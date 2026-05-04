import {access, mkdir, readFile, unlink, writeFile} from 'fs/promises'
import path, {dirname} from 'node:path'
import {sanitizePath} from './path.js'

const CACHE_ROOT = sanitizePath(`${process.cwd()}/cache`)

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
    this.#path = this.#resolveCachePath(path || `${CACHE_ROOT}/report.json`)
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
    this.#path = this.#resolveCachePath(newPath)
  }

  /**
   * Resolves and validates a cache path to ensure it stays within CACHE_ROOT.
   * @param {string} inputPath - Candidate cache file path
   * @returns {string} Safe absolute cache path
   * @throws {Error} If path is outside of cache root
   */
  #resolveCachePath(inputPath) {
    const resolvedPath = sanitizePath(inputPath)
    const relativePath = path.relative(CACHE_ROOT, resolvedPath)

    if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
      throw new Error(`Cache path must be within ${CACHE_ROOT}`)
    }

    return resolvedPath
  }

  /**
   * Saves data to the cache file.
   * Creates cache directory if it doesn't exist.
   * @param {object} data - The data to save to cache
   * @returns {Promise<void>} Resolves when save completes, logs errors on failure
   */
  async save(data) {
    try {
      const dir = dirname(this.#path)
      await mkdir(dir, {recursive: true})
      this.#logger.debug(`Creating cache directory at ${dir}`)

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
      const safePath = sanitizePath(this.#path)
      const data = await readFile(safePath, 'utf-8')
      this.#logger.debug(`Cache loaded from ${safePath}`)

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
      const safePath = sanitizePath(this.#path)
      await access(safePath)
      this.#logger.debug(`Cache file exists at ${safePath}`)

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
