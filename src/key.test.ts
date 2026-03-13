import type { QueryKey } from '@tanstack/react-query'
import { describe, expect, it } from 'vite-plus/test'
import { buildKey } from './key'

describe('buildKey', () => {
  it('should build a query key with type "query" and valid input', () => {
    const path = ['user', 'profile']
    const input = { userId: 1 }
    const result: QueryKey = buildKey(path, { type: 'query', input })
    expect(result).toEqual([path, { type: 'query', input }])
  })

  it('should build a query key with type "query" and no input', () => {
    const path = ['user', 'profile']
    const result: QueryKey = buildKey(path, { type: 'query' })
    expect(result).toEqual([path, { type: 'query' }])
  })

  it('should build a query key with type "mutation" and no input', () => {
    const path = ['user', 'update']
    const result: QueryKey = buildKey(path, { type: 'mutation' })
    expect(result).toEqual([path, { type: 'mutation' }])
  })

  it('should handle unexpected input types gracefully', () => {
    const path = ['user', 'profile']
    const resultWithNull: QueryKey = buildKey(path, {
      type: 'query',
      input: null,
    })
    expect(resultWithNull).toEqual([path, { type: 'query', input: null }])

    const resultWithUndefined: QueryKey = buildKey(path, {
      type: 'query',
      input: undefined,
    })
    expect(resultWithUndefined).toEqual([path, { type: 'query' }])
  })
})
