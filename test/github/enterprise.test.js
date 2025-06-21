/**
 * Unit tests for the GitHub Enterprise module.
 */
import {jest} from '@jest/globals'

// Import the module under test
import Enterprise from '../../src/github/enterprise.js'

// Mock the Owner class to avoid GraphQL calls in Enterprise tests
jest.mock('../../src/github/owner.js', () => {
  return jest.fn().mockImplementation(() => ({
    login: undefined,
    name: undefined,
    id: undefined,
    node_id: undefined,
    type: undefined,
    getRepositories: jest.fn().mockResolvedValue([
      {name: 'repo1', owner: 'mocked-org'},
      {name: 'repo2', owner: 'mocked-org'},
    ]),
  }))
})

describe('enterprise', () => {
  let enterprise

  beforeEach(() => {
    // Create instance with mocks
    enterprise = new Enterprise('test-enterprise', {
      token: 'test-token',
      debug: false,
    })
  })

  afterEach(() => {
    jest.resetAllMocks()
  })

  /**
   * Test that Enterprise class can be instantiated.
   */
  test('should instantiate with valid token', () => {
    expect(enterprise).toBeInstanceOf(Enterprise)
  })

  /**
   * Test constructor options
   */
  describe('constructor options', () => {
    test('should handle all constructor parameters', () => {
      const options = {
        token: 'test-token',
        hostname: 'github.enterprise.com',
        debug: true,
        archived: true,
        forked: true,
      }
      const ent = new Enterprise('test-ent', options)
      expect(ent.name).toBe('test-ent')
      expect(ent.options).toEqual(options)
    })

    test('should handle default values', () => {
      const ent = new Enterprise('test-ent', {token: 'test-token'})
      expect(ent.name).toBe('test-ent')
      expect(ent.organizations).toEqual([])
    })
  })

  /**
   * Test property getters and setters
   */
  describe('property getters and setters', () => {
    test('should handle name property correctly', () => {
      expect(enterprise.name).toBe('test-enterprise')
      enterprise.name = 'new-enterprise'
      expect(enterprise.name).toBe('new-enterprise')
    })

    test('should handle id property correctly', () => {
      expect(enterprise.id).toBeUndefined()
      enterprise.id = 123
      expect(enterprise.id).toBe(123)
    })

    test('should handle node_id property correctly', () => {
      expect(enterprise.node_id).toBeUndefined()
      enterprise.node_id = 'MDEwOkVudGVycHJpc2Ux'
      expect(enterprise.node_id).toBe('MDEwOkVudGVycHJpc2Ux')
    })

    test('should handle organizations property correctly', () => {
      expect(enterprise.organizations).toEqual([])
      const orgs = [{login: 'org1'}, {login: 'org2'}]
      enterprise.organizations = orgs
      expect(enterprise.organizations).toEqual(orgs)
    })

    test('should return options object', () => {
      expect(enterprise.options).toBeDefined()
      expect(enterprise.options.token).toBe('test-token')
      expect(enterprise.options.debug).toBe(false)
    })
  })

  /**
   * Test enterprise operations
   */
  describe('enterprise operations', () => {
    beforeEach(() => {
      // Mock the octokit requests
      enterprise.octokit.graphql = jest.fn()
    })

    test('should fetch organizations for enterprise (simplified)', async () => {
      const mockGraphQLResponse = {
        enterprise: {
          name: 'test-enterprise',
          id: 123,
          node_id: 'MDEwOkVudGVycHJpc2Ux',
          organizations: {
            nodes: [],
            pageInfo: {
              hasNextPage: false,
              endCursor: null,
            },
          },
        },
      }

      enterprise.octokit.graphql.mockResolvedValueOnce(mockGraphQLResponse)

      const orgs = await enterprise.getOrganizations('test-enterprise')

      expect(Array.isArray(orgs)).toBe(true)
      expect(enterprise.name).toBe('test-enterprise')
      expect(enterprise.id).toBe(123)
      expect(enterprise.node_id).toBe('MDEwOkVudGVycHJpc2Ux')
    })

    test('should handle pagination correctly (simplified)', async () => {
      // First page
      const mockFirstPage = {
        enterprise: {
          name: 'test-enterprise',
          id: 123,
          node_id: 'MDEwOkVudGVycHJpc2Ux',
          organizations: {
            nodes: [],
            pageInfo: {
              hasNextPage: true,
              endCursor: 'cursor123',
            },
          },
        },
      }

      // Second page
      const mockSecondPage = {
        enterprise: {
          name: 'test-enterprise',
          id: 123,
          node_id: 'MDEwOkVudGVycHJpc2Ux',
          organizations: {
            nodes: [],
            pageInfo: {
              hasNextPage: false,
              endCursor: null,
            },
          },
        },
      }

      enterprise.octokit.graphql.mockResolvedValueOnce(mockFirstPage).mockResolvedValueOnce(mockSecondPage)

      const orgs = await enterprise.getOrganizations('test-enterprise')

      expect(orgs).toHaveLength(0)
      expect(enterprise.octokit.graphql).toHaveBeenCalledTimes(2)
    })

    test('should handle empty enterprise name', async () => {
      const orgs = await enterprise.getOrganizations('')
      expect(orgs).toEqual([])
    })

    test('should handle null enterprise name', async () => {
      const orgs = await enterprise.getOrganizations(null)
      expect(orgs).toEqual([])
    })

    test('should handle undefined enterprise name', async () => {
      const orgs = await enterprise.getOrganizations(undefined)
      expect(orgs).toEqual([])
    })
  })

  /**
   * Test error handling
   */
  describe('error handling', () => {
    beforeEach(() => {
      enterprise.octokit.graphql = jest.fn()
    })

    test('should handle GraphQL API errors gracefully', async () => {
      const error = new Error('Enterprise not found')
      enterprise.octokit.graphql.mockRejectedValueOnce(error)

      await expect(enterprise.getOrganizations('nonexistent-enterprise')).rejects.toThrow('Enterprise not found')
    })

    test('should handle authentication errors', async () => {
      const error = new Error('Bad credentials')
      error.status = 401
      enterprise.octokit.graphql.mockRejectedValueOnce(error)

      await expect(enterprise.getOrganizations('test-enterprise')).rejects.toThrow('Bad credentials')
    })

    test('should handle rate limit errors', async () => {
      const error = new Error('Rate limit exceeded')
      error.status = 403
      enterprise.octokit.graphql.mockRejectedValueOnce(error)

      await expect(enterprise.getOrganizations('test-enterprise')).rejects.toThrow('Rate limit exceeded')
    })
  })
})
