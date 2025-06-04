import chalk from 'chalk'

import Base from './base.js'

// GitHub API classes
import Owner from './owner.js'

// Utilities
import wait from '../util/wait.js'

const {cyan} = chalk

/**
 * Represents a GitHub Enterprise instance with associated organizations.
 * @extends Base
 */
export default class Enterprise extends Base {
  #logger
  #options

  // Private fields
  #name
  #id
  #node_id
  #organizations

  /**
   * Creates a new Enterprise instance.
   * @param {string} name - The name of the enterprise
   * @param {object} [options={}] - Configuration options for the enterprise
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

    this.#name = name
    this.#id = undefined
    this.#node_id = undefined

    this.#organizations = []
  }

  /**
   * Gets the enterprise name.
   * @returns {string} The enterprise name
   */
  get name() {
    return this.#name
  }

  /**
   * Sets the enterprise name.
   * @param {string} name - The enterprise name
   */
  set name(name) {
    this.#name = name
  }

  /**
   * Gets the enterprise ID.
   * @returns {number|undefined} The enterprise ID
   */
  get id() {
    return this.#id
  }

  /**
   * Sets the enterprise ID.
   * @param {number} id - The enterprise ID
   */
  set id(id) {
    this.#id = id
  }

  /**
   * Gets the enterprise node ID.
   * @returns {string|undefined} The enterprise node ID
   */
  get node_id() {
    return this.#node_id
  }

  /**
   * Sets the enterprise node ID.
   * @param {string} node_id - The enterprise node ID
   */
  set node_id(node_id) {
    this.#node_id = node_id
  }

  /**
   * Gets the organizations array.
   * @returns {Array} The array of organizations
   */
  get organizations() {
    return this.#organizations
  }

  /**
   * Sets the organizations array.
   * @param {Array} organizations - The array of organizations
   */
  set organizations(organizations) {
    this.#organizations = organizations
  }

  /**
   * Gets the options object.
   * @returns {object} The options object
   */
  get options() {
    return this.#options
  }

  /**
   * Fetches all organizations for this enterprise using GraphQL pagination.
   * @async
   * @param {string} enterprise - The enterprise slug
   * @param {string|null} [cursor=null] - Pagination cursor for GraphQL query
   * @returns {Promise<Array>} Array of organization objects with repositories
   */
  async getOrganizations(enterprise, cursor = null) {
    if (!enterprise) {
      return []
    }

    const {
      enterprise: {
        name,
        id,
        node_id,
        organizations: {nodes, pageInfo},
      },
    } = await this.octokit.graphql(ENTERPRISE_QUERY, {enterprise, cursor})

    this.#name = name
    this.#id = id
    this.#node_id = node_id

    // Process each organization and fetch its repositories
    await Promise.all(
      nodes.map(async data => {
        const org = new Owner(data.login, this.options)

        org.login = data.login
        org.name = data.name
        org.id = data.id
        org.node_id = data.node_id
        org.type = 'organization'

        // Load repositories for the organization
        this.spinner.text = `Loading organization ${cyan(data.login)}...`
        const repos = await org.getRepositories(data.login)

        // Add the organization to the list
        this.#organizations.push({
          login: org.login,
          name: org.name,
          id: org.id,
          node_id: org.node_id,
          type: 'organization',
          repositories: repos,
        })
      }),
    )

    // Sleep for 1s to avoid hitting the rate limit
    await wait(1000)

    // Paginate through the organizations
    if (pageInfo.hasNextPage) {
      await this.getOrganizations(enterprise, pageInfo.endCursor)
    }

    return this.#organizations
  }
}

/**
 * GraphQL query to fetch enterprise information and organizations.
 * Retrieves enterprise metadata and paginated organization data.
 */
const ENTERPRISE_QUERY = `query ($enterprise: String!, $cursor: String = null) {
  enterprise(slug: $enterprise) {
    name: slug
    id: databaseId
    node_id: id
    organizations(first: 5, after: $cursor) {
      pageInfo {
        hasNextPage
        endCursor
      }
      nodes {
        name
        login
        id: databaseId
        node_id: id
      }
    }
  }
}
`
