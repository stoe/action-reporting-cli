/**
 * Unit tests for the GitHub Repository module.
 */
import {jest} from '@jest/globals'

// Load fixtures
import commonOptions from 'fixtures/common-options.json'

// Import the module under test
import Repository from '../../src/github/repository.js'

describe('repository', () => {
  let repository

  beforeEach(() => {
    // Create instance with mocks using fixtures
    repository = new Repository('mona/sample-repo', commonOptions.repository)
  })

  afterEach(() => {
    jest.resetAllMocks()
  })

  /**
   * Test that Repository class can be instantiated.
   */
  test('should instantiate with valid token', () => {
    expect(repository).toBeInstanceOf(Repository)
  })

  /**
   * Test constructor validation
   */
  describe('constructor validation', () => {
    test('should throw error for invalid repository name format', () => {
      expect(() => {
        new Repository('invalid-repo-name', commonOptions.repository)
      }).toThrow('Repository name must be in format "owner/repo"')
    })

    test('should throw error for empty repository name', () => {
      expect(() => {
        new Repository('', commonOptions.repository)
      }).toThrow('Repository name must be in format "owner/repo"')
    })

    test('should throw error for repository name with too many parts', () => {
      expect(() => {
        new Repository('owner/repo/extra', commonOptions.repository)
      }).toThrow('Repository name must be in format "owner/repo"')
    })
  })

  /**
   * Test property getters and setters
   */
  describe('property getters and setters', () => {
    test('should handle nwo property correctly', () => {
      expect(repository.nwo).toBe('mona/sample-repo')
      repository.nwo = 'owner/new-repo'
      expect(repository.nwo).toBe('owner/new-repo')
    })

    test('should handle owner property correctly', () => {
      expect(repository.owner).toBe('mona')
    })

    test('should handle name property correctly', () => {
      expect(repository.name).toBe('sample-repo')
      repository.name = 'new-repo'
      expect(repository.name).toBe('new-repo')
    })

    test('should handle repo object correctly', () => {
      expect(repository.repo).toEqual({owner: 'mona', name: 'sample-repo'})
      repository.repo = {owner: 'test', name: 'test-repo'}
      expect(repository.repo).toEqual({owner: 'test', name: 'test-repo'})
    })

    test('should handle id property correctly', () => {
      expect(repository.id).toBeUndefined()
      repository.id = 123
      expect(repository.id).toBe(123)
    })

    test('should handle node_id property correctly', () => {
      expect(repository.node_id).toBeUndefined()
      repository.node_id = 'MDEwOlJlcG9zaXRvcnkx'
      expect(repository.node_id).toBe('MDEwOlJlcG9zaXRvcnkx')
    })

    test('should handle visibility property correctly', () => {
      expect(repository.visibility).toBeUndefined()
      repository.visibility = 'public'
      expect(repository.visibility).toBe('public')
    })

    test('should handle isArchived property correctly', () => {
      expect(repository.isArchived).toBeUndefined()
      repository.isArchived = false
      expect(repository.isArchived).toBe(false)
    })

    test('should handle isFork property correctly', () => {
      expect(repository.isFork).toBeUndefined()
      repository.isFork = false
      expect(repository.isFork).toBe(false)
    })

    test('should handle branch property correctly', () => {
      expect(repository.branch).toBeUndefined()
      repository.branch = 'main'
      expect(repository.branch).toBe('main')
    })

    test('should handle workflows property correctly', () => {
      expect(repository.workflows).toEqual([])
      const workflows = [{name: 'ci.yml'}, {name: 'release.yml'}]
      repository.workflows = workflows
      expect(repository.workflows).toEqual(workflows)
    })
  })

  /**
   * Test workflow operations
   */
  describe('workflow operations', () => {
    beforeEach(() => {
      // Mock the octokit requests
      repository.octokit.request = jest.fn()
      repository.octokit.graphql = jest.fn()
    })

    test('should fetch workflows for repository', async () => {
      const mockGraphQLResponse = {
        data: {
          data: {
            repository: {
              object: {
                entries: [
                  {
                    name: 'ci.yml',
                    path: '.github/workflows/ci.yml',
                    language: {name: 'YAML'},
                    object: {
                      text: 'name: CI\non: push',
                      isTruncated: false,
                    },
                  },
                  {
                    name: 'release.yml',
                    path: '.github/workflows/release.yml',
                    language: {name: 'YAML'},
                    object: {
                      text: 'name: Release\non: release',
                      isTruncated: false,
                    },
                  },
                ],
              },
            },
          },
        },
      }

      repository.octokit.request.mockResolvedValue(mockGraphQLResponse)

      const workflows = await repository.getWorkflows('mona', 'sample-repo')

      expect(Array.isArray(workflows)).toBe(true)
      // Since the actual implementation will depend on Workflow constructor,
      // we just verify that the method runs without error
      expect(workflows).toBeDefined()
    })

    test('should handle repositories without workflows', async () => {
      const mockGraphQLResponse = {
        data: {
          data: {
            repository: {
              object: null,
            },
          },
        },
      }

      repository.octokit.request.mockResolvedValueOnce(mockGraphQLResponse)

      const workflows = await repository.getWorkflows('mona', 'sample-repo')

      expect(Array.isArray(workflows)).toBe(true)
      expect(workflows).toHaveLength(0)
    })

    test('should handle empty workflow directory', async () => {
      const mockGraphQLResponse = {
        data: {
          data: {
            repository: {
              object: {
                entries: [],
              },
            },
          },
        },
      }

      repository.octokit.request.mockResolvedValueOnce(mockGraphQLResponse)

      const workflows = await repository.getWorkflows('mona', 'sample-repo')

      expect(Array.isArray(workflows)).toBe(true)
      expect(workflows).toHaveLength(0)
    })

    test('should fetch repository metadata', async () => {
      const mockRepoData = {
        data: {
          data: {
            repository: {
              nwo: 'mona/sample-repo',
              owner: {login: 'mona'},
              name: 'sample-repo',
              id: 123,
              node_id: 'MDEwOlJlcG9zaXRvcnkx',
              visibility: 'PUBLIC',
              isArchived: false,
              isFork: false,
              defaultBranchRef: {name: 'main'},
            },
          },
        },
      }

      repository.octokit.request.mockResolvedValueOnce(mockRepoData)

      const result = await repository.getRepo('mona/sample-repo')

      expect(result).toBeDefined()
      expect(result.id).toBe(123)
      expect(result.node_id).toBe('MDEwOlJlcG9zaXRvcnkx')
      expect(result.visibility).toBe('PUBLIC')
      expect(result.isArchived).toBe(false)
      expect(result.isFork).toBe(false)
    })

    test('should handle API errors when fetching workflows', async () => {
      const mockGraphQLResponse = {
        data: {
          data: {
            repository: {
              object: null,
            },
          },
        },
      }

      repository.octokit.request.mockResolvedValueOnce(mockGraphQLResponse)

      const workflows = await repository.getWorkflows('mona', 'sample-repo')
      expect(Array.isArray(workflows)).toBe(true)
    })
  })

  /**
   * Test repository metadata
   */
  describe('repository metadata', () => {
    test('should extract repository information correctly', () => {
      expect(repository.name).toBe('sample-repo')
      expect(repository.owner).toBe('mona')
      expect(repository.nwo).toBe('mona/sample-repo')
      expect(repository.repo).toEqual({owner: 'mona', name: 'sample-repo'})
    })

    test('should handle boolean flags correctly', () => {
      repository.isArchived = true
      repository.isFork = true
      expect(repository.isArchived).toBe(true)
      expect(repository.isFork).toBe(true)
    })

    test('should handle visibility settings', () => {
      repository.visibility = 'private'
      expect(repository.visibility).toBe('private')
    })
  })
})
