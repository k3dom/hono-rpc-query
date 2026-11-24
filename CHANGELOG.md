# hono-rpc-query

## 3.1.0

### Minor Changes

- effe2c1: Fix text responses and non-standard methods, and make options optional.
  
  - Success responses are parsed by content type, as in `hono/client`'s `parseResponse`. Endpoints returning `c.text()` used to reject with a `SyntaxError`.
  - Every `$`-prefixed request method is wrapped, including `$options` and custom methods from `app.on()`. Only `$get`, `$post`, `$put`, `$patch` and `$delete` worked before.
  - `$url`, `$path` and `$ws` keep their hono client types and can be called.
  - `queryOptions()` and `mutationOptions()` no longer need an empty `{}` when the endpoint requires no input, and such mutations can run with `mutate()`.
  - `input` can be passed to endpoints whose input is all optional.
- 60af1c7: Type `HonoResponseError` from the endpoint's declared error responses.
  
  The error of `queryOptions()` and `mutationOptions()` was always `Error`, so `error.data` was `unknown` even when the route declared its error bodies. `HonoResponseError` now takes the status and body as type parameters, and each endpoint's error is a union of its 4xx and 5xx responses, with JSON bodies typed, plus `Error` for network failures. `instanceof HonoResponseError` narrows to those responses, and checking `error.status` narrows `error.data`. This reaches `onError`, `useQuery` and `useMutation`.
  
  `queryOptions()` now also accepts a `select` that changes the data type, and returns the TanStack options it was given in its type. Its `queryKey` is tagged with the data and error types, so `queryClient.getQueryData(queryKey)` is typed.

## 3.0.0

### Major Changes

- 0f9dc36: Throw `HonoResponseError` on non-2xx responses.

  `queryFn` and `mutationFn` resolved with whatever `res.json()` returned, so a 4xx was cached as successful data and a failed mutation ran `onSuccess`. Error bodies that were not json threw a bare `SyntaxError` with no status attached, and 204 responses failed to parse at all.

  Non-2xx responses now reject with `HonoResponseError`, carrying the status, the parsed body and the original response. Query data is narrowed to the endpoint's success statuses, and 204/205 responses resolve to `null`.

  To migrate:

  - Failure checks on `data` (`if ('error' in data)`, `Array.isArray(data)`) become `error instanceof HonoResponseError`, and the payload moves to `error.data`.
  - Failed mutations run `onError` instead of `onSuccess`.
  - 4xx responses are now retried by default; set a retry predicate on your `QueryClient` to skip them.

# [2.0.0](https://github.com/k3dom/hono-rpc-query/compare/v1.5.1...v2.0.0) (2026-05-16)

- fix!: make query cancellation opt-in ([#62](https://github.com/k3dom/hono-rpc-query/issues/62)) ([2b0d948](https://github.com/k3dom/hono-rpc-query/commit/2b0d948122df8a26a4a3f84844da6f3163cf6fac))

### BREAKING CHANGES

- queryOptions no longer passes TanStack Query's AbortSignal to Hono requests by default. Use abortOnCancel: true to preserve automatic request abortion on query cancellation.

## [1.5.1](https://github.com/k3dom/hono-rpc-query/compare/v1.5.0...v1.5.1) (2026-03-13)

### Bug Fixes

- **deps:** update dependency @hono/zod-validator to ^0.7.0 ([#32](https://github.com/k3dom/hono-rpc-query/issues/32)) ([32e8d93](https://github.com/k3dom/hono-rpc-query/commit/32e8d939d0cb60641ad1f9ed3cc0c4085524ec87))
- **deps:** update dependency zod to v4 ([#35](https://github.com/k3dom/hono-rpc-query/issues/35)) ([fe56acd](https://github.com/k3dom/hono-rpc-query/commit/fe56acdb0a2d2b4c2950f82ce1877eb4e0bd4512))

# [1.5.0](https://github.com/kedom1337/hono-rpc-query/compare/v1.4.0...v1.5.0) (2026-01-09)

### Features

- add support for PATCH method ([#11](https://github.com/kedom1337/hono-rpc-query/issues/11)) ([296d83a](https://github.com/kedom1337/hono-rpc-query/commit/296d83a9a0a212805d382fab7299b6047d67e5d7))

# [1.4.0](https://github.com/kedom1337/hono-rpc-query/compare/v1.3.0...v1.4.0) (2025-12-23)

### Features

- update dependencies for release ([c6fd977](https://github.com/kedom1337/hono-rpc-query/commit/c6fd9771382fd7363089e99e67e59e601e1b699a))

# [1.3.0](https://github.com/kedom1337/hono-rpc-query/compare/v1.2.0...v1.3.0) (2025-12-23)

### Features

- update dependencies for release ([ef21b2c](https://github.com/kedom1337/hono-rpc-query/commit/ef21b2c0e74dfc23384576026ffd9f88f5668668))

# [1.2.0](https://github.com/kedom1337/hono-rpc-query/compare/v1.1.0...v1.2.0) (2025-06-24)

### Features

- switch from tsup to tsdown ([ff75a3d](https://github.com/kedom1337/hono-rpc-query/commit/ff75a3d4cbdb42f01f51a34637bc25c961afeab1))

# [1.1.0](https://github.com/kedom1337/hono-rpc-query/compare/v1.0.0...v1.1.0) (2025-05-14)

### Features

- updated package dependencies ([d0829c0](https://github.com/kedom1337/hono-rpc-query/commit/d0829c0cd7a6149568c08211ad42065304c2c1f3))

# 1.0.0 (2025-05-14)

### Bug Fixes

- properly await `res.json()` in `mutationFn` ([19efdb9](https://github.com/kedom1337/hono-rpc-query/commit/19efdb9819eeda32f555ff52f7a08b07b4a40258))
