/**
 * Mock for Repository module.
 */
import {jest} from '@jest/globals'

// Create a mock Owner class
class MockOwner {
  constructor(login, options = {}) {
    this.login = login
    this.options = options
    this.name = undefined
    this.id = undefined
    this.node_id = undefined
    this.type = 'Organization'
  }

  async getRepositories() {
    return [
      {name: 'repo1', owner: this.login},
      {name: 'repo2', owner: this.login},
    ]
  }
}

// Export the mock class
export default jest.fn().mockImplementation((login, options) => new MockOwner(login, options))
