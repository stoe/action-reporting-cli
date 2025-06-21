/**
 * Mock for Repository module.
 */
import {jest} from '@jest/globals'

// Import fixtures
const workflows = require('../__fixtures__/workflows.json')

// Create a mock Repository class
class MockRepository {
  constructor(repository, options = {}) {
    this.repository = repository
    this.options = options
    this.owner = repository.split('/')[0]
    this.repo = repository.split('/')[1]
  }

  async getWorkflows() {
    return workflows
  }

  async getWorkflow(workflow) {
    const yaml = require('fs').readFileSync(
      require('path').join(process.cwd(), 'test/github/__fixtures__/sample-workflow.yml'),
      'utf8',
    )

    return {
      name: workflow.name,
      path: workflow.path,
      language: {name: 'YAML'},
      object: {text: yaml, isTruncated: false},
    }
  }
}

// Export the mock class
export default jest.fn().mockImplementation((repository, options) => new MockRepository(repository, options))
