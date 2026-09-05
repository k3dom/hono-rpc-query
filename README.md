# 🔥 hono-rpc-query

[![npm version](https://img.shields.io/npm/v/hono-rpc-query.svg)](https://www.npmjs.com/package/hono-rpc-query)
[![npm downloads](https://img.shields.io/npm/dm/hono-rpc-query.svg)](https://www.npmjs.com/package/hono-rpc-query)
[![license](https://img.shields.io/npm/l/hono-rpc-query.svg)](https://github.com/k3dom/hono-rpc-query/blob/master/LICENSE)

Stop hand-writing TanStack Query `queryFn` wrappers around your Hono RPC client. `hono-rpc-query` bridges the two by generating fully type-safe `queryOptions` and `mutationOptions` for every endpoint.

## Installation

```bash
pnpm add hono-rpc-query
# or
npm install hono-rpc-query
# or
yarn add hono-rpc-query
```

## Quick Start

### 1. Set up your Hono server

```typescript
// server/index.ts
import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'

const app = new Hono()
const routes = app
  .get('/posts', (c) => {
    return c.json([
      { id: 1, title: 'Hello World' },
      { id: 2, title: 'Learning Hono' },
    ])
  })
  .get(
    '/posts/:id',
    zValidator('param', z.object({ id: z.coerce.number() })),
    (c) => {
      const { id } = c.req.valid('param')
      // ... fetch post logic
      return c.json({ id, title: 'Post title' })
    }
  )
  .post(
    '/posts',
    zValidator('json', z.object({ title: z.string(), content: z.string() })),
    (c) => {
      const data = c.req.valid('json')
      // ... create post logic
      return c.json({ id: 3, ...data })
    }
  )

export type AppRoutes = typeof routes
```

### 2. Create the client wrapper

```typescript
// client/api.ts
import { hc } from 'hono/client'
import { hcQuery } from 'hono-rpc-query'
import type { AppRoutes } from '../server'

const client = hc<AppRoutes>('http://localhost:3001')
export const api = hcQuery(client)
```

### 3. Use in your React components

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from './api'

function App() {
  const queryClient = useQueryClient()

  // Fetch all posts
  const postsQuery = useQuery(api.posts.$get.queryOptions({}))

  // Create post mutation and pass options directly to mutationOptions()
  const createPost = useMutation(
    api.posts.$post.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: api.posts.$get.queryOptions({}).queryKey,
        })
      },
    })
  )

  const handleCreate = () => {
    createPost.mutate({ json: { title: 'New Post', content: 'Content' } })
  }

  return <div>{/* ... */}</div>
}
```

## API Reference

### `queryOptions(config)`

Generates TanStack Query options for GET requests. Returns an object with `queryKey` and `queryFn`.

> [!IMPORTANT]
> You must always pass an object to `queryOptions()`, even when there are no input arguments. Pass an empty object `{}` if no input is needed.

#### Usage with no input

```typescript
const options = api.posts.$get.queryOptions({})

useQuery(options)
```

#### Usage with input parameters

```typescript
const options = api.posts[':id'].$get.queryOptions({
  input: {
    param: { id: '1' },
  },
})

useQuery(options)
```

#### Usage with json parameters

```typescript
const options = api.posts.$get.queryOptions({
  input: {
    json: { page: 1, limit: 10 },
  },
})

useQuery(options)
```

#### Additional TanStack Query options

You can pass any TanStack Query options alongside the input:

```typescript
const options = api.posts.$get.queryOptions({
  input: { param: { id: '1' } },
  enabled: true,
  staleTime: 5000,
  refetchOnWindowFocus: false,
})

useQuery(options)
```

#### Query cancellation

By default, `queryOptions()` does not consume TanStack Query's `AbortSignal`, matching TanStack Query's default behavior. If you want requests to be aborted when TanStack Query cancels a query, opt in with `abortOnCancel`:

```typescript
const options = api.posts.$get.queryOptions({
  input: { param: { id: '1' } },
  abortOnCancel: true,
})
```

---

### `mutationOptions(config)`

Generates TanStack Query options for POST, PUT, DELETE requests. Returns an object with `mutationKey` and `mutationFn`.

> [!IMPORTANT]
> You must always pass an object to `mutationOptions()`, even when configuring no additional options. Pass an empty object `{}` if no config is needed.

#### Basic usage

```typescript
const mutation = useMutation(api.posts.$post.mutationOptions({}))

mutation.mutate({ json: { title: 'New Post', content: 'Content' } })
```

#### Usage with callbacks

Pass additional mutation options directly to `mutationOptions()`:

```typescript
const options = api.posts.$post.mutationOptions({
  onSuccess: (data) => {
    console.log('Created:', data)
  },
  onError: (error) => {
    console.error('Failed:', error)
  },
})

const mutation = useMutation(options)
```

#### DELETE request example

```typescript
const deleteMutation = useMutation(
  api.posts[':id'].$delete.mutationOptions({
    onSuccess: () => {
      // Invalidate queries after deletion
      queryClient.invalidateQueries({
        queryKey: api.posts.$get.queryOptions({}).queryKey,
      })
    },
  })
)

deleteMutation.mutate({ param: { id: '1' } })
```

---

### Error handling

Non-2xx responses reject with `HonoResponseError`, so failures reach `error` instead of `data`. `data` is narrowed to the endpoint's success responses, and 204/205 resolve to `null`.

```typescript
import { HonoResponseError } from 'hono-rpc-query'

const { data, error } = useQuery(api.posts[':id'].$get.queryOptions({}))

if (error instanceof HonoResponseError) {
  error.status // 404
  error.data // parsed body: json, raw text, or undefined when empty
  error.response // metadata only, the body is already read
}
```

TanStack Query's default `retry: 3` now applies to 4xx. To skip those, set a predicate on your `QueryClient`:

```typescript
retry: (failureCount, error) =>
  error instanceof HonoResponseError && error.status < 500 ? false : failureCount < 3
```

---

### Accessing Query Keys

You can access the generated query key for cache invalidation or other purposes:

```typescript
// Get the query key
const queryKey = api.posts.$get.queryOptions({}).queryKey

// Use it for invalidation
queryClient.invalidateQueries({ queryKey })

// Use it for setting query data
queryClient.setQueryData(queryKey, newData)

// Use it for getting cached data
const cachedData = queryClient.getQueryData(queryKey)
```

#### Query keys with parameters

```typescript
// Query key includes the input parameters
const queryKey = api.posts[':id'].$get.queryOptions({
  input: { param: { id: '1' } },
}).queryKey

// Invalidate a specific post
queryClient.invalidateQueries({ queryKey })

// Invalidate all posts (partial matching)
queryClient.invalidateQueries({
  queryKey: ['posts'], // Matches all posts-related queries
})
```

## Complete Example

Check out the [example](./example) directory for a full working implementation

## Known Limitations

- No support for `infiniteQueryOptions` (yet)

## Contributing

Pull requests are welcome. For major changes, please open an issue first to discuss what you would like to change.

Please make sure to update tests as appropriate.

Use Node.js 24 LTS and Corepack to select the pinned pnpm version. Alternatively, `nix develop` provides Node, Corepack, and the Nix/workflow linters (Linux x86_64/ARM64 and Apple Silicon).

```bash
pnpm install --frozen-lockfile
pnpm exec vp check
pnpm exec vp test --coverage
pnpm build
nix flake check
```

See the [example instructions](./example/README.md) for the separate client/server checks.

## License

[MIT](https://choosealicense.com/licenses/mit/)
