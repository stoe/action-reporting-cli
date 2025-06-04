# action-reporting-cli

[![test](https://github.com/stoe/action-reporting-cli/actions/workflows/test.yml/badge.svg)](https://github.com/stoe/action-reporting-cli/actions/workflows/test.yml) [![CodeQL](https://github.com/stoe/action-reporting-cli/actions/workflows/github-code-scanning/codeql/badge.svg)](https://github.com/stoe/action-reporting-cli/actions/workflows/github-code-scanning/codeql) [![publish](https://github.com/stoe/action-reporting-cli/actions/workflows/publish.yml/badge.svg)](https://github.com/stoe/action-reporting-cli/actions/workflows/publish.yml) [![styled with prettier](https://img.shields.io/badge/styled_with-prettier-ff69b4.svg)](https://github.com/prettier/prettier)

> CLI to report on GitHub Actions usage across enterprises, organizations, users, and repositories

`action-reporting-cli` helps you audit GitHub Actions usage across your GitHub environment by collecting comprehensive data about workflows, actions, secrets, variables, permissions, and dependencies. It supports GitHub.com, GitHub Enterprise Cloud, and GitHub Enterprise Server.

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

The tool requires a GitHub Personal Access Token (PAT) with appropriate permissions:

- For GitHub.com and GitHub Enterprise Cloud:

  - `repo` scope for private repositories
  - `workflow` scope to access GitHub Actions data
  - `admin:org` scope when using `--owner` for organizations

- For GitHub Enterprise Server:
  - Same permissions as above
  - Ensure network access to your GitHub Enterprise Server instance

You can provide the token using the `--token` parameter or via the `GITHUB_TOKEN` environment variable.

## Usage

The tool requires one target scope to analyze (enterprise, owner, or repository):

```sh
# Basic usage pattern
$ action-reporting-cli --<scope> <name> --<report-options> --<output-options>
```

## Options

### Target Scope (Required, choose one)

- `--enterprise`, `-e` GitHub Enterprise (Cloud|Server) account slug (e.g. _enterprise_).
- `--owner`, `-o` GitHub organization/user login (e.g. _owner_).
  If `--owner` is a user, results for the authenticated user (`--token`) will be returned.
- `--repository`, `-r` GitHub repository name with owner (e.g. _owner/repo_).

### Authentication and Connection

- `--token`, `-t` GitHub Personal Access Token (PAT) (default: environment variable `GITHUB_TOKEN`).
- `--hostname` GitHub Enterprise Server hostname or GitHub Enterprise Cloud with Data Residency region endpoint (default: `api.github.com`).
  For GitHub Enterprise Server: `github.example.com`
  For GitHub Enterprise Cloud with Data Residency: `api.example.ghe.com`

### Report Content Options

- `--all` Generate all report types listed below.
- `--listeners` Report workflow `on` event listeners/triggers used.
- `--permissions` Report `permissions` values set for `GITHUB_TOKEN`.
- `--runs-on` Report `runs-on` runner environments used.
- `--secrets` Report `secrets` referenced in workflows.
- `--uses` Report `uses` statements for actions referenced.
  - `--exclude` Exclude GitHub-created actions (from github.com/actions and github.com/github).
  - `--unique` List unique GitHub Actions references.
    Values: `true`, `false`, or `both` (default: `false`).
    When `true` or `both`, creates additional `*-unique.{csv,json,md}` report files.
- `--vars` Report `vars` referenced in workflows.

### Repository Filtering (for Enterprise/Owner Scopes)

- `--archived` Skip archived repositories (default: `false`).
- `--forked` Skip forked repositories (default: `false`).

### Output Format Options

- `--csv` Path to save CSV output (e.g. `/path/to/reports/report.csv`).
- `--json` Path to save JSON output (e.g. `/path/to/reports/report.json`).
- `--md` Path to save markdown output (e.g. `/path/to/reports/report.md`).

### Utility Options

- `--debug`, `-d` Enable debug mode with verbose logging.
- `--skipCache` Disable caching of API responses.
- `--help`, `-h` Print action-reporting-cli help.
- `--version`, `-v` Print action-reporting-cli version.

## Report Files

The tool generates reports in your specified format(s) with the following naming convention:

- Enterprise reports: `enterprise.<slug>.[csv|json|md]`
- Organization reports: `org.<org-name>.[csv|json|md]`
- User reports: `user.<username>.[csv|json|md]`
- Repository reports: `repository.<owner>-<repo>.[csv|json|md]`

When using `--unique true` or `--unique both` with `--uses`, additional files with `.unique` suffix are created.

## Examples

### Enterprise-Wide Audit

Generate a complete report on all GitHub Actions usage across an enterprise:

```sh
# Report on everything in the `my-enterprise` GitHub Enterprise Cloud account
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
# Report on permissions, runners, secrets, actions, and variables in a GitHub organization
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

### Repository-Specific Report

Analyze unique third-party actions used in a specific repository:

```sh
# Report on unique third-party GitHub Actions in a specific repository
$ npx @stoe/action-reporting-cli \
  --token ghp_000000000000000000000000000000000000 \
  --repository my-org/myrepo \
  --uses \
  --exclude \
  --unique both \
  --csv ./reports/actions.csv
```

### GitHub Enterprise Server

Run the tool against GitHub Enterprise Server:

```sh
# Report on everything in an organization on GitHub Enterprise Server
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
# Set token as environment variable
$ export GITHUB_TOKEN=ghp_000000000000000000000000000000000000

# Run without specifying token in command
$ npx @stoe/action-reporting-cli \
  --owner my-org \
  --uses \
  --csv ./reports/actions.csv
```

## Advanced Usage

### Filtering Repositories

Skip archived or forked repositories in an enterprise-wide scan:

```sh
$ npx @stoe/action-reporting-cli \
  --enterprise my-enterprise \
  --all \
  --archived \
  --forked \
  --json ./reports/actions.json
```

### Debugging Issues

Enable debug mode for verbose logging:

```sh
$ npx @stoe/action-reporting-cli \
  --repository my-org/myrepo \
  --all \
  --debug \
  --md ./reports/actions.md
```

### API Performance

Skip cache for fresh data (may increase API usage):

```sh
$ npx @stoe/action-reporting-cli \
  --owner my-org \
  --all \
  --skipCache \
  --json ./reports/actions.json
```

## Contributing

Contributions to this project are welcome and appreciated! Whether you want to report a bug, suggest enhancements, or submit code changes, your help makes this project better.

Please see our [contributing guidelines](./.github/contributing.md) for detailed information on:

- How to submit bug reports and feature requests
- The development workflow and coding standards
- Pull request process and review expectations
- Project structure and architecture

Thank you to all our contributors!

## Performance Considerations

- Set `--debug` flag to see detailed progress information
- For very large scans, consider targeting specific organizations or repositories

## License

[MIT](./license) © [Stefan Stölzle](https://github.com/stoe)
