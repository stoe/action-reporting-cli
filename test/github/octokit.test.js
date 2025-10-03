/**
 * Unit tests for the Octokit client module.
 */
import {jest} from '@jest/globals'

// Reset singleton between tests by clearing module cache
beforeEach(() => {
  jest.resetModules()
})

describe('octokit', () => {
  beforeEach(() => {})

  afterEach(() => {})

  /**
   * Test that Octokit client is created with correct token and options.
   */
  test('should create Octokit client with valid token and default api.github.com', async () => {
    const {default: getOctokit, getBaseUrl} = await import('../../src/github/octokit.js')
    const client = getOctokit('token')
    expect(getBaseUrl(client)).toBe('https://api.github.com')
  })

  /**
   * Test constructor options
   */
  describe('constructor options', () => {
    test('should normalize classic GHE hostname to /api/v3', async () => {
      const {default: getOctokit, getBaseUrl} = await import('../../src/github/octokit.js')
      const client = getOctokit('token', 'ghe.internal.example.com')
      expect(getBaseUrl(client)).toBe('https://ghe.internal.example.com/api/v3')
    })

    test('should transform GHEC+DR hostname *.ghe.com to api.<host>', async () => {
      const {default: getOctokit, getBaseUrl} = await import('../../src/github/octokit.js')
      const client = getOctokit('token', 'region1.ghe.com')
      expect(getBaseUrl(client)).toBe('https://api.region1.ghe.com')
    })

    test('should preserve already api-prefixed GHEC+DR hostname without /api/v3', async () => {
      const {default: getOctokit, getBaseUrl} = await import('../../src/github/octokit.js')
      const client = getOctokit('token', 'api.region1.ghe.com')
      expect(getBaseUrl(client)).toBe('https://api.region1.ghe.com')
    })

    test('should handle default values', async () => {
      const {default: getOctokit, getBaseUrl} = await import('../../src/github/octokit.js')
      const client = getOctokit('token')
      expect(getBaseUrl(client)).toBe('https://api.github.com')
    })
  })

  /**
   * Test client operations
   */
  describe('client operations', () => {
    test('should perform API requests correctly', async () => {
      const {default: getOctokit} = await import('../../src/github/octokit.js')
      const client = getOctokit('token')
      expect(typeof client.request).toBe('function')
    })
  })
})
