import {
  QueryClient,
  QueryObserver,
  type QueryFunctionContext,
} from '@tanstack/react-query'
import { Hono } from 'hono'
import { hc } from 'hono/client'
import type { ClientRequestOptions, ClientResponse } from 'hono/client'
import { describe, expect, it, vi } from 'vite-plus/test'
import { hcQuery } from './client'
import { HonoResponseError } from './error'

function createEndpoint<TResponse>(response: TResponse) {
  return vi.fn(async (_input: unknown, _options?: ClientRequestOptions) => {
    return {
      ok: true,
      status: 200,
      json: async () => response,
    } as ClientResponse<TResponse>
  })
}

function createDeferredEndpoint<TResponse>(response: Promise<TResponse>) {
  return vi.fn(async (_input: unknown, _options?: ClientRequestOptions) => {
    return {
      ok: true,
      status: 200,
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

const app = new Hono()
  .get('/posts', (c) => c.json([{ id: 1 }]))
  .get('/missing', (c) => c.json({ error: 'not found' }, 404))
  .get('/boom', (c) => c.text('Internal Server Error', 500))
  .get('/empty-error', (c) => c.body(null, 503))
  .post('/posts', (c) => c.json({ error: 'invalid' }, 422))
  .delete('/posts/:id', (c) => c.body(null, 204))

const api = hcQuery(hc<typeof app>('http://api.test', { fetch: app.request }))

describe('non-2xx responses', () => {
  it('throws HonoResponseError with the parsed json body', async () => {
    const error = await api.missing.$get
      .queryOptions({})
      .queryFn(createQueryContext(new AbortController().signal))
      .catch((thrown: unknown) => thrown)

    expect(error).toBeInstanceOf(HonoResponseError)
    expect(error).toMatchObject({
      name: 'HonoResponseError',
      message: 'Request failed with status 404',
      status: 404,
      data: { error: 'not found' },
    })
    expect((error as HonoResponseError).response.status).toBe(404)
  })

  it('falls back to the raw text for non-json error bodies', async () => {
    const error = await api.boom.$get
      .queryOptions({})
      .queryFn(createQueryContext(new AbortController().signal))
      .catch((thrown: unknown) => thrown)

    expect(error).toBeInstanceOf(HonoResponseError)
    expect(error).toMatchObject({ status: 500, data: 'Internal Server Error' })
  })

  it('leaves data undefined for an empty error body', async () => {
    const error = await api['empty-error'].$get
      .queryOptions({})
      .queryFn(createQueryContext(new AbortController().signal))
      .catch((thrown: unknown) => thrown)

    expect(error).toBeInstanceOf(HonoResponseError)
    expect((error as HonoResponseError).data).toBeUndefined()
  })

  it('throws from mutationFn as well', async () => {
    const error = await api.posts.$post
      .mutationOptions({})
      .mutationFn({})
      .catch((thrown: unknown) => thrown)

    expect(error).toBeInstanceOf(HonoResponseError)
    expect(error).toMatchObject({ status: 422, data: { error: 'invalid' } })
  })

  it('surfaces the error through a TanStack query', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })

    await expect(
      queryClient.fetchQuery(api.missing.$get.queryOptions({}))
    ).rejects.toBeInstanceOf(HonoResponseError)

    queryClient.clear()
  })
})

describe('2xx responses', () => {
  it('resolves the parsed body', async () => {
    await expect(
      api.posts.$get
        .queryOptions({})
        .queryFn(createQueryContext(new AbortController().signal))
    ).resolves.toEqual([{ id: 1 }])
  })

  it('resolves null for no-content responses', async () => {
    await expect(
      api.posts[':id'].$delete.mutationOptions({}).mutationFn({
        param: { id: '1' },
      })
    ).resolves.toBeNull()
  })
})
