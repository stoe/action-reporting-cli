/**
 * Unit tests for the CSV reporter module.
 */
import {jest} from '@jest/globals'

// Mock dependencies
jest.mock('node:fs/promises')

// Load fixtures
import commonOptions from 'fixtures/common-options.json'
import testDataRaw from 'fixtures/report/test-data.json'

// Import the module under test
import CsvReporter from '../../src/report/csv.js'
import Reporter from '../../src/report/reporter.js'

describe('CsvReporter', () => {
  let csvReporter
  let options
  let testData
  let testFilePath

  beforeEach(() => {
    testFilePath = '/test/path/report.csv'
    options = commonOptions.csvReport

    // Transform fixture data to match test requirements (Sets, etc.)
    testData = testDataRaw.map(item => ({
      ...item,
      listeners: Array.isArray(item.listeners) ? new Set(item.listeners) : item.listeners,
      permissions: Array.isArray(item.permissions) ? new Set(item.permissions) : item.permissions,
      runsOn: Array.isArray(item.runsOn) ? new Set(item.runsOn) : item.runsOn,
      secrets: item.secrets ? (Array.isArray(item.secrets) ? new Set(item.secrets) : item.secrets) : null,
      vars: item.vars && Array.isArray(item.vars) ? new Set(item.vars) : item.vars,
      uses: Array.isArray(item.uses) ? new Set(item.uses) : item.uses,
      updated_at: item.updated_at === '2025-06-10T00:00:00Z' ? new Date(item.updated_at) : item.updated_at,
    }))

    // Create a spy for the saveFile method
    jest.spyOn(Reporter.prototype, 'saveFile').mockImplementation(() => Promise.resolve())

    // Mock the createUniquePath method
    jest.spyOn(Reporter.prototype, 'createUniquePath').mockReturnValue('/test/path/report.unique.csv')

    // Create instance with test data
    csvReporter = new CsvReporter(testFilePath, options, testData)
  })

  afterEach(() => {
    jest.resetAllMocks()
  })

  /**
   * Test basic functionality
   */
  describe('basic functionality', () => {
    /**
     * Test that CsvReporter class can be instantiated.
     */
    test('should instantiate with valid parameters', () => {
      expect(csvReporter).toBeInstanceOf(CsvReporter)
      expect(csvReporter.path).toBe(testFilePath)
      expect(csvReporter.options).toEqual(options)
      expect(csvReporter.data).toEqual(testData)
    })
  })

  /**
   * Test save operations
   */
  describe('save operations', () => {
    /**
     * Test the save method
     */
    test('should save data as CSV correctly', async () => {
      await csvReporter.save()

      // Verify that saveFile was called with correct arguments
      expect(Reporter.prototype.saveFile).toHaveBeenCalledWith(
        testFilePath,
        expect.stringContaining(
          'owner,repo,name,workflow,state,created_at,updated_at,last_run_at,listeners,permissions,runs-on,secrets,vars,uses',
        ),
      )
    })

    /**
     * Test the saveUnique method
     */
    test('should save unique uses data as CSV correctly', async () => {
      await csvReporter.saveUnique()

      // Verify that saveFile was called with correct arguments
      expect(Reporter.prototype.saveFile).toHaveBeenCalledWith(
        '/test/path/report.unique.csv',
        expect.stringContaining('uses'),
      )
    })
  })

  /**
   * Test CSV formatting
   */
  describe('CSV formatting', () => {
    /**
     * Test the createHeaders method
     */
    test('should create correct headers based on options', () => {
      // Test with all options enabled
      const headers = csvReporter.createHeaders()

      expect(headers).toEqual([
        'owner',
        'repo',
        'name',
        'workflow',
        'state',
        'created_at',
        'updated_at',
        'last_run_at',
        'listeners',
        'permissions',
        'runs-on',
        'secrets',
        'vars',
        'uses',
      ])

      // Test with limited options
      const limitedOptions = {listeners: true, uses: true}
      const limitedCsv = new CsvReporter(testFilePath, limitedOptions, testData)
      const limitedHeaders = limitedCsv.createHeaders()

      expect(limitedHeaders).toEqual([
        'owner',
        'repo',
        'name',
        'workflow',
        'state',
        'created_at',
        'updated_at',
        'last_run_at',
        'listeners',
        'uses',
      ])
    })

    /**
     * Test formatValue method with different types of values
     */
    test('should format values correctly for CSV output', () => {
      // Test with a string
      expect(csvReporter.formatValue('test')).toBe('test')

      // Test with a number
      expect(csvReporter.formatValue(123)).toBe(123)

      // Test with a Date object
      const date = new Date('2025-06-01T00:00:00Z')
      expect(csvReporter.formatValue(date)).toBe('2025-06-01T00:00:00.000Z')

      // Test with a Set
      const set = new Set(['item1', 'item2'])
      expect(csvReporter.formatValue(set)).toBe('item1, item2')

      // Test with an array
      expect(csvReporter.formatValue(['item1', 'item2'])).toEqual(['item1', 'item2'])

      // Test with null/undefined
      expect(csvReporter.formatValue(null)).toBe('')
      expect(csvReporter.formatValue(undefined)).toBe('')

      // Test with a complex object
      const obj = {key1: 'value1', key2: 'value2'}
      expect(csvReporter.formatValue(obj)).toBe('{key1: value1, key2: value2}')
    })

    /**
     * Test formatObjectForCsv method
     */
    test('should format objects correctly for CSV', () => {
      // Test with a plain object
      const plainObj = {key1: 'value1', key2: 'value2'}
      expect(csvReporter.formatObjectForCsv(plainObj)).toBe('{key1: value1, key2: value2}')

      // Test with a nested object
      const nestedObj = {key1: 'value1', key2: {nested: 'value'}}
      expect(csvReporter.formatObjectForCsv(nestedObj)).toBe('{key1: value1, key2: {nested: value}}')

      // Test with special types in object
      const specialObj = {
        str: 'string',
        num: 123,
        bool: true,
        nil: null,
        set: new Set(['item1', 'item2']),
        arr: ['item1', 'item2'],
      }
      const result = csvReporter.formatObjectForCsv(specialObj)

      expect(result).toContain('str: string')
      expect(result).toContain('num: 123')
      expect(result).toContain('bool: true')
      expect(result).toContain('{str: string, num: 123, bool: true, nil: null, set: {}, arr: [item1, item2]}')
    })
  })

  /**
   * Test error handling
   */
  describe('error handling', () => {
    /**
     * Test specific error handling for save method
     */
    test('should throw specific error on save failure', async () => {
      // Mock saveFile to throw an error
      Reporter.prototype.saveFile.mockRejectedValueOnce(new Error('Test error'))

      await expect(csvReporter.save()).rejects.toThrow('Failed to save CSV report')
    })

    /**
     * Test specific error handling for saveUnique method
     */
    test('should throw specific error on saveUnique failure', async () => {
      // Mock saveFile to throw an error
      Reporter.prototype.saveFile.mockRejectedValueOnce(new Error('Test error'))

      await expect(csvReporter.saveUnique()).rejects.toThrow('Failed to save unique uses CSV report')
    })
  })
})
