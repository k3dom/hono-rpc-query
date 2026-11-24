import type {
  DataTag,
  QueryFunctionContext,
  QueryKey,
  UseMutationOptions,
  UseQueryOptions,
} from '@tanstack/react-query'
import type {
  ClientRequestOptions,
  ClientResponse,
  InferRequestType,
  InferResponseType,
} from 'hono/client'
import type {
  ClientErrorStatusCode,
  ServerErrorStatusCode,
  SuccessStatusCode,
} from 'hono/utils/http-status'
import { HonoResponseError } from './error'
import { buildKey } from './key'

type ClientRequestEndpoint = (
  args: any,
  options?: ClientRequestOptions
) => Promise<ClientResponse<unknown>>

type SuccessResponse<TEndpoint extends ClientRequestEndpoint> = InferResponseType<
  TEndpoint,
  SuccessStatusCode
>

type EndpointError<TEndpoint extends ClientRequestEndpoint> =
  | (Awaited<ReturnType<TEndpoint>> extends infer TResponse
      ? TResponse extends ClientResponse<infer TBody, infer TStatus, infer TFormat>
        ? [Extract<TStatus, ClientErrorStatusCode | ServerErrorStatusCode>] extends [
            never,
          ]
          ? never
          : HonoResponseError<
              Extract<TStatus, ClientErrorStatusCode | ServerErrorStatusCode>,
              TFormat extends 'json' ? TBody : unknown
            >
        : never
      : never)
  | Error

async function parseResponse<TData>(res: ClientResponse<unknown>): Promise<TData> {
  if (!res.ok) {
    // A failed json() drains the body, leaving nothing to report for html pages.
    const raw = await res.text()
    let data: unknown
    try {
      data = JSON.parse(raw)
    } catch {
      data = raw || undefined
    }

    throw new HonoResponseError(res as unknown as Response, data)
  }

  // json() throws on an empty body, and TanStack Query rejects undefined as data.
  if (res.status === 204 || res.status === 205) {
    return null as TData
  }

  // Same detection as hono/client's parseResponse.
  const contentType = res.headers.get('content-type')?.split(';')[0] ?? ''
  const isJson = /^application\/(?:[\w!#$%&*.^`~-]*\+)?json$/i.test(contentType)
  return (isJson ? await res.json() : await res.text()) as TData
}

type QueryOptionsArgs<TEndpoint extends ClientRequestEndpoint, TData> = Omit<
  UseQueryOptions<SuccessResponse<TEndpoint>, EndpointError<TEndpoint>, TData>,
  'queryKey' | 'queryFn'
> & {
  abortOnCancel?: boolean
} & ({} extends InferRequestType<TEndpoint>
    ? { input?: InferRequestType<TEndpoint> }
    : { input: InferRequestType<TEndpoint> })

type MutationVariables<TEndpoint extends ClientRequestEndpoint> =
  {} extends InferRequestType<TEndpoint>
    ? InferRequestType<TEndpoint> | void
    : InferRequestType<TEndpoint>

export interface QueryEndpoint<TEndpoint extends ClientRequestEndpoint> {
  call: TEndpoint
  queryOptions: <TData = SuccessResponse<TEndpoint>>(
    ...args: {} extends InferRequestType<TEndpoint>
      ? [options?: QueryOptionsArgs<TEndpoint, TData>]
      : [options: QueryOptionsArgs<TEndpoint, TData>]
  ) => Omit<
    UseQueryOptions<SuccessResponse<TEndpoint>, EndpointError<TEndpoint>, TData>,
    // Its pageParam context conflicts with fetchQuery's before react-query 5.102.
    'persister'
  > & {
    queryKey: DataTag<QueryKey, SuccessResponse<TEndpoint>, EndpointError<TEndpoint>>
    queryFn: (opts: QueryFunctionContext) => Promise<SuccessResponse<TEndpoint>>
  }
  mutationOptions: (
    options?: Omit<
      UseMutationOptions<
        SuccessResponse<TEndpoint>,
        EndpointError<TEndpoint>,
        MutationVariables<TEndpoint>
      >,
      'mutationKey' | 'mutationFn'
    >
  ) => UseMutationOptions<
    SuccessResponse<TEndpoint>,
    EndpointError<TEndpoint>,
    MutationVariables<TEndpoint>
  > & {
    mutationKey: QueryKey
    mutationFn: (
      input: MutationVariables<TEndpoint>
    ) => Promise<SuccessResponse<TEndpoint>>
  }
}

function createHcQueryEndpoint<TEndpoint extends ClientRequestEndpoint>(
  endpoint: TEndpoint,
  path: string[]
): QueryEndpoint<TEndpoint> {
  return {
    call: endpoint,
    queryOptions(...[options]) {
      const { input, abortOnCancel = false, ...rest } = options ?? {}
      return {
        ...rest,
        queryKey: buildKey(path, {
          type: 'query',
          input: input,
        }) as DataTag<
          QueryKey,
          SuccessResponse<TEndpoint>,
          EndpointError<TEndpoint>
        >,
        queryFn: async (context) => {
          const res = abortOnCancel
            ? await endpoint(input, { init: { signal: context.signal } })
            : await endpoint(input)
          return parseResponse<SuccessResponse<TEndpoint>>(res)
        },
      }
    },
    mutationOptions(options) {
      return {
        ...options,
        mutationKey: buildKey(path, {
          type: 'mutation',
        }),
        mutationFn: async (input) => {
          const res = await endpoint(input)
          return parseResponse<SuccessResponse<TEndpoint>>(res)
        },
      }
    },
  }
}

type QueryClient<T> = {
  [K in keyof T]: T[K] extends ClientRequestEndpoint
    ? QueryEndpoint<T[K]>
    : T[K] extends (...args: any) => any
      ? T[K]
      : T[K] extends object
        ? QueryClient<T[K]>
        : T[K]
}

export function hcQuery<T extends object>(obj: T) {
  const createProxy = (target: T, path: string[] = []): QueryClient<T> => {
    return new Proxy(target, {
      get(target, prop, receiver) {
        const value = Reflect.get(target, prop, receiver)
        if (typeof prop !== 'string' || prop === 'then') {
          return value
        }

        const nextPath = [...path, prop]
        // hc sends a request for every $-prefixed key except these.
        if (['$url', '$path', '$ws'].includes(prop)) {
          return value
        }
        if (prop.startsWith('$')) {
          return createHcQueryEndpoint(value as ClientRequestEndpoint, nextPath)
        }

        return createProxy(value as T, nextPath)
      },
    }) as QueryClient<T>
  }

  return createProxy(obj)
}
