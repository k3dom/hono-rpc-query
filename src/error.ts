export class HonoResponseError<
  TStatus extends number = number,
  TData = unknown,
> extends Error {
  override readonly name = 'HonoResponseError'

  // Without this, instanceof turns the `Error` member of a query's error union
  // into HonoResponseError<any, any>, which swallows the typed members.
  static override [Symbol.hasInstance]<T>(
    value: T
  ): value is [Extract<T, HonoResponseError>] extends [never]
    ? T & HonoResponseError
    : Extract<T, HonoResponseError> {
    return Function.prototype[Symbol.hasInstance].call(this, value)
  }

  readonly status: TStatus

  /** Parsed json, the raw text when the body was not json, undefined when empty. */
  readonly data: TData

  /** Body is already consumed to build {@link data}; only metadata is usable. */
  readonly response: Response

  constructor(response: Response & { status: TStatus }, data: TData) {
    // Omit the url so error trackers group by status.
    super(`Request failed with status ${response.status}`)
    this.status = response.status
    this.data = data
    this.response = response
  }
}
