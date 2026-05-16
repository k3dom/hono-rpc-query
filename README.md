# 🔥 hono-rpc-query

Eliminates boilerplate when integrating Hono's RPC client with TanStack React Query by automatically generating type-safe `queryOptions` and `mutationOptions` for all your endpoints.

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

  // Fetch all posts - note the empty object {} is required even with no input
  const postsQuery = useQuery(api.posts.$get.queryOptions({}))

  // Create post mutation - pass options directly to mutationOptions()
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

**Important:** You must always pass an object to `queryOptions()`, even when there are no input arguments. Pass an empty object `{}` if no input is needed.

#### Usage with no input

```typescript
// Endpoint with no parameters
const options = api.posts.$get.queryOptions({})
// Returns: { queryKey: [...], queryFn: ... }

useQuery(options)
```

#### Usage with input parameters

```typescript
// Endpoint with path parameters
const options = api.posts[':id'].$get.queryOptions({
  input: {
    param: { id: '1' },
  },
})

useQuery(options)
```

#### Usage with json parameters

```typescript
// Endpoint with query string
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
  input: { param: { id: 1 } },
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
  input: { param: { id: 1 } },
  abortOnCancel: true,
})
```

### `mutationOptions(config)`

Generates TanStack Query options for POST, PUT, DELETE requests. Returns an object with `mutationKey` and `mutationFn`.

**Important:** You must always pass an object to `mutationOptions()`, even when configuring no additional options. Pass an empty object `{}` if no config is needed.

#### Basic usage

```typescript
// Always pass an object, even if empty
const mutation = useMutation(api.posts.$post.mutationOptions({}))

// Call the mutation with input
mutation.mutate({ json: { title: 'New Post', content: 'Content' } })
```

#### Usage with callbacks

Pass additional mutation options directly to `mutationOptions()`:

```typescript
const mutation = useMutation(
  api.posts.$post.mutationOptions({
    onSuccess: (data) => {
      console.log('Created:', data)
    },
    onError: (error) => {
      console.error('Failed:', error)
    },
  })
)
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

// Call with parameters
deleteMutation.mutate({ param: { id: '1' } })
```

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
  input: { param: { id: 1 } },
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

## License

[MIT](https://choosealicense.com/licenses/mit/)
