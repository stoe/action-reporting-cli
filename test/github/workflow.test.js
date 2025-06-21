/**
 * Unit tests for the GitHub Workflow module.
 */
import {jest} from '@jest/globals'
import fs from 'fs'
import path from 'path'

// Load fixtures
import commonOptions from 'fixtures/common-options.json'
import workflowConfig from 'fixtures/github/workflow-config.json'

const sampleWorkflow = fs.readFileSync(path.join(process.cwd(), 'test/github/__fixtures__/sample-workflow.yml'), 'utf8')

// Import the module under test
import Workflow from '../../src/github/workflow.js'

describe('workflow', () => {
  let workflow

  beforeEach(() => {
    // Create instance with mocks using fixtures
    const config = {
      ...workflowConfig,
      object: {
        ...workflowConfig.object,
        text: sampleWorkflow,
      },
    }

    workflow = new Workflow(config, commonOptions.workflow)
  })

  afterEach(() => {
    jest.resetAllMocks()
  })

  /**
   * Test that Workflow class can be instantiated.
   */
  test('should instantiate with valid token', () => {
    expect(workflow).toBeInstanceOf(Workflow)
  })

  /**
   * Test property getters and setters
   */
  describe('property getters and setters', () => {
    test('should handle id property correctly', () => {
      expect(workflow.id).toBeUndefined()
      workflow.id = 123
      expect(workflow.id).toBe(123)
    })

    test('should handle node_id property correctly', () => {
      expect(workflow.node_id).toBeUndefined()
      workflow.node_id = 'node_123'
      expect(workflow.node_id).toBe('node_123')
    })

    test('should handle name property correctly', () => {
      expect(workflow.name).toBe(workflowConfig.name)
      workflow.name = 'new-workflow'
      expect(workflow.name).toBe('new-workflow')
    })

    test('should handle path property correctly', () => {
      expect(workflow.path).toBe(workflowConfig.path)
      workflow.path = '.github/workflows/new.yml'
      expect(workflow.path).toBe('.github/workflows/new.yml')
    })

    test('should handle language property correctly', () => {
      expect(workflow.language).toBe(workflowConfig.language?.name)
      workflow.language = 'YAML'
      expect(workflow.language).toBe('YAML')
    })

    test('should handle language property as undefined when not set', () => {
      const configWithoutLanguage = {}
      const testWorkflow = new Workflow(configWithoutLanguage, commonOptions.workflow)
      expect(testWorkflow.language).toBeUndefined()
    })

    test('should handle text property correctly', () => {
      expect(workflow.text).toBe(sampleWorkflow)
      workflow.text = 'new content'
      expect(workflow.text).toBe('new content')
    })

    test('should handle isTruncated property correctly', () => {
      expect(workflow.isTruncated).toBe(false)
      workflow.isTruncated = true
      expect(workflow.isTruncated).toBe(true)
    })

    test('should handle state property correctly', () => {
      expect(workflow.state).toBeUndefined()
      workflow.state = 'active'
      expect(workflow.state).toBe('active')
    })

    test('should handle created_at property correctly', () => {
      expect(workflow.created_at).toBeUndefined()
      const date = '2023-01-01T00:00:00Z'
      workflow.created_at = date
      expect(workflow.created_at).toBe(date)
    })

    test('should handle updated_at property correctly', () => {
      expect(workflow.updated_at).toBeUndefined()
      const date = '2023-01-02T00:00:00Z'
      workflow.updated_at = date
      expect(workflow.updated_at).toBe(date)
    })

    test('should handle last_run_at property correctly', () => {
      expect(workflow.last_run_at).toBeUndefined()
      const date = '2023-01-03T00:00:00Z'
      workflow.last_run_at = date
      expect(workflow.last_run_at).toBe(date)
    })
  })

  /**
   * Test workflow processing
   */
  describe('workflow processing', () => {
    test('should parse workflow content correctly with getYaml', async () => {
      const yaml = await workflow.getYaml()
      expect(yaml).toBeDefined()
      expect(typeof yaml).toBe('object')
      expect(yaml.name).toBeDefined()
    })

    test('should handle truncated workflow text gracefully', async () => {
      workflow.isTruncated = true
      const consoleSpy = jest.spyOn(workflow.logger, 'warn').mockImplementation()

      const yaml = await workflow.getYaml()
      expect(yaml).toBeNull()
      expect(consoleSpy).toHaveBeenCalledWith('Workflow text is truncated. Skipping YAML parsing.')

      consoleSpy.mockRestore()
    })

    test('should handle malformed YAML gracefully', async () => {
      workflow.text = 'invalid: yaml: content: ['
      const consoleSpy = jest.spyOn(workflow.logger, 'error').mockImplementation()

      const yaml = await workflow.getYaml()
      expect(yaml).toBeNull()
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Malformed YAML:'))

      consoleSpy.mockRestore()
    })
  })

  /**
   * Test async operations
   */
  describe('async operations', () => {
    beforeEach(() => {
      // Mock the octokit requests
      workflow.octokit.request = jest.fn()
    })

    test('should fetch workflow details from API', async () => {
      const mockWorkflowData = {
        id: 123,
        node_id: 'W_123',
        state: 'active',
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-02T00:00:00Z',
      }

      const mockRunsData = {
        workflow_runs: [
          {
            updated_at: '2023-01-03T00:00:00Z',
          },
        ],
      }

      workflow.octokit.request
        .mockResolvedValueOnce({data: mockWorkflowData})
        .mockResolvedValueOnce({data: mockRunsData})

      const result = await workflow.getWorkflow('owner', 'repo', 'workflow.yml')

      expect(result).toBeDefined()
      expect(result.id).toBe(123)
      expect(result.node_id).toBe('W_123')
      expect(result.state).toBe('active')
      expect(result.created_at).toBe('2023-01-01T00:00:00.000Z')
      expect(result.updated_at).toBe('2023-01-02T00:00:00.000Z')
      expect(result.last_run_at).toBe('2023-01-03T00:00:00.000Z')
    })

    test('should handle API errors gracefully', async () => {
      const error = new Error('API Error')
      workflow.octokit.request.mockRejectedValueOnce(error)

      await expect(workflow.getWorkflow('owner', 'repo', 'workflow.yml')).rejects.toThrow('API Error')
    })

    test('should handle empty workflow runs', async () => {
      const mockWorkflowData = {
        id: 123,
        node_id: 'W_123',
        state: 'active',
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-02T00:00:00Z',
      }

      const mockRunsData = {
        workflow_runs: [],
      }

      workflow.octokit.request
        .mockResolvedValueOnce({data: mockWorkflowData})
        .mockResolvedValueOnce({data: mockRunsData})

      const result = await workflow.getWorkflow('owner', 'repo', 'workflow.yml')

      expect(result.last_run_at).toBeNull()
    })
  })
})
