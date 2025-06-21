import {writeFile} from 'node:fs/promises'
import path from 'node:path'

/**
 * Base class for all report formatters.
 * Provides common functionality for saving reports in different formats.
 */
export default class Reporter {
  /**
   * Creates a new report formatter instance.
   * @param {string} filePath - The file path where the report will be saved
   * @param {Object} options - Configuration options for the report
   * @param {Array} data - The data to be exported in the report
   */
  constructor(filePath, options, data) {
    this.path = filePath
    this.options = options
    this.data = data
  }

  /**
   * Saves the report to a file.
   * Must be implemented by subclasses.
   * @returns {Promise<void>} A promise that resolves when the file is saved
   */
  async save() {
    throw new Error('Method save() must be implemented by subclasses')
  }

  /**
   * Saves unique "uses" values as a separate file.
   * Must be implemented by subclasses.
   * @returns {Promise<void>} A promise that resolves when the file is saved
   */
  async saveUnique() {
    throw new Error('Method saveUnique() must be implemented by subclasses')
  }

  /**
   * Helper method to write content to a file.
   * @param {string} filePath - The path where the file will be saved
   * @param {string} content - The content to write to the file
   * @returns {Promise<void>} A promise that resolves when the file is saved
   * @protected
   */
  async saveFile(filePath, content) {
    try {
      await writeFile(filePath, content, 'utf8')
    } catch (error) {
      throw new Error(`Failed to write file ${filePath}: ${error.message}`)
    }
  }

  /**
   * Creates a path for the unique values report.
   * @param {string} extension - The file extension without the dot
   * @returns {string} The file path for the unique report
   * @protected
   */
  createUniquePath(extension) {
    const parsedPath = path.parse(this.path)
    // If uniqueFlag is true, we return the original path (no .unique suffix)
    // If uniqueFlag is 'both', we add the .unique suffix
    return this.options.uniqueFlag === true
      ? this.path
      : path.join(parsedPath.dir, `${parsedPath.name}.unique.${extension}`)
  }

  /**
   * Extracts unique "uses" values from the report data.
   * @returns {Set<string>} A set containing unique "uses" values
   * @protected
   */
  extractUniqueUses() {
    const uniqueUses = new Set()

    // Check if data exists and is an array before processing
    if (!this.data || !Array.isArray(this.data)) {
      return uniqueUses
    }

    this.data.forEach(workflow => {
      if (workflow.uses) {
        if (Array.isArray(workflow.uses)) {
          workflow.uses.forEach(use => uniqueUses.add(use))
        } else if (typeof workflow.uses === 'string') {
          uniqueUses.add(workflow.uses)
        } else if (workflow.uses instanceof Set) {
          workflow.uses.forEach(use => uniqueUses.add(use))
        }
      }
    })

    return uniqueUses
  }
}
