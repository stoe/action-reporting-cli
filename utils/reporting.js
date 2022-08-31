import {Octokit} from '@octokit/core'
import chalk from 'chalk'
import {load} from 'js-yaml'
import {paginateRest} from '@octokit/plugin-paginate-rest'
import {stringify} from 'csv-stringify/sync'
import {throttling} from '@octokit/plugin-throttling'
import wait from './wait.js'
import {writeFileSync} from 'fs'

const {blue, dim, inverse, red, yellow} = chalk
const MyOctokit = Octokit.plugin(throttling, paginateRest)

const ORG_QUERY = `query ($enterprise: String!, $cursor: String = null) {
  enterprise(slug: $enterprise) {
    organizations(first: 25, after: $cursor) {
      nodes {
        login
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
}`

/**
 * @typedef {object} Organization
 *
 * @property {string} login
 *
 * @readonly
 */

/**
 * @async
 * @private
 * @function getOrganizations
 *
 * @param {import('@octokit/core').Octokit} octokit
 * @param {string}                          enterprise
 * @param {string}                          [cursor=null]
 * @param {Organization[]}                  [records=[]]
 *
 * @returns {Organization[]}
 */
const getOrganizations = async (octokit, enterprise, cursor = null, records = []) => {
  if (!enterprise) return records

  const {
    enterprise: {
      organizations: {nodes, pageInfo}
    }
  } = await octokit.graphql(ORG_QUERY, {enterprise, cursor})

  nodes.map(data => {
    /** @type Organization */
    records.push(data.login)
  })

  if (pageInfo.hasNextPage) {
    await getOrganizations(octokit, enterprise, pageInfo.endCursor, records)
  }

  return records
}

/**
 * @typedef {object} Repository
 *
 * @property {string} owner
 * @property {string} repo
 *
 * @readonly
 */

const ORG_REPO_QUERY = `query ($owner: String!, $cursor: String = null) {
  organization(login: $owner) {
    repositories(
      affiliations: OWNER
      isFork: false
      orderBy: { field: PUSHED_AT, direction: DESC }
      first: 100
      after: $cursor
    ) {
      nodes {
        name
        owner {
          login
        }
        isArchived
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
}`

const USER_REPO_QUERY = `query ($owner: String!, $cursor: String = null) {
  user(login: $owner) {
    repositories(
      affiliations: OWNER
      isFork: false
      orderBy: { field: PUSHED_AT, direction: DESC }
      first: 100
      after: $cursor
    ) {
      nodes {
        name
        owner {
          login
        }
        isArchived
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
}`

/**
 * @async
 * @private
 * @function getRepositories
 *
 * @param {import('@octokit/core').Octokit} octokit
 * @param {Organization}                    owner
 * @param {string}                          [type='organization']
 * @param {string}                          [cursor=null]
 * @param {Repository[]}                    [records=[]]
 *
 * @returns {Repository[]}
 */
const getRepositories = async (octokit, owner, type = 'organization', cursor = null, records = []) => {
  let nodes = []
  let pageInfo = {
    hasNextPage: false,
    endCursor: null
  }

  if (type === 'organization') {
    const {
      organization: {repositories}
    } = await octokit.graphql(ORG_REPO_QUERY, {owner, cursor})

    nodes = repositories.nodes
    pageInfo = repositories.pageInfo
  } else if (type === 'user') {
    const {
      user: {repositories}
    } = await octokit.graphql(USER_REPO_QUERY, {owner, cursor})

    nodes = repositories.nodes
    pageInfo = repositories.pageInfo
  }

  nodes.map(data => {
    // skip if repository is archived
    if (data.isArchived) return

    if (data.owner.login === owner) {
      /** @type Repository */
      records.push({
        owner: data.owner.login,
        repo: data.name
      })
    }
  })

  if (pageInfo.hasNextPage) {
    await getRepositories(octokit, owner, type, pageInfo.endCursor, records)
  }

  return records
}

/**
 * @typedef {object} Action
 *
 * @property {string} action
 * @property {string} [owner]
 * @property {string} [repo]
 * @property {string} [workflow]
 *
 * @readonly
 */

/**
 * @async
 * @private
 * @function findActions
 *
 * @param {import('@octokit/core').Octokit} octokit
 * @param {object}                          options
 * @param {string}                          options.owner
 * @param {string}                          options.repo
 * @param {boolean}                         [options.getPermissions=false]
 * @param {boolean}                         [options.getUses=false]
 * @param {boolean}                         [options.isExcluded=false]
 *
 * @returns {Action[]}
 */
const findActions = async (octokit, {owner, repo, getPermissions = false, getUses = false, isExcluded = false}) => {
  /** @type Action[] */
  const actions = []

  try {
    // https://docs.github.com/en/rest/reference/actions#list-repository-workflows
    const {
      data: {workflows}
    } = await octokit.request('GET /repos/{owner}/{repo}/actions/workflows', {
      owner,
      repo
    })

    for await (const wf of workflows) {
      const info = {owner, repo, workflow: wf.path}

      if (getPermissions || getUses) {
        const {
          data: {content}
        } = await octokit.request('GET /repos/{owner}/{repo}/contents/{path}', {
          owner,
          repo,
          path: wf.path
        })

        if (content) {
          const _buff = Buffer.from(content, 'base64')
          const _content = _buff.toString('utf-8')
          const yaml = load(_content, 'utf8')

          if (getPermissions) {
            info.permissions = recursiveSearch(yaml, 'permissions')
          }

          if (getUses) {
            let uses = recursiveSearch(yaml, 'uses')

            // exclude actions created by GitHub (owner: actions||github)
            if (isExcluded) {
              uses = uses.filter(use => !(use.includes('actions/') || use.includes('github/')))
            }

            info.uses = uses
          }
        }
      }

      actions.push(info)

      // wait 2.5s between calls
      await wait(2500)
    }
  } catch (error) {
    // do nothing
  }

  return actions.sort(sortActions)
}

/**
 * @private
 * @function sortActions
 *
 * @param {Action} a
 * @param {Action} b
 *
 * @returns {number}
 */
const sortActions = (a, b) => {
  // Use toUpperCase() to ignore character casing
  const A = a.workflow.toUpperCase()
  const B = b.workflow.toUpperCase()

  let comparison = 0

  if (A > B) {
    comparison = 1
  } else if (A < B) {
    comparison = -1
  }

  return comparison
}

/**
 * @private
 * @function recursiveSearch
 *
 * @param {object}  search
 * @param {string}  key
 * @param {any[]}   [results=[]]
 *
 * @returns {any[]}
 */
const recursiveSearch = (search, key, results = []) => {
  const res = results

  for (const k in search) {
    const value = search[k]

    if (typeof value === 'object' && k !== key) {
      recursiveSearch(value, key, res)
    } else if (typeof value === 'string' && k === key) {
      res.push(value)
    }
  }

  return res
}

/**
 * @private
 * @function getUnique
 *
 * @param {Action[]}  actions
 *
 * @returns {string[]|null}
 */
const getUnique = actions => {
  const _unique = []
  let unique = []

  actions.map(({uses}) => {
    if (uses && uses.length > 0) _unique.push(...uses)
  })

  unique = [...new Set(_unique)].sort((a, b) => {
    // Use toUpperCase() to ignore character casing
    const A = a.toUpperCase()
    const B = b.toUpperCase()

    let comparison = 0

    if (A > B) {
      comparison = 1
    } else if (A < B) {
      comparison = -1
    }

    return comparison
  })

  return unique
}

class Reporting {
  /**
   * @param {object}          options
   * @param {string}          options.token
   * @param {string}          options.enterprise
   * @param {string}          options.owner
   * @param {string}          options.repository
   * @param {string}          [options.csvPath=undefined]
   * @param {string}          [options.mdPath=undefined]
   * @param {string}          [options.jsonPath=undefined]
   * @param {boolean}         [options.getPermissions=false]
   * @param {boolean}         [options.getUses=false]
   * @param {boolean|'both'}  [options.isUnique=false]
   * @param {boolean}         [options.isExcluded=false]
   */
  constructor({
    token,
    enterprise,
    owner,
    repository,
    csvPath = undefined,
    mdPath = undefined,
    jsonPath = undefined,
    getPermissions = false,
    getUses = false,
    isUnique = false,
    isExcluded = false
  }) {
    this.token = token
    this.enterprise = enterprise
    this.owner = owner
    this.repository = repository
    this.csvPath = csvPath
    this.mdPath = mdPath
    this.jsonPath = jsonPath
    this.getPermissions = getPermissions
    this.getUses = getUses
    this.isUnique = isUnique
    this.isExcluded = isExcluded

    this.octokit = new MyOctokit({
      auth: token,
      throttle: {
        onRateLimit: (retryAfter, options) => {
          console.warn(yellow(`Request quota exhausted for request ${options.method} ${options.url}`))
          console.warn(yellow(`Retrying after ${retryAfter} seconds!`))
          return true
        },
        onSecondaryRateLimit: (retryAfter, options) => {
          console.warn(red(`Secondary rate limit hit detected for request ${options.method} ${options.url}`))
          console.warn(yellow(`Retrying after ${retryAfter} seconds!`))
          return true
        }
      }
    })

    this.actions = []
    this.unique = []
  }

  /**
   * @async
   * @function get
   *
   * @returns Action[]
   */
  async get() {
    const {octokit, enterprise, owner, repository, getPermissions, getUses, isUnique, isExcluded} = this

    console.log(`
Gathering GitHub Actions for ${blue(enterprise || owner || repository)} ${
      getPermissions ? inverse('permissions') : ''
    } ${getUses ? inverse('uses') : ''}
${dim('(this could take a while...)')}
`)

    let repos = []

    if (enterprise) {
      const orgs = await getOrganizations(octokit, enterprise)
      console.log(`${dim(`searching in %s enterprise organizations\n[%s]`)}`, orgs.length, orgs.join(', '))

      for await (const org of orgs) {
        const res = await getRepositories(octokit, org)
        repos.push(...res)
      }
    }

    if (owner) {
      const {
        data: {type}
      } = await octokit.request('GET /users/{owner}', {
        owner
      })

      console.log(`${dim(`searching %s %s`)}`, type.toLowerCase(), owner)
      repos = await getRepositories(octokit, owner, type.toLowerCase())
    }

    if (repository) {
      const [_o, _r] = repository.split('/')

      console.log(`${dim(`searching %s/%s`)}`, _o, _r)
      repos.push({owner: _o, repo: _r})
    }

    const actions = []
    let i = 0
    for await (const {owner: org, repo} of repos) {
      const ul = i === repos.length - 1 ? '└─' : '├─'

      console.log(`  ${ul} ${org}/${repo}`)
      const res = await findActions(octokit, {
        owner: org,
        repo,
        getPermissions,
        getUses,
        isExcluded
      })

      actions.push(...res)

      // wait 2.5s between repositories to help spread out the requests
      wait(2500)

      i++
    }

    this.actions = actions

    if (getUses && isUnique !== false) {
      this.unique = getUnique(actions)
    }

    return actions
  }

  /**
   * @async
   * @function set
   *
   * @param {Action[]}  actions
   */
  async set(actions) {
    this.actions = actions
    this.unique = getUnique(actions)
  }

  /**
   * @async
   * @function saveCsv
   *
   * @throws {Error}
   */
  async saveCsv() {
    const {actions, csvPath, getPermissions, getUses} = this

    try {
      const header = ['owner', 'repo', 'workflow']
      if (getPermissions) header.push('permissions')
      if (getUses) header.push('uses')

      // actions report
      const csv = stringify(
        actions.map(i => {
          const csvData = [i.owner, i.repo, i.workflow]
          if (getPermissions) csvData.push(JSON.stringify(i.permissions, null, 0))
          if (getUses && i.uses) csvData.push(i.uses.join(', '))

          return csvData
        }),
        {
          header: true,
          columns: header
        }
      )

      console.log(`saving report CSV in ${blue(`${csvPath}`)}`)
      await writeFileSync(csvPath, csv)
    } catch (error) {
      throw error
    }
  }

  /**
   * @async
   * @function saveCsvUnique
   *
   * @throws {Error}
   */
  async saveCsvUnique() {
    const {csvPath, getUses, isUnique, unique} = this
    const pathUnique = csvPath.replace('.csv', '-unique.csv')

    if (!getUses || isUnique === false) {
      return
    }

    try {
      // actions report
      const csv = stringify(
        unique.map(i => [i]),
        {
          header: true,
          columns: ['uses']
        }
      )

      console.log(`saving unique report CSV in ${blue(`${pathUnique}`)}`)
      await writeFileSync(pathUnique, csv)
    } catch (error) {
      throw error
    }
  }

  /**
   * @async
   * @function saveJSON
   *
   * @throws {Error}
   */
  async saveJSON() {
    const {actions, jsonPath, getPermissions, getUses} = this

    try {
      const json = actions.map(i => {
        const jsonData = {owner: i.owner, repo: i.repo, workflow: i.workflow}

        if (getPermissions) jsonData.permissions = i.permissions
        if (getUses) jsonData.uses = i.uses

        return jsonData
      })

      console.log(`saving report JSON in ${blue(`${jsonPath}`)}`)
      await writeFileSync(jsonPath, JSON.stringify(json, null, 2))
    } catch (error) {
      throw error
    }
  }

  /**
   * @async
   * @function saveJSONUnique
   *
   * @throws {Error}
   */
  async saveJSONUnique() {
    const {jsonPath, getUses, isUnique, unique} = this
    const pathUnique = jsonPath.replace('.json', '-unique.json')

    if (!getUses || isUnique === false) {
      return
    }

    try {
      console.log(`saving unique report JSON in ${blue(`${pathUnique}`)}`)
      await writeFileSync(pathUnique, JSON.stringify(unique, null, 2))
    } catch (error) {
      throw error
    }
  }

  /**
   * @async
   * @function saveMarkdown
   *
   * @throws {Error}
   */
  async saveMarkdown() {
    const {actions, mdPath, getPermissions, getUses} = this

    try {
      let header = 'owner | repo | workflow'
      let headerBreak = '--- | --- | ---'

      if (getPermissions) {
        header += ' | permissions'
        headerBreak += ' | ---'
      }

      if (getUses) {
        header += ' | uses'
        headerBreak += ' | ---'
      }

      const mdData = []
      for (const {owner, repo, workflow, permissions, uses} of actions) {
        const workflowLink = `https://github.com/${owner}/${repo}/blob/HEAD/${workflow}`
        let mdStr = `${owner} | ${repo} | [${workflow}](${workflowLink})`

        if (getPermissions) {
          mdStr += ` | ${permissions && permissions.length > 0 ? `\`${JSON.stringify(permissions, null, 0)}\`` : 'n/a'}`
        }

        if (getUses) {
          const usesLinks = []

          for (const action of uses) {
            if (action.indexOf('./') === -1) {
              const [a, v] = action.split('@')
              const [o, r] = a.split('/')

              usesLinks.push(`[${o}/${r}](https://github.com/${o}/${r}) (\`${v}\`)`)
            }
          }

          mdStr += ` | ${usesLinks.length > 0 ? `<ul><li>${usesLinks.join('</li><li>')}</li></ul>` : 'n/a'}`
        }

        mdData.push(mdStr)
      }

      let md = `${[header, headerBreak].join('\n')}\n`
      md += mdData.join('\n')

      console.log(`saving report markdown in ${blue(`${mdPath}`)}`)
      await writeFileSync(mdPath, md)
    } catch (error) {
      throw error
    }
  }

  /**
   * @async
   * @function saveMarkdownUnique
   *
   * @throws {Error}
   */
  async saveMarkdownUnique() {
    const {mdPath, getUses, isUnique, unique} = this
    const pathUnique = mdPath.replace('.md', '-unique.md')

    if (!getUses || isUnique === false) {
      return
    }

    try {
      const uses = unique.map(i => {
        if (i.indexOf('./') === -1) {
          const [a, v] = i.split('@')
          const [o, r] = a.split('/')

          return `[${o}/${r}](https://github.com/${o}/${r}) (\`${v}\`)`
        } else {
          return i
        }
      })

      const md = `### Unique GitHub Actions \`uses\`
- ${uses.join('\n- ')}
`

      console.log(`saving unique report MD in ${blue(`${pathUnique}`)}`)
      await writeFileSync(pathUnique, md)
    } catch (error) {
      throw error
    }
  }
}

export default Reporting
