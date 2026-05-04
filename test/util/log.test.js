/**
 * Unit tests for input validation functions.
 */
import {jest} from '@jest/globals'

/**
 * Unit tests for the log utility class.
 */
import log from '../../src/util/log.js'
jest.mock('../../src/util/log.js')

import mockLog from '@mocks/util/log.js'

const baseOptions = {
  entity: 'test-entity',
  token: 'myS3cr3tT0k3n',
  isDebug: false,
}

const originalEnv = process.env.DEBUG
let logger
let mockLogger

/**
 * Test suite for the log function and Log class.
 */
describe('log', () => {
  beforeEach(() => {
    // Reset environment variables that might affect tests
    process.env.DEBUG = undefined

    // Create a new logger instance before each test
    logger = log(baseOptions.entity, baseOptions.token, baseOptions.isDebug)
    mockLogger = mockLog(baseOptions.entity, baseOptions.token, baseOptions.isDebug)
  })

  afterEach(() => {
    logger = null

    // Reset the mock log instance to clear any logged messages
    mockLogger = null
    mockLog._reset()

    // Reset the mock log instance
    jest.restoreAllMocks()

    // Reset environment variables to original state
    process.env.DEBUG = originalEnv
  })

  /**
   * Test basic functionality
   */
  describe('basic functionality', () => {
    /**
     * Test singleton
     * This test checks that the log function returns the same instance of the logger
     * regardless of how many times it is called with the same parameters.
     * It ensures that the logger is a singleton.
     */
    test('should return singleton instance', () => {
      const logger2 = log('different', 'values', true)

      expect(logger).toBe(logger2)
    })

    /**
     * Test constructor
     * This test checks that the logger instance is created with the correct properties.
     */
    test('constructor should set properties correctly', () => {
      expect(logger.entity).toBe('test-entity')
      expect(logger.isDebug).toBe(false)
    })

    /**
     * Test logger methods
     * This test checks that the logger has the expected methods and they are functions.
     */
    test('logger should have expected methods', () => {
      expect(logger).toHaveProperty('error')
      expect(logger).toHaveProperty('warn')
      expect(logger).toHaveProperty('info')
      expect(logger).toHaveProperty('debug')
      expect(logger).toHaveProperty('start')
      expect(logger).toHaveProperty('stopAndPersist')
      expect(logger).toHaveProperty('fail')
      expect(logger).toHaveProperty('text')

      expect(typeof logger.error).toBe('function')
      expect(typeof logger.warn).toBe('function')
      expect(typeof logger.info).toBe('function')
      expect(typeof logger.debug).toBe('function')
      expect(typeof logger.start).toBe('function')
      expect(typeof logger.stopAndPersist).toBe('function')
      expect(typeof logger.fail).toBe('function')
      expect(typeof logger.text).toBe('string')
    })
  })

  /**
   * Test logging methods
   */
  describe('logging methods', () => {
    /**
     * Test info method
     */
    test('info method should log messages correctly', () => {
      mockLogger.info('This is an info message')

      expect(mockLogger.infos.length).toBe(1)
      expect(mockLogger.infos[0].message).toBe('This is an info message')
    })

    /**
     * Test warn method
     */
    test('warn method should log messages correctly', () => {
      mockLogger.warn('This is a warning message')

      expect(mockLogger.warns.length).toBe(1)
      expect(mockLogger.warns[0].message).toBe('This is a warning message')
    })

    /**
     * Test debug method when debug mode is disabled
     */
    test('debug method should not log messages when debug mode is disabled', () => {
      // Test without debug mode enabled
      mockLogger.debug('This is a debug message')
      expect(mockLogger.debugs.length).toBe(0)
    })

    /**
     * Test debug method with debug mode enabled
     */
    test('debug method should log messages correctly', () => {
      const debugLogger = mockLog._createNew(baseOptions.entity, baseOptions.token, true)
      debugLogger.debug('This is a debug message')

      expect(debugLogger.debugs.length).toBe(1)
      expect(debugLogger.debugs[0].message).toBe('This is a debug message')
    })

    /**
     * Test error method
     */
    test('error method should log messages correctly', () => {
      mockLogger.error('This is an error message')

      expect(mockLogger.errors.length).toBe(1)
      expect(mockLogger.errors[0].message).toBe('This is an error message')
    })
  })

  /**
   * Test spinner functionality
   */
  describe('spinner functionality', () => {
    /**
     * Test spinner functionality
     */
    test('spinner start and success methods should work correctly', () => {
      mockLogger.start('Starting process...')

      expect(mockLogger.spinnerActive).toBe(true)
      expect(mockLogger.currentText).toBe('Starting process...')

      mockLogger.stopAndPersist({text: 'Process completed'})

      expect(mockLogger.spinnerActive).toBe(false)
      expect(mockLogger.spinnerLogs[1].text).toContain('Process completed')
    })

    /**
     * Test spinner functionality
     */
    test('spinner start and fail methods should work correctly', () => {
      mockLogger.start('Starting process...')
      mockLogger.fail('Process failed')

      expect(mockLogger.spinnerActive).toBe(false)
      expect(mockLogger.spinnerLogs[1].text).toContain('Process failed')
    })
  })
})

/**
 * Tests for security-related behavior using the real Log class.
 */
import {Log} from '../../src/util/log.js'

describe('Log security', () => {
  describe('isDebug boolean coercion', () => {
    test('should coerce truthy non-boolean values to true', () => {
      const l = new Log('entity', 'token', 'yes')
      expect(l.isDebug).toBe(true)
    })

    test('should coerce falsy non-boolean values to false', () => {
      const l = new Log('entity', 'token', 0)
      expect(l.isDebug).toBe(false)
    })

    test('should keep explicit boolean true', () => {
      const l = new Log('entity', 'token', true)
      expect(l.isDebug).toBe(true)
    })

    test('should keep explicit boolean false', () => {
      const l = new Log('entity', 'token', false)
      expect(l.isDebug).toBe(false)
    })
  })

  describe('maskSensitive prototype pollution guard', () => {
    test('should not process __proto__ keys', () => {
      const l = new Log('entity', 'secret123', false)
      const input = JSON.parse('{"__proto__": {"polluted": true}, "safe": "secret123"}')
      const result = l.maskSensitive(input)

      expect(result.safe).toBe('***')
      const emptyObj = {}
      expect(emptyObj.polluted).toBeUndefined()
    })

    test('should not process constructor keys', () => {
      const l = new Log('entity', 'secret123', false)
      const input = {constructor: 'secret123', normal: 'secret123'}
      const result = l.maskSensitive(input)

      expect(result.normal).toBe('***')
      // constructor key string value should still be masked for security
      expect(result.constructor).toBe('***')
    })

    test('should still mask tokens in regular properties', () => {
      const l = new Log('entity', 'secret123', false)
      const input = {name: 'hello secret123 world', nested: {value: 'secret123'}}
      const result = l.maskSensitive(input)

      expect(result.name).toBe('hello *** world')
      expect(result.nested.value).toBe('***')
    })
  })
})
