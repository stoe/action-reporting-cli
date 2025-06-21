/**
 * Unit tests for the Markdown reporter module.
 */
import {jest} from '@jest/globals'
import path from 'node:path'

// Create mock for writeFile
const mockWriteFile = jest.fn()

// Mock fs/promises module
jest.mock('node:fs/promises', () => ({
  writeFile: mockWriteFile,
}))

// Load fixtures
import commonOptions from 'fixtures/common-options.json'
import testDataRaw from 'fixtures/report/test-data.json'

// Import the module under test
import MarkdownReporter from '../../src/report/markdown.js'
import Reporter from '../../src/report/reporter.js'

describe('MarkdownReporter', () => {
  let markdownReporter
  let options
  let testData
  let testFilePath

  beforeEach(() => {
    testFilePath = '/test/path/report.md'
    options = {
      ...commonOptions.report,
      hostname: 'github.com',
      uniqueFlag: 'both',
    }

    // Transform fixture data to include Sets as needed
    testData = testDataRaw.map(item => ({
      ...item,
      listeners: Array.isArray(item.listeners) ? new Set(item.listeners) : item.listeners,
      permissions: Array.isArray(item.permissions) ? new Set(item.permissions) : item.permissions,
      runsOn: Array.isArray(item.runsOn) ? new Set(item.runsOn) : item.runsOn,
      secrets: item.secrets ? (Array.isArray(item.secrets) ? new Set(item.secrets) : item.secrets) : null,
      vars: item.vars && Array.isArray(item.vars) ? new Set(item.vars) : item.vars,
      uses: Array.isArray(item.uses) ? new Set(item.uses) : item.uses,
      updated_at: item.updated_at === '2025-06-10T00:00:00Z' ? new Date(item.updated_at) : item.updated_at,
    }))

    // Create instance with test data
    markdownReporter = new MarkdownReporter(testFilePath, options, testData)

    // Create a spy for the saveFile method
    jest.spyOn(Reporter.prototype, 'saveFile').mockImplementation(() => Promise.resolve())

    // Mock the createUniquePath method
    jest.spyOn(Reporter.prototype, 'createUniquePath').mockReturnValue('/test/path/report.unique.md')
  })

  afterEach(() => {
    mockWriteFile.mockReset()
    jest.resetAllMocks()
  })

  /**
   * Test basic functionality
   */
  describe('basic functionality', () => {
    /**
     * Test that MarkdownReporter class can be instantiated.
     */
    test('should instantiate with valid parameters', () => {
      expect(markdownReporter).toBeInstanceOf(MarkdownReporter)
      expect(markdownReporter.path).toBe(testFilePath)
      expect(markdownReporter.options).toEqual(options)
      expect(markdownReporter.data).toEqual(testData)
    })
  })

  /**
   * Test save operations
   */
  describe('save operations', () => {
    /**
     * Test the save method
     */
    test('should save data as markdown correctly', async () => {
      // Call the method we're testing
      await markdownReporter.save()

      // Verify that saveFile was called with correct arguments
      expect(Reporter.prototype.saveFile).toHaveBeenCalledWith(
        testFilePath,
        expect.stringContaining(
          'owner | repo | name | workflow | state | created_at | updated_at | last_run_at | listeners | permissions | runs-on | secrets | vars | uses',
        ),
      )

      // Verify that the markdown content contains our test data
      const markdownContent = Reporter.prototype.saveFile.mock.calls[0][1]
      expect(markdownContent).toContain('test-owner')
      expect(markdownContent).toContain('test-repo')
      expect(markdownContent).toContain('Test Workflow')

      // Check formatting of links
      expect(markdownContent).toContain(
        '[.github/workflows/test.yml](https://github.com/test-owner/test-repo/blob/HEAD/.github/workflows/test.yml)',
      )
    })

    /**
     * Test the saveUnique method
     */
    test('should save unique uses data as markdown correctly', async () => {
      // Spy on utility methods to verify they're called correctly
      jest
        .spyOn(markdownReporter, 'getFilteredUniqueUses')
        .mockReturnValueOnce(['actions/checkout@v3', 'actions/setup-node@v3'])
      jest.spyOn(markdownReporter, 'groupUsesByRepository').mockReturnValueOnce({
        'actions/checkout': ['actions/checkout@v3'],
        'actions/setup-node': ['actions/setup-node@v3'],
      })

      // Call the method we're testing
      await markdownReporter.saveUnique()

      // Verify that utility methods were called
      expect(markdownReporter.getFilteredUniqueUses).toHaveBeenCalled()
      expect(markdownReporter.groupUsesByRepository).toHaveBeenCalledWith([
        'actions/checkout@v3',
        'actions/setup-node@v3',
      ])

      // Verify that saveFile was called with correct arguments
      expect(Reporter.prototype.saveFile).toHaveBeenCalledWith(
        '/test/path/report.unique.md',
        expect.stringContaining('### Unique GitHub Actions `uses`'),
      )
    })
  })

  /**
   * Test markdown formatting utilities
   */
  describe('MD formatting', () => {
    /**
     * Test the getFilteredUniqueUses method
     */
    test('should filter and sort unique uses correctly', () => {
      // Setup test data with duplicate values and local actions
      const localTestData = [
        {
          uses: new Set(['actions/checkout@v3', './local-action', 'docker://alpine:3.14']),
        },
        {
          uses: new Set(['actions/checkout@v3', 'actions/setup-node@v3']),
        },
      ]

      const localReporter = new MarkdownReporter(testFilePath, options, localTestData)

      // Call the method we're testing
      const result = localReporter.getFilteredUniqueUses()

      // Verify the result
      expect(result).toEqual(['actions/checkout@v3', 'actions/setup-node@v3', 'docker://alpine:3.14'])
      expect(result).not.toContain('./local-action') // Local actions should be filtered out
      expect(result[0]).toBe('actions/checkout@v3') // Result should be sorted alphabetically
    })

    /**
     * Test the groupUsesByRepository method
     */
    test('should group uses by repository correctly', () => {
      const uniqueUses = [
        'actions/checkout@v3',
        'actions/setup-node@v3',
        'actions/setup-node@v4',
        'owner/repo/path/to/workflow@v1',
        'docker://alpine:3.14',
      ]

      // Call the method we're testing
      const result = markdownReporter.groupUsesByRepository(uniqueUses)

      // Verify the result
      expect(Object.keys(result)).toHaveLength(4) // Different repos (owner/repo/path is grouped under owner/repo)
      expect(result['actions/checkout']).toEqual(['actions/checkout@v3'])
      expect(result['actions/setup-node']).toEqual(['actions/setup-node@v3', 'actions/setup-node@v4'])
    })

    /**
     * Test the generateMarkdownFromGroupedUses method
     */
    test('should generate markdown from grouped uses correctly', () => {
      const groupedUses = {
        'actions/checkout': ['actions/checkout@v3'],
        'actions/setup-node': ['actions/setup-node@v3', 'actions/setup-node@v4'],
        'owner/repo': ['owner/repo/path/to/workflow@v1'],
      }

      // Call the method we're testing
      const result = markdownReporter.generateMarkdownFromGroupedUses(groupedUses)

      // Verify the result
      expect(result[0]).toBe('### Unique GitHub Actions `uses`\n')
      expect(result).toContain('- [actions/checkout](https://github.com/actions/checkout) `v3`')
      expect(result).toContain('- actions/setup-node')
      expect(result).toContain('  - [actions/setup-node](https://github.com/actions/setup-node) `v3`')
      expect(result).toContain('  - [actions/setup-node](https://github.com/actions/setup-node) `v4`')
    })

    /**
     * Test the formatSetToHtmlList method
     */
    test('should format Set to HTML list correctly', () => {
      // Test with a Set
      const testSet = new Set(['item1', 'item2', 'item3'])
      const resultSet = markdownReporter.formatSetToHtmlList(testSet)

      expect(resultSet).toBe('<ul><li>`item1`</li><li>`item2`</li><li>`item3`</li></ul>')

      // Test with a string
      const testString = 'item1,item2,item3'
      const resultString = markdownReporter.formatSetToHtmlList(testString)

      expect(resultString).toBe('<ul><li>`item1`</li><li>`item2`</li><li>`item3`</li></ul>')

      // Test with GitHub Actions formatting
      const actionsSet = new Set(['actions/checkout@v3', 'owner/repo@ref'])
      const resultActions = markdownReporter.formatSetToHtmlList(actionsSet, true)

      expect(resultActions).toContain(
        '<li>[actions/checkout](https://github.com/actions/checkout) <code>v3</code></li>',
      )

      // Test with empty or invalid inputs
      expect(markdownReporter.formatSetToHtmlList(null)).toBe('')
      expect(markdownReporter.formatSetToHtmlList(new Set())).toBe('')
      expect(markdownReporter.formatSetToHtmlList('')).toBe('')
    })

    /**
     * Test the createMarkdownLink method
     */
    test('should create markdown links correctly', () => {
      // Test normal repository link
      const repoLink = markdownReporter.createMarkdownLink('repo-name', 'owner', 'repo')
      expect(repoLink).toBe('[repo-name](https://github.com/owner/repo)')

      // Test link with path
      const pathLink = markdownReporter.createMarkdownLink('file.yml', 'owner', 'repo', 'path/to/file.yml')
      expect(pathLink).toBe('[file.yml](https://github.com/owner/repo/blob/HEAD/path/to/file.yml)')

      // Test with custom hostname
      markdownReporter.options.hostname = 'github.example.com'
      const customLink = markdownReporter.createMarkdownLink('repo-name', 'owner', 'repo')
      expect(customLink).toBe('[repo-name](https://github.example.com/owner/repo)')

      // Reset hostname
      markdownReporter.options.hostname = 'github.com'

      // Test with docker URL
      const dockerLink = markdownReporter.createMarkdownLink('docker://alpine:3.14', 'docker://', 'alpine:3.14')
      expect(dockerLink).toBe('`docker://alpine:3.14`')
    })

    /**
     * Test the formatActionReference method
     */
    test('should format action references correctly', () => {
      // Test regular GitHub Action
      const regularAction = markdownReporter.formatActionReference('actions/checkout@v3')
      expect(regularAction).toBe('[actions/checkout](https://github.com/actions/checkout) `v3`')

      // Test HTML output
      const htmlAction = markdownReporter.formatActionReference('actions/checkout@v3', true)
      expect(htmlAction).toBe('<li>[actions/checkout](https://github.com/actions/checkout) <code>v3</code></li>')

      // Test reusable workflow
      const reusableAction = markdownReporter.formatActionReference('owner/repo/path/to/workflow@v1')
      expect(reusableAction).toContain('(reusable workflow')
      expect(reusableAction).toContain('[path/to/workflow]')

      // Test special URLs
      const dockerAction = markdownReporter.formatActionReference('docker://alpine:3.14')
      expect(dockerAction).toBe('`docker://alpine:3.14`')

      const localAction = markdownReporter.formatActionReference('./local-action')
      expect(localAction).toBe('`./local-action`')

      // Test invalid reference
      const invalidAction = markdownReporter.formatActionReference('invalid@reference')
      expect(invalidAction).toContain('invalid') // Just check for content, not exact format
    })
  })

  /**
   * Test helper methods
   */
  describe('helper methods', () => {
    /**
     * Test the isSpecialUrl method
     */
    test('should identify special URLs correctly', () => {
      expect(markdownReporter.isSpecialUrl('docker://alpine:3.14')).toBe(true)
      expect(markdownReporter.isSpecialUrl('./local-action')).toBe(true)
      expect(markdownReporter.isSpecialUrl('actions/checkout@v3')).toBe(false)
    })

    /**
     * Test the formatVersion method
     */
    test('should format version references correctly', () => {
      expect(markdownReporter.formatVersion('v3', false)).toBe(' `v3`')
      expect(markdownReporter.formatVersion('v3', true)).toBe(' <code>v3</code>')
      expect(markdownReporter.formatVersion('', false)).toBe('')
      expect(markdownReporter.formatVersion(null, true)).toBe('')
    })

    /**
     * Test the formatReusableWorkflow method
     */
    test('should format reusable workflow references correctly', () => {
      const repoLink = '[owner/repo](https://github.com/owner/repo)'
      const workflowPath = 'path/to/workflow.yml'
      const pathLink = '[path/to/workflow.yml](https://github.com/owner/repo/blob/HEAD/path/to/workflow.yml)'
      const version = ' `v1`'

      // Test regular format
      const regular = markdownReporter.formatReusableWorkflow(
        repoLink,
        'owner',
        'repo',
        ['path', 'to', 'workflow.yml'],
        version,
        false,
      )
      expect(regular).toBe(`${repoLink} (reusable workflow ${pathLink})${version}`)

      // Test HTML format
      const html = markdownReporter.formatReusableWorkflow(
        repoLink,
        'owner',
        'repo',
        ['path', 'to', 'workflow.yml'],
        version,
        true,
      )
      expect(html).toBe(`<li>${repoLink} (reusable workflow ${pathLink})${version}</li>`)
    })
  })

  /**
   * Test table formatting
   */
  describe('table formatting', () => {
    /**
     * Test the createTableHeaders method
     */
    test('should create table headers based on options', () => {
      // Test with all options enabled
      const fullHeaders = markdownReporter.createTableHeaders()

      expect(fullHeaders).toContain('owner')
      expect(fullHeaders).toContain('repo')
      expect(fullHeaders).toContain('workflow')
      expect(fullHeaders).toContain('listeners')
      expect(fullHeaders).toContain('permissions')
      expect(fullHeaders).toContain('runs-on')
      expect(fullHeaders).toContain('secrets')
      expect(fullHeaders).toContain('vars')
      expect(fullHeaders).toContain('uses')

      // Test with limited options
      markdownReporter.options.listeners = false
      markdownReporter.options.permissions = false
      markdownReporter.options.runsOn = false
      markdownReporter.options.secrets = false
      markdownReporter.options.vars = false
      markdownReporter.options.uses = false

      const limitedHeaders = markdownReporter.createTableHeaders()

      expect(limitedHeaders).toContain('owner')
      expect(limitedHeaders).toContain('repo')
      expect(limitedHeaders).toContain('workflow')
      expect(limitedHeaders).not.toContain('listeners')
      expect(limitedHeaders).not.toContain('permissions')
      expect(limitedHeaders).not.toContain('runs-on')
      expect(limitedHeaders).not.toContain('secrets')
      expect(limitedHeaders).not.toContain('vars')
      expect(limitedHeaders).not.toContain('uses')
    })

    /**
     * Test the formatWorkflowRow method
     */
    test('should format workflow rows correctly', () => {
      const workflow = testData[0]
      const row = markdownReporter.formatWorkflowRow(workflow)

      expect(row).toHaveLength(14) // All columns with all options enabled
      expect(row[0]).toBe('test-owner') // owner
      expect(row[1]).toBe('test-repo') // repo
      expect(row[2]).toBe('Test Workflow') // name
      expect(row[3]).toContain('[.github/workflows/test.yml]') // workflow with link
      expect(row[4]).toBe('active') // state
      expect(row[5]).toBe('2025-06-01T00:00:00Z') // created_at
      expect(row[6]).toBe('2025-06-15T00:00:00Z') // updated_at
      expect(row[7]).toBe('2025-06-18T00:00:00Z') // last_run_at
      expect(row[8]).toContain('<ul><li>') // listeners as HTML list
      expect(row[13]).toContain('actions/checkout') // uses with formatting
    })
  })

  /**
   * Test error handling
   */
  describe('error handling', () => {
    /**
     * Test the save method error handling (specific to MarkdownReporter)
     */
    test('should throw specific error on save failure', async () => {
      // Mock saveFile to throw an error
      Reporter.prototype.saveFile.mockRejectedValueOnce(new Error('Test error'))

      await expect(markdownReporter.save()).rejects.toThrow('Failed to save Markdown report')
    })

    /**
     * Test the saveUnique method error handling (specific to MarkdownReporter)
     */
    test('should throw specific error on saveUnique failure', async () => {
      // Mock saveFile to throw an error
      Reporter.prototype.saveFile.mockRejectedValueOnce(new Error('Test error'))

      await expect(markdownReporter.saveUnique()).rejects.toThrow('Failed to save unique uses report')
    })
  })

  /**
   * Test edge cases
   */
  describe('edge cases', () => {
    /**
     * Test edge cases for groupUsesByRepository
     */
    test('should handle edge cases in groupUsesByRepository', () => {
      // Test with invalid format
      const invalidUse = ['invalid-no-slash', '@just-version']
      const result = markdownReporter.groupUsesByRepository(invalidUse)
      expect(Object.keys(result)).toHaveLength(0)
    })

    /**
     * Test edge cases for generateMarkdownFromGroupedUses
     */
    test('should handle empty input for generateMarkdownFromGroupedUses', () => {
      const result = markdownReporter.generateMarkdownFromGroupedUses({})
      expect(result[0]).toBe('### Unique GitHub Actions `uses`\n')
      expect(result.length).toBe(1) // Only the header, no repos
    })
  })
})
