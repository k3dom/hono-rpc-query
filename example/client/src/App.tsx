import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { api } from './api'

function App() {
  const queryClient = useQueryClient()
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')

  // Fetch all posts using queryOptions from hono-rpc-query
  const postsQuery = useQuery(api.posts.$get.queryOptions({}))

  // Create post mutation using mutationOptions from hono-rpc-query
  const createMutation = useMutation(
    api.posts.$post.mutationOptions({
      onSuccess: async () => {
        // Invalidate and refetch posts after creating
        // using the queryKey from queryOptions
        await queryClient.invalidateQueries({
          queryKey: api.posts.$get.queryOptions({}).queryKey,
        })
        setTitle('')
        setContent('')
      },
    })
  )

  // Delete post mutation
  const deleteMutation = useMutation(
    api.posts[':id'].$delete.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries({
          queryKey: api.posts.$get.queryOptions({}).queryKey,
        })
      },
    })
  )

  const handleSubmit = (e: React.SubmitEvent) => {
    e.preventDefault()
    if (title && content) {
      createMutation.mutate({ json: { title, content } })
    }
  }

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', padding: '20px' }}>
      <h1>hono-rpc-query Example</h1>

      <form onSubmit={handleSubmit} style={{ marginBottom: '20px' }}>
        <h2>Create New Post</h2>
        <div style={{ marginBottom: '10px' }}>
          <input
            type="text"
            placeholder="Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            style={{ width: '100%', padding: '8px' }}
          />
        </div>
        <div style={{ marginBottom: '10px' }}>
          <textarea
            placeholder="Content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            style={{ width: '100%', padding: '8px', minHeight: '80px' }}
          />
        </div>
        <button
          type="submit"
          disabled={createMutation.isPending}
          style={{ padding: '8px 16px' }}
        >
          {createMutation.isPending ? 'Creating...' : 'Create Post'}
        </button>
      </form>

      <h2>Posts</h2>
      {postsQuery.isLoading && <p>Loading posts...</p>}
      {postsQuery.error && <p>Error: {postsQuery.error.message}</p>}
      {postsQuery.data && Array.isArray(postsQuery.data) && (
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {postsQuery.data.map((post) => (
            <li
              key={post.id}
              style={{
                border: '1px solid #ccc',
                padding: '15px',
                marginBottom: '10px',
                borderRadius: '4px',
              }}
            >
              <h3 style={{ margin: '0 0 10px 0' }}>{post.title}</h3>
              <p style={{ margin: '0 0 10px 0' }}>{post.content}</p>
              <button
                onClick={() =>
                  deleteMutation.mutate({ param: { id: String(post.id) } })
                }
                disabled={deleteMutation.isPending}
                style={{ padding: '4px 8px', color: 'red' }}
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default App
