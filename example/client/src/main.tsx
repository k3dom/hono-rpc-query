import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { HonoResponseError } from 'hono-rpc-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // A 4xx is an answer, not an outage, so only retry server-side failures.
      retry: (failureCount, error) =>
        error instanceof HonoResponseError && error.status < 500
          ? false
          : failureCount < 3,
    },
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>
)
