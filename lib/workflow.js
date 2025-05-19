import chalk from 'chalk'
import {load} from 'js-yaml'

const {red} = chalk

const secretsRegex = /\$\{\{\s?secrets\.(.*)\s?\}\}/g
const usesRegex = /([^\s+]|[^\t+])uses: (.*)/g
const varsRegex = /\$\{\{\s?vars\.(.*)\s?\}\}/g

export default class Workflow {
  constructor(
    owner,
    repo,
    workflow,
    {
      getListeners = false,
      getPermissions = false,
      getRunsOn = false,
      getSecrets = false,
      getUses = false,
      isExcluded = false,
      getVars = false,
    },
  ) {
    this.owner = owner
    this.repo = repo

    this.workflow = workflow
    this.path = workflow.path

    this.content = workflow.object?.text
  }

  get() {
    const {owner, repo, path} = this

    const info = {
      owner,
      repo,
      workflow: path,
    }

    if (this.content) {
      this.yaml = load(this.content, 'utf8')

      try {
        if (getListeners) info.listeners = this.findObject('on', this.yaml)
        if (getPermissions) info.permissions = this.findObject('permissions', this.yaml)
        if (getRunsOn) info.runsOn = this.findRunsOn(this.yaml)
        if (getSecrets) info.secrets = this.findSecrets(this.content)
        if (getUses) info.uses = this.findUses(this.content, isExcluded)
        if (getVars) info.vars = this.findVars(this.content)
      } catch (err) {
        console.warn(red(`malformed yml: https://github.com/${owner}/${repo}/blob/HEAD/${this.path}`))
      }
    }

    // TODO
    // for (const {node_id: id, name: n, state, path, created_at, updated_at, last_run_at} of d) {
    //   if (path === this.path) {
    //     info.id = id
    //     info.name = n
    //     info.state = state
    //     info.created_at = new Date(created_at).toISOString()
    //     info.updated_at = new Date(updated_at).toISOString()
    //     info.last_run_at = last_run_at ? new Date(last_run_at).toISOString() : ''
    //   }
    // }

    return info
  }

  /**
   * Finds an object in the YAML content by key.
   *
   * @function findObject
   *
   * @param {string}  key
   * @param {object}  search
   * @param {any[]}   [results=[]]
   *
   * @returns {any[]}
   */
  findObject(key, search, results = []) {
    const res = results

    for (const k in search) {
      const value = search[k]

      if (k !== key && typeof value === 'object') {
        this.findObject(key, value, res)
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

  findRunsOn(search, results = []) {
    const key = 'runs-on'
    const res = results

    for (const k in search) {
      const value = search[k]

      if (k !== key && typeof value === 'object') {
        this.findRunsOn(value, res)
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

  findSecrets(text) {
    const secrets = []
    const matchSecrets = [...text.matchAll(secretsRegex)]

    matchSecrets.map(m => {
      const v = m[1].trim()

      if (!secrets.includes(v)) secrets.push(v)
    })

    return secrets
  }

  findUses(text, isExcluded) {
    const uses = []
    const matchUses = [...text.matchAll(usesRegex)]

    matchUses.map(m => {
      let u = m[2].trim()
      if (u.indexOf('/') < 0 && u.indexOf('.') < 0) return

      // exclude actions created by GitHub (owner: actions||github)
      if ((isExcluded && u.startsWith('actions/')) || u.startsWith('github/')) return

      // strip '|" from uses
      u = u.replace(/('|")/g, '').trim()

      // remove comments from uses
      u = u.split(/ #.*$/)[0].trim()

      if (!uses.includes(u)) uses.push(u)
    })

    return uses
  }

  findVars(text) {
    const vars = []
    const matchVars = [...text.matchAll(varsRegex)]

    matchVars.map(m => {
      const v = m[1].trim()

      if (!vars.includes(v)) vars.push(v)
    })

    return vars
  }
}
