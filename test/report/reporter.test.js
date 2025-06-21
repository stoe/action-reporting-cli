/**
 * Unit tests for the Reporter module.
 */
import {jest} from '@jest/globals'

// Load fixtures
import commonOptions from 'fixtures/common-options.json'
import testDataRaw from 'fixtures/report/test-data.json'
import promises from '@mocks/fs.js'

// Import the module under test
import Reporter from '../../src/report/reporter.js'

describe('Reporter', () => {
  let reporter
  let options
  let testData
  let testFilePath

  beforeEach(() => {
    testFilePath = '/test/path/report.txt'
    options = commonOptions.reporter

    // Transform fixture data to extract only what reporter tests need
    testData = testDataRaw.map(item => ({
      owner: item.owner,
      repo: item.repo,
      uses: Array.isArray(item.uses) ? new Set(item.uses) : item.uses,
    }))

    // Create instance with test data
    reporter = new Reporter(testFilePath, options, testData)
  })

  afterEach(() => {
    jest.resetAllMocks()

    promises.writeFile.mockReset()
  })

  /**
   * Test basic functionality
   */
  describe('basic functionality', () => {
    /**
     * Test that Reporter class can be instantiated.
     */
    test('should instantiate with valid parameters', () => {
      expect(reporter).toBeInstanceOf(Reporter)
      expect(reporter.path).toBe(testFilePath)
      expect(reporter.options).toEqual(options)
      expect(reporter.data).toEqual(testData)
    })

    /**
     * Test that save method throws error when not implemented
     */
    test('should throw error when save method is not implemented', async () => {
      await expect(reporter.save()).rejects.toThrow('Method save() must be implemented by subclasses')
    })

    /**
     * Test that saveUnique method throws error when not implemented
     */
    test('should throw error when saveUnique method is not implemented', async () => {
      await expect(reporter.saveUnique()).rejects.toThrow('Method saveUnique() must be implemented by subclasses')
    })
  })

  /**
   * Test file operations
   */
  describe('file operations', () => {
    /**
     * Test saveFile method
     */
    test('should save content to a file', async () => {
      // TODO
    })

    /**
     * Test saveFile method handles errors properly
     */
    test('should handle errors when saving file fails', async () => {
      testFilePath = '/nonexistent/path/report.json'
      const content = 'Test content'
      const testError = new Error(`ENOENT: no such file or directory, open '${testFilePath}'`)

      promises.writeFile.mockImplementation(() => {
        throw testError
      })

      // Test that the error is properly handled
      await expect(reporter.saveFile(testFilePath, content)).rejects.toThrow(
        `Failed to write file ${testFilePath}: ${testError.message}`,
      )
    })

    /**
     * Test createUniquePath method when uniqueFlag is true
     */
    test('should return original path when uniqueFlag is true', () => {
      const reporter = new Reporter(testFilePath, {uniqueFlag: true}, testData)
      const uniquePath = reporter.createUniquePath('json')

      expect(uniquePath).toBe(testFilePath)
    })

    /**
     * Test createUniquePath method when uniqueFlag is "both"
     */
    test('should return path with unique suffix when uniqueFlag is "both"', () => {
      const filePath = '/test/path/report.json'
      const reporter = new Reporter(filePath, {uniqueFlag: 'both'}, testData)
      const uniquePath = reporter.createUniquePath('json')

      const expectedPath = '/test/path/report.unique.json'

      expect(uniquePath).toBe(expectedPath)
    })
  })

  /**
   * Test data extraction utilities
   */
  describe('data extraction utilities', () => {
    /**
     * Test extractUniqueUses method with array values
     */
    test('should extract unique uses from array values', () => {
      const result = reporter.extractUniqueUses()

      expect(result).toBeInstanceOf(Set)
      expect(result.size).toBe(4)
      expect(result.has('actions/checkout@v3')).toBe(true)
      expect(result.has('actions/setup-node@v3')).toBe(true)
      expect(result.has('actions/setup-node@v3')).toBe(true)
      expect(result.has('actions/setup-python@v4')).toBe(true)
      expect(result.has('./local-action')).toBe(true)
    })

    /**
     * Test extractUniqueUses with empty data
     */
    test('should return empty set when no uses data is available', () => {
      const emptyReporter = new Reporter(testFilePath, options, [{owner: 'test', repo: 'test'}])

      const result = emptyReporter.extractUniqueUses()

      expect(result).toBeInstanceOf(Set)
      expect(result.size).toBe(0)
    })

    /**
     * Test extractUniqueUses with string data
     */
    test('should extract unique uses when uses is a string', () => {
      const stringUsesData = [{owner: 'test-owner', repo: 'test-repo', uses: 'action4/repo@v1'}]
      const stringUsesReporter = new Reporter(testFilePath, options, stringUsesData)

      const result = stringUsesReporter.extractUniqueUses()

      expect(result).toBeInstanceOf(Set)
      expect(result.size).toBe(1)
      expect(result.has('action4/repo@v1')).toBe(true)
    })

    /**
     * Test handling of empty data in extractUniqueUses
     */
    test('should handle null or undefined data in extractUniqueUses', () => {
      // Test with null data
      const nullDataReporter = new Reporter(testFilePath, options, null)
      const nullResult = nullDataReporter.extractUniqueUses()
      expect(nullResult).toBeInstanceOf(Set)
      expect(nullResult.size).toBe(0)

      // Test with undefined data
      const undefinedDataReporter = new Reporter(testFilePath, options, undefined)
      const undefinedResult = undefinedDataReporter.extractUniqueUses()
      expect(undefinedResult).toBeInstanceOf(Set)
      expect(undefinedResult.size).toBe(0)

      // Test with empty array
      const emptyArrayReporter = new Reporter(testFilePath, options, [])
      const emptyArrayResult = emptyArrayReporter.extractUniqueUses()
      expect(emptyArrayResult).toBeInstanceOf(Set)
      expect(emptyArrayResult.size).toBe(0)
    })
  })

  /**
   * Test error handling
   */
  describe('error handling', () => {
    /**
     * Test generic error handling for save method
     */
    test('should handle common errors in save method implementations', async () => {
      // Create a mock subclass that implements save with an error
      class MockReporter extends Reporter {
        async save() {
          throw new Error('Test save error')
        }

        async saveUnique() {
          // Need to implement this to make the class concrete
          return Promise.resolve()
        }
      }

      const mockReporter = new MockReporter(testFilePath, options, testData)
      await expect(mockReporter.save()).rejects.toThrow('Test save error')
    })

    /**
     * Test generic error handling for saveUnique method
     */
    test('should handle common errors in saveUnique method implementations', async () => {
      // Create a mock subclass that implements saveUnique with an error
      class MockReporter extends Reporter {
        async save() {
          // Need to implement this to make the class concrete
          return Promise.resolve()
        }

        async saveUnique() {
          throw new Error('Test saveUnique error')
        }
      }

      const mockReporter = new MockReporter(testFilePath, options, testData)
      await expect(mockReporter.saveUnique()).rejects.toThrow('Test saveUnique error')
    })

    /**
     * Test handling of empty data in save method implementations
     */
    test('should handle empty data in save method implementations', async () => {
      // Create a mock subclass that implements save with empty data tracking
      class MockReporter extends Reporter {
        saveWasCalledWithEmptyData = false

        async save() {
          if (!this.data || !Array.isArray(this.data) || this.data.length === 0) {
            this.saveWasCalledWithEmptyData = true
          }
          return Promise.resolve()
        }

        async saveUnique() {
          // Need to implement this to make the class concrete
          return Promise.resolve()
        }
      }

      // Test with empty array
      const emptyReporter = new MockReporter(testFilePath, options, [])
      await emptyReporter.save()
      expect(emptyReporter.saveWasCalledWithEmptyData).toBe(true)

      // Test with null
      const nullReporter = new MockReporter(testFilePath, options, null)
      await nullReporter.save()
      expect(nullReporter.saveWasCalledWithEmptyData).toBe(true)
    })
  })
})
