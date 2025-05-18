import {Octokit} from '@octokit/core'
import {paginateRest} from '@octokit/plugin-paginate-rest'
import {throttling} from '@octokit/plugin-throttling'
import normalizeUrl from 'normalize-url'

// Utilities
import log from '../util/log.js'

// Singleton pattern to ensure only one instance of Octokit class is created
let instance = null

/**
 * Creates and returns a singleton instance of the Octokit GitHub API client.
 * Includes throttling and pagination support for robust API interactions.
 * @param {string} token - The GitHub personal access token for authentication
 * @param {string|null} [hostname=null] - GitHub hostname for Enterprise servers (e.g., 'github.example.com')
 * @param {object} [options={}] - Configuration options
 * @param {boolean} [options.debug=false] - Enable debug logging
 * @returns {import('@octokit/core').Octokit} Configured Octokit instance with plugins
 * @throws {Error} Throws an error if no GitHub token is provided
 */
export default function getOctokit(token, hostname = null, debug = false) {
  if (!token) {
    throw new Error('GitHub token is required')
  }

  const logger = log('octokit', token, debug)

  // Normalize hostname for GitHub Enterprise servers
  if (hostname) {
    const normalizedHost = normalizeUrl(hostname, {
      removeTrailingSlash: true,
      stripProtocol: true,
    }).split('/')[0]

    hostname = `https://${normalizedHost}/api/v3`
  } else {
    hostname = 'https://api.github.com'
  }

  // Create enhanced Octokit class with required plugins
  const MyOctokit = Octokit.defaults({
    headers: {
      'X-Github-Next-Global-ID': 1,
    },
  }).plugin(throttling, paginateRest)

  if (!instance) {
    instance = new MyOctokit({
      userAgent: `@stoe/action-reporting-cli`,
      auth: token,
      ...(hostname ? {baseUrl: hostname} : {}),
      throttle: {
        onRateLimit: (retryAfter, options) => {
          logger.warn(`Request quota exhausted for request ${options.method} ${options.url}`)
          logger.warn(`Retrying after ${retryAfter} seconds!`)
          return true
        },
        onSecondaryRateLimit: (retryAfter, options) => {
          logger.warn(`SecondaryRateLimit detected for request ${options.method} ${options.url}`)
          logger.warn(`Retrying after ${retryAfter} seconds!`)
          return true
        },
      },
    })

    logger.debug(`Created Octokit instance for ${hostname}`)
  }

  return instance
}
