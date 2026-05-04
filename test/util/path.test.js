/**
 * Unit tests for the path sanitization utility.
 */
import path from 'node:path'
import {sanitizePath} from '../../src/util/path.js'

describe('sanitizePath', () => {
  test('should resolve a relative path to absolute', () => {
    const result = sanitizePath('foo/bar.json')
    expect(path.isAbsolute(result)).toBe(true)
    expect(result).toBe(path.resolve('foo/bar.json'))
  })

  test('should return the same value for an already absolute path', () => {
    const absPath = '/tmp/reports/output.csv'
    const result = sanitizePath(absPath)
    expect(result).toBe(path.resolve(absPath))
  })

  test('should normalize path traversal sequences', () => {
    const result = sanitizePath('/tmp/reports/../secrets/output.json')
    expect(result).toBe(path.resolve('/tmp/secrets/output.json'))
    expect(result).not.toContain('..')
  })

  test('should throw on null bytes', () => {
    expect(() => sanitizePath('/tmp/reports/\0malicious')).toThrow('Path must not contain null bytes')
  })

  test('should throw on non-string input', () => {
    expect(() => sanitizePath(123)).toThrow('Path must be a string')
    expect(() => sanitizePath(null)).toThrow('Path must be a string')
    expect(() => sanitizePath(undefined)).toThrow('Path must be a string')
  })
})
