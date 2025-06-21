/**
 * Unit tests for the JSON reporter module.
 */
import {jest} from '@jest/globals'

// Mock dependencies
jest.mock('node:fs/promises')

// Load fixtures
import commonOptions from 'fixtures/common-options.json'
import testDataRaw from 'fixtures/report/test-data.json'

// Import the module under test
import JsonReporter from '../../src/report/json.js'
import Reporter from '../../src/report/reporter.js'

describe('JsonReporter', () => {
  let jsonReporter
  let options
  let testData
  let testFilePath

  beforeEach(() => {
    testFilePath = '/test/path/report.json'
    options = {
      ...commonOptions.report,
      uniqueFlag: 'both',
      uses: true,
    }

    // Transform fixture data to include Sets and other data structures as needed
    testData = testDataRaw.map((item, index) => ({
      ...item,
      uses: Array.isArray(item.uses) ? new Set(item.uses) : item.uses,
      updated_at: item.updated_at === '2025-06-10T00:00:00Z' ? new Date(item.updated_at) : item.updated_at,
      // Add some test-specific data for JSON tests
      ...(index === 1 && {
        mapData: new Map([
          ['key1', 'value1'],
          ['key2', 'value2'],
        ]),
      }),
    }))

    // Create a spy for the saveFile method
    jest.spyOn(Reporter.prototype, 'saveFile').mockImplementation(() => Promise.resolve())

    // Mock the createUniquePath method
    jest.spyOn(Reporter.prototype, 'createUniquePath').mockReturnValue('/test/path/report.unique.json')

    // Mock extractUniqueUses for certain tests
    jest
      .spyOn(Reporter.prototype, 'extractUniqueUses')
      .mockReturnValue(
        new Set(['actions/checkout@v3', 'actions/setup-node@v3', 'actions/setup-python@v4', './local-action']),
      )

    // Create instance with test data
    jsonReporter = new JsonReporter(testFilePath, options, testData)
  })

  afterEach(() => {
    jest.resetAllMocks()
  })

  /**
   * Test basic functionality
   */
  describe('basic functionality', () => {
    /**
     * Test that JsonReporter class can be instantiated.
     */
    test('should instantiate with valid parameters', () => {
      expect(jsonReporter).toBeInstanceOf(JsonReporter)
      expect(jsonReporter.path).toBe(testFilePath)
      expect(jsonReporter.options).toEqual(options)
      expect(jsonReporter.data).toEqual(testData)
    })
  })

  /**
   * Test save operations
   */
  describe('save operations', () => {
    /**
     * Test the save method
     */
    test('should save data as JSON correctly', async () => {
      await jsonReporter.save()

      // Verify that saveFile was called with correct arguments
      expect(Reporter.prototype.saveFile).toHaveBeenCalledWith(testFilePath, expect.stringContaining('"owner"'))

      // Get the JSON data passed to saveFile
      const jsonData = Reporter.prototype.saveFile.mock.calls[0][1]

      // Parse the JSON to verify structure
      const parsedData = JSON.parse(jsonData)

      // Check that Sets were properly converted to arrays
      expect(Array.isArray(parsedData[0].uses)).toBe(true)

      // Check that Maps were properly converted to objects
      expect(typeof parsedData[1].mapData).toBe('object')
      expect(parsedData[1].mapData.key1).toBe('value1')
    })

    /**
     * Test the saveUnique method
     */
    test('should save unique uses data as JSON correctly', async () => {
      await jsonReporter.saveUnique()

      // Verify that saveFile was called with correct arguments
      expect(Reporter.prototype.saveFile).toHaveBeenCalledWith(
        '/test/path/report.unique.json',
        expect.stringContaining('actions/checkout@v3'),
      )

      // Get the JSON data passed to saveFile
      const jsonData = Reporter.prototype.saveFile.mock.calls[0][1]

      // Parse the JSON to verify structure
      const parsedData = JSON.parse(jsonData)

      // Check that the data is an array
      expect(Array.isArray(parsedData)).toBe(true)

      // Check that local actions are filtered out
      expect(parsedData).not.toContain('./local-action')
    })
  })

  /**
   * Test JSON serialization
   */
  describe('JSON serialization', () => {
    /**
     * Test JSON serialization of complex data types
     */
    test('should correctly serialize Set and Map objects', async () => {
      const testSet = new Set(['item1', 'item2'])
      const testMap = new Map([
        ['key1', 'value1'],
        ['key2', 'value2'],
      ])

      // Add complex objects to test data
      const complexData = [
        {
          testSet,
          testMap,
          date: new Date('2025-06-01T00:00:00Z'),
        },
      ]

      const complexReporter = new JsonReporter(testFilePath, options, complexData)

      await complexReporter.save()

      // Get the JSON data passed to saveFile
      const jsonData = Reporter.prototype.saveFile.mock.calls[0][1]

      // Parse the JSON to verify structure
      const parsedData = JSON.parse(jsonData)

      // Check that Set was converted to array
      expect(Array.isArray(parsedData[0].testSet)).toBe(true)
      expect(parsedData[0].testSet).toEqual(['item1', 'item2'])

      // Check that Map was converted to object
      expect(typeof parsedData[0].testMap).toBe('object')
      expect(parsedData[0].testMap.key1).toBe('value1')
      expect(parsedData[0].testMap.key2).toBe('value2')

      // Check that Date was serialized correctly
      expect(parsedData[0].date).toBe('2025-06-01T00:00:00.000Z')
    })

    /**
     * Test handling of circular references in JSON
     */
    test('should handle circular references properly', async () => {
      // Create circular reference
      const circular = {}
      circular.self = circular

      const circularData = [{circular}]

      try {
        const circularReporter = new JsonReporter(testFilePath, options, circularData)
        await circularReporter.save()
      } catch (error) {
        expect(error.message).toContain('Unable to serialize data to JSON: Circular reference detected')
      }
    })
  })

  /**
   * Test error handling
   */
  describe('error handling', () => {
    /**
     * Test specific error handling in save method (JsonReporter specific)
     */
    test('should throw specific error on save failure', async () => {
      // Mock saveFile to throw an error
      Reporter.prototype.saveFile.mockRejectedValueOnce(new Error('Test error'))

      await expect(jsonReporter.save()).rejects.toThrow('Failed to save JSON report')
    })

    /**
     * Test specific error handling in saveUnique method (JsonReporter specific)
     */
    test('should throw specific error on saveUnique failure', async () => {
      // Mock saveFile to throw an error
      Reporter.prototype.saveFile.mockRejectedValueOnce(new Error('Test error'))

      await expect(jsonReporter.saveUnique()).rejects.toThrow('Failed to save unique uses report')
    })
  })
})
