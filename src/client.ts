import type {
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
import { buildKey } from './key'

type ClientRequestEndpoint = (
  args: any,
  options?: ClientRequestOptions
) => Promise<ClientResponse<unknown>>

export interface QueryEndpoint<TEndpoint extends ClientRequestEndpoint> {
  call: TEndpoint
  queryOptions: (
    args: Omit<
      UseQueryOptions<InferResponseType<TEndpoint>>,
      'queryKey' | 'queryFn'
    > & {
      abortOnCancel?: boolean
    } & ({} extends InferRequestType<TEndpoint>
        ? { input?: undefined }
        : { input: InferRequestType<TEndpoint> })
  ) => {
    queryKey: QueryKey
    queryFn: (opts: QueryFunctionContext) => Promise<InferResponseType<TEndpoint>>
  }
  mutationOptions: (
    args: Omit<
      UseMutationOptions<
        InferResponseType<TEndpoint>,
        Error,
        InferRequestType<TEndpoint>
      >,
      'mutationKey' | 'mutationFn'
    >
  ) => {
    mutationKey: QueryKey
    mutationFn: (
      input: InferRequestType<TEndpoint>
    ) => Promise<InferResponseType<TEndpoint>>
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
          return (await res.json()) as InferResponseType<TEndpoint>
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
          return (await res.json()) as InferResponseType<TEndpoint>
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
