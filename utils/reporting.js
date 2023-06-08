import {Octokit} from '@octokit/core'
import chalk from 'chalk'
import got from 'got'
import {load} from 'js-yaml'
import normalizeUrl from 'normalize-url'
import {paginateRest} from '@octokit/plugin-paginate-rest'
import {stringify} from 'csv-stringify/sync'
import {throttling} from '@octokit/plugin-throttling'
import wait from './wait.js'
import {writeFileSync} from 'fs'

const {blue, dim, red, yellow} = chalk
const MyOctokit = Octokit.plugin(throttling, paginateRest)
const MyGot = got.extend({
  retry: {
    limit: 0,
  },
})

const ORG_QUERY = `query ($enterprise: String!, $cursor: String = null) {
  enterprise(slug: $enterprise) {
    organizations(first: 25, after: $cursor) {
      nodes { login }
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
      organizations: {nodes, pageInfo},
    },
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
 * @typedef {object} Action
 *
 * @property {string}   owner
 * @property {string}   repo
 * @property {string}   workflow
 * @property {string[]} [permissions]
 * @property {string[]} [uses]
 *
 * @readonly
 */

const WORKFLOWS_QUERY = `query($owner: String!, $cursor: String = null) {
  repositoryOwner(login: $owner) {
    repositories(
      first: 50
      after: $cursor
      affiliations: OWNER
      orderBy: {
        field: NAME
        direction: ASC
      }
    ) {
      nodes {
        owner { login }
        name
        isArchived
        isFork
        object(expression: "HEAD:.github/workflows") {
          ... on Tree {
            entries {
              path
              name
              object {
                ... on Blob {
                  text
                  abbreviatedOid
                  byteSize
                  isBinary
                  isTruncated
                }
              }
              extension
              type
            }
          }
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
}`

const REPO_QUERY = `query ($owner: String!, $name: String!) {
  repository(owner: $owner, name: $name) {
    owner {
      login
    }
    name
    isArchived
    isFork
    object(expression: "HEAD:.github/workflows") {
      ... on Tree {
        entries {
          path
          name
          object {
            ... on Blob {
              text
              abbreviatedOid
              byteSize
              isBinary
              isTruncated
            }
          }
          extension
          type
        }
      }
    }
  }
}`

/**
 * @async
 * @private
 * @function findActions
 *
 * @param {import('@octokit/core').Octokit} octokit
 * @param {object}                          options
 * @param {string}                          [options.owner=null]
 * @param {string}                          [options.repo=null]
 * @param {boolean}                         [options.getListeners=false]
 * @param {boolean}                         [options.getPermissions=false]
 * @param {boolean}                         [options.getRunsOn=false]
 * @param {boolean}                         [options.getSecrets=false]
 * @param {boolean}                         [options.getUses=false]
 * @param {boolean}                         [options.isExcluded=false]
 * @param {string}                          [options.getVars=false]
 * @param {string}                          [cursor=null]
 * @param {Action[]}                        [records=[]]
 *
 * @returns {[]object}
 */
const findActions = async (
  octokit,
  {
    owner = null,
    repo = null,
    getListeners = false,
    getPermissions = false,
    getRunsOn = false,
    getSecrets = false,
    getUses = false,
    isExcluded = false,
    getVars = false,
  },
  cursor = null,
  records = [],
) => {
  try {
    let repos = []
    let pi = null

    if (owner !== null && repo === null) {
      const {
        repositoryOwner: {
          repositories: {nodes, pageInfo},
        },
      } = await octokit.graphql(WORKFLOWS_QUERY, {owner, cursor})

      repos = nodes
      pi = pageInfo
    }

    if (owner !== null && repo !== null) {
      const {repository} = await octokit.graphql(REPO_QUERY, {owner, name: repo})

      repos = [repository]
    }

    for (const r of repos) {
      const {
        name,
        // isArchived: archived,
        // isFork: fork,
        object: workflows,
      } = r

      // // skip archived or forked repositories
      // if (archived || fork) continue

      // skip if we don't have content
      if (!workflows?.entries) continue

      // https://docs.github.com/en/rest/actions/workflows#list-repository-workflows
      // we're doubling down here with this request to get additional details
      const {
        data: {workflows: wfds},
      } = await octokit.request('GET /repos/{owner}/{repo}/actions/workflows', {
        owner,
        repo: name,
      })

      // copy array into new array
      const d = [...wfds]

      for (const i in d) {
        // https://docs.github.com/en/rest/actions/workflow-runs#list-workflow-runs-for-a-workflow
        const {
          data: {workflow_runs: runs},
        } = await octokit.request('GET /repos/{owner}/{repo}/actions/workflows/{workflow_id}/runs', {
          owner,
          repo: name,
          workflow_id: d[i].id,
          per_page: 1,
          page: 1,
          status: 'completed',
          exclude_pull_requests: true,
          sort: 'desc',
        })

        if (runs && runs.length > 0) {
          d[i].last_run_at = new Date(runs[0].updated_at).toISOString()
        } else {
          d[i].last_run_at = null
        }
      }

      for (const wf of workflows.entries) {
        // skip if not .yml or .yaml
        if (!['.yml', '.yaml'].includes(wf.extension)) continue

        const info = {owner, repo: name, workflow: wf.path}

        const content = wf.object?.text

        if (content) {
          try {
            const yaml = load(content, 'utf8')

            if (getListeners) {
              info.listeners = findObject('on', yaml)
            }

            if (getPermissions) {
              info.permissions = findObject('permissions', yaml)
            }

            if (getRunsOn) {
              info.runsOn = findRunsOn(yaml)
            }

            if (getSecrets) {
              info.secrets = findSecrets(content)
            }

            if (getUses) {
              info.uses = findUses(content, isExcluded)
            }

            if (getVars) {
              info.vars = findVars(content)
            }
          } catch (err) {
            console.warn(red(`malformed yml: https://github.com/${owner}/${name}/blob/HEAD/${wf.path}`))
          }
        }

        for (const {name: n, state, path, created_at, updated_at, last_run_at} of d) {
          if (path === wf.path) {
            info.name = n
            info.state = state
            info.created_at = new Date(created_at).toISOString()
            info.updated_at = new Date(updated_at).toISOString()
            info.last_run_at = last_run_at ? new Date(last_run_at).toISOString() : ''
          }
        }

        records.push(info)
      }
    }

    if (pi && pi.hasNextPage) {
      // wait 1s between requests
      wait(1000)

      await findActions(octokit, {owner, repo, getPermissions, getRunsOn, getUses, isExcluded}, pi.endCursor, records)
    }
  } catch (err) {
    // do nothing
  }
}

/**
 * @private
 * @function findObject
 *
 * @param {string}  key
 * @param {object}  search
 * @param {any[]}   [results=[]]
 *
 * @returns {any[]}
 */
const findObject = (key, search, results = []) => {
  const res = results

  for (const k in search) {
    const value = search[k]

    if (k !== key && typeof value === 'object') {
      findObject(key, value, res)
    }

    if (k === key && typeof value === 'object') {
      for (const i in value) {
        let v = ''

        switch (key) {
          case 'on':
            if (!value[i]) {
              v = i
            } else {
              v = `${i}: ${JSON.stringify(value[i])}`.replace(/"/g, '')
            }
            break
          case 'permissions':
            v = `${i}: ${value[i]}`
            break
          default:
            break
        }

        if (!res.includes(v)) res.push(v)
      }
    }

    if (k === key && typeof value === 'string') {
      if (!res.includes(value)) res.push(value)
    }
  }

  return res
}

/**
 * @private
 * @function findRunsOn
 *
 * @param {object}  search
 * @param {any[]}   [results=[]]
 *
 * @returns {any[]}
 */
const findRunsOn = (search, results = []) => {
  const key = 'runs-on'
  const res = results

  for (const k in search) {
    const value = search[k]

    if (k !== key && typeof value === 'object') {
      findRunsOn(value, res)
    }

    if (k === key && typeof value === 'object') {
      for (const i in value) {
        const v = value[i]

        if (!res.includes(v)) res.push(v)
      }
    }

    if (k === key && typeof value === 'string') {
      if (!res.includes(value)) res.push(value)
    }
  }

  return res
}

const secretsRegex = /\$\{\{\s?secrets\.(.*)\s?\}\}/g
/**
 * @private
 * @function findSecrets
 *
 * @param {string}  text
 *
 * @returns {string[]}
 */
const findSecrets = text => {
  const secrets = []
  const matchSecrets = [...text.matchAll(secretsRegex)]

  matchSecrets.map(m => {
    const v = m[1].trim()

    if (!secrets.includes(v)) secrets.push(v)
  })

  return secrets
}

const usesRegex = /([^\s+]|[^\t+])uses: (.*)/g
/**
 * @private
 * @function findUses
 *
 * @param {string}  text
 * @param {boolean} isExcluded
 *
 * @returns {string[]}
 */
const findUses = (text, isExcluded) => {
  const uses = []
  const matchUses = [...text.matchAll(usesRegex)]

  matchUses.map(m => {
    const u = m[2].trim()
    if (u.indexOf('/') < 0 && u.indexOf('.') < 0) return

    // exclude actions created by GitHub (owner: actions||github)
    if ((isExcluded && u.startsWith('actions/')) || u.startsWith('github/')) return

    if (!uses.includes(u)) uses.push(u)
  })

  return uses
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

const varsRegex = /\$\{\{\s?vars\.(.*)\s?\}\}/g
/**
 * @private
 * @function findVars
 *
 * @param {string}  text
 *
 * @returns {string[]}
 */
const findVars = text => {
  const vars = []
  const matchVars = [...text.matchAll(varsRegex)]

  matchVars.map(m => {
    const v = m[1].trim()

    if (!vars.includes(v)) vars.push(v)
  })

  return vars
}

/**
 * @async
 * @private
 * @function checkURL
 *
 * @param {string}  hostname
 * @param {string}  owner
 * @param {string}  repo
 * @param {Map}     checkedURLs
 *
 * @returns {string}
 */
const checkURL = async (hostname, owner, repo, checkedURLs) => {
  let url = `https://github.com/${owner}/${repo}`

  // skip if already checked
  if (checkedURLs.has(url)) {
    return url
  }

  try {
    await MyGot.get(url, {cache: checkedURLs})
  } catch (error) {
    url = `https://${hostname}/${owner}/${repo}`
  }

  checkedURLs.set(url, true)
  return url
}

class Reporting {
  /**
   * @param {object}          options
   * @param {string}          options.token
   * @param {string}          options.enterprise
   * @param {string}          options.owner
   * @param {string}          options.repository
   * @param {object}          options.flags
   * @param {boolean}         [options.flags.getListeners=false]
   * @param {boolean}         [options.flags.getPermissions=false]
   * @param {boolean}         [options.flags.getRunsOn=false]
   * @param {boolean}         [options.flags.getSecrets=false]
   * @param {boolean}         [options.flags.getUses=false]
   * @param {boolean}         [options.flags.isUnique=false]
   * @param {boolean}         [options.flags.isExcluded=false]
   * @param {boolean}         [options.flags.getVars=false]
   * @param {object}          options.outputs
   * @param {string}          [options.outputs.csvPath=undefined]
   * @param {string}          [options.outputs.mdPath=undefined]
   * @param {string}          [options.outputs.jsonPath=undefined]
   * @param {string}          [hostname=undefined]
   */
  constructor({
    token,
    enterprise,
    owner,
    repository,
    flags: {
      getListeners = false,
      getPermissions = false,
      getRunsOn = false,
      getSecrets = false,
      getUses = false,
      isUnique = false,
      isExcluded = false,
      getVars = false,
    },
    outputs: {csvPath = undefined, mdPath = undefined, jsonPath = undefined},
    hostname = undefined,
  }) {
    this.token = token
    this.enterprise = enterprise
    this.owner = owner
    this.repository = repository

    this.getListeners = getListeners
    this.getPermissions = getPermissions
    this.getRunsOn = getRunsOn
    this.getSecrets = getSecrets
    this.getUses = getUses
    this.isUnique = isUnique
    this.isExcluded = isExcluded
    this.getVars = getVars

    this.csvPath = csvPath
    this.mdPath = mdPath
    this.jsonPath = jsonPath

    if (hostname) {
      const h = normalizeUrl(hostname, {
        removeTrailingSlash: true,
        stripProtocol: true,
      }).split('/')[0]
      this.hostname = h

      hostname = `https://${h}/api/v3`
    }

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
        },
      },
      ...(hostname ? {baseUrl: hostname} : {}),
      headers: {
        'X-Github-Next-Global-ID1': 1,
      },
    })

    this.actions = []
    this.unique = []

    this.checkedURLs = new Map()
  }

  /**
   * @async
   * @function get
   *
   * @returns Action[]
   */
  async get() {
    const {
      octokit,
      enterprise,
      owner,
      repository,
      getListeners,
      getPermissions,
      getRunsOn,
      getSecrets,
      getUses,
      isUnique,
      isExcluded,
      getVars,
      hostname,
    } = this

    const f = []
    if (getListeners) f.push('listeners')
    if (getPermissions) f.push('permissions')
    if (getRunsOn) f.push('runs-on')
    if (getSecrets) f.push('secrets')
    if (getUses) f.push('uses')
    if (getVars) f.push('vars')

    console.log(`Gathering GitHub Actions${f.length < 1 ? '' : yellow(` ${f.join(', ')}`)} for ${blue(
      enterprise || owner || repository,
    )} ${hostname ? `on ${blue(hostname)}` : ''}
${dim('(this could take a while...)')}`)

    const actions = []

    if (enterprise) {
      const orgs = await getOrganizations(octokit, enterprise)
      const ol = orgs.length
      console.log(`${dim(`searching in %s enterprise organizations\n%s`)}`, ol, ol > 10 ? '' : `[${orgs.join(', ')}]`)

      for await (const org of orgs) {
        await findActions(
          octokit,
          {
            owner: org,
            repo: null,
            getListeners,
            getPermissions,
            getRunsOn,
            getSecrets,
            getUses,
            isExcluded,
            getVars,
          },
          null,
          actions,
        )

        // wait 1s between orgs
        wait(1000)
      }
    }

    if (owner) {
      await findActions(
        octokit,
        {
          owner,
          repo: null,
          getListeners,
          getPermissions,
          getRunsOn,
          getSecrets,
          getUses,
          isExcluded,
          getVars,
        },
        null,
        actions,
      )
    }

    if (repository) {
      const [_o, _r] = repository.split('/')

      console.log(`${dim(`searching %s/%s`)}`, _o, _r)

      await findActions(
        octokit,
        {
          owner: _o,
          repo: _r,
          getListeners,
          getPermissions,
          getRunsOn,
          getSecrets,
          getUses,
          isExcluded,
          getVars,
        },
        null,
        actions,
      )
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
    const {actions, csvPath, getListeners, getPermissions, getRunsOn, getSecrets, getUses, getVars} = this

    try {
      const header = ['owner', 'repo', 'name', 'state', 'workflow', 'created_at', 'updated_at', 'last_run_at']

      if (getListeners) header.push('listeners')
      if (getPermissions) header.push('permissions')
      if (getRunsOn) header.push('runs-on')
      if (getSecrets) header.push('secrets')
      if (getUses) header.push('uses')
      if (getVars) header.push('vars')

      // actions report
      const csv = stringify(
        actions.map(i => {
          const csvData = [i.owner, i.repo, i.name, i.state, i.workflow, i.created_at, i.updated_at, i.last_run_at]

          if (getListeners) csvData.push(i.listeners.join(', '))
          if (getPermissions) csvData.push(i.permissions.join(', '))
          if (getRunsOn) csvData.push(i.runsOn.join(', '))
          if (getSecrets) csvData.push(i.secrets.join(', '))
          if (getUses && i.uses) csvData.push(i.uses.join(', '))
          if (getVars) csvData.push(i.vars.join(', '))

          return csvData
        }),
        {
          header: true,
          columns: header,
        },
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
          columns: ['uses'],
        },
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
    const {actions, jsonPath, getListeners, getPermissions, getRunsOn, getSecrets, getUses, getVars} = this

    try {
      const json = actions.map(i => {
        const jsonData = {
          owner: i.owner,
          repo: i.repo,
          name: i.name,
          state: i.state,
          workflow: i.workflow,
          created_at: i.created_at,
          updated_at: i.updated_at,
          last_run_at: i.last_run_at,
        }

        if (getListeners) jsonData.listeners = i.listeners
        if (getPermissions) jsonData.permissions = i.permissions
        if (getRunsOn) jsonData.runsOn = i.runsOn
        if (getSecrets) jsonData.secrets = i.secrets
        if (getUses) jsonData.uses = i.uses
        if (getVars) jsonData.vars = i.vars

        return jsonData
      })

      console.log(`saving report JSON in ${blue(`${jsonPath}`)}`)
      await writeFileSync(jsonPath, JSON.stringify(json, null, 0))
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
      await writeFileSync(pathUnique, JSON.stringify(unique, null, 0))
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
    const {
      actions,
      mdPath,
      getListeners,
      getPermissions,
      getRunsOn,
      getSecrets,
      getUses,
      getVars,
      hostname,
      checkedURLs,
    } = this

    try {
      let header = 'owner | repo | name | state | workflow | created_at | updated_at | last_run_at'
      let headerBreak = '--- | --- | --- | --- | --- | --- | --- | ---'

      if (getListeners) {
        header += ' | listeners'
        headerBreak += ' | ---'
      }

      if (getPermissions) {
        header += ' | permissions'
        headerBreak += ' | ---'
      }

      if (getRunsOn) {
        header += ' | runs-on'
        headerBreak += ' | ---'
      }

      if (getSecrets) {
        header += ' | secrets'
        headerBreak += ' | ---'
      }

      if (getUses) {
        header += ' | uses'
        headerBreak += ' | ---'
      }

      if (getVars) {
        header += ' | vars'
        headerBreak += ' | ---'
      }

      const mdData = []
      for (const {
        owner,
        repo,
        name,
        state,
        workflow,
        created_at,
        updated_at,
        last_run_at,
        listeners,
        permissions,
        runsOn,
        secrets,
        uses,
        vars,
      } of actions) {
        const workflowLink = `https://${hostname}/${owner}/${repo}/blob/HEAD/${workflow}`
        let mdStr = `${owner} | ${repo} | ${name} | ${state} | [${workflow}](${workflowLink}) | ${created_at} | ${updated_at} | ${last_run_at}`

        if (getListeners) {
          mdStr += ` | ${
            listeners && listeners.length > 0 ? `<ul><li>\`${listeners.join(`\`</li><li>\``)}\`</li></ul>` : ''
          }`
        }

        if (getPermissions) {
          mdStr += ` | ${
            permissions && permissions.length > 0 ? `<ul><li>\`${permissions.join(`\`</li><li>\``)}\`</li></ul>` : ''
          }`
        }

        if (getRunsOn) {
          const v = runsOn.map(i => {
            if (i.indexOf('matrix') > -1) {
              i = `\`${i}\``
            }
            return i
          })

          mdStr += ` | ${v && v.length > 0 ? v.join(', ') : ''}`
        }

        if (getSecrets) {
          mdStr += ` | ${secrets && secrets.length > 0 ? `<ul><li>\`${secrets.join(`\`</li><li>\``)}\`</li></ul>` : ''}`
        }

        if (getUses && uses) {
          // skip if not iterable
          if (uses === null || uses === undefined || typeof uses[Symbol.iterator] !== 'function') {
            mdStr += ' | '
            continue
          }

          const usesLinks = []
          for await (const action of uses) {
            if (action.indexOf('./') === -1) {
              const [a, v] = action.split('@')
              const [o, r] = a.split('/')
              let url = `https://github.com/${o}/${r}`

              if (hostname) {
                url = await checkURL(hostname, o, r, checkedURLs)
              }

              usesLinks.push(`[${o}/${r}](${url}) (\`${v}\`)`)
            }
          }

          mdStr += ` | ${usesLinks.length > 0 ? `<ul><li>${usesLinks.join('</li><li>')}</li></ul>` : ''}`
        }

        if (getVars) {
          mdStr += ` | ${vars && vars.length > 0 ? `<ul><li>\`${vars.join(`\`</li><li>\``)}\`</li></ul>` : ''}`
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
    const {mdPath, getUses, isUnique, unique, hostname, checkedURLs} = this
    const pathUnique = mdPath.replace('.md', '-unique.md')

    if (!getUses || isUnique === false) {
      return
    }

    try {
      const uses = unique.map(async i => {
        if (i.indexOf('./') === -1) {
          const [a, v] = i.split('@')
          const [o, r] = a.split('/')
          let url = `https://github.com/${o}/${r}`

          if (hostname) {
            url = await checkURL(hostname, o, r, checkedURLs)
          }

          return `[${o}/${r}](https://${url}) (\`${v}\`)`
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
