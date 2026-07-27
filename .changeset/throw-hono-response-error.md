---
'hono-rpc-query': major
---

Throw `HonoResponseError` on non-2xx responses.

`queryFn` and `mutationFn` resolved with whatever `res.json()` returned, so a 4xx was cached as successful data and a failed mutation ran `onSuccess`. Error bodies that were not json threw a bare `SyntaxError` with no status attached, and 204 responses failed to parse at all.

Non-2xx responses now reject with `HonoResponseError`, carrying the status, the parsed body and the original response. Query data is narrowed to the endpoint's success statuses, and 204/205 responses resolve to `null`.

To migrate:

- Failure checks on `data` (`if ('error' in data)`, `Array.isArray(data)`) become `error instanceof HonoResponseError`, and the payload moves to `error.data`.
- Failed mutations run `onError` instead of `onSuccess`.
- 4xx responses are now retried by default; set a retry predicate on your `QueryClient` to skip them.
