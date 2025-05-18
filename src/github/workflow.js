import {load} from 'js-yaml'

import Base from './base.js'

// Utilities
import wait from '../util/wait.js'

/**
 * Represents a GitHub workflow with associated metadata and actions.
 * @extends Base
 */
export default class Workflow extends Base {
  #logger
  #options

  // Private fields
  #id
  #node_id
  #file_name
  #path
  #language
  #text
  #isTruncated

  // Additional metadata
  #state
  #created_at
  #updated_at
  #last_run_at

  /**
   * Creates a new Workflow instance.
   * @param {object} wf - The workflow object containing metadata
   * @param {object} [options={}] - Configuration options for the workflow
   * @param {string|null} [options.token=null] - GitHub personal access token
   * @param {string|null} [options.hostname=null] - GitHub hostname for Enterprise servers
   * @param {boolean} [options.debug=false] - Enable debug mode
   */
  constructor(
    wf,
    options = {
      token: null,
      hostname: null,
      debug: false,
    },
  ) {
    super(options)
    this.#options = options

    // Initialize workflow properties
    this.#id = undefined
    this.#node_id = undefined
    this.#file_name = wf.name
    this.#path = wf.path
    this.#language = wf.language?.name || undefined
    this.#text = wf.object?.text
    this.#isTruncated = wf.object?.isTruncated || false

    // Addional metadata
    this.#state = undefined
    this.#created_at = undefined
    this.#updated_at = undefined
    this.#last_run_at = undefined
  }

  /**
   * Gets the workflow ID.
   * @returns {number|undefined} The workflow ID
   */
  get id() {
    return this.#id
  }

  /**
   * Sets the workflow ID.
   * @param {number} id - The workflow ID
   */
  set id(id) {
    this.#id = id
  }

  /**
   * Gets the workflow node ID.
   * @returns {string|undefined} The workflow node ID
   */
  get node_id() {
    return this.#node_id
  }

  /**
   * Sets the workflow node ID.
   * @param {string} node_id - The workflow node ID
   */
  set node_id(node_id) {
    this.#node_id = node_id
  }

  /**
   * Gets the workflow name.
   * @returns {string|undefined} The workflow name
   */
  get name() {
    return this.#file_name
  }

  /**
   * Sets the workflow name.
   * @param {string} name - The workflow name
   */
  set name(name) {
    this.#file_name = name
  }

  /**
   * Gets the workflow path.
   * @returns {string|undefined} The workflow path
   */
  get path() {
    return this.#path
  }

  /**
   * Sets the workflow path.
   * @param {string} path - The workflow path
   */
  set path(path) {
    this.#path = path
  }

  /**
   * Gets the workflow language.
   * @returns {string|undefined} The workflow language
   */
  get language() {
    return this.#language
  }

  /**
   * Sets the workflow language.
   * @param {string} language - The workflow language
   */
  set language(language) {
    this.#language = language
  }

  /**
   * Gets the workflow text.
   * @returns {string|undefined} The workflow text
   */
  get text() {
    return this.#text
  }

  /**
   * Sets the workflow text.
   * @param {string} text - The workflow text
   */
  set text(text) {
    this.#text = text
  }

  /**
   * Gets whether the workflow text is truncated.
   * @returns {boolean} True if the workflow text is truncated, false otherwise
   */
  get isTruncated() {
    return this.#isTruncated
  }

  /**
   * Sets whether the workflow text is truncated.
   * @param {boolean} isTruncated - True if the workflow text is truncated, false otherwise
   */
  set isTruncated(isTruncated) {
    this.#isTruncated = isTruncated
  }

  /**
   * Gets the workflow state.
   * @returns {string|undefined} The workflow state
   */
  get state() {
    return this.#state
  }

  /**
   * Sets the workflow state.
   * @param {string} state - The workflow state
   */
  set state(state) {
    this.#state = state
  }

  /**
   * Gets the workflow creation date.
   * @returns {string|undefined} The workflow creation date
   */
  get created_at() {
    return this.#created_at
  }

  /**
   * Sets the workflow creation date.
   * @param {string} created_at - The workflow creation date
   */
  set created_at(created_at) {
    this.#created_at = created_at
  }

  /**
   * Gets the workflow last update date.
   * @returns {string|undefined} The workflow last update date
   */
  get updated_at() {
    return this.#updated_at
  }

  /**
   * Sets the workflow last update date.
   * @param {string} updated_at - The workflow last update date
   */
  set updated_at(updated_at) {
    this.#updated_at = updated_at
  }

  /**
   * Gets the workflow last run date.
   * @returns {string|null} The workflow last run date
   */
  get last_run_at() {
    return this.#last_run_at
  }

  /**
   * Sets the workflow last run date.
   * @param {string} last_run_at - The workflow last run date
   */
  set last_run_at(last_run_at) {
    this.#last_run_at = last_run_at
  }

  /**
   * Fetches the workflow details from GitHub.
   * @param {string} owner - The repository owner
   * @param {string} repo - The repository name
   * @param {string} path - The workflow file path
   * @returns {Promise<object>} The workflow details including ID, node ID, file name, path, language, text, YAML, and metadata
   *
   * @see https://docs.github.com/en/rest/actions/workflows#get-a-workflow
   * @see https://docs.github.com/en/rest/actions/workflow-runs#list-workflow-runs-for-a-repository
   */
  async getWorkflow(owner, repo, path) {
    const {data} = await this.octokit.request('GET /repos/{owner}/{repo}/actions/workflows/{workflow_id}', {
      owner,
      repo,
      workflow_id: path,
    })

    // wait 0.5s to avoid rate limit
    await wait(500)

    const {
      data: {workflow_runs: runs},
    } = await this.octokit.request('GET /repos/{owner}/{repo}/actions/workflows/{workflow_id}/runs', {
      owner,
      repo,
      workflow_id: data.id,
      per_page: 1,
      page: 1,
      status: 'completed',
      exclude_pull_requests: true,
      sort: 'desc',
    })

    // wait 0.5s to avoid rate limit
    await wait(500)

    this.#id = data.id
    this.#node_id = data.node_id
    this.#state = data.state
    this.#created_at = new Date(data.created_at).toISOString()
    this.#updated_at = new Date(data.updated_at).toISOString()
    this.#last_run_at = runs?.length > 0 ? new Date(runs[0].updated_at).toISOString() : null

    return {
      id: this.#id,
      node_id: this.#node_id,
      file_name: this.#file_name,
      path: this.#path,
      language: this.#language,
      text: this.#text,
      yaml: this.getYaml(),
      isTruncated: this.#isTruncated,
      state: this.#state,
      created_at: this.#created_at,
      updated_at: this.#updated_at,
      last_run_at: this.#last_run_at,
    }
  }

  getYaml() {
    if (this.#isTruncated) {
      this.logger.warn('Workflow text is truncated. Skipping YAML parsing.')

      return null
    }

    try {
      return load(this.#text, 'utf8')
    } catch (error) {
      this.logger.error(`Malformed YAML: ${error.message}`)

      return null
    }
  }
}
