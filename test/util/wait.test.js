/**
 * Unit tests for the wait utility function.
 */
import wait from '../../src/util/wait.js'

describe('wait', () => {
  /**
   * Test that wait resolves after the specified time.
   */
  test('should resolve after specified milliseconds', async () => {
    const startTime = Date.now()
    const delay = 100

    const result = await wait(delay)
    const elapsed = Date.now() - startTime

    expect(result).toBe('done!')
    expect(elapsed).toBeGreaterThanOrEqual(delay)
    // Allow 50ms buffer for timing variations in the JavaScript runtime
    expect(elapsed).toBeLessThan(delay + 50)
  })

  /**
   * Test that wait throws error for non-number input.
   */
  test('should throw error for non-number input', async () => {
    await expect(wait('invalid')).rejects.toThrow('milliseconds not a number')
  })

  /**
   * Test that wait handles zero milliseconds.
   */
  test('should handle zero milliseconds', async () => {
    const result = await wait(0)
    expect(result).toBe('done!')
  })
})
