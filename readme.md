# action-reporting-cli

[![test](https://github.com/stoe/action-reporting-cli/actions/workflows/test.yml/badge.svg)](https://github.com/stoe/action-reporting-cli/actions/workflows/test.yml)
[![publish](https://github.com/stoe/action-reporting-cli/actions/workflows/publish.yml/badge.svg)](https://github.com/stoe/action-reporting-cli/actions/workflows/publish.yml)
[![CodeQL](https://github.com/stoe/action-reporting-cli/actions/workflows/github-code-scanning/codeql/badge.svg)](https://github.com/stoe/action-reporting-cli/actions/workflows/github-code-scanning/codeql)
[![GitHub package.json version](https://img.shields.io/github/package-json/v/stoe/action-reporting-cli)](https://www.npmjs.com/package/@stoe/action-reporting-cli)
[![npm downloads](https://img.shields.io/npm/dm/%40stoe%2Faction-reporting-cli.svg)](https://www.npmjs.com/package/@stoe/action-reporting-cli)
[![install size](https://packagephobia.com/badge?p=@stoe/action-reporting-cli)](https://packagephobia.com/result?p=@stoe/action-reporting-cli)
![node version](https://img.shields.io/badge/node-%3E=22-339933?logo=node.js)
[![OpenSSF Scorecard](https://api.securityscorecards.dev/projects/github.com/stoe/action-reporting-cli/badge)](https://securityscorecards.dev/viewer/?uri=github.com/stoe/action-reporting-cli)
[![styled with prettier](https://img.shields.io/badge/styled_with-prettier-ff69b4.svg)](https://github.com/prettier/prettier)
[![license](https://img.shields.io/github/license/stoe/action-reporting-cli.svg)](./license)

> CLI to report on GitHub Actions usage across enterprises, organizations, users, and repositories

`action-reporting-cli` helps you audit GitHub Actions usage across your entire GitHub environment. It collects comprehensive data about workflows, actions, secrets, variables, permissions, and dependencies, giving you valuable insights into your Actions usage. The tool works with GitHub.com, GitHub Enterprise Cloud, and GitHub Enterprise Server.

## Table of Contents

1. [Quick Start](#quick-start)
2. [Installation](#installation)
3. [Authentication](#authentication)
4. [Usage](#usage)
5. [Options](#options)
6. [Report Files](#report-files)
7. [Examples](#examples)
8. [Performance Tips](#performance-tips)
9. [Contributing](#contributing)
10. [License](#license)

## Quick Start

Get a full enterprise report (all report types) in three formats:

```sh
npx @stoe/action-reporting-cli \
  --token YOUR_TOKEN \
  --enterprise my-enterprise \
  --all \
  --json ./reports/actions.json \
  --csv ./reports/actions.csv \
  --md ./reports/actions.md
```

List unique third‑party actions for one repository:

```sh
npx @stoe/action-reporting-cli \
  --token YOUR_TOKEN \
  --repository my-org/my-repo \
  --uses --exclude --unique both \
  --csv ./reports/actions.csv
```

Minimal org scan (just actions used):

```sh
export GITHUB_TOKEN=YOUR_TOKEN
npx @stoe/action-reporting-cli --owner my-org --uses --json ./report.json
```

## Installation

### Using npx (recommended)

Run without installing:

```sh
$ npx @stoe/action-reporting-cli [--options]
```

### Global Installation

```sh
$ npm install -g @stoe/action-reporting-cli
$ action-reporting-cli [--options]
```

### Local Installation

```sh
$ npm install @stoe/action-reporting-cli
$ npx action-reporting-cli [--options]
```

## Authentication

You'll need a GitHub Personal Access Token (PAT) with these permissions:

- For GitHub.com, GitHub Enterprise Cloud, and GitHub Enterprise Cloud with Data Residency:
  - `repo` scope to access private repositories
  - `workflow` scope to read GitHub Actions data
  - `admin:org` scope when using `--owner` with organizations

- For GitHub Enterprise Server:
  - Same permissions as above
  - Make sure you have network access to your GitHub Enterprise Server instance

You can provide your token using the `--token` parameter or by setting the `GITHUB_TOKEN` environment variable.

## Usage

You must specify exactly one target scope (enterprise OR owner OR repository). Then add the report flags you want and at least one output format.

Pattern:

```sh
action-reporting-cli --<scope> <name> [report flags] [output flags] [utility flags]
```

## Options

### 1. Target Scope (required — choose exactly one)

- `--enterprise`, `-e <slug>`: Enterprise account slug (GitHub Enterprise Cloud or Server)
- `--owner`, `-o <login>`: Organization or user login (user returns authenticated user’s repos)
- `--repository`, `-r <owner/name>`: Single repository

### 2. Authentication & Connection

- `--token`, `-t <token>`: Personal Access Token (defaults to `GITHUB_TOKEN` env var)
- `--hostname <host>`: Custom host.
  - GHES example: `github.example.com` → `https://github.example.com/api/v3`
  - GHEC+DR regional: `example.ghe.com` → `https://api.example.ghe.com`
  - Already API host: `api.example.ghe.com` (unchanged)
  - Omit for public: `https://api.github.com`

### 3. Report Content Flags

Pick any combination (or just `--all`):

- `--all`: Shorthand for all report types below (also sets `--unique both` for actions when combined with `--uses` logic)
- `--listeners`: Workflow `on` event triggers
- `--permissions`: `permissions` blocks for the default `GITHUB_TOKEN`
- `--runs-on`: Runner labels / environments used
- `--secrets`: Referenced secrets in workflows
- `--uses`: `uses:` action references
  - `--exclude`: Skip first‑party actions (`actions/*` and `github/*`) — only meaningful with `--uses`
  - `--unique <true|false|both>`: Reduce duplicates for third‑party actions.
    - `false` (default)
    - `true`: Adds an extra `.unique` output containing only unique third‑party actions
    - `both`: Keep full list plus `.unique` file (implied when `--all` includes actions)
- `--vars`: Referenced `vars` in workflows

### 4. Repository Filtering (enterprise / owner scopes only)

- `--archived`: Skip archived repositories
- `--forked`: Skip forked repositories

### 5. Output Formats (at least one recommended)

- `--csv <path>`: Write CSV report
- `--json <path>`: Write JSON report
- `--md <path>`: Write Markdown report

You can specify multiple output formats in one run.

### 6. Utility & Meta

- `--debug`, `-d`: Verbose progress + diagnostic logging
- `--skipCache`: Force fresh API calls (only works when `--debug` is enabled)
- `--help`, `-h`: Show inline usage help
- `--version`, `-v`: Show version

## Report Files

The tool generates reports in your specified format(s):

- **CSV**: Comma-separated values that you can easily import into spreadsheets
- **JSON**: Structured data format for programmatic access or further processing
- **Markdown**: Human-readable format that's perfect for documentation or sharing

When you use `--unique both` with `--uses`, you'll get an additional file with the `.unique` suffix containing only unique third-party actions.

### Hostname Handling

The CLI normalizes the API base URL from `--hostname`:

- (omitted): `https://api.github.com`
- `github.example.com`: → append `/api/v3`
- `example.ghe.com`: → prefix with `api.` (no `/api/v3`)
- `api.example.ghe.com`: → used as provided
- Extra protocol, case, paths, or trailing slashes are stripped

Rule of thumb:

1. Ends with `.ghe.com`? Ensure it starts with `api.` (do NOT add `/api/v3`).
2. Anything else custom? Treat as GHES → add `/api/v3`.
3. Nothing passed? Use public API.

Tip: Always pass `--hostname` in scripts so moves between public / GHES / GHEC+DR need no code changes.

## Examples

Here are some common usage scenarios to help you get started:

### Enterprise-Wide Audit

Get a complete report on all GitHub Actions usage across your enterprise:

```sh
# Analyze everything in your GitHub Enterprise Cloud account
$ npx @stoe/action-reporting-cli \
  --token ghp_000000000000000000000000000000000000 \
  --enterprise my-enterprise \
  --all \
  --csv ./reports/actions.csv \
  --json ./reports/actions.json \
  --md ./reports/actions.md
```

### Organization-Level Analysis

Focus on specific aspects of GitHub Actions in an organization:

```sh
# Check permissions, runners, secrets, actions, and variables in your org
$ npx @stoe/action-reporting-cli \
  --token ghp_000000000000000000000000000000000000 \
  --owner my-org \
  --permissions \
  --runs-on \
  --secrets \
  --uses \
  --vars \
  --json ./reports/actions.json
```

### Repository-Specific Analysis

Find unique third-party actions used in a specific repository:

```sh
# Identify third-party actions in your repository
$ npx @stoe/action-reporting-cli \
  --token ghp_000000000000000000000000000000000000 \
  --repository my-org/my-repo \
  --uses \
  --exclude \
  --unique both \
  --csv ./reports/actions.csv
```

### GitHub Enterprise Server

Run the tool against your GitHub Enterprise Server instance:

```sh
# Analyze an organization on GitHub Enterprise Server
$ npx @stoe/action-reporting-cli \
  --hostname github.example.com \
  --token ghp_000000000000000000000000000000000000 \
  --owner my-org \
  --all \
  --json ./reports/actions.json
```

### Using Environment Variables

Use environment variables for authentication:

```sh
# Set your token as an environment variable
$ export GITHUB_TOKEN=ghp_000000000000000000000000000000000000

# Run without including token in the command
$ npx @stoe/action-reporting-cli \
  --owner my-org \
  --uses \
  --csv ./reports/actions.csv
```

## Advanced Usage

### Filtering Repositories

Skip archived or forked repositories in your enterprise-wide scan:

```sh
$ npx @stoe/action-reporting-cli \
  --enterprise my-enterprise \
  --all \
  --archived \
  --forked \
  --json ./reports/actions.json
```

### Debugging Issues

Enable debug mode when you need more information:

```sh
$ npx @stoe/action-reporting-cli \
  --repository my-org/my-repo \
  --all \
  --debug \
  --md ./reports/actions.md
```

### Getting Fresh Data

Skip the cache to get the most up-to-date information (uses more API calls, only works with `--debug`):

```sh
$ npx @stoe/action-reporting-cli \
  --owner my-org \
  --all \
  --skipCache \
  --json ./reports/actions.json
```

## Performance Tips

When working with large GitHub environments:

- Use the `--debug` flag to monitor progress and identify any issues
- For very large enterprises, consider running separate scans for specific organizations
- Use repository filtering options (`--archived` and `--forked`) to reduce API calls or exclude unnecessary data

## Contributing

We welcome and appreciate your contributions! Whether you're reporting bugs, suggesting features, or submitting code changes, your help makes this project better.

Please check out our [contributing guidelines](./.github/contributing.md) for information on:

- How to submit bug reports and feature requests
- Development workflow and coding standards
- Pull request process
- Project structure

Thank you to everyone who's contributed!

## License

[MIT](./license) © [Stefan Stölzle](https://github.com/stoe)
