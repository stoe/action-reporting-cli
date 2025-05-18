import Reporter from './reporter.js'

/**
 * MD report generator that extends the base formatter class.
 * Handles creation and formatting of MD reports for GitHub Actions data.
 */
export default class Markdown extends Reporter {
  /**
   * Creates a new MD report instance.
   * @param {string} path - The output file path for the markdown report
   * @param {Object} options - Configuration options for the report
   * @param {Array} data - The workflow data to include in the report
   */
  constructor(path, options, data) {
    super(path, options, data)
  }

  /**
   * Format a Set of values or comma-separated string into an HTML unordered list for markdown
   * @param {Set<string>|string} input - Set of values or comma-separated string to format
   * @param {boolean} [formatAsActionReference=false] - Whether to format with GitHub Action links
   * @returns {string} Formatted HTML list or empty string
   * @private
   */
  #formatSetToHtmlList(input, formatAsActionReference = false) {
    if (!input) return ''

    const items = []

    if (input instanceof Set) {
      // If it's a Set, process each item
      for (const item of input) {
        // Only format as action reference if specified
        if (formatAsActionReference && item.includes('/') && !item.startsWith('./')) {
          // Check if it's a GitHub Action reference
          items.push(this.#formatActionReference(item, true))
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
   * Creates a markdown link or code block for a repository or path
   * @param {string} text - The text to display in the link
   * @param {string} owner - Repository owner
   * @param {string} repo - Repository name
   * @param {string} [path] - Optional path within the repository
   * @returns {string} Formatted markdown link or code block
   * @private
   */
  #createMarkdownLink(text, owner, repo, path = '') {
    // Don't create links for docker:/ URLs
    if (text.startsWith('docker:/') || owner.startsWith('docker:/')) {
      return `\`${text}\``
    }

    const baseUrl = `https://${this.options.hostname || 'github.com'}/${owner}/${repo}`
    const url = path ? `${baseUrl}/blob/HEAD/${path}` : baseUrl

    return `[${text}](${url})`
  }

  /**
   * Formats a GitHub Action reference into a markdown link with shortened version reference
   * @param {string} actionRef - The full action reference (e.g., 'owner/repo@ref' or 'owner/repo/path@ref')
   * @param {boolean} isHtml - Whether to format for HTML output (with <li> tags)
   * @returns {string} Formatted markdown string
   * @private
   */
  #formatActionReference(actionRef, isHtml = false) {
    // Don't create links for docker:/ URLs
    if (actionRef.startsWith('docker:/')) {
      return isHtml ? `<li>\`${actionRef}\`</li>` : `\`${actionRef}\``
    }

    // Skip local references
    if (actionRef.startsWith('./')) {
      return isHtml ? `<li>\`${actionRef}\`</li>` : `\`${actionRef}\``
    }

    // Extract parts from the action reference
    const repoMatch = actionRef.match(/^([^@]+)/)
    if (!repoMatch) {
      return isHtml ? `<li>\`${actionRef}\`</li>` : `\`${actionRef}\``
    }

    const fullPath = repoMatch[1]
    const [owner, repo, ...rest] = fullPath.split('/') // Extract version/ref (could be commit SHA, tag, or branch name)
    const parts = actionRef.split('@')
    const version = parts.length > 1 ? parts[1] : ''

    // Keep the full version/ref (no shortening)
    const versionFormatted = version ? (isHtml ? ` <code>${version}</code>` : ` \`${version}\``) : ''

    // Create repo link
    const repoLink = this.#createMarkdownLink(`${owner}/${repo}`, owner, repo)

    // For reusable workflows (with additional path components)
    if (rest.length > 0) {
      const workflowPath = rest.join('/')
      const pathLink = this.#createMarkdownLink(workflowPath, owner, repo, workflowPath)

      if (isHtml) {
        return `<li>${repoLink} (reusable workflow ${pathLink})${versionFormatted}</li>`
      }
      return `${repoLink} (reusable workflow ${pathLink})${versionFormatted}`
    }

    // For regular actions
    if (isHtml) {
      return `<li>${repoLink}${versionFormatted}</li>`
    }
    return `${repoLink}${versionFormatted}`
  }

  /**
   * Creates the table headers for the markdown report based on enabled options.
   * @returns {string[]} Array of header columns
   * @private
   */
  #createTableHeaders() {
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
   * @private
   */
  #formatWorkflowRow(workflow) {
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
        ? this.#createMarkdownLink(workflow.workflow, workflow.owner, workflow.repo, workflow.workflow)
        : '',
    )

    // Add state and dates
    row.push(workflow.state || '')
    row.push(workflow.created_at || '')
    row.push(workflow.updated_at || '')
    row.push(workflow.last_run_at || '')

    // Add optional data if enabled
    if (this.options.listeners) {
      row.push(this.#formatSetToHtmlList(workflow.listeners))
    }

    if (this.options.permissions) {
      row.push(this.#formatSetToHtmlList(workflow.permissions))
    }

    if (this.options.runsOn) {
      row.push(workflow.runsOn?.size > 0 ? Array.from(workflow.runsOn).join(', ') : '')
    }

    if (this.options.secrets) {
      row.push(this.#formatSetToHtmlList(workflow.secrets))
    }

    if (this.options.vars) {
      row.push(this.#formatSetToHtmlList(workflow.vars))
    }

    if (this.options.uses) {
      row.push(this.#formatSetToHtmlList(workflow.uses, true))
    }

    return row
  }

  /**
   * Saves workflow data as a markdown file with formatted tables.
   * Includes workflow details and optional columns based on configuration.
   * @returns {Promise<void>} A promise that resolves when the file is saved
   * @throws {Error} If file writing fails
   */
  async save() {
    // Start with the report title
    const md = []

    // Get table headers and add header rows
    const headers = this.#createTableHeaders()
    md.push(headers.join(' | '))
    md.push(headers.map(() => '---').join(' | '))

    // For each workflow in the data, generate a row
    if (Array.isArray(this.data)) {
      for (const workflow of this.data) {
        const row = this.#formatWorkflowRow(workflow)
        md.push(row.join(' | '))
      }
    }

    // Write the MD data to the specified file path using the base class method
    await this.saveFile(this.path, md.join('\n'))
  }

  /**
   * Saves a unique summary of GitHub Actions used across workflows.
   * Creates a separate markdown file listing all unique action references
   * organized by repository.
   * @returns {Promise<void>} A promise that resolves when the file is saved
   */
  async saveUnique() {
    // Start with the report title
    const mdUnique = []

    // Create a unique file name using the base class method
    const uniquePath = this.createUniquePath('md')

    // Extract unique "uses" entries from the data using the base class method and filter local actions
    const allUniqueUses = this.extractUniqueUses()
    const uniqueUses = new Set()

    // Filter out local actions starting with './'
    for (const use of allUniqueUses) {
      if (!use.startsWith('./')) {
        uniqueUses.add(use)
      }
    }

    // Sort unique uses alphabetically
    const uniqueUsesArray = Array.from(uniqueUses).sort()

    // Add header for the unique uses section
    mdUnique.push('### Unique GitHub Actions `uses`\n')

    // Group uses by repository name (organization/repo)
    const usesByRepo = {}

    for (const use of uniqueUsesArray) {
      // Extract repository name from use (assumes format like 'organization/repo@ref')
      const repoMatch = use.match(/^([^@]+)/)
      if (!repoMatch) continue

      const repo = repoMatch[1]

      if (!usesByRepo[repo]) {
        usesByRepo[repo] = []
      }

      usesByRepo[repo].push(use)
    }

    // Generate markdown list for each repo
    for (const repo in usesByRepo) {
      const [owner, name, ...rest] = repo.split('/')

      // Create link to the repo using the createMarkdownLink method
      const repoLink = this.#createMarkdownLink(`${owner}/${name}`, owner, name)

      // Check if there's only one action reference for this repo
      if (usesByRepo[repo].length === 1) {
        // Format the single reference directly as a main bullet
        const formattedUse = this.#formatActionReference(usesByRepo[repo][0], false)
        mdUnique.push(`- ${formattedUse}`)
      } else {
        // For multiple references, use nested bullets
        mdUnique.push(`- ${owner}/${name}`)
        for (const use of usesByRepo[repo]) {
          // Format each action reference using the helper method (without <li> tags)
          const formattedUse = this.#formatActionReference(use, false)
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

    await this.saveFile(uniquePath, mdUnique.join('\n'))
  }
}
