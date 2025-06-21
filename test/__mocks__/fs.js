/**
 * Unit tests for input validation functions.
 */
import {jest} from '@jest/globals'

export default {
  access: jest.fn().mockResolvedValue(),
  mkdir: jest.fn().mockResolvedValue(),
  readFile: jest.fn().mockResolvedValue('{}'),
  writeFile: jest.fn().mockResolvedValue(),
  unlink: jest.fn().mockResolvedValue(),
}
