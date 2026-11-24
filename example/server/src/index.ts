import { serve } from '@hono/node-server'
import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { z } from 'zod'

const posts = [
  { id: 1, title: 'Hello World', content: 'This is my first post!' },
  { id: 2, title: 'Learning Hono', content: 'Hono is a fast web framework.' },
  { id: 3, title: 'React Query', content: 'Data fetching made easy.' },
]

let nextId = 4

const app = new Hono()
app.use(cors(), logger())

const routes = app
  .get('/posts', (c) => {
    return c.json(posts, 200)
  })
  .get(
    '/posts/:id',
    zValidator(
      'param',
      z.object({
        id: z.coerce.number(),
      })
    ),
    (c) => {
      const { id } = c.req.valid('param')
      const post = posts.find((p) => p.id === id)
      if (!post) {
        return c.notFound()
      }
      return c.json(post, 200)
    }
  )
  .post(
    '/posts',
    zValidator(
      'json',
      z.object({
        title: z.string().min(1),
        content: z.string().min(1),
      })
    ),
    (c) => {
      const { title, content } = c.req.valid('json')
      const newPost = { id: nextId++, title, content }
      posts.push(newPost)
      return c.json(newPost, 201)
    }
  )
  .put(
    '/posts/:id',
    zValidator(
      'param',
      z.object({
        id: z.coerce.number(),
      })
    ),
    zValidator(
      'json',
      z.object({
        title: z.string().min(1),
        content: z.string().min(1),
      })
    ),
    (c) => {
      const { id } = c.req.valid('param')
      const { title, content } = c.req.valid('json')
      const index = posts.findIndex((p) => p.id === id)
      if (index === -1) {
        return c.notFound()
      }
      posts[index] = { id, title, content }
      return c.json(posts[index], 200)
    }
  )
  .patch(
    '/posts/:id',
    zValidator(
      'param',
      z.object({
        id: z.coerce.number(),
      })
    ),
    zValidator(
      'json',
      z.object({
        title: z.string().min(1).optional(),
        content: z.string().min(1).optional(),
      })
    ),
    (c) => {
      const { id } = c.req.valid('param')
      const updates = c.req.valid('json')
      const post = posts.find((p) => p.id === id)
      if (!post) {
        return c.notFound()
      }
      if (updates.title) post.title = updates.title
      if (updates.content) post.content = updates.content
      return c.json(post, 200)
    }
  )
  .delete(
    '/posts/:id',
    zValidator(
      'param',
      z.object({
        id: z.coerce.number(),
      })
    ),
    (c) => {
      const { id } = c.req.valid('param')
      const index = posts.findIndex((p) => p.id === id)
      if (index === -1) {
        return c.notFound()
      }
      const deleted = posts.splice(index, 1)[0]
      return c.json(deleted, 200)
    }
  )

// Export the type for the client
export type AppRoutes = typeof routes

const port = 3001
console.log(`Server is running on http://localhost:${port}`)

serve({
  fetch: app.fetch,
  port,
})
