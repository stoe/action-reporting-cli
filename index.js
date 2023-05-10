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
    ${yellow(`--token`)}, ${yellow(`-t`)}       GitHub Personal Access Token (PAT) ${dim('(default GITHUB_TOKEN)')}.

  ${bold('Additional options')}
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

  ${bold('Report output options')}
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
        alias: 'h',
      },
      version: {
        type: 'boolean',
        alias: 'v',
      },
      enterprise: {
        type: 'string',
        alias: 'e',
      },
      owner: {
        type: 'string',
        alias: 'o',
        isMultiple: false,
      },
      repository: {
        type: 'string',
        alias: 'r',
        isMultiple: false,
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
      csv: {
        type: 'string',
      },
      md: {
        type: 'string',
      },
      json: {
        type: 'string',
      },
      token: {
        type: 'string',
        alias: 't',
        default: process.env.GITHUB_TOKEN || '',
      },
    },
  },
)

// action
;(async () => {
  try {
    // Get options/flags
    const {
      help,
      version,
      enterprise,
      owner,
      repository,
      csv,
      md,
      json,
      token,
      permissions,
      runsOn,
      secrets,
      uses,
      unique: _unique,
      exclude,
    } = cli.flags

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

    const report = new Reporting({
      token,
      enterprise,
      owner,
      repository,
      flags: {
        getPermissions: permissions,
        getRunsOn: runsOn,
        getSecrets: secrets,
        getUses: uses,
        isUnique: uniqueFlag,
        isExcluded: exclude,
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
