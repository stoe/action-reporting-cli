# Testing Guide for `action-reporting-cli`

This document provides comprehensive guidance for testing the `action-reporting-cli` project, including setup instructions, best practices, and architectural guidelines.

## Overview

The `action-reporting-cli` project uses [Jest](https://jestjs.io/) as its testing framework and follows a comprehensive testing strategy with:

- **Unit Tests**: Testing individual modules in isolation
- **Integration Tests**: Testing interaction between components
- **Mocking**: Isolating external dependencies (GitHub API, file system)
- **Fixtures**: Providing realistic test data for consistent testing

## Test Setup

### Prerequisites

- Node.js >= 20
- npm >= 10

### Installation

Tests are automatically set up when you install the project dependencies:

```bash
npm install
```

### Configuration

The testing configuration is defined in [`jest.config.js`](../jest.config.js).

## Running Tests

### Basic Commands

```bash
# Run all tests
npm test

# Run tests in watch mode (reruns on file changes)
npm run test:watch

# Run specific test file
npm test -- test/github/workflow.test.js

# Run tests matching a pattern, e.g., "throw" in test names
npm test -- --testNamePattern="throw"

# Run tests for specific directory
npm test -- test/github/

# Debug mode (shows console.log output)
npm test -- --verbose --silent=false
```

### Continuous Integration

Tests are run automatically via `lint-staged` and `husky` pre-commit hooks, ensuring code quality before commits.

The CI pipeline also runs all tests on every push and pull request to maintain code integrity.

## Test Structure and Organization

### Test Coverage

**Complete Coverage Achieved**: All 16 source modules have corresponding test files.

| Source File                                               | Test File                                                     | Description                                 |
| --------------------------------------------------------- | ------------------------------------------------------------- | ------------------------------------------- |
| [`cli.js`](../cli.js)                                     | [`test/cli.test.js`](cli.test.js)                             | Command-line interface and argument parsing |
| [`src/github/base.js`](../src/github/base.js)             | [`test/github/base.test.js`](github/base.test.js)             | Base GitHub API functionality               |
| [`src/github/enterprise.js`](../src/github/enterprise.js) | [`test/github/enterprise.test.js`](github/enterprise.test.js) | Enterprise account operations               |
| [`src/github/octokit.js`](../src/github/octokit.js)       | [`test/github/octokit.test.js`](github/octokit.test.js)       | GitHub API client configuration             |
| [`src/github/owner.js`](../src/github/owner.js)           | [`test/github/owner.test.js`](github/owner.test.js)           | Repository owner operations                 |
| [`src/github/repository.js`](../src/github/repository.js) | [`test/github/repository.test.js`](github/repository.test.js) | Repository data retrieval                   |
| [`src/github/workflow.js`](../src/github/workflow.js)     | [`test/github/workflow.test.js`](github/workflow.test.js)     | Workflow analysis and parsing               |
| [`src/report/csv.js`](../src/report/csv.js)               | [`test/report/csv.test.js`](report/csv.test.js)               | CSV report generation                       |
| [`src/report/json.js`](../src/report/json.js)             | [`test/report/json.test.js`](report/json.test.js)             | JSON report generation                      |
| [`src/report/markdown.js`](../src/report/markdown.js)     | [`test/report/markdown.test.js`](report/markdown.test.js)     | Markdown report generation                  |
| [`src/report/report.js`](../src/report/report.js)         | [`test/report/report.test.js`](report/report.test.js)         | Main report orchestration                   |
| [`src/report/reporter.js`](../src/report/reporter.js)     | [`test/report/reporter.test.js`](report/reporter.test.js)     | Report output handling                      |
|                                                           | [`test/report/validation.test.js`](report/validation.test.js) | Report data validation                      |
| [`src/util/cache.js`](../src/util/cache.js)               | [`test/util/cache.test.js`](util/cache.test.js)               | Caching functionality                       |
| [`src/util/log.js`](../src/util/log.js)                   | [`test/util/log.test.js`](util/log.test.js)                   | Logging utilities                           |
| [`src/util/wait.js`](../src/util/wait.js)                 | [`test/util/wait.test.js`](util/wait.test.js)                 | Rate limiting and delays                    |

## Fixtures and Mocks

### Available Test Data

**Fixtures (Test Data):**

| File                                                                                                                | Description                          |
| ------------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| [`test/__fixtures__/common-options.json`](__fixtures__/common-options.json)                                         | Common CLI options for testing       |
| [`test/github/__fixtures__/enterprise-orgs.json`](github/__fixtures__/enterprise-orgs.json)                         | Sample enterprise organizations data |
| [`test/github/__fixtures__/repositories.json`](github/__fixtures__/repositories.json)                               | Sample repository listings           |
| [`test/github/__fixtures__/sample-workflow.yml`](github/__fixtures__/sample-workflow.yml)                           | Sample GitHub Actions workflow       |
| [`test/github/__fixtures__/workflow-config.json`](github/__fixtures__/workflow-config.json)                         | Workflow configuration data          |
| [`test/github/__fixtures__/workflow-without-permissions.yml`](github/__fixtures__/workflow-without-permissions.yml) | Workflow without permissions         |
| [`test/github/__fixtures__/workflows.json`](github/__fixtures__/workflows.json)                                     | Sample workflows data                |
| [`test/report/__fixtures__/test-data.json`](report/__fixtures__/test-data.json)                                     | Report generation test data          |

**Mocks (Dependency Substitutes):**

| File                                                                    | Description                 |
| ----------------------------------------------------------------------- | --------------------------- |
| [`test/__mocks__/fs.js`](__mocks__/fs.js)                               | File system operations mock |
| [`test/github/__mocks__/octokit.js`](github/__mocks__/octokit.js)       | GitHub API client mock      |
| [`test/github/__mocks__/repository.js`](github/__mocks__/repository.js) | Repository operations mock  |
| [`test/util/__mocks__/log.js`](util/__mocks__/log.js)                   | Logging utility mock        |

### Using Module Name Mapping

The Jest configuration provides clean import paths:

```js
// Instead of relative paths
import workflowsData from '../../../test/github/__fixtures__/workflows.json'
```

```js
// Use mapped paths
import workflowData from 'fixtures/github/workflows.json'
import mockOctokit from '@mocks/github/octokit'
```

## Testing Best Practices

### Writing Tests

#### Test Structure

Follow the standard Jest structure for all test files:

```js
/**
 * Unit tests for [module name].
 */
import {jest} from '@jest/globals'
import Module from '../../src/path/module.js'

// Mock dependencies at the top level
jest.mock('../../src/dependency.js')

describe('[module name]', () => {
  let instance

  beforeEach(() => {
    // Set up test instance and reset mocks
    jest.clearAllMocks()
    instance = new Module(testOptions)
  })

  afterEach(() => {
    // Clean up after each test
    jest.resetAllMocks()
  })

  describe('methodName', () => {
    test('should handle normal case', () => {
      // Arrange
      const input = 'test-input'
      const expected = 'expected-output'

      // Act
      const result = instance.methodName(input)

      // Assert
      expect(result).toBe(expected)
    })

    test('should handle error case', () => {
      // Test error scenarios
      expect(() => instance.methodName(null)).toThrow('Invalid input')
    })
  })
})
```

#### Naming Conventions

- Test files: `[module-name].test.js`
- Test descriptions: Use "should" statements that describe expected behavior
- Variables: Use descriptive names that make tests self-documenting

#### Test Organization

- Group related tests using `describe()` blocks
- Test both success and failure scenarios
- Include edge cases and boundary conditions
- Test one behavior per test case

### Mocking Strategy

#### External Dependencies

Mock all external dependencies to ensure tests are:

- **Fast**: No network calls or file system operations
- **Reliable**: Not dependent on external services
- **Isolated**: Each test runs independently

```js
// Mock GitHub API
jest.mock('../../src/github/octokit.js', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    paginate: jest.fn(),
    request: jest.fn(),
  })),
}))

// Mock file system
jest.mock('fs', () => ({
  writeFileSync: jest.fn(),
  existsSync: jest.fn().mockReturnValue(true),
}))
```

#### Using Centralized Mocks

Leverage the module name mapping for cleaner imports:

```js
// Instead of inline mocking, use centralized mocks
jest.mock('../../src/github/octokit.js', () => import('@mocks/github/octokit'))
```

```js
// Use fixtures for test data
import testData from 'fixtures/github/workflows.json'
import commonOptions from 'fixtures/common-options.json'
```

### Fixtures and Test Data

#### Creating Fixtures

- Store test data in `__fixtures__/` directories
- Use realistic data that represents actual API responses
- Keep fixtures focused and minimal
- Version control all fixture files

#### Fixture Guidelines

```json
{
  "workflow": {
    "name": "CI",
    "permissions": {
      "contents": "read",
      "actions": "read"
    },
    "jobs": {
      "test": {
        "runs-on": "ubuntu-latest",
        "steps": []
      }
    }
  }
}
```

### Error Handling

#### Test Error Scenarios

Always test error conditions alongside success cases:

```js
describe('fetchWorkflows', () => {
  test('should return workflows on success', async () => {
    // Test success case
  })

  test('should handle API errors gracefully', async () => {
    // Mock API error
    mockOctokit.request.mockRejectedValue(new Error('API Error'))

    await expect(repository.fetchWorkflows()).rejects.toThrow('API Error')
  })

  test('should handle rate limiting', async () => {
    // Test rate limiting scenario
  })
})
```

### Performance Testing

#### Guidelines for Performance

- Keep test execution time under 10ms per test
- Use mocks to avoid slow operations
- Group slow tests separately if needed
- Monitor total test suite runtime

### Code Coverage

#### Coverage Goals

- Aim for 90%+ line coverage
- Focus on testing business logic thoroughly
- Don't chase 100% coverage at the expense of meaningful tests
- Exclude generated files and trivial code from coverage

#### Checking Coverage

```bash
# Generate detailed coverage report
npm test -- --coverage
```

## Debugging and Troubleshooting

### Common Issues

#### Test Failures

1. **Check if the test is correct first** - Sometimes tests need updates when functionality changes
2. **Verify mocks are properly configured** - Ensure mocks match actual API responses
3. **Check for timing issues** - Use proper async/await patterns

#### Running Individual Tests

```bash
# Run a specific test file
npm test -- github/workflow.test.js

# Run tests with more verbose output
npm test -- --verbose --silent=false

# Run tests in watch mode for development
npm run test:watch
```

#### Mock Debugging

```js
// Log mock calls to debug issues
console.log(mockFunction.mock.calls)
console.log(mockFunction.mock.results)

// Reset mocks between tests
beforeEach(() => {
  jest.clearAllMocks()
})
```

### Integration with CLI

When testing the CLI tool itself, you can run it manually for verification:

```bash
# Test repository reporting
node cli.js \
  --token $(gh auth token) \
  --all \
  --exclude \
  --csv $(pwd)/reports/repository.csv \
  --json $(pwd)/reports/repository.json \
  --md $(pwd)/reports/repository.md \
  --repository stoe/action-reporting-cli \
  --debug

# Test user reporting
node cli.js \
  --token $(gh auth token) \
  --all \
  --exclude \
  --csv $(pwd)/reports/user.csv \
  --json $(pwd)/reports/user.json \
  --md $(pwd)/reports/user.md \
  --owner stoe \
  --debug
```

## Contributing to Tests

### Adding New Tests

1. **Create test file** following the naming convention: `[module].test.js`
2. **Follow the standard structure** with describe/test blocks
3. **Add fixtures** if you need test data
4. **Create mocks** for external dependencies
5. **Update this documentation** if you add new patterns

### Test Guidelines

- **Test behavior, not implementation** - Focus on what the code should do
- **Keep tests simple and focused** - One assertion per test when possible
- **Use descriptive test names** - Make it clear what's being tested
- **Test edge cases** - Include boundary conditions and error scenarios
- **Mock external dependencies** - Keep tests fast and reliable

### Code Review Checklist

- [ ] All new code has corresponding tests
- [ ] Tests follow the established patterns
- [ ] Mocks are used appropriately
- [ ] Test data is in fixtures, not inline
- [ ] Tests run quickly (under 10ms each)
- [ ] Error cases are tested
- [ ] Documentation is updated if needed

## Conclusion

This testing guide provides the foundation for maintaining high-quality, reliable tests in the `action-reporting-cli` project. The comprehensive test suite ensures:

- **Reliability**: All functionality is verified through automated tests
- **Maintainability**: Well-organized structure makes tests easy to update
- **Developer Experience**: Clear patterns and good tooling support efficient development
- **Quality Assurance**: Comprehensive coverage catches issues early

The testing infrastructure supports confident development and ensures the `action-reporting-cli` tool remains robust and dependable for users analyzing GitHub Actions workflows.
