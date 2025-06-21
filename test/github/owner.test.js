/**
 * Unit tests for the GitHub Owner module.
 */
import {jest} from '@jest/globals'

// Import the module under test
import Owner from '../../src/github/owner.js'

describe('owner', () => {
  let owner

  beforeEach(() => {
    // Create instance with mocks
    owner = new Owner('test-owner', {
      token: 'test-token',
      debug: false,
    })
  })

  afterEach(() => {
    jest.resetAllMocks()
  })

  /**
   * Test that Owner class can be instantiated.
   */
  test('should instantiate with valid token', () => {
    expect(owner).toBeInstanceOf(Owner)
  })

  /**
   * Test property getters and setters
   */
  describe('property getters and setters', () => {
    test('should handle login property correctly', () => {
      expect(owner.login).toBe('test-owner')
      owner.login = 'new-owner'
      expect(owner.login).toBe('new-owner')
    })

    test('should handle name property correctly', () => {
      expect(owner.name).toBe('test-owner')
      owner.name = 'New Owner Name'
      expect(owner.name).toBe('New Owner Name')
    })

    test('should handle id property correctly', () => {
      expect(owner.id).toBeUndefined()
      owner.id = 123
      expect(owner.id).toBe(123)
    })

    test('should handle node_id property correctly', () => {
      expect(owner.node_id).toBeUndefined()
      owner.node_id = 'MDQ6VXNlcjEyMw=='
      expect(owner.node_id).toBe('MDQ6VXNlcjEyMw==')
    })

    test('should handle type property correctly', () => {
      expect(owner.type).toBeUndefined()
      owner.type = 'user'
      expect(owner.type).toBe('user')
    })

    test('should handle type property case correctly', () => {
      expect(owner.type).toBeUndefined()
      owner.type = 'User'
      expect(owner.type).toBe('user')
    })

    test('should handle repositories property correctly', () => {
      expect(owner.repositories).toEqual([])
      const repos = [{name: 'repo1'}, {name: 'repo2'}]
      owner.repositories = repos
      expect(owner.repositories).toEqual(repos)
    })

    test('should return options object', () => {
      expect(owner.options).toBeDefined()
      expect(owner.options.token).toBe('test-token')
      expect(owner.options.debug).toBe(false)
    })
  })

  /**
   * Test Owner operations
   */
  describe('Owner operations', () => {
    beforeEach(() => {
      // Mock the octokit requests
      owner.octokit.request = jest.fn()
      owner.octokit.graphql = jest.fn()
    })

    test('should fetch user information successfully', async () => {
      const mockUserData = {
        login: 'test-user',
        name: 'Test User',
        id: 123,
        node_id: 'MDQ6VXNlcjEyMw==',
        type: 'User',
      }

      owner.octokit.request.mockResolvedValueOnce({data: mockUserData})

      const result = await owner.getUser('test-user')

      expect(result).toEqual({
        login: 'test-user',
        name: 'Test User',
        id: 123,
        node_id: 'MDQ6VXNlcjEyMw==',
        type: 'user',
      })
      expect(owner.login).toBe('test-user')
      expect(owner.name).toBe('Test User')
      expect(owner.id).toBe(123)
      expect(owner.type).toBe('user')
    })

    test('should handle user information with empty name', async () => {
      owner.octokit.request.mockResolvedValueOnce({
        data: {
          login: 'test-user',
          name: '',
          id: 123,
          node_id: 'MDQ6VXNlcjEyMw==',
          type: undefined, // Simulate undefined type
        },
      })

      await owner.getUser('test-user')

      expect(owner.type).toBe('')
    })

    test('should handle user not found error', async () => {
      const error = new Error('Not Found')
      error.status = 404
      owner.octokit.request.mockRejectedValueOnce(error)

      const consoleSpy = jest.spyOn(owner.logger, 'error').mockImplementation()

      await expect(owner.getUser('nonexistent-user')).rejects.toThrow('User nonexistent-user not found')
      expect(consoleSpy).toHaveBeenCalledWith('User nonexistent-user not found')

      consoleSpy.mockRestore()
    })

    test('should handle other API errors', async () => {
      const error = new Error('API Error')
      error.status = 500
      owner.octokit.request.mockRejectedValueOnce(error)

      const consoleSpy = jest.spyOn(owner.logger, 'error').mockImplementation()

      await expect(owner.getUser('test-user')).rejects.toThrow('API Error')
      expect(consoleSpy).toHaveBeenCalledWith('Error fetching user test-user: API Error')

      consoleSpy.mockRestore()
    })

    test('should fetch repositories for owner', async () => {
      const mockGraphQLResponse = {
        repositoryOwner: {
          repositories: {
            nodes: [
              {
                nwo: 'test-owner/repo1',
                owner: {login: 'test-owner'},
                name: 'repo1',
                id: 1,
                node_id: 'MDEwOlJlcG9zaXRvcnkx',
                visibility: 'PUBLIC',
                isArchived: false,
                isFork: false,
                defaultBranchRef: {name: 'main'},
              },
              {
                nwo: 'test-owner/repo2',
                owner: {login: 'test-owner'},
                name: 'repo2',
                id: 2,
                node_id: 'MDEwOlJlcG9zaXRvcnky',
                visibility: 'PRIVATE',
                isArchived: false,
                isFork: false,
                defaultBranchRef: {name: 'master'},
              },
            ],
            pageInfo: {
              hasNextPage: false,
              endCursor: null,
            },
          },
        },
      }

      owner.octokit.graphql.mockResolvedValueOnce(mockGraphQLResponse)

      const repos = await owner.getRepositories('test-owner')

      expect(Array.isArray(repos)).toBe(true)
      expect(repos).toHaveLength(2)
      expect(repos[0].name).toBe('repo1')
      expect(repos[0].owner).toBe('test-owner')
      expect(repos[1].name).toBe('repo2')
    })

    test('should set branch property for repositories to undefined if no default branch', async () => {
      owner.octokit.graphql.mockResolvedValueOnce({
        repositoryOwner: {
          repositories: {
            nodes: [
              {
                nwo: 'test-owner/repo1',
                owner: {login: 'test-owner'},
                name: 'repo1',
                id: 1,
                node_id: 'MDEwOlJlcG9zaXRvcnkx',
                visibility: 'PUBLIC',
                isArchived: false,
                isFork: false,
                defaultBranchRef: null, // No default branch
              },
            ],
            pageInfo: {
              hasNextPage: false,
              endCursor: null,
            },
          },
        },
      })
      const repos = await owner.getRepositories('test-owner')

      expect(repos).toHaveLength(1)
      expect(repos[0].branch).toBeUndefined() // Branch should be undefined
    })

    test('should handle pagination correctly', async () => {
      // First page
      const mockFirstPage = {
        repositoryOwner: {
          repositories: {
            nodes: [
              {
                nwo: 'test-owner/repo1',
                owner: {login: 'test-owner'},
                name: 'repo1',
                id: 1,
                node_id: 'MDEwOlJlcG9zaXRvcnkx',
                visibility: 'PUBLIC',
                isArchived: false,
                isFork: false,
                defaultBranchRef: {name: 'main'},
              },
            ],
            pageInfo: {
              hasNextPage: true,
              endCursor: 'cursor123',
            },
          },
        },
      }

      // Second page
      const mockSecondPage = {
        repositoryOwner: {
          repositories: {
            nodes: [
              {
                nwo: 'test-owner/repo2',
                owner: {login: 'test-owner'},
                name: 'repo2',
                id: 2,
                node_id: 'MDEwOlJlcG9zaXRvcnky',
                visibility: 'PRIVATE',
                isArchived: false,
                isFork: false,
                defaultBranchRef: {name: 'master'},
              },
            ],
            pageInfo: {
              hasNextPage: false,
              endCursor: null,
            },
          },
        },
      }

      owner.octokit.graphql.mockResolvedValueOnce(mockFirstPage).mockResolvedValueOnce(mockSecondPage)

      const repos = await owner.getRepositories('test-owner')

      expect(repos).toHaveLength(2)
      expect(owner.octokit.graphql).toHaveBeenCalledTimes(2)
    })

    test('should filter archived repositories when flag is set', () => {
      const ownerWithArchived = new Owner('test', {token: 'test', archived: true})
      const query = ownerWithArchived.getRepositoryQuery()

      expect(query).toContain('isArchived: false')
    })

    test('should filter forked repositories when flag is set', () => {
      const ownerWithForked = new Owner('test', {token: 'test', forked: true})
      const query = ownerWithForked.getRepositoryQuery()

      expect(query).toContain('isFork: false')
    })

    test('should generate correct GraphQL query', () => {
      const query = owner.getRepositoryQuery()

      expect(query).toContain('query ($user: String!, $cursor: String = null)')
      expect(query).toContain('repositoryOwner(login: $user)')
      expect(query).toContain('repositories(')
      expect(query).toContain('pageInfo')
      expect(query).toContain('nodes')
    })
  })

  /**
   * Test error handling
   */
  describe('error handling', () => {
    beforeEach(() => {
      owner.octokit.request = jest.fn()
      owner.octokit.graphql = jest.fn()
    })

    test('should handle GraphQL API errors gracefully', async () => {
      const error = new Error('GraphQL Error')
      owner.octokit.graphql.mockRejectedValueOnce(error)

      await expect(owner.getRepositories('test-owner')).rejects.toThrow('GraphQL Error')
    })

    test('should handle invalid owner names', async () => {
      const error = new Error('Not Found')
      error.status = 404
      owner.octokit.request.mockRejectedValueOnce(error)

      await expect(owner.getUser('')).rejects.toThrow()
    })
  })
})
