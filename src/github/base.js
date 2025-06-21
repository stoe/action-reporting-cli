// GitHub API classes
import getOctokit from './octokit.js'

// Utilities
import log from '../util/log.js'

/**
 * Base class for GitHub-related classes providing common functionality.
 * Sets up logging and Octokit instance for GitHub API interactions.
 */
export default class Base {
  // Private fields
  #logger
  #octokit

  #archived = false
  #forked = false

  /**
   * Creates a new Base instance with logging and GitHub API client.
   * @param {object} options - Configuration options for the base class
   * @param {string|null} [options.token=null] - GitHub personal access token for authentication
   * @param {string|null} [options.hostname=null] - GitHub hostname for Enterprise servers
   * @param {boolean} [options.debug=false] - Enable debug logging
   * @param {boolean} [options.archived=false] - Skip archived repositories
   * @param {boolean} [options.forked=false] - Skip forked repositories
   * @throws {Error} Throws an error if Octokit initialization fails
   */
  constructor({token = null, hostname = null, debug = false, archived = false, forked = false} = {}) {
    this.#logger = log('Base', token, debug)

    this.#archived = archived
    this.#forked = forked

    try {
      this.#octokit = getOctokit(token, hostname, debug)
    } catch (error) {
      this.#logger.error(error.message)
      throw error
    }
  }

  /**
   * Gets the logger instance.
   * @returns {object} The logger instance
   */
  get logger() {
    return this.#logger
  }

  /**
   * Gets the spinner instance (same as logger for compatibility).
   * @returns {object} The logger instance with spinner functionality
   */
  get spinner() {
    return this.#logger
  }

  /**
   * Gets the Octokit instance.
   * @returns {object} The Octokit instance
   */
  get octokit() {
    return this.#octokit
  }

  /**
   * Gets the archived repositories flag.
   * @returns {boolean} True if archived repositories should be skipped, false otherwise
   */
  get archived() {
    return this.#archived
  }

  /**
   * Gets the forked repositories flag.
   * @returns {boolean} True if forked repositories should be skipped, false otherwise
   */
  get forked() {
    return this.#forked
  }
}
