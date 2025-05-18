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

  /**
   * Creates a new Base instance with logging and GitHub API client.
   * @param {object} options - Configuration options for the base class
   * @param {string|null} [options.token=null] - GitHub personal access token for authentication
   * @param {string|null} [options.hostname=null] - GitHub hostname for Enterprise servers
   * @param {boolean} [options.debug=false] - Enable debug logging
   * @throws {Error} Throws an error if Octokit initialization fails
   */
  constructor({token = null, hostname = null, debug = false} = {}) {
    this.#logger = log(debug)

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
}
