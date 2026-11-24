---
'hono-rpc-query': minor
---

Fix text responses and non-standard methods, and make options optional.

- Success responses are parsed by content type, as in `hono/client`'s `parseResponse`. Endpoints returning `c.text()` used to reject with a `SyntaxError`.
- Every `$`-prefixed request method is wrapped, including `$options` and custom methods from `app.on()`. Only `$get`, `$post`, `$put`, `$patch` and `$delete` worked before.
- `$url`, `$path` and `$ws` keep their hono client types and can be called.
- `queryOptions()` and `mutationOptions()` no longer need an empty `{}` when the endpoint requires no input, and such mutations can run with `mutate()`.
- `input` can be passed to endpoints whose input is all optional.
