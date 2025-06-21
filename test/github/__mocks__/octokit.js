/**
 * Mock for Octokit API client.
 */
import {jest} from '@jest/globals'

// Create a mock request function
const mockRequest = jest.fn().mockImplementation(async options => {
  return {data: {}}
})

const mockGraphql = jest.fn().mockImplementation(async (query, variables) => {
  return {data: {}}
})

// Create the mock Octokit instance
const mockOctokit = {
  request: mockRequest,
  graphql: mockGraphql,
}

// Export default function that returns the mock instance
export default jest.fn().mockReturnValue(mockOctokit)
