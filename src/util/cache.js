import {access, mkdir, readFile, unlink, writeFile} from 'fs/promises'

class Cache {
  /**
   * @private
   * The logger instance for logging messages.
   * @type {@import('./log').default}
   */
  #logger

  /**
   * @private
   * The path to the cache file.
   * Defaults to `${process.cwd()}/cache/report.json` if not provided.
   * @type {string}
   */
  #path

  /**
   * Creates an instance of Cache.
   * @param {string|null} [path=null] - The path to the cache directory. Defaults to `${process.cwd()}/cache/`
   * @param {@import('./log').default} [logger=null] - The logger instance for logging messages.
   *
   * If no path is provided, it defaults to `${process.cwd()}/cache/report.json`.
   * If a path is provided, it will be used as the cache file path.
   */
  constructor(path = null, logger) {
    this.#path = path || `${process.cwd()}/cache/report.json`
    this.#logger = logger
  }

  /**
   * Gets the current cache path.
   * @returns {string} The current cache path
   */
  get path() {
    return this.#path
  }

  /**
   * Sets a new cache path.
   * @param {string} newPath - The new cache path to set
   */
  set path(newPath) {
    this.#path = newPath
  }

  /**
   * Saves data to the cache file.
   * Creates cache directory if it doesn't exist.
   * @param {object} data - The data to save to cache
   * @returns {Promise<void>} Resolves when save completes, logs errors on failure
   */
  async save(data) {
    try {
      await mkdir(`${process.cwd()}/cache`, {recursive: true})
      this.#logger.debug(`Creating cache directory at ${process.cwd()}/cache`)

      await writeFile(this.#path, JSON.stringify(data, null, 2))
      this.#logger.debug(`Cache saved to ${this.#path}`)

      return true
    } catch (error) {
      this.#logger.error(`Failed to save cache to ${this.#path}: ${error.message}`)

      return null
    }
  }

  /**
   * Loads data from the cache file.
   * @returns {Promise<object|null>} The cached data or null if loading fails
   */
  async load() {
    try {
      const data = await readFile(this.#path, 'utf-8')
      this.#logger.debug(`Cache loaded from ${this.#path}`)

      return JSON.parse(data)
    } catch (error) {
      this.#logger.error(`Failed to load cache from ${this.#path}: ${error.message}`)

      return null
    }
  }

  /**
   * Clears the cache by deleting the cache file.
   * @returns {Promise<boolean>} True if successful, false if clearing fails
   */
  async clear() {
    try {
      await unlink(this.#path)
      this.#logger.debug(`Cache cleared at ${this.#path}`)

      return true
    } catch (error) {
      this.#logger.error(`Failed to clear cache at ${this.#path}: ${error.message}`)

      return false
    }
  }

  /**
   * Checks if the cache file exists.
   * @returns {Promise<boolean>} True if the cache file exists, false otherwise
   */
  async exists() {
    try {
      await access(this.#path)
      this.#logger.debug(`Cache file exists at ${this.#path}`)

      return true
    } catch {
      this.#logger.warn(`Cache file does not exist at ${this.#path}`)

      return false
    }
  }
}

// Singleton pattern to ensure only one instance of Log class is created
let instance = null

export default function cacheInstance(path, logger) {
  if (!instance) {
    instance = new Cache(path, logger)
  }

  return instance
}
