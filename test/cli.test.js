import {spawnSync} from 'node:child_process'
import {readFileSync} from 'node:fs'
import {fileURLToPath} from 'node:url'

const cliPath = fileURLToPath(new URL('../cli.js', import.meta.url))
const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))

/**
 * Run the CLI in a child process so the entrypoint is exercised end to end.
 * @param {string[]} args - CLI arguments
 * @returns {import('node:child_process').SpawnSyncReturns<string>} Child process result
 */
function runCli(args) {
  return spawnSync(process.execPath, [cliPath, ...args], {
    encoding: 'utf8',
    env: {
      ...process.env,
      GITHUB_TOKEN: '',
    },
  })
}

describe('cli', () => {
  beforeEach(() => {})

  afterEach(() => {})

  /**
   * Test CLI help functionality
   */
  test('should display help information with --help flag', () => {
    const result = runCli(['--help'])

    expect(result.status).toBe(0)
    expect(result.stdout).toContain('Usage')
    expect(result.stdout).toContain('action-reporting-cli')
  })

  /**
   * Test CLI version functionality
   */
  test('should display version information with --version flag', () => {
    const result = runCli(['--version'])

    expect(result.status).toBe(0)
    expect(result.stdout).toContain(packageJson.version)
  })
})
