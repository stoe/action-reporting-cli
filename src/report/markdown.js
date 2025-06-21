import Reporter from './reporter.js'

/**
 * Markdown report generator that extends the base formatter class.
 * Handles creation and formatting of Markdown reports for GitHub Actions data.
 */
export default class MarkdownReporter extends Reporter {
  /**
   * Creates a new Markdown report instance.
   * @param {string} path - The file path where the Markdown will be saved
   * @param {Object} options - Configuration options for the report
   * @param {Array} data - The data to be exported as Markdown
   */
  constructor(path, options, data) {
    super(path, options, data)
  }

  /**
   * Saves workflow data as a markdown file with formatted tables.
   * Includes workflow details and optional columns based on configuration.
   * @returns {Promise<void>} A promise that resolves when the file is saved
   */
  async save() {
    try {
      // Start with the report title
      const md = []

      // Get table headers and add header rows
      const headers = this.createTableHeaders()
      md.push(headers.join(' | '))
      md.push(headers.map(() => '---').join(' | '))

      // For each workflow in the data, generate a row
      if (Array.isArray(this.data)) {
        for (const workflow of this.data) {
          const row = this.formatWorkflowRow(workflow)
          md.push(row.join(' | '))
        }
      }

      // Write the MD data to the specified file path using the base class method
      await this.saveFile(this.path, md.join('\n'))
    } catch (error) {
      throw new Error(`Failed to save Markdown report: ${error.message}`)
    }
  }

  /**
   * Saves unique "uses" values as a separate file.
   * @returns {Promise<void>} A promise that resolves when the file is saved
   */
  async saveUnique() {
    try {
      // Create a unique file name using the base class method
      const uniquePath = this.createUniquePath('md')

      // Get filtered and sorted unique uses
      const uniqueUsesArray = this.getFilteredUniqueUses()

      // Group uses by repository name
      const usesByRepo = this.groupUsesByRepository(uniqueUsesArray)

      // Generate markdown content from the grouped uses
      const mdUnique = this.generateMarkdownFromGroupedUses(usesByRepo)

      // Save the file
      await this.saveFile(uniquePath, mdUnique.join('\n'))
    } catch (error) {
      throw new Error(`Failed to save unique uses report: ${error.message}`)
    }
  }

  /**
   * Filters and sorts unique uses from the report data.
   * @returns {string[]} Array of filtered and sorted unique uses
   */
  getFilteredUniqueUses() {
    const allUniqueUses = this.extractUniqueUses()
    const uniqueUses = new Set()

    // Filter out local actions starting with './'
    for (const use of allUniqueUses) {
      if (!use.startsWith('./')) {
        uniqueUses.add(use)
      }
    }

    // Sort unique uses alphabetically
    return Array.from(uniqueUses).sort()
  }

  /**
   * Groups uses by repository name.
   * @param {string[]} uniqueUsesArray - Array of unique uses
   * @returns {Object} Object with repo names as keys and arrays of uses as values
   */
  groupUsesByRepository(uniqueUsesArray) {
    const usesByRepo = {}

    if (!uniqueUsesArray || !Array.isArray(uniqueUsesArray)) {
      return usesByRepo
    }

    for (const use of uniqueUsesArray) {
      if (!use) continue

      // Handle Docker URLs as their own category
      if (use.startsWith('docker://')) {
        if (!usesByRepo['docker://']) {
          usesByRepo['docker://'] = []
        }
        usesByRepo['docker://'].push(use)
        continue
      }

      // Skip other special URLs
      if (this.isSpecialUrl(use)) {
        continue
      }

      // Extract repository name from use
      const repoMatch = use.match(/^([^@]+)/)
      if (!repoMatch) continue

      const repo = repoMatch[1]

      // Ensure this is a valid GitHub Action reference with at least one slash
      if (!repo.includes('/')) {
        continue
      }

      // Get owner/repo part for proper grouping
      const parts = repo.split('/')
      const repoKey = parts.length >= 2 ? `${parts[0]}/${parts[1]}` : repo

      if (!usesByRepo[repoKey]) {
        usesByRepo[repoKey] = []
      }

      usesByRepo[repoKey].push(use)
    }

    return usesByRepo
  }

  /**
   * Generates Markdown content from grouped uses.
   * @param {Object} usesByRepo - Object with repo names as keys and arrays of uses as values
   * @returns {string[]} Array of Markdown lines
   */
  generateMarkdownFromGroupedUses(usesByRepo) {
    const mdUnique = []
    mdUnique.push('### Unique GitHub Actions `uses`\n')

    // Generate markdown list for each repo
    for (const repo in usesByRepo) {
      const [owner, name] = repo.split('/')

      // Format based on number of uses for this repo
      if (usesByRepo[repo].length === 1) {
        const formattedUse = this.formatActionReference(usesByRepo[repo][0], false)
        mdUnique.push(`- ${formattedUse}`)
      } else {
        mdUnique.push(`- ${owner}/${name}`)
        for (const use of usesByRepo[repo]) {
          const formattedUse = this.formatActionReference(use, false)
          mdUnique.push(`  - ${formattedUse}`)
        }
      }

      // Add a blank line between repos
      mdUnique.push('')
    }

    // Remove trailing empty line if it exists
    if (mdUnique[mdUnique.length - 1] === '') {
      mdUnique.pop()
    }

    return mdUnique
  }

  /**
   * Format a Set of values or comma-separated string into an HTML unordered list for markdown.
   * @param {Set<string>|string} input - Set of values or comma-separated string to format
   * @param {boolean} [formatAsActionReference=false] - Whether to format with GitHub Action links
   * @returns {string} Formatted HTML list or empty string
   */
  formatSetToHtmlList(input, formatAsActionReference = false) {
    if (!input) return ''

    const items = []

    if (input instanceof Set) {
      // If it's a Set, process each item
      for (const item of input) {
        // Only format as action reference if specified
        if (formatAsActionReference && item.includes('/') && !item.startsWith('./')) {
          // Check if it's a GitHub Action reference
          items.push(this.formatActionReference(item, true))
        } else {
          // Default formatting for other items
          items.push(`<li>\`${item}\`</li>`)
        }
      }
    } else if (typeof input === 'string') {
      // If it's a string, split by commas and add each item
      const stringItems = input
        .split(',')
        .map(item => item.trim())
        .filter(Boolean)

      for (const item of stringItems) {
        items.push(`<li>\`${item}\`</li>`)
      }
    }

    // If no items were added, return an empty string
    if (items.length === 0) return ''

    return `<ul>${items.join('')}</ul>`
  }

  /**
   * Creates a markdown link or code block for a repository or path.
   * @param {string} text - The text to display in the link
   * @param {string} owner - Repository owner
   * @param {string} repo - Repository name
   * @param {string} [path] - Optional path within the repository
   * @returns {string} Formatted markdown link or code block
   */
  createMarkdownLink(text, owner, repo, path = '') {
    // Don't create links for docker:/ URLs
    if (text.startsWith('docker://') || owner.startsWith('docker://')) {
      return `\`${text}\``
    }

    const baseUrl = `https://${this.options.hostname || 'github.com'}/${owner}/${repo}`
    const url = path ? `${baseUrl}/blob/HEAD/${path}` : baseUrl

    return `[${text}](${url})`
  }

  /**
   * Formats a GitHub Action reference into a markdown link with version reference.
   * @param {string} actionRef - The full action reference (e.g., 'owner/repo@ref')
   * @param {boolean} isHtml - Whether to format for HTML output (with <li> tags)
   * @returns {string} Formatted markdown string
   */
  formatActionReference(actionRef, isHtml = false) {
    // Format special URL types
    if (this.isSpecialUrl(actionRef)) {
      return isHtml ? `<li>\`${actionRef}\`</li>` : `\`${actionRef}\``
    }

    // Extract parts from the action reference
    const repoMatch = actionRef.match(/^([^@]+)/)
    if (!repoMatch) {
      return isHtml ? `<li>\`${actionRef}\`</li>` : `\`${actionRef}\``
    }

    const fullPath = repoMatch[1]
    const [owner, repo, ...rest] = fullPath.split('/')
    const parts = actionRef.split('@')
    const version = parts.length > 1 ? parts[1] : ''

    // Format the version reference
    const versionFormatted = this.formatVersion(version, isHtml)

    // Create repo link
    const repoLink = this.createMarkdownLink(`${owner}/${repo}`, owner, repo)

    // Format reusable workflows differently
    if (rest.length > 0) {
      return this.formatReusableWorkflow(repoLink, owner, repo, rest, versionFormatted, isHtml)
    }

    // For regular actions
    return isHtml ? `<li>${repoLink}${versionFormatted}</li>` : `${repoLink}${versionFormatted}`
  }

  /**
   * Checks if a URL is a special type that should not be formatted as a link.
   * @param {string} url - The URL to check
   * @returns {boolean} True if special URL type
   */
  isSpecialUrl(url) {
    return url.startsWith('docker:/') || url.startsWith('./')
  }

  /**
   * Formats the version reference for a GitHub Action.
   * @param {string} version - The version string
   * @param {boolean} isHtml - Whether to format for HTML
   * @returns {string} Formatted version string
   */
  formatVersion(version, isHtml) {
    return version ? (isHtml ? ` <code>${version}</code>` : ` \`${version}\``) : ''
  }

  /**
   * Formats a reusable workflow reference.
   * @param {string} repoLink - The formatted repo link
   * @param {string} owner - Repository owner
   * @param {string} repo - Repository name
   * @param {string[]} rest - Additional path components
   * @param {string} versionFormatted - Formatted version string
   * @param {boolean} isHtml - Whether to format for HTML
   * @returns {string} Formatted workflow reference
   */
  formatReusableWorkflow(repoLink, owner, repo, rest, versionFormatted, isHtml) {
    const workflowPath = rest.join('/')
    const pathLink = this.createMarkdownLink(workflowPath, owner, repo, workflowPath)

    if (isHtml) {
      return `<li>${repoLink} (reusable workflow ${pathLink})${versionFormatted}</li>`
    }
    return `${repoLink} (reusable workflow ${pathLink})${versionFormatted}`
  }

  /**
   * Creates the table headers for the markdown report based on enabled options.
   * @returns {string[]} Array of header columns
   */
  createTableHeaders() {
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
   * Formats a single workflow data row for the markdown table.
   * @param {Object} workflow - The workflow data to format
   * @returns {string[]} Array of formatted cells for the row
   */
  formatWorkflowRow(workflow) {
    const row = []

    // Basic workflow data
    row.push(workflow.owner || '')

    // Use repo property for repository column
    row.push(workflow.repo || '')

    // Extract name
    row.push(workflow.name || '')

    // Format workflow path as link
    row.push(
      workflow.workflow
        ? this.createMarkdownLink(workflow.workflow, workflow.owner, workflow.repo, workflow.workflow)
        : '',
    )

    // Add state and dates
    row.push(workflow.state || '')
    row.push(workflow.created_at || '')
    row.push(workflow.updated_at || '')
    row.push(workflow.last_run_at || '')

    // Add optional data if enabled
    if (this.options.listeners) {
      row.push(this.formatSetToHtmlList(workflow.listeners))
    }

    if (this.options.permissions) {
      row.push(this.formatSetToHtmlList(workflow.permissions))
    }

    if (this.options.runsOn) {
      row.push(workflow.runsOn?.size > 0 ? Array.from(workflow.runsOn).join(', ') : '')
    }

    if (this.options.secrets) {
      row.push(this.formatSetToHtmlList(workflow.secrets))
    }

    if (this.options.vars) {
      row.push(this.formatSetToHtmlList(workflow.vars))
    }

    if (this.options.uses) {
      row.push(this.formatSetToHtmlList(workflow.uses, true))
    }

    return row
  }
}
