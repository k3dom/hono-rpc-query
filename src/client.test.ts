import {
  QueryClient,
  QueryObserver,
  type QueryFunctionContext,
} from '@tanstack/react-query'
import type { ClientRequestOptions, ClientResponse } from 'hono/client'
import { describe, expect, it, vi } from 'vite-plus/test'
import { hcQuery } from './client'

function createEndpoint<TResponse>(response: TResponse) {
  return vi.fn(async (_input: unknown, _options?: ClientRequestOptions) => {
    return {
      json: async () => response,
    } as ClientResponse<TResponse>
  })
}

function createDeferredEndpoint<TResponse>(response: Promise<TResponse>) {
  return vi.fn(async (_input: unknown, _options?: ClientRequestOptions) => {
    return {
      json: () => response,
    } as ClientResponse<TResponse>
  })
}

function createQueryContext(signal: AbortSignal): QueryFunctionContext {
  return {
    queryKey: [],
    get signal() {
      return signal
    },
  } as unknown as QueryFunctionContext
}

function createDeferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve
    reject = promiseReject
  })

  return { promise, resolve, reject }
}

describe('hcQuery', () => {
  it('does not consume or pass the abort signal by default', async () => {
    const response = { ok: true }
    const endpoint = createEndpoint(response)
    const api = hcQuery({ posts: { $get: endpoint } })
    const abortController = new AbortController()
    let signalRead = false
    const context = {
      queryKey: [],
      get signal() {
        signalRead = true
        return abortController.signal
      },
    } as unknown as QueryFunctionContext

    const options = api.posts.$get.queryOptions({})
    await expect(options.queryFn(context)).resolves.toEqual(response)

    expect(signalRead).toBe(false)
    expect(endpoint).toHaveBeenCalledWith(undefined)
  })

  it('keeps fetchQuery in flight when an observer unsubscribes by default', async () => {
    const response = { ok: true }
    const deferred = createDeferred<typeof response>()
    const endpoint = createDeferredEndpoint(deferred.promise)
    const api = hcQuery({ posts: { $get: endpoint } })
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    const options = api.posts.$get.queryOptions({})

    const fetchPromise = queryClient.fetchQuery(options)
    const observer = new QueryObserver(queryClient, options)
    const unsubscribe = observer.subscribe(() => undefined)

    unsubscribe()
    deferred.resolve(response)

    await expect(fetchPromise).resolves.toEqual(response)
    expect(endpoint).toHaveBeenCalledTimes(1)
    queryClient.clear()
  })

  it('passes the abort signal when abortOnCancel is true', async () => {
    const response = { ok: true }
    const endpoint = createEndpoint(response)
    const api = hcQuery({ posts: { $get: endpoint } })
    const abortController = new AbortController()

    const options = api.posts.$get.queryOptions({ abortOnCancel: true })
    await expect(
      options.queryFn(createQueryContext(abortController.signal))
    ).resolves.toEqual(response)

    expect(endpoint).toHaveBeenCalledWith(undefined, {
      init: { signal: abortController.signal },
    })
  })

  it('omits abortOnCancel from the returned TanStack query options', () => {
    const endpoint = createEndpoint({ ok: true })
    const api = hcQuery({ posts: { $get: endpoint } })

    const options = api.posts.$get.queryOptions({
      abortOnCancel: true,
      staleTime: 1_000,
    })

    expect(options).not.toHaveProperty('abortOnCancel')
    expect(options).toHaveProperty('staleTime', 1_000)
  })
})
