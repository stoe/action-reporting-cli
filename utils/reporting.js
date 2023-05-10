import {Octokit} from '@octokit/core'
import chalk from 'chalk'
import {load} from 'js-yaml'
import {paginateRest} from '@octokit/plugin-paginate-rest'
import {stringify} from 'csv-stringify/sync'
import {throttling} from '@octokit/plugin-throttling'
import wait from './wait.js'
import {writeFileSync} from 'fs'

const {blue, dim, red, yellow} = chalk
const MyOctokit = Octokit.plugin(throttling, paginateRest)

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

      for (const wf of workflows.entries) {
        // skip if not .yml or .yaml
        if (!['.yml', '.yaml'].includes(wf.extension)) continue

        const info = {owner, repo: name, workflow: wf.path}

        const content = wf.object?.text

        if (content) {
          try {
            const yaml = load(content, 'utf8')

            if (getPermissions) {
              info.permissions = findPermissions(yaml)
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
 * @function findPermissions
 *
 * @param {object}  search
 * @param {any[]}   [results=[]]
 *
 * @returns {any[]}
 */
const findPermissions = (search, results = []) => {
  const key = 'permissions'
  const res = results

  for (const k in search) {
    const value = search[k]

    if (k !== key && typeof value === 'object') {
      findPermissions(value, res)
    }

    if (k === key && typeof value === 'object') {
      for (const i in value) {
        const v = `${i}: ${value[i]}`

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

class Reporting {
  /**
   * @param {object}          options
   * @param {string}          options.token
   * @param {string}          options.enterprise
   * @param {string}          options.owner
   * @param {string}          options.repository
   * @param {object}          options.flags
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
   */
  constructor({
    token,
    enterprise,
    owner,
    repository,
    flags: {
      getPermissions = false,
      getRunsOn = false,
      getSecrets = false,
      getUses = false,
      isUnique = false,
      isExcluded = false,
      getVars = false,
    },
    outputs: {csvPath = undefined, mdPath = undefined, jsonPath = undefined},
  }) {
    this.token = token
    this.enterprise = enterprise
    this.owner = owner
    this.repository = repository

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
    const {
      octokit,
      enterprise,
      owner,
      repository,
      getPermissions,
      getRunsOn,
      getSecrets,
      getUses,
      isUnique,
      isExcluded,
      getVars,
    } = this

    const f = []
    if (getPermissions) f.push('permissions')
    if (getRunsOn) f.push('runs-on')
    if (getSecrets) f.push('secrets')
    if (getUses) f.push('uses')
    if (getVars) f.push('vars')

    console.log(`Gathering GitHub Actions ${yellow(`${f.join(', ')}`)} for ${blue(enterprise || owner || repository)}
${dim('(this could take a while...)')}`)

    const actions = []

    if (enterprise) {
      const orgs = await getOrganizations(octokit, enterprise)
      console.log(`${dim(`searching in %s enterprise organizations\n[%s]`)}`, orgs.length, orgs.join(', '))

      for await (const org of orgs) {
        await findActions(
          octokit,
          {
            owner: org,
            repo: null,
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
    const {actions, csvPath, getPermissions, getRunsOn, getSecrets, getUses, getVars} = this

    try {
      const header = ['owner', 'repo', 'workflow']
      if (getPermissions) header.push('permissions')
      if (getRunsOn) header.push('runs-on')
      if (getSecrets) header.push('secrets')
      if (getUses) header.push('uses')
      if (getVars) header.push('vars')

      // actions report
      const csv = stringify(
        actions.map(i => {
          const csvData = [i.owner, i.repo, i.workflow]
          if (getPermissions) csvData.push(JSON.stringify(i.permissions, null, 0))
          if (getRunsOn) csvData.push(i.runsOn.join(', '))
          if (getSecrets) csvData.push(i.secrets.join(', '))
          if (getUses && i.uses) csvData.push(i.uses.join(', '))
          if (getVars) csvData.push(JSON.stringify(i.vars, null, 0))

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
    const {actions, jsonPath, getPermissions, getRunsOn, getSecrets, getUses, getVars} = this

    try {
      const json = actions.map(i => {
        const jsonData = {owner: i.owner, repo: i.repo, workflow: i.workflow}

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
    const {actions, mdPath, getPermissions, getRunsOn, getSecrets, getUses, getVars} = this

    try {
      let header = 'owner | repo | workflow'
      let headerBreak = '--- | --- | ---'

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
      for (const {owner, repo, workflow, permissions, runsOn, secrets, uses, vars} of actions) {
        const workflowLink = `https://github.com/${owner}/${repo}/blob/HEAD/${workflow}`
        let mdStr = `${owner} | ${repo} | [${workflow}](${workflowLink})`

        if (getPermissions) {
          mdStr += ` | ${permissions && permissions.length > 0 ? `\`${permissions.join(`\`,\``)}\`` : ''}`
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
          for (const action of uses) {
            if (action.indexOf('./') === -1) {
              const [a, v] = action.split('@')
              const [o, r] = a.split('/')

              usesLinks.push(`[${o}/${r}](https://github.com/${o}/${r}) (\`${v}\`)`)
            }
          }

          mdStr += ` | ${usesLinks.length > 0 ? `<ul><li>${usesLinks.join('</li><li>')}</li></ul>` : ''}`
        }

        if (getVars) {
          mdStr += ` | ${vars && vars.length > 0 ? `\`${vars.join(`\`,\``)}\`` : ''}`
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
