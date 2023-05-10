# action-reporting-cli

[![test](https://github.com/stoe/action-reporting-cli/actions/workflows/test.yml/badge.svg)](https://github.com/stoe/action-reporting-cli/actions/workflows/test.yml) [![codeql](https://github.com/stoe/action-reporting-cli/actions/workflows/codeql.yml/badge.svg)](https://github.com/stoe/action-reporting-cli/actions/workflows/codeql.yml) [![publish](https://github.com/stoe/action-reporting-cli/actions/workflows/publish.yml/badge.svg)](https://github.com/stoe/action-reporting-cli/actions/workflows/publish.yml) [![styled with prettier](https://img.shields.io/badge/styled_with-prettier-ff69b4.svg)](https://github.com/prettier/prettier)

> CLI to report on GitHub Actions

## Usage example

```sh
$ npx @stoe/action-reporting-cli [--options]
```

## Required options [one of]

- `--enterprise`, `-e` GitHub Enterprise Cloud account slug (e.g. _enterprise_).
- `--owner`, `-o` GitHub organization/user login (e.g. _owner_).
  If `--owner` is a user, results for the authenticated user (`--token`) will be returned.
- `--repository`, `-r` GitHub repository name with owner (e.g. _owner/repo_).

## Additional options

- `--token`, `-t` GitHub Personal Access Token (PAT) (default `GITHUB_TOKEN`).
- `--permissions` Report `permissions` values for `GITHUB_TOKEN`.
- `--runs-on` Report `runs-on` values.
- `--secrets` Report `secrets` used.
- `--uses` Report `uses` values.
  - `--exclude` Exclude GitHub Actions created by GitHub.<br/>
    From https://github.com/actions and https://github.com/github organizations.<br/>
    Only applies to `--uses`.
  - `--unique` List unique GitHub Actions.<br/>
    Possible values are `true`, `false` and `both`.<br/>
    Only applies to `--uses`. Will create an additional `*-unique.{csv,json,md}` report file.
- `--vars` Report `vars` used.

## Report output options

- `--csv` Path to save CSV output (e.g. /path/to/reports/report.csv).
- `--json` Path to save JSON output (e.g. /path/to/reports/report.json).
- `--md` Path to save markdown output (e.g. /path/to/reports/report.md).

## Helper options

- `--help`, `-h` Print action-reporting-cli help.
- `--version`, `-v` Print action-reporting-cli version.

## Examples

```sh
# Report on everything in the `my-enterprise` GitHub Enterprise Cloud account.
# Save CSV, JSON and markdown reports to `./reports/actions.{csv,json,md}`.
$ npx @stoe/action-reporting-cli \
  --token ghp_000000000000000000000000000000000000 \
  --enterprise my-enterprise \
  --permissions \
  --runs-on \
  --secrets \
  --uses \
  --vars \
  --csv ./reports/actions.csv \
  --json ./reports/actions.json \
  --md ./reports/actions.md
```

```sh
# Report on everything in the `my-org` GitHub organization.
# Save JSON report to `./reports/actions.json`.
$ npx @stoe/action-reporting-cli \
  --token ghp_000000000000000000000000000000000000 \
  --owner my-org \
  --permissions \
  --runs-on \
  --secrets \
  --uses \
  --vars \
  --csv ./reports/actions.csv
```

```sh
# Report on unique GitHub Actions in the `my-org/myrepo` GitHub repository.
# Exclude GitHub Actions created by GitHub.
# Save CSV report to `./reports/actions.CSV`.
$ npx @stoe/action-reporting-cli \
  --token ghp_000000000000000000000000000000000000 \
  --repository my-org/myrepo \
  --uses \
  --exclude \
  --unique both \
  --csv ./reports/actions.CSV
```

## License

[MIT](./license) © [Stefan Stölzle](https://github.com/stoe)
