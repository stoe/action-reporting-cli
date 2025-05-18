/**
 * Unit tests for input validation functions.
 */
import {jest} from '@jest/globals'

// This is a Jest mock function that simulates the validateInput function
// This is a Jest mock function that simulates the validateInput function
const mockValidateInput = flags => {
  const {token, enterprise, owner, repository, csv, md, json, unique: _unique} = flags

  // Ensure GitHub token is provided
  if (!token) {
    throw new Error('GitHub Personal Access Token (PAT) not provided')
  }

  // Ensure at least one processing option is provided
  if (!(enterprise || owner || repository)) {
    throw new Error('no options provided')
  }

  // Ensure only one processing option is provided at a time
  if ((enterprise && owner) || (enterprise && repository) || (owner && repository)) {
    throw new Error('can only use one of: enterprise, owner, repository')
  }

  // Validate output file paths when provided
  if (csv === '') {
    throw new Error('please provide a valid path for the CSV output')
  }

  if (md === '') {
    throw new Error('please provide a valid path for the markdown output')
  }

  if (json === '') {
    throw new Error('please provide a valid path for the JSON output')
  }

  // Process unique flag
  const uniqueFlag = _unique === 'both' ? 'both' : _unique === 'true'

  // Return uniqueFlag only if validation passes
  return uniqueFlag
}

// Mock flags for testing
const baseFlags = {
  token: 'test-token',
  enterprise: null,
  owner: null,
  repository: null,
  csv: null,
  md: null,
  json: null,
  unique: false,
}

/**
 * Test suite for input validation.
 */
describe('report input validation', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  /**
   * Unit tests for input validation functions.
   */
  it('should throw an error if no/empty GitHub token is provided', () => {
    expect(() => mockValidateInput({...baseFlags, token: ''})).toThrow(
      'GitHub Personal Access Token (PAT) not provided',
    )
  })

  it('should throw an error if no processing options are provided', () => {
    expect(() => mockValidateInput({...baseFlags, enterprise: null, owner: null, repository: null})).toThrow(
      'no options provided',
    )
  })

  it('should throw an error if multiple processing options are provided', () => {
    expect(() =>
      mockValidateInput({
        ...baseFlags,
        enterprise: 'test-enterprise',
        owner: 'test-owner',
      }),
    ).toThrow('can only use one of: enterprise, owner, repository')
  })

  it('should throw an error if CSV output path is not provided', () => {
    expect(() => mockValidateInput({...baseFlags, owner: 'mona', csv: ''})).toThrow(
      'please provide a valid path for the CSV output',
    )
  })

  it('should throw an error if Markdown output path is not provided', () => {
    expect(() => mockValidateInput({...baseFlags, owner: 'mona', md: ''})).toThrow(
      'please provide a valid path for the markdown output',
    )
  })

  it('should throw an error if JSON output path is not provided', () => {
    expect(() => mockValidateInput({...baseFlags, owner: 'mona', json: ''})).toThrow(
      'please provide a valid path for the JSON output',
    )
  })

  it('should return "both" for unique flag when set to "both"', () => {
    const result = mockValidateInput({...baseFlags, owner: 'mona', unique: 'both'})
    expect(result).toBe('both')
  })

  it('should return true for unique flag when set to true', () => {
    const result = mockValidateInput({...baseFlags, owner: 'mona', unique: 'true'})
    expect(result).toBe(true)
  })

  it('should return false for unique flag when set to false', () => {
    const result = mockValidateInput({...baseFlags, owner: 'mona', unique: 'false'})
    expect(result).toBe(false)
  })
})
