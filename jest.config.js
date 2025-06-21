/**
 * For a detailed explanation regarding each configuration property, visit:
 * https://jestjs.io/docs/configuration
 */

/** @type {import('jest').Config} */
const config = {
  // automock: true,
  bail: 1,
  clearMocks: true,
  collectCoverage: true,
  coverageDirectory: 'coverage',
  coveragePathIgnorePatterns: ['/node_modules/'],
  coverageProvider: 'v8',
  coverageReporters: ['text', 'text-summary'],
  // globals: {},
  passWithNoTests: true,
  reporters: ['default', ['github-actions', {silent: false}], 'summary'],
  resetMocks: true,
  resetModules: true,
  // setupFilesAfterEnv: [],
  silent: true,
  transform: {},
  verbose: true,
  moduleNameMapper: {
    // Map mocks for different directories
    '^@mocks/(.+)/(.*)$': '<rootDir>/test/$1/__mocks__/$2',
    '^@mocks/(.*)$': '<rootDir>/test/__mocks__/$1',
    // Map fixtures for different directories
    '^fixtures/(.+)/(.*)$': '<rootDir>/test/$1/__fixtures__/$2',
    '^fixtures/(.*)$': '<rootDir>/test/__fixtures__/$1',
  },
}

export default config
