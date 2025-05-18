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
})
