import Reporter from './reporter.js'

/**
 * JSON report generator that extends the base formatter class.
 * Handles creation and formatting of JSON reports for GitHub Actions data.
 */
export default class JsonReporter extends Reporter {
  /**
   * Creates a new JSON report instance.
   * @param {string} path - The file path where the JSON will be saved
   * @param {Object} options - Configuration options for the report
   * @param {Array} data - The data to be exported as JSON
   */
  constructor(path, options, data) {
    super(path, options, data)
  }

  /**
   * Saves workflow data as a JSON file.
   * Includes workflow details and optional columns based on configuration.
   * @returns {Promise<void>} A promise that resolves when the file is saved
   */
  async save() {
    try {
      // Convert data to JSON format with proper handling of Sets and Maps
      const jsonData = JSON.stringify(
        this.data,
        (_, value) => {
          if (value instanceof Set) {
            return Array.from(value)
          } else if (value instanceof Map) {
            return Object.fromEntries(value)
          }
          return value
        },
        2,
      )

      // Write the JSON data to the specified file path
      await this.saveFile(this.path, jsonData)
    } catch (error) {
      // Provide a more specific error message for JSON serialization issues
      if (error.message.includes('circular')) {
        throw new Error(`Unable to serialize data to JSON: Circular reference detected`)
      } else {
        throw new Error(`Failed to save JSON report: ${error.message}`)
      }
    }
  }

  /**
   * Saves unique "uses" values as a separate file.
   * @returns {Promise<void>} A promise that resolves when the unique uses file is saved
   */
  async saveUnique() {
    try {
      // Create a unique file name using the base class method
      const uniquePath = this.createUniquePath('json')

      // Extract unique "uses" entries from the data using the base class method
      const allUniqueUses = this.extractUniqueUses()
      const uniqueUses = new Set()

      // Filter out local actions starting with './'
      for (const use of allUniqueUses) {
        if (!use.startsWith('./')) {
          uniqueUses.add(use)
        }
      }

      // Convert the Set to an array and sort it
      const jsonUniqueData = Array.from(uniqueUses).sort()

      // Write the JSON data to the specified file path
      await this.saveFile(uniquePath, JSON.stringify(jsonUniqueData, null, 2))
    } catch (error) {
      throw new Error(`Failed to save unique uses report: ${error.message}`)
    }
  }
}
