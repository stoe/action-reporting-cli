import chalk from 'chalk'

import Base from './base.js'

// GitHub API classes
import Workflow from './workflow.js'

// Utilities
import wait from '../util/wait.js'

const {cyan} = chalk

/**
 * Represents a GitHub repository with associated metadata and workflows.
 * @extends Base
 */
export default class Repository extends Base {
  #logger
  #options

  // Private fields
  #nwo
  #owner
  #name
  #repo
  #id
  #node_id
  #visibility
  #isArchived
  #isFork
  #branch

  // Private field for workflows
  #workflows

  /**
   * Creates a new Repository instance.
   * @param {string} nwo - The name with owner of the repository (e.g., "owner/repo")
   * @param {object} [options={}] - Configuration options for the repository
   * @param {string|null} [options.token=null] - GitHub personal access token
   * @param {string|null} [options.hostname=null] - GitHub hostname for Enterprise servers
   * @param {boolean} [options.debug=false] - Enable debug mode
   * @throws {Error} Throws an error if the repository name format is invalid
   */
  constructor(
    nwo,
    options = {
      token: null,
      hostname: null,
      debug: false,
    },
  ) {
    super(options)
    this.#options = options

    this.#nwo = nwo

    const parts = nwo.split('/')
    if (parts.length !== 2) {
      throw new Error('Repository name must be in format "owner/repo"')
    }

    const [owner, name] = parts

    this.#owner = owner
    this.#name = name

    this.#repo = {
      owner,
      name,
    }

    // Initialize repository properties
    this.#id = undefined
    this.#node_id = undefined
    this.#visibility = undefined
    this.#isArchived = undefined
    this.#isFork = undefined
    this.#branch = undefined

    this.#workflows = []
  }

  /**
   * Gets the repository name with owner (e.g., "owner/repo").
   * @returns {string} The repository name with owner
   */
  get nwo() {
    return this.#nwo
  }

  /**
   * Sets the repository name with owner.
   * @param {string} nwo - The repository name with owner
   */
  set nwo(nwo) {
    this.#nwo = nwo
  }

  /**
   * Gets the repository owner.
   * @returns {string} The repository owner
   */
  get owner() {
    return this.#owner
  }

  /**
   * Sets the repository owner.
   * @param {string} owner - The repository owner
   */
  set owner(owner) {
    this.owner = owner
  }

  /**
   * Gets the repository name.
   * @returns {string} The repository name
   */
  get name() {
    return this.#name
  }

  /**
   * Sets the repository name.
   * @param {string} name - The repository name
   */
  set name(name) {
    this.#name = name
  }

  /**
   * Gets the repository object with owner and name.
   * @returns {object} The repository object
   */
  get repo() {
    return this.#repo
  }

  /**
   * Sets the repository object.
   * @param {object} repo - The repository object
   */
  set repo(repo) {
    this.#repo = repo
  }

  /**
   * Gets the repository ID.
   * @returns {number|undefined} The repository ID
   */
  get id() {
    return this.#id
  }

  /**
   * Sets the repository ID.
   * @param {number} id - The repository ID
   */
  set id(id) {
    this.#id = id
  }

  /**
   * Gets the repository node ID.
   * @returns {string|undefined} The repository node ID
   */
  get node_id() {
    return this.#node_id
  }

  /**
   * Sets the repository node ID.
   * @param {string} node_id - The repository node ID
   */
  set node_id(node_id) {
    this.#node_id = node_id
  }

  /**
   * Gets the repository visibility.
   * @returns {string|undefined} The repository visibility (public, private, internal)
   */
  get visibility() {
    return this.#visibility
  }

  /**
   * Sets the repository visibility.
   * @param {string} visibility - The repository visibility
   */
  set visibility(visibility) {
    this.#visibility = visibility
  }

  /**
   * Gets whether the repository is archived.
   * @returns {boolean|undefined} True if the repository is archived
   */
  get isArchived() {
    return this.#isArchived
  }

  /**
   * Sets whether the repository is archived.
   * @param {boolean} isArchived - True if the repository is archived
   */
  set isArchived(isArchived) {
    this.#isArchived = isArchived
  }

  /**
   * Gets whether the repository is a fork.
   * @returns {boolean|undefined} True if the repository is a fork
   */
  get isFork() {
    return this.#isFork
  }

  /**
   * Sets whether the repository is a fork.
   * @param {boolean} isFork - True if the repository is a fork
   */
  set isFork(isFork) {
    this.#isFork = isFork
  }

  /**
   * Gets the default branch name.
   * @returns {string|undefined} The default branch name
   */
  get branch() {
    return this.#branch
  }

  /**
   * Sets the default branch name.
   * @param {string} branch - The default branch name
   */
  set branch(branch) {
    this.#branch = branch
  }

  /**
   * Gets the workflows array.
   * @returns {Array} The array of workflows
   */
  get workflows() {
    return this.#workflows
  }

  /**
   * Sets the workflows array.
   * @param {Array} workflows - The array of workflows
   */
  set workflows(workflows) {
    this.#workflows = workflows
  }

  /**
   * Gets the options object.
   * @returns {object} The options object
   */
  get options() {
    return this.#options
  }

  /**
   * Get the repository details from GitHub.
   * @async
   * @param {string} repoName - The name of the repository in the format "owner/repo"
   * @returns {Promise<object>} The repository details
   * @throws {Error} Throws an error if the repository is not found or if fetching fails
   */
  async getRepo(repoName) {
    try {
      const [o, n] = repoName.split('/')

      const {
        data: {
          data: {
            repository: {
              nwo,
              owner: {login: owner},
              name,
              id,
              node_id,
              visibility,
              isArchived,
              isFork,
              defaultBranchRef,
            },
          },
        },
      } = await this.octokit.request('POST /graphql', {
        query: REPO_QUERY,
        variables: {owner: o, name: n},
      })

      this.#nwo = nwo
      this.#owner = owner
      this.#name = name
      this.#repo = {
        owner: owner.login,
        name: name,
      }
      this.#id = id
      this.#node_id = node_id
      this.#visibility = visibility
      this.#isArchived = isArchived
      this.#isFork = isFork
      this.#branch = defaultBranchRef?.name || undefined

      return {
        nwo,
        owner,
        name,
        repo: {
          owner,
          name,
        },
        id,
        node_id,
        visibility,
        isArchived,
        isFork,
        branch: defaultBranchRef?.name || undefined,
      }
    } catch (error) {
      if (error.status === 404 || error.message.includes('Could not resolve to a Repository')) {
        this.#logger.error(`Repository ${repoName} not found.`)

        return {}
      } else {
        this.#logger.error(`Failed to fetch repository ${repoName}: ${error.message}`)
        return {}
      }
    }
  }

  /**
   * Fetches all workflows in the repository.
   * @async
   * @param {string} owner - The repository owner
   * @param {string} repo - The repository name
   * @returns {Promise<Array>} Array of workflow objects
   */
  async getWorkflows(owner, repo) {
    this.spinner.text = `Loading workflows for repository ${cyan(`${owner}/${repo}`)}...`

    try {
      const {
        data: {
          data: {repository},
        },
      } = await this.octokit.request('POST /graphql', {
        query: WORKFLOWS_QUERY,
        variables: {
          owner,
          name: repo,
        },
      })

      const wfs = []
      if (repository.object && repository.object.entries) {
        for (const entry of repository.object.entries) {
          // Skip non-YAML files
          if (!entry.path.endsWith('.yml') && !entry.path.endsWith('.yaml')) continue

          const wf = new Workflow(entry, {
            token: this.options.token,
            hostname: this.options.hostname,
            debug: this.options.debug,
          })
          const wfData = await wf.getWorkflow(owner, repo, entry.path)

          wfs.push(wfData)
        }
      }

      this.#workflows = wfs
      return wfs
    } catch (error) {
      return []
    }
  }
}

const REPO_QUERY = `query ($owner: String!, $name: String!) {
  repository(owner: $owner, name: $name) {
    nwo: nameWithOwner
    owner {
      login
    }
    name
    id: databaseId
    node_id: id
    visibility
    isArchived
    isFork
    defaultBranchRef {
      name
    }
  }
}`

const WORKFLOWS_QUERY = `query ($owner: String!, $name: String!) {
  repository(owner: $owner, name: $name) {
    object(expression: "HEAD:.github/workflows") {
      ... on Tree {
        entries {
          name
          path
          language { name }
          extension
          type
          object {
            ... on Blob {
              text
              node_id: id
              abbreviatedOid
              byteSize
              isBinary
              isTruncated
            }
          }
        }
      }
    }
  }
}`
