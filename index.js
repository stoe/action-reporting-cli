#!/usr/bin/env node

import Reporting from './utils/reporting.js'
import chalk from 'chalk'
import meow from 'meow'

const {dim, blue, bold, red, yellow} = chalk
const cli = meow(
  `
  ${bold('Usage')}
    ${blue(`action-reporting`)} ${yellow(`[options]`)}

  ${bold('Required options')} ${dim(`[one of]`)}
    ${yellow(`--enterprise`)}, ${yellow(`-e`)}  GitHub Enterprise Cloud account slug ${dim('(e.g. enterprise)')}.
    ${yellow(`--owner`)}, ${yellow(`-o`)}       GitHub organization/user login ${dim('(e.g. owner)')}.
                      ${dim(
                        `If ${yellow(`--owner`)} is a user, results for the authenticated user (${yellow(
                          `--token`,
                        )}) will be returned.`,
                      )}
    ${yellow(`--repository`)}, ${yellow(`-r`)}  GitHub repository name with owner ${dim('(e.g. owner/repo)')}.

  ${bold('Additional options')}
    ${yellow(`--token`)}, ${yellow(`-t`)}       GitHub Personal Access Token (PAT) ${dim('(default GITHUB_TOKEN)')}.

  ${bold('Report options')}
    ${yellow(`--all`)}             Report all below.

    ${yellow(`--listeners`)}       Report ${bold('on')} listeners used.
    ${yellow(`--permissions`)}     Report ${bold('permissions')} values for GITHUB_TOKEN.
    ${yellow(`--runs-on`)}         Report ${bold('runs-on')} values.
    ${yellow(`--secrets`)}         Report ${bold('secrets')} used.
    ${yellow(`--uses`)}            Report ${bold('uses')} values.
      ${yellow(`--exclude`)}         Exclude GitHub Actions created by GitHub.
                        ${dim(
                          `From https://github.com/actions and https://github.com/github organizations.
                        Only applies to ${yellow(`--uses`)}.`,
                        )}
      ${yellow(`--unique`)}          List unique GitHub Actions.
                        ${dim(
                          `Possible values are ${yellow('true')}, ${yellow('false')} and ${yellow('both')}.
                        Only applies to ${yellow(`--uses`)}.`,
                        )}
                        ${dim(`Will create an additional ${bold('*-unique.{csv,json,md}')} report file.`)}
    ${yellow(`--vars`)}            Report ${bold('vars')} used.

  ${bold('Output options')}
    ${yellow(`--csv`)}             Path to save CSV output ${dim('(e.g. /path/to/reports/report.csv)')}.
    ${yellow(`--json`)}            Path to save JSON output ${dim('(e.g. /path/to/reports/report.json)')}.
    ${yellow(`--md`)}              Path to save markdown output ${dim('(e.g. /path/to/reports/report.md)')}.

  ${bold('Helper options')}
    ${yellow(`--help`)}, ${yellow(`-h`)}        Print action-reporting help.
    ${yellow(`--version`)}, ${yellow(`-v`)}     Print action-reporting version.`,
  {
    booleanDefault: undefined,
    description: false,
    hardRejection: false,
    allowUnknownFlags: false,
    importMeta: import.meta,
    inferType: false,
    input: [],
    flags: {
      help: {
        type: 'boolean',
        shortFlag: 'h',
      },
      version: {
        type: 'boolean',
        shortFlag: 'v',
      },
      enterprise: {
        type: 'string',
        shortFlag: 'e',
      },
      owner: {
        type: 'string',
        shortFlag: 'o',
        isMultiple: false,
      },
      repository: {
        type: 'string',
        shortFlag: 'r',
        isMultiple: false,
      },
      token: {
        type: 'string',
        shortFlag: 't',
        default: process.env.GITHUB_TOKEN || '',
      },
      // reports
      all: {
        type: 'boolean',
        default: false,
      },
      listeners: {
        type: 'boolean',
        default: false,
      },
      permissions: {
        type: 'boolean',
        default: false,
      },
      runsOn: {
        type: 'boolean',
        default: false,
      },
      secrets: {
        type: 'boolean',
        default: false,
      },
      uses: {
        type: 'boolean',
        default: false,
      },
      exclude: {
        type: 'boolean',
        default: false,
      },
      unique: {
        default: false,
      },
      vars: {
        type: 'boolean',
        default: false,
      },
      // outputs
      csv: {
        type: 'string',
      },
      md: {
        type: 'string',
      },
      json: {
        type: 'string',
      },
    },
  },
)

// action
;(async () => {
  try {
    // Get options/flags
    const {help, version, enterprise, owner, repository, token, all, unique: _unique, exclude} = cli.flags

    // Get report options/flags
    let {listeners, permissions, runsOn, secrets, uses, vars} = cli.flags

    // Get output options/flags
    const {csv, md, json} = cli.flags

    help && cli.showHelp(0)
    version && cli.showVersion(0)

    if (!token) {
      throw new Error('GitHub Personal Access Token (PAT) not provided')
    }

    if (!(enterprise || owner || repository)) {
      throw new Error('no options provided')
    }

    if ((enterprise && owner) || (enterprise && repository) || (owner && repository)) {
      throw new Error('can only use one of: enterprise, owner, repository')
    }

    if (csv === '') {
      throw new Error('please provide a valid path for the CSV output')
    }

    if (md === '') {
      throw new Error('please provide a valid path for the markdown output')
    }

    if (json === '') {
      throw new Error('please provide a valid path for the JSON output')
    }

    const uniqueFlag = _unique === 'both' ? 'both' : _unique === 'true'
    if (![true, false, 'both'].includes(uniqueFlag)) {
      throw new Error('please provide a valid value for unique: true, false, both')
    }

    if (all) {
      listeners = true
      permissions = true
      runsOn = true
      secrets = true
      uses = true
      vars = true
    }

    const report = new Reporting({
      token,
      enterprise,
      owner,
      repository,
      flags: {
        getListeners: listeners,
        getPermissions: permissions,
        getRunsOn: runsOn,
        getSecrets: secrets,
        getUses: uses,
        isUnique: uniqueFlag,
        isExcluded: exclude,
        getVars: vars,
      },
      outputs: {
        csvPath: csv,
        mdPath: md,
        jsonPath: json,
      },
    })

    // get report
    await report.get()

    // create and save CSV
    if (csv) {
      await report.saveCsv()
      await report.saveCsvUnique()
    }

    // create and save markdown
    if (md) {
      await report.saveMarkdown()
      await report.saveMarkdownUnique()
    }

    // create and save JSON
    if (json) {
      await report.saveJSON()
      await report.saveJSONUnique()
    }
  } catch (error) {
    console.error(`\n  ${red('ERROR: %s')}`, error.message)
    console.error(error.stack)
    cli.showHelp(1)
  }
})()
