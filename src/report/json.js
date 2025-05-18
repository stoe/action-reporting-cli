import Reporter from './reporter.js'

/**
 * JSON report generator that extends the base formatter class.
 * Handles creation and formatting of JSON reports for GitHub Actions data.
 */
export default class Json extends Reporter {
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
   * Saves data as a JSON file.
   * @returns {Promise<void>} A promise that resolves when the file is saved
   */
  async save() {
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
  }

  /**
   * Saves unique "uses" values as a separate JSON file.
   * @returns {Promise<void>} A promise that resolves when the unique uses file is saved
   */
  async saveUnique() {
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
  }
}
