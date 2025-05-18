/**
 * Pauses execution for the specified number of milliseconds.
 * @param {number} milliseconds - The number of milliseconds to wait
 * @returns {Promise<string>} A promise that resolves with 'done!' after the specified time
 * @throws {Error} Throws an error if milliseconds is not a number
 */
const wait = milliseconds => {
  return new Promise(resolve => {
    if (typeof milliseconds !== 'number') {
      throw new Error('milliseconds not a number')
    }

    setTimeout(() => resolve('done!'), milliseconds)
  })
}

export default wait
