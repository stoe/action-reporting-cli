import {Log} from '../../../src/util/log.js'

// Mock for src/util/log.js
// This file mocks the logging functionality for testing

/**
 * MockLog class that mimics the Log class from src/util/log.js
 * but stores logs in memory for testing instead of outputting to console or file
 */
class MockLog extends Log {
  // Properties to store configuration
  entity
  token
  isDebug

  // Store logs in arrays for testing inspection
  logs = []
  infos = []
  warns = []
  errors = []
  debugs = []
  spinnerLogs = []

  // For spinner state tracking
  spinnerActive = false
  currentText = ''

  /**
   * Creates a new MockLog instance with debug mode configuration.
   * @param {string} entity - The entity name
   * @param {string} token - The authentication token
   * @param {boolean} [isDebug=false] - Debug mode flag
   */
  constructor(entity, token, isDebug = false) {
    super(entity, token, isDebug)

    this.entity = entity
    this.token = token
    this.isDebug = isDebug
  }

  /**
   * Masks sensitive information in messages for testing
   * @param {any} value - Value to mask
   * @returns {any} Masked value
   */
  _maskSensitive(value) {
    if (!this.token || value == null) {
      return value
    }

    if (typeof value === 'string') {
      return value.includes(this.token) ? value.replace(this.token, '***') : value
    }

    if (typeof value === 'object') {
      const clone = Array.isArray(value) ? [...value] : {...value}

      for (const key in clone) {
        if (key === 'token' && typeof clone[key] === 'string') {
          clone[key] = '***'
        } else if (typeof clone[key] === 'string' && this.token && clone[key].includes(this.token)) {
          clone[key] = clone[key].replace(this.token, '***')
        } else if (typeof clone[key] === 'object' && clone[key] !== null) {
          clone[key] = this._maskSensitive(clone[key])
        }
      }

      return clone
    }

    return value
  }

  /**
   * Generic log method for all log types
   * @param {string|object} msg - Message to log
   * @param {...any} args - Additional arguments
   */
  log(msg, ...args) {
    const maskedMsg = this._maskSensitive(msg)
    const maskedArgs = args.map(arg => this._maskSensitive(arg))
    this.logs.push({message: maskedMsg, args: maskedArgs})
  }

  /**
   * Info level logging
   * @param {string|object} msg - Message to log
   * @param {...any} args - Additional arguments
   */
  info(msg, ...args) {
    const maskedMsg = this._maskSensitive(msg)
    const maskedArgs = args.map(arg => this._maskSensitive(arg))
    this.infos.push({message: maskedMsg, args: maskedArgs})
  }

  /**
   * Warning level logging
   * @param {string|object} msg - Message to log
   * @param {...any} args - Additional arguments
   */
  warn(msg, ...args) {
    const maskedMsg = this._maskSensitive(msg)
    const maskedArgs = args.map(arg => this._maskSensitive(arg))
    this.warns.push({message: maskedMsg, args: maskedArgs})
  }

  /**
   * Error level logging
   * @param {string|object} msg - Message to log
   * @param {...any} args - Additional arguments
   */
  error(msg, ...args) {
    const maskedMsg = this._maskSensitive(msg)
    const maskedArgs = args.map(arg => this._maskSensitive(arg))
    this.errors.push({message: maskedMsg, args: maskedArgs})
  }

  /**
   * Debug level logging
   * @param {string|object} msg - Message to log
   * @param {...any} args - Additional arguments
   */
  debug(msg, ...args) {
    if (!this.isDebug) return

    const maskedMsg = this._maskSensitive(msg)
    const maskedArgs = args.map(arg => this._maskSensitive(arg))
    this.debugs.push({message: maskedMsg, args: maskedArgs})
  }

  /**
   * Start a spinner
   * @param {string} text - Spinner text
   */
  start(text) {
    const maskedText = this._maskSensitive(text)
    this.spinnerActive = true
    this.currentText = maskedText
    this.spinnerLogs.push({type: 'start', text: maskedText})
  }

  /**
   * Stop and persist spinner
   * @param {object} options - Options object
   * @param {string} options.symbol - Symbol to display
   * @param {string} options.text - Text to display
   * @param {string} [options.prefixText=''] - Prefix text
   * @param {string} [options.suffixText=''] - Suffix text
   */
  stopAndPersist({symbol, text, prefixText = '', suffixText = ''}) {
    const maskedText = this._maskSensitive(text)
    const maskedPrefixText = this._maskSensitive(prefixText)
    const maskedSuffixText = this._maskSensitive(suffixText)

    this.spinnerActive = false
    this.currentText = ''

    this.spinnerLogs.push({
      type: 'stopAndPersist',
      symbol,
      text: maskedText,
      prefixText: maskedPrefixText,
      suffixText: maskedSuffixText,
    })
  }

  /**
   * Show failure message
   * @param {string} text - Failure message
   */
  fail(text) {
    const maskedText = this._maskSensitive(text)
    this.spinnerActive = false
    this.currentText = ''
    this.spinnerLogs.push({type: 'fail', text: maskedText})
  }

  /**
   * Update spinner text
   * @param {string} newText - New text to display
   */
  set text(newText) {
    const maskedText = this._maskSensitive(newText)
    this.currentText = maskedText
    this.spinnerLogs.push({type: 'updateText', text: maskedText})
  }

  /**
   * Get current spinner text
   * @returns {string} Current spinner text
   */
  get text() {
    return this.currentText
  }

  // Testing utility methods

  /**
   * Reset all logs for testing
   */
  _reset() {
    this.logs = []
    this.infos = []
    this.warns = []
    this.errors = []
    this.debugs = []
    this.spinnerLogs = []
    this.spinnerActive = false
    this.currentText = ''
  }

  /**
   * Get all logs for assertions in tests
   * @returns {object} All logged messages by type
   */
  _getAllLogs() {
    return {
      logs: this.logs,
      infos: this.infos,
      warns: this.warns,
      errors: this.errors,
      debugs: this.debugs,
      spinnerLogs: this.spinnerLogs,
    }
  }
}

// Singleton pattern like the original
let instance = null

/**
 * Returns a singleton instance of the MockLog class
 * @param {string} entity - The entity name
 * @param {string} token - The authentication token
 * @param {boolean} [isDebug=false] - Enable debug mode
 * @returns {MockLog} Instance of MockLog class
 */
const mockLog = function (entity, token, isDebug = false) {
  if (!instance) {
    instance = new MockLog(entity, token, isDebug)
  }

  return instance
}

/**
 * Reset the mock for fresh tests
 */
mockLog._reset = function () {
  if (instance) {
    instance._reset()
  }
}

/**
 * Create a new instance regardless of singleton state (for test isolation)
 * @param {string} entity - The entity name
 * @param {string} token - The authentication token
 * @param {boolean} [isDebug=false] - Enable debug mode
 * @returns {MockLog} New instance of MockLog class
 */
mockLog._createNew = function (entity, token, isDebug = false) {
  instance = new MockLog(entity, token, isDebug)
  return instance
}

/**
 * Get the current instance for test inspections
 * @returns {MockLog|null} Current MockLog instance or null
 */
mockLog._getInstance = function () {
  return instance
}

export default mockLog
