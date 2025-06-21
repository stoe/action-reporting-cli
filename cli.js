#!/usr/bin/env node

/**
 * @fileoverview GitHub Actions Reporting CLI - Generates reports on GitHub Actions usage across enterprises,
 * organizations, users, and individual repositories. Supports CSV, JSON, and Markdown output formats.
 *
 * This CLI tool helps organizations audit their GitHub Actions usage by collecting data about workflows,
 * secrets, variables, permissions, and action dependencies. It supports GitHub Enterprise Cloud/Server
 * and provides caching for improved performance on large datasets.
 *
 * @author Stefan Stölzle
 * @license MIT
 */

import chalk from 'chalk'
import meow from 'meow'

// Report class
import Report from './src/report/report.js'

// Utilities
import cacheInstance from './src/util/cache.js'
import log from './src/util/log.js'

const {blue, bold, dim, yellow} = chalk

/**
 * Creates the help text for the CLI application.
 * @returns {string} The formatted help text with usage, options, and examples
 */
function createHelpText() {
  return `
  ${bold('Usage')}
    ${blue(`action-reporting-cli`)} ${yellow(`[options]`)}

  ${bold('Required options')} ${dim(`[one of]`)}
    ${yellow(`--enterprise`)}, ${yellow(`-e`)}  GitHub Enterprise (Cloud|Server) account slug ${dim(
      '(e.g. enterprise)',
    )}.
    ${yellow(`--owner`)}, ${yellow(`-o`)}       GitHub organization/user login ${dim('(e.g. owner)')}.
                        ${dim(
                          `If ${yellow(`--owner`)} is a user, results for the authenticated user (${yellow(
                            `--token`,
                          )}) will be returned.`,
                        )}
    ${yellow(`--repository`)}, ${yellow(`-r`)}  GitHub repository name with owner ${dim('(e.g. owner/repo)')}.

  ${bold('Additional options')}
    ${yellow(`--token`)}, ${yellow(`-t`)}       GitHub Personal Access Token (PAT) ${dim('(default GITHUB_TOKEN)')}.
    ${yellow(`--hostname`)}        GitHub Enterprise Server ${bold('hostname')} ${dim('(default api.github.com)')}.
                       ${dim(`For example: ${yellow('github.example.com')}`)}

  ${bold('Report options')}
    ${yellow(`--all`)}             Report all below or individually:
      ${yellow(`--listeners`)}     Report ${bold('on')} listeners used.
      ${yellow(`--permissions`)}   Report ${bold('permissions')} values for GITHUB_TOKEN.
      ${yellow(`--runs-on`)}       Report ${bold('runs-on')} values.
      ${yellow(`--secrets`)}       Report ${bold('secrets')} used.
      ${yellow(`--vars`)}          Report ${bold('vars')} used.
      ${yellow(`--uses`)}          Report ${bold('uses')} values.
        ${yellow(`--exclude`)}     Exclude GitHub Actions created by GitHub. ${dim(`(can be used with ${yellow('--all')})`)}
                       ${dim(`From https://github.com/actions and https://github.com/github organizations.
                        Only applies to ${yellow(`--uses`)}.`)}
        ${yellow(`--unique`)}      List unique GitHub Actions.
                        ${dim(
                          `Possible values are ${yellow('true')}, ${yellow('false')} and ${yellow('both')}.
                        Will create an additional ${bold('*-unique.{csv,json,md}')} report file when not ${yellow('false')}.
                        Resolves to ${yellow('both')} for ${yellow(`--all`)}.`,
                        )}

  ${bold('Output options')}
    ${yellow(`--csv`)}             Path to save CSV output ${dim('(e.g. /path/to/reports/report.csv)')}.
    ${yellow(`--json`)}            Path to save JSON output ${dim('(e.g. /path/to/reports/report.json)')}.
    ${yellow(`--md`)}              Path to save markdown output ${dim('(e.g. /path/to/reports/report.md)')}.

  ${bold('Skip options')} ${dim(`[only applies to --enterprise and --owner options]`)}
    ${yellow(`--archived`)}        Skip archived repositories ${dim('(default false)')}.
    ${yellow(`--forked`)}          Skip forked repositories ${dim('(default false)')}.

  ${bold('Helper options')}
    ${yellow(`--debug`)}, ${yellow(`-d`)}       Enable debug mode.
    ${yellow(`--skipCache`)}       Disable caching.
    ${yellow(`--help`)}, ${yellow(`-h`)}        Print action-reporting help.
    ${yellow(`--version`)}, ${yellow(`-v`)}     Print action-reporting version.`
}

/**
 * Creates the CLI flags configuration object.
 * @returns {object} The CLI flags configuration for meow
 */
const CLI_FLAGS = {
  // Required options
  enterprise: {
    type: 'string',
    shortFlag: 'e',
  },
  owner: {
    type: 'string',
    shortFlag: 'o',
  },
  repository: {
    type: 'string',
    shortFlag: 'r',
  },
  // Additional options
  token: {
    type: 'string',
    default: process.env.GITHUB_TOKEN || '',
    shortFlag: 't',
  },
  hostname: {
    type: 'string',
  },
  // Report options
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
  vars: {
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
    type: 'string',
    default: 'false',
  },
  // Output options
  csv: {
    type: 'string',
  },
  md: {
    type: 'string',
  },
  json: {
    type: 'string',
  },
  // Skip options
  archived: {
    type: 'boolean',
    default: false,
  },
  forked: {
    type: 'boolean',
    default: false,
  },
  // Helper options
  debug: {
    type: 'boolean',
    default: false,
    shortFlag: 'd',
  },
  skipCache: {
    type: 'boolean',
    default: false,
  },
  help: {
    type: 'boolean',
    shortFlag: 'h',
  },
  version: {
    type: 'boolean',
    shortFlag: 'v',
  },
}

const cli = meow(createHelpText(), {
  booleanDefault: undefined,
  description: false,
  hardRejection: false,
  allowUnknownFlags: false,
  importMeta: import.meta,
  inferType: false,
  input: [],
  flags: CLI_FLAGS,
})

/**
 * Displays a structured status message showing what the CLI is scanning for and what options are enabled.
 * @param {object} flags - The CLI flags object containing all user options
 * @param {string} targetName - The name of the target (enterprise, owner, or repository)
 * @param {string} [hostName] - Optional hostname for GitHub Enterprise Server
 */
const displayAnalysisSummary = (flags, targetName, hostName) => {
  // Check if any report options are enabled
  const {all, listeners, permissions, runsOn, secrets, vars, uses, exclude, unique, archived, forked} = flags

  // Create readable list of enabled report types
  const enabledReportTypes = []
  if (all || listeners) enabledReportTypes.push('listeners')
  if (all || permissions) enabledReportTypes.push('permissions')
  if (all || runsOn) enabledReportTypes.push('runs-on')
  if (all || secrets) enabledReportTypes.push('secrets')
  if (all || vars) enabledReportTypes.push('vars')
  if (all || uses) enabledReportTypes.push('uses')

  // Create readable list of options
  const options = []
  if (all || uses) {
    if (exclude) options.push('excluding actions created by GitHub')
    const uniqueValue = all ? 'both' : unique
    if (uniqueValue !== 'false') options.push(`unique report=${uniqueValue}`)
  }
  // Show repository filter information
  if (archived) options.push('skip archived repos')
  if (forked) options.push('skip forked repos')

  // Create readable list of output formats
  const outputs = []
  if (flags.csv) outputs.push('csv')
  if (flags.json) outputs.push('json')
  if (flags.md) outputs.push('markdown')

  // Build the structured message
  console.log(
    `Analyzing GitHub Actions in ${blue(targetName)}${hostName ? ` on ${blue(hostName)}` : ''}:
${yellow('→')} scanning:\t${enabledReportTypes.map(type => yellow(type)).join(', ')}
${yellow('→')} options:\t${options.length > 0 ? options.map(opt => yellow(opt)).join(', ') : 'none'}
${yellow('→')} outputs:\t${outputs.length > 0 ? outputs.map(output => yellow(output)).join(', ') : 'none'}

${dim('This can take a while...')}
`,
  )
}

/**
 * Main execution function that orchestrates the CLI application.
 * Handles input validation, option processing, and delegates to appropriate processing functions.
 * @async
 * @returns {Promise<void>}
 * @throws {Error} When validation fails or processing encounters errors
 */
async function main() {
  console.log(`${bold('@stoe/action-reporting-cli')} ${dim(`v${cli.pkg.version}`)}\n`)

  const {token, hostname, enterprise, owner, repository, debug, archived, forked, help, version} = cli.flags
  const entity = enterprise || owner || repository
  const logger = log(entity, token, debug)
  const cache = cacheInstance(null, logger)

  try {
    // Handle help and version flags early exit
    if (help) cli.showHelp(0)
    if (version) cli.showVersion(0)

    const report = new Report(cli.flags, logger, cache)

    // Display analysis summary
    displayAnalysisSummary(cli.flags, enterprise || owner || repository, hostname)

    let results

    if (enterprise) {
      results = await report.processEnterprise(enterprise, token, hostname, debug, archived, forked)
    } else if (owner) {
      results = await report.processOwner(owner, token, hostname, debug, archived, forked)
    } else if (repository) {
      results = await report.processRepository(repository, token, hostname, debug, archived, forked)
    }

    const reportData = await report.createReport(results)
    reportData.length && (await report.saveReports(reportData))
  } catch (error) {
    logger.fail(error.message)

    // Log error stack trace in debug mode
    debug && logger.error(error.stack)
  }
}

// Execute the main function
main()
