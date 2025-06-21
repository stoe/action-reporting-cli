# action-reporting-cli

[![test](https://github.com/stoe/action-reporting-cli/actions/workflows/test.yml/badge.svg)](https://github.com/stoe/action-reporting-cli/actions/workflows/test.yml) [![CodeQL](https://github.com/stoe/action-reporting-cli/actions/workflows/github-code-scanning/codeql/badge.svg)](https://github.com/stoe/action-reporting-cli/actions/workflows/github-code-scanning/codeql) [![publish](https://github.com/stoe/action-reporting-cli/actions/workflows/publish.yml/badge.svg)](https://github.com/stoe/action-reporting-cli/actions/workflows/publish.yml) [![styled with prettier](https://img.shields.io/badge/styled_with-prettier-ff69b4.svg)](https://github.com/prettier/prettier)

> CLI to report on GitHub Actions usage across enterprises, organizations, users, and repositories

`action-reporting-cli` helps you audit GitHub Actions usage across your entire GitHub environment. It collects comprehensive data about workflows, actions, secrets, variables, permissions, and dependencies, giving you valuable insights into your Actions usage. The tool works with GitHub.com, GitHub Enterprise Cloud, and GitHub Enterprise Server.

## Table of Contents

- [Installation](#installation)
- [Authentication](#authentication)
- [Usage](#usage)
- [Options](#options)
- [Examples](#examples)
- [Report Files](#report-files)
- [Contributing](#contributing)
- [License](#license)

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

You'll need to specify one target scope to analyze (enterprise, owner, or repository):

```sh
# Basic usage pattern
$ action-reporting-cli --<scope> <name> --<report-options> --<output-options>
```

## Options

### Target Scope (Required, choose one)

| Option                   | Description                                                                                                    | Example          |
| ------------------------ | -------------------------------------------------------------------------------------------------------------- | ---------------- |
| `--enterprise`,<br/>`-e` | GitHub Enterprise Cloud or Server account slug                                                                 | _my-enterprise_  |
| `--owner`,<br/>`-o`      | GitHub organization or user login.<br/>When `--owner` is a user, you'll get results for the authenticated user | _my-org_         |
| `--repository`,<br/>`-r` | GitHub repository name with owner                                                                              | _my-org/my-repo_ |

### Authentication and Connection

| Option              | Description                                                                                                                                                                                                                      | Default                             |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| `--token`,<br/>`-t` | Your GitHub Personal Access Token                                                                                                                                                                                                | Environment variable `GITHUB_TOKEN` |
| `--hostname`        | GitHub Enterprise Server hostname or GitHub Enterprise Cloud with Data Residency endpoint:<br/>- For GitHub Enterprise Server: `github.example.com`<br/>- For GitHub Enterprise Cloud with Data Residency: `api.example.ghe.com` | `api.github.com`                    |

### Report Content Options

| Option          | Description                                                                     | Default                                    | Notes                                                                                                                                                                                                           |
| --------------- | ------------------------------------------------------------------------------- | ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--all`         | Generate all report types listed below                                          |                                            |                                                                                                                                                                                                                 |
| `--listeners`   | Report workflow `on` event listeners and triggers used                          |                                            |                                                                                                                                                                                                                 |
| `--permissions` | Report `permissions` values set for `GITHUB_TOKEN`                              |                                            |                                                                                                                                                                                                                 |
| `--runs-on`     | Report `runs-on` runner environments used                                       |                                            |                                                                                                                                                                                                                 |
| `--secrets`     | Report `secrets` referenced in workflows                                        |                                            |                                                                                                                                                                                                                 |
| `--uses`        | Report `uses` statements for actions referenced                                 |                                            |                                                                                                                                                                                                                 |
| `--exclude`     | Skip GitHub-created Actions (from `github.com/actions` and `github.com/github`) |                                            | Use with `--uses`                                                                                                                                                                                               |
| `--unique`      | List unique GitHub Actions references                                           | `false`<br/> `both` when used with `--all` | Values: `true`, `false`, or `both`.<br/>When `true` creates a `.unique` file with unique third-party actions.<br/>When `both`, creates two files: one with all actions and one with unique third-party actions. |
| `--vars`        | Report `vars` referenced in workflows                                           |                                            |                                                                                                                                                                                                                 |

### Repository Filtering (for Enterprise/Owner Scopes)

| Option       | Description                | Default |
| ------------ | -------------------------- | ------- |
| `--archived` | Skip archived repositories | `false` |
| `--forked`   | Skip forked repositories   | `false` |

### Output Format Options

| Option   | Description                  | Example                 |
| -------- | ---------------------------- | ----------------------- |
| `--csv`  | Path to save CSV output      | `./reports/report.csv`  |
| `--json` | Path to save JSON output     | `./reports/report.json` |
| `--md`   | Path to save Markdown output | `./reports/report.md`   |

### Utility Options

| Option                | Description                                                                             |
| --------------------- | --------------------------------------------------------------------------------------- |
| `--debug`,<br/>`-d`   | Enable debug mode with verbose logging                                                  |
| `--skipCache`         | Disable caching of API responses (gets fresh data each time, only works with `--debug`) |
| `--help`,<br/>`-h`    | Show command help and usage information                                                 |
| `--version`,<br/>`-v` | Display the tool's version                                                              |

## Report Files

The tool generates reports in your specified format(s):

- **CSV**: Comma-separated values that you can easily import into spreadsheets
- **JSON**: Structured data format for programmatic access or further processing
- **Markdown**: Human-readable format that's perfect for documentation or sharing

When you use `--unique both` with `--uses`, you'll get an additional file with the `.unique` suffix containing only unique third-party actions.

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
