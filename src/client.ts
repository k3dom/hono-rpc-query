import type {
  DefaultError,
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
import type { SuccessStatusCode } from 'hono/utils/http-status'
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

  return (await res.json()) as TData
}

export interface QueryEndpoint<TEndpoint extends ClientRequestEndpoint> {
  call: TEndpoint
  queryOptions: (
    args: Omit<
      UseQueryOptions<SuccessResponse<TEndpoint>>,
      'queryKey' | 'queryFn'
    > & {
      abortOnCancel?: boolean
    } & ({} extends InferRequestType<TEndpoint>
        ? { input?: undefined }
        : { input: InferRequestType<TEndpoint> })
  ) => {
    queryKey: QueryKey
    queryFn: (opts: QueryFunctionContext) => Promise<SuccessResponse<TEndpoint>>
  }
  mutationOptions: (
    args: Omit<
      UseMutationOptions<
        SuccessResponse<TEndpoint>,
        DefaultError,
        InferRequestType<TEndpoint>
      >,
      'mutationKey' | 'mutationFn'
    >
  ) => {
    mutationKey: QueryKey
    mutationFn: (
      input: InferRequestType<TEndpoint>
    ) => Promise<SuccessResponse<TEndpoint>>
  }
}

function createHcQueryEndpoint<TEndpoint extends ClientRequestEndpoint>(
  endpoint: TEndpoint,
  path: string[]
): QueryEndpoint<TEndpoint> {
  return {
    call: endpoint,
    queryOptions(args) {
      const { input, abortOnCancel = false, ...rest } = args
      return {
        ...rest,
        queryKey: buildKey(path, {
          type: 'query',
          input: input,
        }),
        queryFn: async (context) => {
          const res = abortOnCancel
            ? await endpoint(input, { init: { signal: context.signal } })
            : await endpoint(input)
          return parseResponse<SuccessResponse<TEndpoint>>(res)
        },
      }
    },
    mutationOptions(args) {
      return {
        ...args,
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
    : T[K] extends object
      ? QueryClient<T[K]>
      : T[K]
}

export function hcQuery<T extends object>(obj: T) {
  const createProxy = (target: T, path: string[] = []): QueryClient<T> => {
    return new Proxy(target, {
      get(target, prop, reciever) {
        const value = Reflect.get(target, prop, reciever)
        if (typeof prop !== 'string' || prop === 'then') {
          return value
        }

        const nextPath = [...path, prop]
        if (['$get', '$post', '$put', '$patch', '$delete'].includes(prop)) {
          return createHcQueryEndpoint(value as ClientRequestEndpoint, nextPath)
        }

        return createProxy(value as T, nextPath)
      },
    }) as QueryClient<T>
  }

  return createProxy(obj)
}
