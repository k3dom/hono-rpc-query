---
'hono-rpc-query': minor
---

Type `HonoResponseError` from the endpoint's declared error responses.

The error of `queryOptions()` and `mutationOptions()` was always `Error`, so `error.data` was `unknown` even when the route declared its error bodies. `HonoResponseError` now takes the status and body as type parameters, and each endpoint's error is a union of its 4xx and 5xx responses, with JSON bodies typed, plus `Error` for network failures. `instanceof HonoResponseError` narrows to those responses, and checking `error.status` narrows `error.data`. This reaches `onError`, `useQuery` and `useMutation`.

`queryOptions()` now also accepts a `select` that changes the data type, and returns the TanStack options it was given in its type. Its `queryKey` is tagged with the data and error types, so `queryClient.getQueryData(queryKey)` is typed.
