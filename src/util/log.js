import ora from 'ora'
import winston from 'winston'

/**
 * Log class for logging messages with different severity levels.
 * Supports enabling/disabling debug mode with token masking for security.
 * Uses singleton pattern to ensure only one instance is created throughout the application.
 * Handles both console output and file logging depending on debug mode.
 */
export class Log {
  #entity
  #token

  #isDebug
  #spinner
  #logger

  /**
   * Creates a new Log instance with debug mode configuration.
   * @param {string} entity - The entity name used for log file naming
   * @param {string} token - The authentication token to mask in logs
   * @param {boolean} [isDebug=false] - Enable debug mode
   */
  constructor(entity, token, isDebug = false) {
    this.#entity = entity
    this.#token = token
    this.#isDebug = isDebug || process.env.DEBUG === 'true'
    this.#spinner = this.#isDebug ? null : ora()

    if (this.#isDebug) {
      this.#logger = this.#createWinstonLogger()
    }
  }

  /* c8 ignore start */

  /**
   * Creates Winston logger configuration for debug mode.
   * @returns {winston.Logger} Configured Winston logger instance
   * @private
   */
  #createWinstonLogger() {
    // Common format for timestamp and message formatting
    const commonFormat = winston.format.printf(({timestamp, level, message, ...meta}) => {
      const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta, null, 2)}` : ''
      return `${timestamp} [${level}]: ${message}${metaStr}`
    })

    // Console transport with colors
    const consoleFormat = winston.format.combine(
      winston.format.timestamp({
        format: 'YYYY-MM-DD HH:mm:ss',
      }),
      winston.format.colorize(),
      commonFormat,
    )

    // File transport without colors or TTY formatting
    const fileFormat = winston.format.combine(
      winston.format.timestamp({
        format: 'YYYY-MM-DD HH:mm:ss',
      }),
      winston.format.uncolorize(),
      commonFormat,
    )

    return winston.createLogger({
      level: 'debug',
      transports: [
        new winston.transports.Console({
          format: consoleFormat,
        }),
        new winston.transports.File({
          level: 'debug',
          filename: `logs/debug.${this.#entity.replace('/', '_')}.log`,
          format: fileFormat,
        }),
      ],
    })
  }

  /**
   * Formats message for logging, converting objects to JSON strings.
   * @param {any} msg - The message to format
   * @returns {string} Formatted message string
   * @private
   */
  #formatMessage(msg) {
    return typeof msg === 'object' && msg !== null ? JSON.stringify(msg) : msg
  }

  /**
   * Logs a message in debug mode using Winston logger or falls back to console.
   * Provides a consistent logging interface regardless of logger availability.
   * Note: Messages should already be masked before calling this method.
   * @param {string} message - The message to log (should be pre-masked)
   * @param {string} [level='info'] - The log level (info, warn, error, debug)
   * @private
   */
  #logInDebugMode(message, level = 'info') {
    if (this.#logger) {
      this.#logger.log(level, message)
    } else {
      console.log(message)
    }
  }

  /* c8 ignore stop */

  get entity() {
    return this.#entity
  }

  /**
   * Gets the debug mode status.
   * @returns {boolean} True if debug mode is enabled
   */
  get isDebug() {
    return this.#isDebug
  }

  /* c8 ignore start */

  /**
   * Masks sensitive tokens in objects or strings.
   * Recursively looks for and replaces any occurrences of the authentication token
   * to prevent accidental exposure in logs.
   * @param {any} value - The value to mask (object or string)
   * @returns {any} The masked value with sensitive information replaced by '***'
   */
  #maskSensitive(value) {
    // Early return if no token to mask or value is null/undefined
    if (!this.#token || value == null) {
      return value
    }

    // Handle string values directly
    if (typeof value === 'string') {
      // Using a safe string replacement with global flag to replace all occurrences
      return this.#token ? value.replace(new RegExp(this.#escapeRegExp(this.#token), 'g'), '***') : value
    }

    // Handle objects (including arrays)
    if (typeof value === 'object') {
      const clone = Array.isArray(value) ? [...value] : {...value}

      // Consolidate property checks into one loop for better performance
      for (const key in clone) {
        // Special case for property named 'token'
        if (key === 'token' && typeof clone[key] === 'string') {
          clone[key] = '***'
          continue
        }

        // Handle string values that contain the token
        if (typeof clone[key] === 'string' && this.#token && clone[key].includes(this.#token)) {
          clone[key] = clone[key].replace(new RegExp(this.#escapeRegExp(this.#token), 'g'), '***')
        }
        // Recursively process nested objects
        else if (typeof clone[key] === 'object' && clone[key] !== null) {
          clone[key] = this.#maskSensitive(clone[key])
        }
      }

      return clone
    }

    return value
  }

  /**
   * Escapes special characters in a string for use in a RegExp.
   * @param {string} string - The string to escape
   * @returns {string} The escaped string
   * @private
   */
  #escapeRegExp(string) {
    // Escape special RegExp characters to avoid regex syntax errors
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  }

  /**
   * Helper method to handle logging with optional prefix and appropriate console method.
   * @param {Function} consoleMethod - The console method to use (log, warn, error, debug)
   * @param {string|object} msg - The message to log
   * @param {...any} args - Additional arguments to log
   * @private
   */
  #logWithPrefix(consoleMethod, msg, ...args) {
    // Mask sensitive data once for both message and arguments
    const maskedMsg = this.#maskSensitive(msg)
    const maskedArgs = this.#maskSensitive(...args)

    if (this.#isDebug && this.#logger) {
      // Use Winston for debug mode logging
      const level = this.#getWinstonLevel(consoleMethod)
      const message = this.#formatMessage(maskedMsg)

      if (args.length > 0) {
        this.#logger.log(level, message, maskedArgs)
      } else {
        this.#logger.log(level, message)
      }
    } else {
      // Fallback to regular console logging for non-debug mode
      if (typeof msg === 'object' && msg !== null) {
        consoleMethod(maskedMsg)
      } else {
        consoleMethod(maskedMsg, maskedArgs)
      }
    }
  }

  /**
   * Maps console methods to Winston log levels.
   * @param {Function} consoleMethod - The console method
   * @returns {string} The corresponding Winston log level
   * @private
   */
  #getWinstonLevel(consoleMethod) {
    // Map console methods to Winston log levels for proper log categorization
    switch (consoleMethod) {
      case console.error:
        return 'error'
      case console.warn:
        return 'warn'
      case console.debug:
        return 'debug'
      case console.log:
      default:
        return 'info'
    }
  }

  /* c8 ignore stop */

  /**
   * Logs a message without any prefix.
   * @param {string|object} msg - The message to log
   * @param {...any} args - Additional arguments to log
   */
  log(msg, ...args) {
    this.#logWithPrefix(console.log, msg, ...args)
  }

  /**
   * Logs a message with the '[INFO]' prefix.
   * @param {string|object} msg - The message to log
   * @param {...any} args - Additional arguments to log
   */
  info(msg, ...args) {
    this.#logWithPrefix(console.log, msg, ...args)
  }

  /**
   * Logs a warning message with the '[WARN]' prefix.
   * @param {string|object} msg - The message to log
   * @param {...any} args - Additional arguments to log
   */
  warn(msg, ...args) {
    this.#logWithPrefix(console.warn, msg, ...args)
  }

  /**
   * Logs an error message with the '[ERROR]' prefix.
   * @param {string|object} msg - The message to log
   * @param {...any} args - Additional arguments to log
   */
  error(msg, ...args) {
    this.#logWithPrefix(console.error, msg, ...args)
  }

  /**
   * Logs a debug message with the '[DEBUG]' prefix.
   * This method is only active if debug mode is enabled.
   * @param {string|object} msg - The message to log
   * @param {...any} args - Additional arguments to log
   */
  debug(msg, ...args) {
    // Skip debug logging when not in debug mode for better performance
    if (!this.#isDebug) return
    this.#logWithPrefix(console.debug, msg, ...args)
  }

  /**
   * Starts a spinner with the given text or logs the text in debug mode.
   * Any sensitive tokens in the text are automatically masked.
   * @param {string} text - The text to display
   */
  start(text) {
    const maskedText = this.#maskSensitive(text)
    if (this.#isDebug) {
      this.#logInDebugMode(maskedText)
    } else if (this.#spinner) {
      this.#spinner.start(maskedText)
    }
  }

  /**
   * Stops the spinner and persists the message or logs directly in debug mode.
   * All text components are automatically checked for sensitive tokens and masked.
   * @param {object} options - Options object
   * @param {string} options.symbol - The symbol to display
   * @param {string} options.text - The text to display
   * @param {string} [options.prefixText=''] - Optional prefix text to prepend
   * @param {string} [options.suffixText=''] - Optional suffix text to append
   */
  stopAndPersist({symbol, text, prefixText = '', suffixText = ''}) {
    // Mask all text components
    const maskedText = this.#maskSensitive(text)
    const maskedPrefixText = this.#maskSensitive(prefixText)
    const maskedSuffixText = this.#maskSensitive(suffixText)

    if (this.#isDebug) {
      const message = [maskedPrefixText, symbol, maskedText, maskedSuffixText].join(' ')
      this.#logInDebugMode(message)
    } else if (this.#spinner) {
      this.#spinner.stopAndPersist({
        symbol,
        text: maskedText,
        suffixText: maskedSuffixText,
        prefixText: maskedPrefixText,
      })
    }
  }

  /**
   * Shows a failure message with spinner or logs directly in debug mode.
   * Uses error level for debug mode logging to indicate a failure condition.
   * Automatically masks any sensitive tokens in the text.
   * @param {string} text - The failure message
   */
  fail(text) {
    const maskedText = this.#maskSensitive(text)
    if (this.#isDebug) {
      this.#logInDebugMode(maskedText, 'error')
    } else if (this.#spinner) {
      this.#spinner.fail(maskedText)
    }
  }

  /**
   * Updates the spinner text or logs the update in debug mode.
   * Automatically masks any sensitive tokens in the new text.
   * @param {string} newText - The new text to display
   */
  set text(newText) {
    const maskedText = this.#maskSensitive(newText)
    if (this.#isDebug) {
      this.#logInDebugMode(maskedText)
    } else if (this.#spinner) {
      this.#spinner.text = maskedText
    }
  }

  /**
   * Gets the current spinner text.
   * @returns {string} The current spinner text or empty string in debug mode
   */
  get text() {
    return this.#isDebug ? '' : this.#spinner?.text || ''
  }
}

// Singleton pattern to ensure only one instance of Log class is created
let instance = null

/**
 * Returns a singleton instance of the Log class.
 * @param {string} entity - The entity name used for log file naming
 * @param {string} token - The authentication token to mask in logs
 * @param {boolean} [isDebug=false] - Enable debug mode
 * @returns {Log} Instance of Log class
 */
export default function log(entity, token, isDebug = false) {
  if (!instance) {
    instance = new Log(entity, token, isDebug)
  }

  return instance
}
