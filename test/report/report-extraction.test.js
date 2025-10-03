/**
 * Integration-style test for Report extraction to ensure workflow YAML is parsed
 * and data sets (listeners, permissions, runsOn, secrets, vars, uses) are populated.
 * This is written BEFORE the underlying bug fix (yaml Promise) so it will fail initially (TDD).
 */
import {jest} from '@jest/globals'
import Report from '../../src/report/report.js'

// Minimal mock logger with required interface (spinner-compatible methods)
const mockLogger = () => ({
  debug: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  start: jest.fn(),
  stopAndPersist: jest.fn(),
  fail: jest.fn(),
  isDebug: true,
  text: '',
  set text(_) {},
})

// Minimal mock cache (disabled path interactions for this test)
const mockCache = () => ({
  path: '',
  exists: jest.fn().mockResolvedValue(false),
  load: jest.fn(),
  save: jest.fn(),
})

// Sample workflow YAML content containing all extractable elements
const WORKFLOW_YAML = `name: CI Full
on:
  push:
    branches: [ main ]
permissions:
  contents: read
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4
      - name: Setup
        uses: actions/setup-node@v4
        with:
          node-version: 20
      - name: Env usage
        run: echo "+\${{ secrets.MY_SECRET }}+\${{ vars.MY_VAR }}+"
`

// Fake workflow object as produced by Repository.getWorkflows / Workflow.getWorkflow (after fix)
function createWorkflow() {
  return {
    node_id: 'WF_node',
    path: '.github/workflows/ci.yml',
    language: 'YAML',
    text: WORKFLOW_YAML,
    yaml: {
      name: 'CI Full',
      on: {push: {branches: ['main']}},
      permissions: {contents: 'read'},
      jobs: {
        build: {
          'runs-on': 'ubuntu-latest',
          steps: [
            {name: 'Checkout', uses: 'actions/checkout@v4'},
            {name: 'Setup', uses: 'actions/setup-node@v4', with: {'node-version': 20}},
            {name: 'Env usage', run: 'echo "+${{ secrets.MY_SECRET }}+${{ vars.MY_VAR }}+"'},
          ],
        },
      },
    },
    state: 'active',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    last_run_at: new Date().toISOString(),
  }
}

describe('Report extraction end-to-end (regression)', () => {
  test('should populate extraction sets from workflow YAML', async () => {
    const flags = {
      token: 'TEST',
      repository: 'o/r',
      csv: null,
      json: null,
      md: null,
      listeners: true,
      permissions: true,
      runsOn: true,
      secrets: true,
      vars: true,
      uses: true,
      unique: 'false',
    }

    const report = new Report(flags, mockLogger(), mockCache())

    const repoData = {
      workflows: [createWorkflow()],
    }

    const data = await report.createReport(repoData)
    expect(data).toHaveLength(1)
    const wf = data[0]

    // These expectations will fail until yaml Promise bug is fixed
    expect(wf.name).toBe('CI Full')
    expect(wf.listeners instanceof Set && wf.listeners.size).toBeGreaterThan(0)
    expect(wf.permissions instanceof Set && wf.permissions.size).toBeGreaterThan(0)
    expect(wf.runsOn instanceof Set && wf.runsOn.size).toBeGreaterThan(0)
    expect(wf.secrets instanceof Set && wf.secrets.size).toBeGreaterThan(0)
    expect(wf.vars instanceof Set && wf.vars.size).toBeGreaterThan(0)
    expect(wf.uses instanceof Set && wf.uses.size).toBeGreaterThan(0)
  })
})
