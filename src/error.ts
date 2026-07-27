export class HonoResponseError extends Error {
  override readonly name = 'HonoResponseError'

  readonly status: number

  /** Parsed json, the raw text when the body was not json, undefined when empty. */
  readonly data: unknown

  /** Body is already consumed to build {@link data}; only metadata is usable. */
  readonly response: Response

  constructor(response: Response, data: unknown) {
    // Omit the url so error trackers group by status.
    super(`Request failed with status ${response.status}`)
    this.status = response.status
    this.data = data
    this.response = response
  }
}
