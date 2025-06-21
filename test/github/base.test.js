/**
 * Unit tests for the GitHub API base class.
 */
import Base from '../../src/github/base.js'

describe('base', () => {
  /**
   * Test that Base class throws error without token.
   */
  test('should throw error when no token provided', () => {
    expect(() => {
      new Base({})
    }).toThrow('GitHub token is required')
  })

  /**
   * Test that Base class initializes with valid token.
   */
  test('should initialize with valid token', () => {
    const base = new Base({
      token: 'test-token',
      debug: false,
    })

    expect(base.logger).toBeDefined()
    expect(base.spinner).toBeDefined()
    expect(base.octokit).toBeDefined()
  })

  /**
   * Test that Base class handles debug mode correctly.
   */
  test('should handle debug mode correctly', () => {
    const base = new Base({
      token: 'test-token',
      debug: true,
    })

    expect(base.logger).toBeDefined()
    expect(base.spinner).toBeDefined()
    expect(base.octokit).toBeDefined()
  })

  /**
   * Test constructor options
   */
  describe('constructor options', () => {
    test('should handle all constructor parameters', () => {
      const options = {
        token: 'test-token',
        hostname: 'github.enterprise.com',
        debug: true,
        archived: true,
        forked: true,
      }
      const base = new Base(options)
      expect(base.archived).toBe(true)
      expect(base.forked).toBe(true)
      expect(base.logger).toBeDefined()
      expect(base.octokit).toBeDefined()
    })

    test('should handle default values', () => {
      const base = new Base({token: 'test-token'})
      expect(base.archived).toBe(false)
      expect(base.forked).toBe(false)
    })

    test('should handle empty options with token', () => {
      const base = new Base({token: 'test-token'})
      expect(base).toBeInstanceOf(Base)
      expect(base.logger).toBeDefined()
      expect(base.octokit).toBeDefined()
    })
  })

  /**
   * Test property getters
   */
  describe('property getters', () => {
    let base

    beforeEach(() => {
      base = new Base({
        token: 'test-token',
        debug: false,
      })
    })

    test('should return logger instance', () => {
      expect(base.logger).toBeDefined()
      expect(typeof base.logger.info).toBe('function')
      expect(typeof base.logger.error).toBe('function')
      expect(typeof base.logger.warn).toBe('function')
    })

    test('should return spinner instance', () => {
      expect(base.spinner).toBeDefined()
      expect(base.spinner).toBe(base.logger) // spinner is alias for logger
    })

    test('should return octokit instance', () => {
      expect(base.octokit).toBeDefined()
      expect(typeof base.octokit.request).toBe('function')
    })

    test('should return archived flag', () => {
      const baseWithArchived = new Base({token: 'test', archived: true})
      expect(baseWithArchived.archived).toBe(true)

      const baseWithoutArchived = new Base({token: 'test', archived: false})
      expect(baseWithoutArchived.archived).toBe(false)
    })

    test('should return forked flag', () => {
      const baseWithForked = new Base({token: 'test', forked: true})
      expect(baseWithForked.forked).toBe(true)

      const baseWithoutForked = new Base({token: 'test', forked: false})
      expect(baseWithoutForked.forked).toBe(false)
    })
  })
})
