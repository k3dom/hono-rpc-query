# hono-rpc-query Example

A minimal example demonstrating how to use `hono-rpc-query` to integrate Hono RPC with React Query.

## Structure

- `server/` - Hono backend with REST API endpoints
- `client/` - React frontend using React Query

## Running the Example

### 1. Install Dependencies

From the root of the repository, build the library first:

```bash
vp install
vp pack
```

Then install dependencies for the example:

```bash
cd example/server && pnpm install
cd ../client && pnpm install
```

### 2. Start the Server

```bash
cd example/server
pnpm dev
```

The server will start on http://localhost:3001

### 3. Start the Client

In a new terminal:

```bash
cd example/client
pnpm dev
```

The client will start on http://localhost:5173

## How It Works

### Server (`server/src/index.ts`)

The server defines a simple REST API with CRUD operations for posts:

- `GET /posts` - List all posts
- `GET /posts/:id` - Get a single post
- `POST /posts` - Create a new post
- `DELETE /posts/:id` - Delete a post

The route type is exported for the client to use:

```typescript
export type AppRoutes = typeof routes
```

### Client (`client/src/api.ts`)

The client creates a Hono RPC client and wraps it with `hcQuery`:

```typescript
import { hc } from 'hono/client'
import { hcQuery } from 'hono-rpc-query'
import type { AppRoutes } from '../../server/src/index'

const client = hc<AppRoutes>('http://localhost:3001')
export const api = hcQuery(client)
```

### Using with React Query (`client/src/App.tsx`)

The `api` object provides `queryOptions` and `mutationOptions` for all endpoints:

```typescript
// Queries - pass options directly to queryOptions
const postsQuery = useQuery(api.posts.$get.queryOptions({}))

// Mutations - pass options directly to mutationOptions
const createMutation = useMutation(
  api.posts.$post.mutationOptions({
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: api.posts.$get.queryOptions({}).queryKey,
      })
    },
  })
)

// With path parameters
const deleteMutation = useMutation(
  api.posts[':id'].$delete.mutationOptions({
    onSuccess: () => {
      // Handle success
    },
  })
)
deleteMutation.mutate({ param: { id: '1' } })
```
