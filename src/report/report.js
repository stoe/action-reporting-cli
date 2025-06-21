import chalk from 'chalk'

import fs from 'node:fs/promises'
import path from 'node:path'

// GitHub API classes
import Enterprise from '../github/enterprise.js'
import Owner from '../github/owner.js'
import Repository from '../github/repository.js'

// Report classes
import CsvReporter from './csv.js'
import JsonReporter from './json.js'
import MarkdownReporter from './markdown.js'

// Utilities
import wait from '../util/wait.js'

const {blue, cyan, dim, green, red} = chalk

/**
 * Base class for generating various types of reports.
 * Provides common functionality for saving report data to files and processing entities.
 */
export default class Report {
  /**
   * Start time of the report generation process.
   * @type {Date}
   * @private
   */
  #startTime

  /**
   * Logger instance for debugging.
   * @type {import('../util/log.js').default}
   * @private
   */
  #logger

  /**
   * Handles cache operations for report data.
   * @type {import('../util/cache.js').default}
   * @private
   */
  #cache

  /**
   * Options for the report generation.
   * @type {object}
   * @property {boolean} all - Whether to report all options
   * @property {boolean} listeners - Report on listeners used
   * @property {boolean} permissions - Report permissions values for GITHUB_TOKEN
   * @property {boolean} runsOn - Report runs-on values
   * @property {boolean} secrets - Report secrets used
   * @property {boolean} uses - Report uses values
   * @property {boolean} vars - Report vars used
   * @property {string} uniqueFlag - Unique flag value for uses reporting
   * @private
   */
  #options

  /**
   * Output data for the report in different formats.
   * @type {object}
   * @property {string} csv - CSV path for report output
   * @property {string} json - JSON path for report output
   * @property {string} md - Markdown path for report output
   * @private
   */
  #output = {
    csv: '',
    json: '',
    md: '',
  }

  /**
   * Creates a new Report instance.
   * @param {object} flags - The CLI flags object from meow
   * @param {import('../util/log.js').default} logger - Logger instance for debugging
   * @param {import('../util/cache.js').default} cache - Cache instance for storing results
   */
  constructor(flags, logger, cache) {
    this.#startTime = new Date()

    this.#logger = logger
    this.#cache = cache

    this.validateInput(flags)
  }

  get startTime() {
    return this.#startTime
  }

  set startTime(value) {
    if (!(value instanceof Date)) {
      throw new TypeError('startTime must be a Date object')
    }

    this.#startTime = value
  }

  get options() {
    return this.#options
  }

  get output() {
    return this.#output
  }

  /**
   * Validates the input flags for the report generation.
   * Ensures that the required flags are provided and correctly formatted.
   * @param {object} flags - The CLI flags object from meow
   * @throws {Error} If any validation fails
   */
  validateInput(flags) {
    const {
      enterprise,
      owner,
      repository,
      token,
      hostname,
      all,
      unique: _unique,
      csv,
      json,
      md,
      skipCache,
      archived,
      forked,
    } = flags

    // Ensure GitHub token is provided
    if (!token) {
      throw new Error('GitHub Personal Access Token (PAT) not provided')
    }

    // Ensure at least one processing option is provided
    if (!(enterprise || owner || repository)) {
      throw new Error('no options provided')
    }

    // Ensure only one processing option is provided at a time
    if ((enterprise && owner) || (enterprise && repository) || (owner && repository)) {
      throw new Error('can only use one of: enterprise, owner, repository')
    }

    // Validate output file paths when provided
    if (csv === '') {
      throw new Error('please provide a valid path for the CSV output')
    }

    if (md === '') {
      throw new Error('please provide a valid path for the markdown output')
    }

    if (json === '') {
      throw new Error('please provide a valid path for the JSON output')
    }

    // Process unique flag
    const uniqueFlag = _unique === 'both' ? 'both' : _unique === 'true'

    this.#options = {
      hostname,
      all,
      ...this.processReportOptions(flags, uniqueFlag),
      skipCache,
      archived,
      forked,
    }

    this.#output = {
      csv,
      json,
      md,
    }
  }

  /**
   * Processes report flags and sets defaults when --all is specified.
   * @param {object} flags - The CLI flags object from meow
   * @param {boolean|string} uniqueFlag - The processed unique flag value
   * @returns {object} Processed report configuration with all report options
   */
  processReportOptions(flags, uniqueFlag) {
    let {listeners, permissions, runsOn, secrets, vars, uses, all, exclude} = flags
    let processedUniqueFlag = uniqueFlag

    // When --all flag is specified, enable all report types
    if (all) {
      listeners = true
      permissions = true
      runsOn = true
      secrets = true
      uses = true
      vars = true

      // If all is true, create unique report by default
      processedUniqueFlag = 'both'
    }

    const result = {
      listeners,
      permissions,
      runsOn,
      secrets,
      vars,
      uses,
      exclude,
      uniqueFlag: processedUniqueFlag,
    }

    this.#options = result

    return result
  }

  /**
   * Formats a duration string for display in debug mode.
   * @param {Date} startTime - The start time to calculate duration from
   * @returns {string} Formatted duration string with dim styling for display
   */
  formatDuration(startTime) {
    const totalMs = new Date() - startTime
    const totalSeconds = Math.floor(totalMs / 1000)

    // Calculate time components
    const hours = Math.floor(totalSeconds / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const seconds = totalSeconds % 60
    const milliseconds = totalMs % 1000
    const parts = []

    // Build compact duration string with only non-zero values
    if (hours > 0) parts.push(`${hours}h`)
    if (minutes > 0) parts.push(`${minutes}m`)

    // Always display seconds and milliseconds for precise timing
    parts.push(`${seconds}s`)
    parts.push(`${milliseconds}ms`)

    return dim(`took ${parts.join(' ')}`)
  }

  /**
   * Handles cache operations for entity processing.
   * @param {string} entityName - The name of the entity for cache path
   * @returns {Promise<{isCached: boolean, data: any}>} Cache status and data
   */
  async handleCache(entityName) {
    // Skip cache operations if cache is disabled
    if (this.#options.skipCache) {
      this.#logger.debug(`Cache disabled for ${entityName}`)
      return {isCached: false, data: null}
    }

    const cache = this.#cache
    const cachePath = `${process.cwd()}/cache/${entityName}.json`

    cache.path = cachePath
    this.#logger.debug(`Checking cache for ${entityName} at ${cachePath}`)

    const isCached = await cache.exists()

    if (isCached) {
      this.#logger.debug(`Cache hit for ${entityName}`)
      const data = await cache.load()

      return {isCached: true, data}
    }

    return {isCached: false, data: null}
  }

  /**
   * Saves data to the cache.
   * @param {any} data - The data to save in the cache
   * @returns {Promise<void>} A promise that resolves when the data is saved
   */
  async saveToCache(data) {
    if (this.#options.skipCache) {
      this.#logger.debug(`Cache saving skipped (cache disabled)`)
      return
    }

    const cache = this.#cache

    this.#logger.debug(`Saving data to cache at ${cache.path}`)

    await this.#cache.save(data)

    this.#logger.debug(`Data successfully saved to cache at ${cache.path}`)
  }

  /**
   * Processes an enterprise and loads its organizations and repositories.
   * @param {string} enterpriseName - The GitHub Enterprise account slug
   * @param {string} token - GitHub Personal Access Token
   * @param {string} hostname - GitHub hostname
   * @param {boolean} debug - Whether to enable debug logging
   * @param {boolean} archived - Whether to include archived repositories
   * @param {boolean} forked - Whether to include forked repositories
   * @returns {Promise<{enterprise: Enterprise, organizations: number, repositories: number}>}
   *   Enterprise data with organization and repository counts
   * @throws {Error} When enterprise loading fails or API requests fail
   */
  async processEnterprise(enterpriseName, token, hostname, debug, archived, forked) {
    const enterprise = new Enterprise(enterpriseName, {
      token,
      hostname,
      debug,
      archived,
      forked,
    })

    this.#logger.start(`Loading enterprise ${cyan(enterpriseName)}...`)

    // Brief delay to ensure spinner is visible
    await wait(500)

    const {isCached, data} = await this.handleCache(enterpriseName)

    let organizations = []
    let result = {
      organizations,
    }
    let reposCount = 0

    try {
      if (isCached) {
        organizations = data.organizations.filter(org => {
          // TODO: Skip organization if it's archived and we're excluding archived orgs

          // Filter organization repositories based on archived and forked flags
          org.repositories = org.repositories.filter(repo => {
            // Skip repository if it's archived and we're excluding archived repos
            if (archived && repo.isArchived) {
              this.#logger.warn(`Skipping archived repository ${repo.nwo}`)
              return false
            }

            // Skip repository if it's forked and we're excluding forked repos
            if (forked && repo.isFork) {
              this.#logger.warn(`Skipping forked repository ${repo.nwo}`)
              return false
            }

            reposCount += 1
            return true
          })

          return true // Keep organization in the list
        })

        result = {
          name: enterprise.name,
          id: enterprise.id,
          node_id: enterprise.node_id,
          organizations,
        }
      } else {
        // Load enterprise organizations
        await enterprise.getOrganizations(enterpriseName)

        // Get organizations and repositories from the enterprise
        organizations = enterprise.organizations

        for await (const org of enterprise.organizations) {
          const repoCount = org.repositories.length
          reposCount += repoCount

          // Get workflows for the organization
          for await (const repo of org.repositories) {
            // Create a new Repository instance for each repository
            const repoInstance = new Repository(repo.nwo, {
              token,
              hostname,
              debug,
            })

            // Load workflows for each repository
            const workflows = await repoInstance.getWorkflows(repo.owner, repo.name)

            repo.workflows = workflows
          }
        }

        result = {
          name: enterprise.name,
          id: enterprise.id,
          node_id: enterprise.node_id,
          organizations,
        }

        // Save owner data to cache
        await this.saveToCache(result)
      }

      // Log successful completion with metrics
      this.#logger.stopAndPersist({
        symbol: green('✔'),
        suffixText: this.formatDuration(this.#startTime),
        text: `Loaded ${green(result.organizations.length)} organizations and ${green(reposCount)} repositories for enterprise ${green(enterpriseName)}.`,
      })
    } catch (error) {
      this.#logger.stopAndPersist({
        symbol: red('✖'),
        suffixText: dim(error.message),
        text: `Failed to load enterprise ${cyan(enterpriseName)}.`,
      })
    }

    return result
  }

  /**
   * Processes an owner (user or organization) and loads their repositories.
   * @param {string} ownerName - The GitHub organization or user login name
   * @param {object} options - Configuration options containing token, hostname, and report settings
   * @param {Date} startTime - Start time for duration calculation and logging
   * @param {import('../util/cache.js').default} cache - Cache instance for storing results
   * @returns {Promise<{owner: Owner, repositories: number}>} Owner data with repository count
   * @throws {Error} When owner loading fails or API requests fail
   */
  async processOwner(ownerName, token, hostname, debug, archived, forked) {
    const ownerInstance = new Owner(ownerName, {token, hostname, debug, archived, forked})
    const owner = await ownerInstance.getUser(ownerName)

    this.#logger.start(`Loading ${owner.type} ${cyan(ownerName)}...`)

    // Brief delay to ensure spinner is visible
    await wait(500)

    const {isCached, data} = await this.handleCache(ownerName)
    let repositories = []

    if (isCached) {
      // If cached, use existing data
      // Filter repositories based on archived and forked flags
      repositories = data.repositories.filter(repo => {
        // Skip repository if it's archived and we're excluding archived repos
        if (archived && repo.isArchived) {
          this.#logger.warn(`Skipping archived repository ${repo.nwo}`)
          return false
        }

        // Skip repository if it's forked and we're excluding forked repos
        if (forked && repo.isFork) {
          this.#logger.warn(`Skipping forked repository ${repo.nwo}`)
          return false
        }

        return true
      })
    } else {
      // Load repositories for the owner (user or organization)
      await ownerInstance.getRepositories(ownerName)
      repositories = ownerInstance.repositories
      this.#logger.debug(`Loaded ${green(repositories.length)} repositories for ${owner.type} ${cyan(ownerName)}`)

      for (const repo of repositories) {
        const repoInstance = new Repository(repo.nwo, {
          token,
          hostname,
          debug,
        })

        // Load workflows for each repository
        const workflows = await repoInstance.getWorkflows(repo.owner, repo.name)
        this.#logger.debug(`Loaded ${green(workflows.length)} workflows for repository ${cyan(repo.nwo)}`)
        repo.workflows = workflows
      }

      // Save owner data to cache
      await this.saveToCache({
        ...owner,
        repositories,
      })
    }

    // Log successful completion with repository count
    this.#logger.stopAndPersist({
      symbol: green('✔'),
      suffixText: this.formatDuration(this.#startTime),
      text: `Loaded ${green(repositories.length)} repositories for ${owner.type} ${green(ownerName)}.`,
    })

    return {owner, repositories}
  }

  /**
   * Creates a repository instance for processing.
   * @param {string} repoName - The repository name in "owner/repo" format
   * @param {object} options - Configuration options containing token, hostname, and report settings
   * @param {Date} startTime - Start time for duration calculation and logging
   * @param {import('../util/cache.js').default} cache - Cache instance for storing results
   * @returns {Promise<{repository: Repository}>} Repository data for processing
   * @throws {Error} When repository loading fails or API requests fail
   */
  async processRepository(repoName, token, hostname, debug, archived, forked) {
    const repo = new Repository(repoName, {token, hostname, debug, archived, forked})

    this.#logger.start(`Loading repository ${cyan(repoName)}...`)

    // Brief delay to ensure spinner is visible and allow API processing
    await wait(500)

    const [ownerName, repoShortName] = repoName.split('/')
    const {isCached, data} = await this.handleCache(`${ownerName}_${repoShortName}`)
    let result = null

    if (isCached) {
      result = data
    } else {
      const repository = await repo.getRepo(repoName)
      repository.workflows = await repo.getWorkflows(repo.owner, repo.name)
      this.#logger.debug(`Loaded ${repository.workflows.length} workflows for repository ${repoName}`)

      // Save repository data to cache
      await this.saveToCache(repository)

      result = repository
    }

    // Log successful completion
    this.#logger.stopAndPersist({
      symbol: green('✔'),
      suffixText: this.formatDuration(this.#startTime),
      text: `Loaded repository ${green(repoName)}.`,
    })

    return result
  }

  /**
   * Processes collected repository data to generate reports.
   * Handles different data structures from enterprise, owner, or single repository requests.
   * @param {object} data - The collected data structure containing repositories and workflows
   * @returns {Promise<Array>} - Array of processed report data
   */
  async createReport(data) {
    this.#logger.debug(`Processing report with options: ${JSON.stringify(this.#options)}`)

    // Get repositories from different data structures
    const repos = this.extractRepositoriesFromData(data)
    if (repos.length === 0) {
      this.#logger.error(`${red('✖')} No data found to process.`, 'Stopping report generation.')

      return []
    }

    // Initialize report data structure
    const reportData = []
    const reportTotalCounts = {
      repos: 0,
      workflows: 0,
      listeners: 0,
      permissions: 0,
      runsOn: 0,
      secrets: 0,
      uses: 0,
      vars: 0,
    }

    // Process each repository
    for await (const repo of repos) {
      await this.processRepositoryWorkflows(repo, reportData, reportTotalCounts)
    }

    // Log summary of processing results
    this.logProcessingResults(reportTotalCounts)

    return reportData
  }

  /**
   * Extracts repositories from different data structures
   * @param {object} data - Input data that could be in various formats
   * @returns {Array} - Array of repositories
   */
  extractRepositoriesFromData(data) {
    // Enterprise: data.organizations[].repositories
    // Owner: data.repositories
    // Repository: data
    if (data.organizations) {
      // If processing an enterprise, flatten all repositories from organizations
      return data.organizations.flatMap(org => org.repositories)
    } else if (data.repositories) {
      // If processing an owner, use the repositories directly
      return data.repositories
    } else if (data.workflows) {
      // If processing a single repository, wrap it in an array
      return [data]
    }
    return []
  }

  /**
   * Processes a single repository's workflows
   * @param {object} repo - Repository object containing workflows to process
   * @param {Array} reportData - Collection to store workflow data
   * @param {object} reportTotalCounts - Counters to track statistics
   * @returns {Promise<void>}
   */
  async processRepositoryWorkflows(repo, reportData, reportTotalCounts) {
    // Increment repository count
    reportTotalCounts.repos += 1

    const wfs = repo.workflows || []
    this.#logger.text = `Processing repository ${cyan(repo.nwo)} workflows...`

    if (wfs.length === 0) {
      this.#logger.stopAndPersist({
        symbol: dim('-'),
        text: `No workflows found in repository ${cyan(repo.nwo)}.`,
      })

      return
    }

    try {
      // Process each workflow according to enabled report options
      for (const wf of wfs) {
        const workflowData = this.processWorkflow(wf, repo, reportTotalCounts)
        if (workflowData) reportData.push(workflowData)
      }

      this.#logger.stopAndPersist({
        symbol: green('✔'),
        text: `Found ${green(wfs.length)} workflows in repository ${cyan(repo.nwo)}`,
      })
    } catch (error) {
      this.#logger.stopAndPersist({
        symbol: red('✖'),
        suffixText: dim(error.message),
        text: `Failed to find workflows in repository ${cyan(repo.nwo)}.`,
      })

      // Log full stack trace only in debug mode for troubleshooting
      this.#logger.isDebug && this.#logger.error(error.stack)
    }
  }

  /**
   * Processes a single workflow file
   * @param {object} wf - Workflow object with yaml and text content
   * @param {object} repo - Parent repository object
   * @param {object} reportTotalCounts - Counters to update
   * @returns {object|null} - Workflow data or null if workflow couldn't be processed
   */
  processWorkflow(wf, repo, reportTotalCounts) {
    const {language, text, yaml} = wf

    if (language !== 'YAML') {
      this.#logger.warn(
        `Skipping workflow ${wf.path} in repository ${repo.nwo} due to unsupported language: ${language}`,
      )
      return null
    }

    // Increment workflow count
    reportTotalCounts.workflows += 1

    const workflowData = this.createWorkflowDataObject(wf, repo)

    // Extract all configured data from the workflow
    this.extractWorkflowContents(workflowData, yaml, text, reportTotalCounts)

    return workflowData
  }

  /**
   * Creates the initial workflow data object
   * @param {object} wf - Workflow object
   * @param {object} repo - Repository object
   * @returns {object} - New workflow data object
   */
  createWorkflowDataObject(wf, repo) {
    const res = {
      id: wf.node_id,
      owner: repo.owner,
      repo: repo.name,
      name: wf.yaml.name,
      workflow: wf.path,
      state: wf.state,
      created_at: wf.created_at,
      updated_at: wf.updated_at,
      last_run_at: wf.last_run_at,
    }

    if (this.#options.listeners) res.listeners = new Set()
    if (this.#options.permissions) res.permissions = new Set()
    if (this.#options.runsOn) res.runsOn = new Set()
    if (this.#options.secrets) res.secrets = new Set()
    if (this.#options.vars) res.vars = new Set()
    if (this.#options.uses) res.uses = new Set()

    return res
  }

  /**
   * Extracts all configured components from a workflow
   * @param {object} workflowData - Object to store extracted data
   * @param {object} yaml - Parsed YAML content of the workflow
   * @param {string} text - Raw text content of the workflow
   * @param {object} reportTotalCounts - Counters to update
   * @private
   */
  extractWorkflowContents(workflowData, yaml, text, reportTotalCounts) {
    // Extract listeners
    if (this.#options.listeners) {
      const listeners = this.extractListeners(yaml)
      workflowData.listeners = new Set([...workflowData.listeners, ...listeners])
      reportTotalCounts.listeners += listeners.length
    }

    // Extract permissions
    if (this.#options.permissions) {
      const permissions = this.extractPermissions(yaml)
      workflowData.permissions = new Set([...workflowData.permissions, ...permissions])
      reportTotalCounts.permissions += permissions.length
    }

    // Extract runs-on values
    if (this.#options.runsOn) {
      const runsOnValues = this.extractRunsOn(yaml)
      workflowData.runsOn = new Set([...workflowData.runsOn, ...runsOnValues])
      reportTotalCounts.runsOn += runsOnValues.length
    }

    // Extract secrets
    if (this.#options.secrets) {
      const secrets = this.extractSecrets(text)
      workflowData.secrets = new Set([...workflowData.secrets, ...secrets])
      reportTotalCounts.secrets += secrets.size
    }

    // Extract vars
    if (this.#options.vars) {
      const vars = this.extractVars(text)
      workflowData.vars = new Set([...workflowData.vars, ...vars])
      reportTotalCounts.vars += vars.size
    }

    // Extract uses
    if (this.#options.uses) {
      const uses = this.extractUses(text)
      workflowData.uses = new Set([...workflowData.uses, ...uses])
      reportTotalCounts.uses += uses.size
    }
  }

  /**
   * Logs the results of processing the report
   * @param {object} reportTotalCounts - Statistics to log
   * @private
   */
  logProcessingResults(reportTotalCounts) {
    this.#logger.debug('Report processing complete. Found:')
    this.#logger.debug(`\trepos:        ${reportTotalCounts.repos}`)
    this.#logger.debug(`\tworkflows:    ${reportTotalCounts.workflows}`)

    if (this.#options.listeners) this.#logger.debug(`\tlisteners:    ${reportTotalCounts.listeners}`)
    if (this.#options.permissions) this.#logger.debug(`\tpermissions:  ${reportTotalCounts.permissions}`)
    if (this.#options.runsOn) this.#logger.debug(`\trunsOn:       ${reportTotalCounts.runsOn}`)
    if (this.#options.secrets) this.#logger.debug(`\tsecrets:      ${reportTotalCounts.secrets}`)
    if (this.#options.vars) this.#logger.debug(`\tvars:         ${reportTotalCounts.vars}`)
    if (this.#options.uses) this.#logger.debug(`\tuses:         ${reportTotalCounts.uses}`)
  }

  /**
   * Generic method for extracting key values from workflow YAML
   * @param {object} yaml - The workflow YAML object
   * @param {string} key - The key to look for in the YAML
   * @param {string} optionFlag - The option flag name to check in this.#options
   * @param {string[]} results - Array to store extracted values
   * @returns {string[]} - Array of unique values for the given key
   * @private
   */
  extractYamlKeyValues(yaml, key, optionFlag, results = []) {
    // Early return if option is disabled
    if (!this.#options[optionFlag]) {
      return results
    }

    // Return original array if yaml is null or not an object
    if (!yaml || typeof yaml !== 'object') {
      return results
    }

    const res = results

    for (const k in yaml) {
      const value = yaml[k]

      // Special handling for runs-on key - only look at job level (immediate children of jobs)
      if (key === 'runs-on' && k === 'steps') {
        // Skip "steps" sections when looking for runs-on as it's only valid at job level
        continue
      }

      // Recursively search nested objects
      if (k !== key && typeof value === 'object') {
        this.extractYamlKeyValues(value, key, optionFlag, res)
      }

      // Handle when we find the target key
      if (k === key) {
        // Handle object values (like 'on' with multiple events or 'permissions' with multiple settings)
        if (typeof value === 'object') {
          for (const i in value) {
            let formattedValue = ''

            // Handle special cases for different key types
            switch (key) {
              case 'on':
                // Event triggers can be with or without configurations
                formattedValue = value[i] ? `${i}: ${JSON.stringify(value[i])}`.replace(/"/g, '') : i
                break
              case 'permissions':
                formattedValue = `${i}: ${value[i]}`
                break
              default:
                formattedValue = value[i]
                break
            }

            // Only add unique values
            if (!res.includes(formattedValue)) {
              res.push(formattedValue)
            }
          }
        }
        // Handle string values (like simple 'runs-on: ubuntu-latest')
        else if (typeof value === 'string' && !res.includes(value)) {
          res.push(value)
        }
      }
    }

    return res
  }

  /**
   * Extracts listeners from a workflow
   * @param {object} yaml - The workflow YAML object
   * @param {string[]} results - Array to store extracted listeners
   * @returns {string[]} - Array of unique listeners
   * @private
   */
  extractListeners(yaml, results = []) {
    return this.extractYamlKeyValues(yaml, 'on', 'listeners', results)
  }

  /**
   * Extracts permissions from a workflow
   * @param {object} yaml - The workflow YAML object
   * @param {string[]} results - Array to store extracted permissions
   * @returns {string[]} - Array of unique permissions
   * @private
   */
  extractPermissions(yaml, results = []) {
    return this.extractYamlKeyValues(yaml, 'permissions', 'permissions', results)
  }

  /**
   * Extracts runs-on values from a workflow
   * @param {object} yaml - The workflow YAML object
   * @param {string[]} results - Array to store extracted runs-on values
   * @returns {string[]} - Array of unique runs-on values
   * @private
   */
  extractRunsOn(yaml, results = []) {
    return this.extractYamlKeyValues(yaml, 'runs-on', 'runsOn', results)
  }

  /**
   * @private
   * @type {RegExp}
   * @description This regex captures the secret name after "secrets." in the format {{ secrets.secretName }}.
   * It allows for optional whitespace around the secret name.
   */
  #secretsRegex = /\$\{\{\s?secrets\.(.*)\s?\}\}/g

  /**
   * Extracts secrets from a workflow
   * @param {string} text - The workflow text content
   * @returns {Set<string>} - Set of extracted secrets
   * @private
   */
  extractSecrets(text) {
    const result = new Set()

    if (this.#options.secrets && text) {
      const matches = [...text.matchAll(this.#secretsRegex)]

      for (const match of matches) {
        const secretName = match[1].trim()

        if (secretName) result.add(secretName)
      }
    }

    return result
  }

  /**
   * @private
   * @type {RegExp}
   * @description This regex captures the variable name after "vars." in the format {{ vars.varName }}.
   * It allows for optional whitespace around the variable name.
   */
  #varsRegex = /\$\{\{\s?vars\.(.*)\s?\}\}/g

  /**
   * Extracts vars from a workflow
   * @param {string} text - The workflow text content
   * @returns {Set<string>} - Set of extracted vars
   * @private
   */
  extractVars(text) {
    const result = new Set()

    if (this.#options.vars && text) {
      const matches = [...text.matchAll(this.#varsRegex)]

      for (const match of matches) {
        const varName = match[1].trim()

        if (varName) result.add(varName)
      }
    }

    return result
  }

  /**
   * @private
   * @type {RegExp}
   * @description This regex captures the uses value in the format "uses: owner/repo@ref" or "uses: owner/repo".
   * It allows for optional whitespace around the colon and uses value.
   */
  #usesRegex = /([^\s+]|[^\t+])uses:\s*(.*)/g

  /**
   * Extracts uses values from a workflow
   * @param {string} text - The workflow text content
   * @returns {Set<string>} - Set of extracted uses values
   * @private
   */
  extractUses(text) {
    const result = new Set()

    if (this.#options.uses && text) {
      const matches = [...text.matchAll(this.#usesRegex)]

      for (const match of matches) {
        let usesValue = match[2].trim()
        if (usesValue.indexOf('/') < 0 && usesValue.indexOf('.') < 0) {
          this.#logger.debug(`Skipping uses value without owner/repo: ${usesValue}`)
          continue
        }

        // Exclude actions created by GitHub (owner: actions||github)
        if (this.#options.exclude && (usesValue.startsWith('actions/') || usesValue.startsWith('github/'))) {
          this.#logger.warn(`Excluding ${usesValue} created by GitHub.`)
          continue
        }

        // strip '|" from uses
        usesValue = usesValue.replace(/('|")/g, '').trim()

        // remove comments from uses
        usesValue = usesValue.split(/ #.*$/)[0].trim()

        if (!result.has(usesValue)) result.add(usesValue)
      }
    }

    return result
  }

  /**
   * Helper method to save a report of a specific type
   * @param {string} type - The report type ('CSV', 'JSON', or 'Markdown')
   * @param {string} filePath - Path where the report will be saved
   * @param {Class} ReportClass - The report class to instantiate (Csv, Json, or Markdown)
   * @param {string} outputKey - The key in this.#output for the report data
   * @param {string} fileExtension - File extension for the report type
   * @param {object} data - The data to save in the report
   * @returns {Promise<void>}
   * @private
   */
  async saveReportOfType(type, filePath, ReportClass, outputKey, fileExtension, data) {
    this.#logger.start(`Saving ${type} report...`)

    try {
      const report = new ReportClass(this.#output[outputKey], this.#options, data)

      // Handle 3 scenarios based on uniqueFlag:
      // - false: only save regular report, no unique report
      // - true: only save unique report (without .unique suffix)
      // - 'both': save both regular and unique reports
      const {uniqueFlag, uses} = this.#options

      if (uniqueFlag === true && uses) {
        // For uniqueFlag === true, only save unique report (without .unique suffix)
        await report.saveUnique()

        this.#logger.stopAndPersist({
          symbol: green('✔'),
          text: `Unique ${type} report saved to ${blue(filePath)}`,
        })
      } else {
        // For uniqueFlag === false or 'both', save the regular report
        await report.save()

        this.#logger.stopAndPersist({
          symbol: green('✔'),
          text: `${type} report saved to ${blue(filePath)}`,
        })

        // For uniqueFlag === 'both', also save the unique report
        if (uniqueFlag === 'both' && uses) {
          this.#logger.start(`Saving unique ${type} report...`)
          await report.saveUnique()
          const uniquePath = filePath.replace(`.${fileExtension}`, `.unique.${fileExtension}`)

          this.#logger.stopAndPersist({
            symbol: green('✔'),
            text: `Unique ${type} report saved to ${blue(uniquePath)}`,
          })
        }
      }
    } catch (error) {
      this.#logger.stopAndPersist({
        symbol: red('✖'),
        suffixText: dim(error.message),
        text: `Failed to save ${type} report`,
      })

      // Log full stack trace only in debug mode for troubleshooting
      this.#logger.isDebug && this.#logger.error(error.stack)
    }
  }

  /**
   * Saves generated reports to specified file paths.
   * Supports CSV, JSON, and Markdown report formats.
   * @param {object} data - The report data to save
   * @returns {Promise<void>}
   */
  async saveReports(data) {
    this.#logger.debug(JSON.stringify(this.#output))
    const {csv, json, md} = this.output

    if (!csv && !json && !md) {
      this.#logger.warn('No output paths provided for reports. Skipping to save reports.')
      return
    }

    // Check if the folder exists we're saving the reports to
    // If not, create it
    const outputDir = path.dirname(csv || json || md)
    try {
      await fs.access(outputDir)
    } catch (error) {
      this.#logger.debug(`Output directory ${outputDir} does not exist. Creating...`)
      await fs.mkdir(outputDir, {recursive: true})
      this.#logger.debug(`Output directory ${outputDir} created.`)
    }

    // Empty line
    !this.#logger.isDebug && console.log('')

    // Save each report type if path is provided
    if (csv) {
      await this.saveReportOfType('CSV', csv, CsvReporter, 'csv', 'csv', data)
    }

    if (json) {
      await this.saveReportOfType('JSON', json, JsonReporter, 'json', 'json', data)
    }

    if (md) {
      await this.saveReportOfType('Markdown', md, MarkdownReporter, 'md', 'md', data)
    }
  }
}
