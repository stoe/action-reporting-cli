import Reporter from './reporter.js'

/**
 * CSV report generator that extends the base formatter class.
 * Handles creation and formatting of CSV reports for GitHub Actions data.
 */
export default class CsvReporter extends Reporter {
  /**
   * Creates a new CSV report instance.
   * @param {string} path - The file path where the CSV will be saved
   * @param {Object} options - Configuration options for the report
   * @param {Array} data - The data to be exported as CSV
   */
  constructor(path, options, data) {
    super(path, options, data)
  }

  /**
   * Saves workflow data as a CSV file.
   * Includes workflow details and optional columns based on configuration.
   * @returns {Promise<void>} A promise that resolves when the file is saved
   */
  async save() {
    try {
      // Create headers based on configuration
      const headers = this.createHeaders()

      // Process rows according to the headers to ensure consistent column order
      const rows = this.data.map(workflow => {
        const row = []

        // Add each column in the order defined by headers
        for (const header of headers) {
          if (header === 'runs-on' && workflow.runsOn) {
            // Special case for runsOn which has a different property name
            row.push(this.formatValue(workflow.runsOn))
          } else {
            // For all other columns, use the header name as the property key
            row.push(this.formatValue(workflow[header]))
          }
        }

        return row
      })

      // Format each row, properly escaping values
      const csvRows = rows.map(row =>
        row
          .map(value => {
            if (value === null || value === undefined) {
              return ''
            }

            const strValue = String(value)
            if (strValue.includes(',') || strValue.includes('"') || strValue.includes('\n')) {
              return `"${strValue.replace(/"/g, '""')}"`
            }

            return strValue
          })
          .join(','),
      )

      // Combine headers and data
      const csvContent = [headers.join(','), ...csvRows].join('\n')

      // Write the CSV data to the specified file path
      await this.saveFile(this.path, csvContent)
    } catch (error) {
      throw new Error(`Failed to save CSV report: ${error.message}`)
    }
  }

  /**
   * Saves unique "uses" values as a separate file.
   * @returns {Promise<void>} A promise that resolves when the unique uses file is saved
   */
  async saveUnique() {
    try {
      // Create a unique file name using the base class method
      const uniquePath = this.createUniquePath('csv')

      // Extract unique "uses" entries from the data
      const allUniqueUses = this.extractUniqueUses()
      const uniqueUses = new Set()

      // Filter out local actions starting with './'
      for (const use of allUniqueUses) {
        if (!use.startsWith('./')) {
          uniqueUses.add(use)
        }
      }

      // Create headers for the unique CSV
      const headers = ['uses']

      // Format unique uses into CSV rows
      const uniqueRows = Array.from(uniqueUses).map(use => {
        const formattedValue = this.formatValue(use)

        // Properly escape values with quotes if they contain commas
        if (typeof formattedValue === 'string' && formattedValue.includes(',')) {
          return [`"${formattedValue.replace(/"/g, '""')}"`]
        }
        return [formattedValue]
      })

      // Sort unique uses alphabetically
      uniqueRows.sort((a, b) => a[0].localeCompare(b[0]))

      // Combine headers with properly formatted rows
      const csvContent = [headers.join(','), ...uniqueRows.map(row => row.join(','))].join('\n')

      // Write the unique CSV data to the file
      await this.saveFile(uniquePath, csvContent)
    } catch (error) {
      throw new Error(`Failed to save unique uses CSV report: ${error.message}`)
    }
  }

  /**
   * Creates headers for CSV reports based on enabled options.
   * @returns {string[]} Array of header columns
   */
  createHeaders() {
    // Define the table header with all columns
    const headers = ['owner', 'repo', 'name', 'workflow', 'state', 'created_at', 'updated_at', 'last_run_at']

    // Add optional columns based on options
    if (this.options.listeners) headers.push('listeners')
    if (this.options.permissions) headers.push('permissions')
    if (this.options.runsOn) headers.push('runs-on')
    if (this.options.secrets) headers.push('secrets')
    if (this.options.vars) headers.push('vars')
    if (this.options.uses) headers.push('uses')

    return headers
  }

  /**
   * Formats a value for CSV output, handling objects and other types appropriately.
   * @param {*} value - The value to format
   * @returns {string|number|boolean} - The formatted value
   */
  formatValue(value) {
    if (value === null || value === undefined) {
      return ''
    }

    // Handle dates - ensure they have the .000Z format
    if (value instanceof Date) {
      return value.toISOString()
    }

    // Handle Sets - convert to comma-separated string
    if (value instanceof Set) {
      if (value.size === 0) return ''
      return Array.from(value).join(', ')
    }

    // Handle objects
    if (typeof value === 'object') {
      // Skip empty objects
      if (Object.keys(value).length === 0) {
        return ''
      }

      // Special handling for complex objects
      if (typeof value === 'object' && !Array.isArray(value)) {
        try {
          // Convert the object to a string without excessive quotes
          return this.formatObjectForCsv(value)
        } catch (error) {
          // Fallback to standard JSON string if custom formatting fails
          return JSON.stringify(value)
        }
      }
    }

    return value
  }

  /**
   * Formats an object for CSV output with custom formatting.
   * @param {Object} obj - The object to format
   * @returns {string} - Formatted string representation
   */
  formatObjectForCsv(obj) {
    // For workflow_call objects, use special formatting
    if (obj.workflow_call) {
      return 'workflow_call'
    }

    // For objects with specific structures, provide custom formatting
    if (obj.inputs || obj.secrets) {
      let result = ''

      // Format key names without quotes and stringify values
      const objEntries = Object.entries(obj)
      if (objEntries.length > 0) {
        result = objEntries
          .map(([key, value]) => {
            if (typeof value === 'object' && value !== null) {
              return `${key}: ${this.formatObjectForCsv(value)}`
            }
            return `${key}: ${value}`
          })
          .join(', ')

        // Wrap in brackets if it's a complex object
        if (objEntries.length > 1) {
          result = `{${result}}`
        }
      }

      return result
    }

    // For simple objects, convert to simplified string without excessive quotes
    return JSON.stringify(obj).replace(/"/g, '').replace(/:/g, ': ').replace(/,/g, ', ')
  }
}
