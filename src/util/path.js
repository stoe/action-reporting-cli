import path from 'node:path'

/**
 * Sanitizes a file path to prevent path injection attacks.
 * Resolves the path to an absolute path and rejects paths containing null bytes.
 * @param {string} inputPath - The path to sanitize
 * @returns {string} The sanitized, resolved absolute path
 * @throws {Error} If the path contains null bytes or is not a string
 */
export function sanitizePath(inputPath) {
  if (typeof inputPath !== 'string') {
    throw new TypeError('Path must be a string')
  }

  if (inputPath.includes('\0')) {
    throw new Error('Path must not contain null bytes')
  }

  return path.resolve(inputPath)
}
