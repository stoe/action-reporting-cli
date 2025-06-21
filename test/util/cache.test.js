/**
 * Unit tests for input validation functions.
 */
import {jest} from '@jest/globals'

/**
 * Unit tests for the cache utility class.
 */
import cacheInstance from '../../src/util/cache.js'

import mockLog from '@mocks/util/log.js'
import promises from '@mocks/fs.js'

let logger

/**
 * Test suite for the cache function and Log class.
 */
describe('cache', () => {
  beforeEach(() => {
    // Reset the logger before each test
    mockLog._reset() // Reset the mock log state
    logger = mockLog('test', 'test-token', true)
  })

  afterEach(() => {
    // Clean up the logger reference
    logger = null

    // Reset the mock state
    mockLog._reset()

    // Reset any global state if needed
    jest.restoreAllMocks()
  })

  /**
   * Test basic cache functionality
   */
  describe('basic functionality', () => {
    /**
     * Test that cache returns a singleton instance.
     */
    test('should return singleton instance', () => {
      const cache1 = cacheInstance(null, logger)
      const cache2 = cacheInstance(null, logger)

      expect(cache1).toBe(cache2)
    })

    /**
     * Test cache functionality if needed
     */
    test('cache should have expected methods', () => {
      const cache = cacheInstance(null, logger)

      expect(cache).toHaveProperty('save')
      expect(cache).toHaveProperty('load')
      expect(cache).toHaveProperty('clear')
      expect(cache).toHaveProperty('exists')

      expect(typeof cache.save).toBe('function')
      expect(typeof cache.load).toBe('function')
      expect(typeof cache.clear).toBe('function')
      expect(typeof cache.exists).toBe('function')
    })

    /**
     * Test that cache methods behave as expected
     */
    test('cache methods should work correctly', async () => {
      const cache = cacheInstance(null, logger)

      // Test save method
      const data = {key: 'value'}
      await expect(cache.save(data)).resolves.toEqual(true)

      // Test load method
      await expect(cache.load()).resolves.toEqual(data)

      // Test exists method
      await expect(cache.exists()).resolves.toBe(true)

      // Test clear method
      await expect(cache.clear()).resolves.toBe(true)

      // Test that cache is empty after clearing
      await expect(cache.load()).resolves.toBeNull()
    })
  })

  /**
   * Test property getters and setters
   */
  describe('property getters and setters', () => {
    /**
     * Test getter and setter methods for path property
     */
    test('getter and setter for path property should work correctly', () => {
      const cache = cacheInstance(null, logger)
      const initialPath = cache.path
      const newPath = '/new/path/to/cache.json'

      // Test getter
      expect(initialPath).toBe(`${process.cwd()}/cache/report.json`)

      // Test setter
      cache.path = newPath
      expect(cache.path).toBe(newPath)
    })
  })

  /**
   * Test error handling
   */
  describe('error handling', () => {
    /**
     * Test save method error handling
     */
    test('save method should handle errors properly', async () => {
      const cache = cacheInstance(null, logger)

      // Mock writeFile to throw an error
      jest.spyOn(promises, 'writeFile').mockImplementation(() => {
        throw new Error('Mock save error')
      })

      // Attempt to save data and expect it to return null
      const data = {key: 'value'}
      await expect(cache.save(data)).resolves.toBeNull()
    })

    /**
     * Test clear method error handling
     */
    test('clear method should handle errors properly', async () => {
      const cache = cacheInstance(null, logger)

      // Mock unlink to throw an error
      jest.spyOn(promises, 'unlink').mockImplementation(() => {
        throw new Error('Mock clear error')
      })

      // Attempt to clear cache and expect it to return false
      await expect(cache.clear()).resolves.toBe(false)
    })

    /**
     * Test exists method when file doesn't exist
     */
    test('exists method should return false when file does not exist', async () => {
      const cache = cacheInstance(null, logger)

      // Mock access to throw an error indicating file does not exist
      jest.spyOn(promises, 'access').mockImplementation(() => {
        throw new Error('File does not exist')
      })

      // Check if cache exists and expect it to return false
      await expect(cache.exists()).resolves.toBe(false)
    })
  })
})
