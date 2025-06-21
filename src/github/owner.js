import chalk from 'chalk'

import Base from './base.js'

// Utilities
import wait from '../util/wait.js'

const {cyan} = chalk

/**
 * Represents a GitHub organization or user with associated repositories.
 * @extends Base
 */
export default class Owner extends Base {
  #logger

  // Private fields
  #options
  #login
  #name
  #type
  #id
  #node_id
  #repositories

  /**
   * Creates a new Owner instance.
   * @param {string} name - The login name of the owner (user or organization)
   * @param {object} [options={}] - Configuration options for the owner
   * @param {string|null} [options.token=null] - GitHub personal access token
   * @param {string|null} [options.hostname=null] - GitHub hostname for Enterprise servers
   * @param {boolean} [options.debug=false] - Enable debug mode
   * @param {boolean} [options.archived=false] - Skip archived repositories
   * @param {boolean} [options.forked=false] - Skip forked repositories
   */
  constructor(
    name,
    options = {
      token: null,
      hostname: null,
      debug: false,
      archived: false,
      forked: false,
    },
  ) {
    super(options)
    this.#options = options

    this.#login = name
    this.#name = name
    this.#type = undefined
    this.#id = undefined
    this.#node_id = undefined

    this.#repositories = []
  }

  /**
   * Gets the owner login name.
   * @returns {string|undefined} The owner login name
   */
  get login() {
    return this.#login
  }

  /**
   * Sets the owner login name.
   * @param {string} login - The owner login name
   */
  set login(login) {
    this.#login = login
  }

  /**
   * Gets the owner display name.
   * @returns {string|undefined} The owner display name
   */
  get name() {
    return this.#name
  }

  /**
   * Sets the owner display name.
   * @param {string} name - The owner display name
   */
  set name(name) {
    this.#name = name
  }

  /**
   * Gets the owner ID.
   * @returns {number|undefined} The owner ID
   */
  get id() {
    return this.#id
  }

  /**
   * Sets the owner ID.
   * @param {number} id - The owner ID
   */
  set id(id) {
    this.#id = id
  }

  /**
   * Gets the owner node ID.
   * @returns {string|undefined} The owner node ID
   */
  get node_id() {
    return this.#node_id
  }

  /**
   * Sets the owner node ID.
   * @param {string} node_id - The owner node ID
   */
  set node_id(node_id) {
    this.#node_id = node_id
  }

  /**
   * Gets the owner type (user or organization).
   * @returns {string|undefined} The owner type
   */
  get type() {
    return this.#type
  }

  /**
   * Sets the owner type.
   * @param {string} type - The owner type (user or organization)
   */
  set type(type) {
    this.#type = type.toLowerCase()
  }

  /**
   * Gets the repositories array.
   * @returns {Array} The array of repositories
   */
  get repositories() {
    return this.#repositories
  }

  /**
   * Sets the repositories array.
   * @param {Array} repositories - The array of repositories
   */
  set repositories(repositories) {
    this.#repositories = repositories
  }

  /**
   * Gets the options object.
   * @returns {object} The options object
   */
  get options() {
    return this.#options
  }

  /**
   * Fetches user information from GitHub API.
   * @async
   * @param {string} user - The login name of the user
   * @returns {Promise<object>} User information including login, name, id, node_id, and type
   * @throws {Error} Throws an error if the user is not found or API request fails
   */
  async getUser(user) {
    try {
      const {
        data: {login, id, node_id, type, name},
      } = await this.octokit.request('GET /users/{username}', {
        username: user,
      })

      this.login = login
      this.name = name
      this.id = id
      this.node_id = node_id
      this.type = type || ''
    } catch (error) {
      if (error.status === 404) {
        this.logger.error(`User ${user} not found`)
        throw new Error(`User ${user} not found`)
      } else {
        this.logger.error(`Error fetching user ${user}: ${error.message}`)
        throw error
      }
    }

    return {
      login: this.login,
      name: this.name,
      id: this.id,
      node_id: this.node_id,
      type: this.type,
    }
  }

  /**
   * Fetches repositories for the owner using GraphQL pagination.
   * @async
   * @param {string} login - The login name of the owner (user or organization)
   * @param {string|null} [cursor=null] - Pagination cursor for GraphQL query
   * @returns {Promise<Array>} Array of repository objects
   */
  async getRepositories(login, cursor = null) {
    const query = this.getRepositoryQuery()
    this.logger.debug(`Fetching repositories for user ${login}${cursor ? ` with cursor ${cursor}` : ''}`)

    const {
      repositoryOwner: {
        repositories: {nodes, pageInfo},
      },
    } = await this.octokit.graphql(
      query,
      {
        user: login,
        cursor,
      },
      {
        headers: {
          'X-Github-Next-Global-ID': 1,
        },
      },
    )

    nodes.map(async data => {
      this.spinner.text = `Loading repository ${cyan(data.nwo)}...`

      // Add repository to the list
      this.#repositories.push({
        nwo: data.nwo,
        owner: data.owner.login,
        name: data.name,
        repo: {
          owner: data.owner.login,
          name: data.name,
        },
        id: data.id,
        node_id: data.node_id,
        visibility: data.visibility,
        isArchived: data.isArchived,
        isFork: data.isFork,
        branch: data.defaultBranchRef?.name || undefined,
      })
    })

    // Sleep for 1s to avoid hitting the rate limit
    await wait(1000)

    // Paginate through the repositories
    if (pageInfo.hasNextPage) {
      await this.getRepositories(login, pageInfo.endCursor)
    }

    return this.#repositories
  }

  getRepositoryQuery() {
    const {archived, forked} = this.#options

    archived && this.logger.warn('Skipping archived repositories.')
    forked && this.logger.warn('Skipping forked repositories.')

    return `query ($user: String!, $cursor: String = null) {
  repositoryOwner(login: $user) {
    repositories(
      first: 50
      after: $cursor
      orderBy: { field: UPDATED_AT, direction: DESC }
      ownerAffiliations: OWNER
      ${archived ? 'isArchived: false' : ''}
      ${forked ? 'isFork: false' : ''}
    ) {
      pageInfo {
        hasNextPage
        endCursor
      }
      nodes {
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
    }
  }
}`
  }
}
