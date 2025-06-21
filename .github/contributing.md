# Contributing to action-reporting-cli

Thanks for your interest in contributing to this project! We welcome contributions from the community and we're glad you're interested in helping improve action-reporting-cli.

This document outlines the process for contributing to the project and provides guidelines to make the contribution process smooth and effective.

## Code of Conduct

By participating in this project, you are expected to uphold our Code of Conduct. Please report unacceptable behavior to [github@stoelzle.me](mailto:github@stoelzle.me).

## How Can I Contribute?

### Reporting Bugs

Before creating bug reports, please check the existing issues to avoid duplicates. When you create a bug report, include as many details as possible:

- A clear and descriptive title
- Steps to reproduce the behavior
- Expected behavior versus actual behavior
- Screenshots or terminal output (if applicable)
- Environment details (OS, Node.js version, etc.)
- Command line arguments you used with the tool

### Suggesting Enhancements

Enhancement suggestions are tracked as GitHub issues. When creating an enhancement suggestion:

- Use a clear and descriptive title
- Provide a detailed description of the proposed functionality
- Explain why this enhancement would be useful
- Include code examples or mockups if applicable

### Pull Requests

Follow these steps to submit your contributions:

1. Fork the repository
2. Create a feature branch (`git checkout -b my-new-feature`)
3. Make your changes (see [Development Guidelines](#development-guidelines))
4. Run tests to ensure they pass (`npm test`)
5. Commit your changes using a descriptive commit message that follows our [commit message guidelines](#commit-message-guidelines)
6. Push to your branch (`git push origin my-new-feature`)
7. Create a new Pull Request

When submitting pull requests that affect functionality, please make sure to update the relevant documentation in the README.md file as well.

## Development Guidelines

### Getting Started

1. Clone the repository:

   ```sh
   git clone https://github.com/stoe/action-reporting-cli.git
   cd action-reporting-cli
   ```

2. Install dependencies:

   ```sh
   npm install
   ```

3. Run tests to verify your setup:
   ```sh
   npm test
   ```

### Project Structure

- `src/`: Main source code
  - `github/`: GitHub API interaction classes (Enterprise, Owner, Repository, Workflow)
  - `report/`: Report generation modules (CSV, JSON, Markdown)
  - `util/`: Utility functions for logging, caching, and rate limiting
- `test/`: Unit tests with corresponding structure to src/
  - `__fixtures__/`: Test data for unit tests
  - `__mocks__/`: Mock implementations for testing
- `cli.js`: Main entry point for the command-line tool

### Coding Standards

- Follow the existing code style (we use prettier and ESLint)
- Write documentation for new methods, classes, and functions
- Include JSDoc comments for public APIs
- Keep functions focused and modular (generally under 50 lines)
- Use clear, descriptive variable and function names
- Handle errors consistently throughout the codebase
- Keep all lines, including comments, under 120 characters
- Write tests for all new functionality

### Commit Message Guidelines

We follow the [Gitmoji](https://gitmoji.dev/) convention for commit messages:

- Use the format `<emoji> <description>`
- Common emojis:
  - ✨ `:sparkles:` for new features
  - 🐛 `:bug:` for bug fixes
  - 📝 `:memo:` for documentation updates
  - 🎨 `:art:` for code style/structure improvements
  - ♻️ `:recycle:` for code refactoring
  - ✅ `:white_check_mark:` for tests
  - 🔧 `:wrench:` for configuration changes
- Keep descriptions concise and descriptive
- Use imperative, present tense (e.g., "change" not "changed" or "changes")

Examples:

- `✨ Add new CSV export format for reports`
- `🐛 Fix pagination issues with large repositories`
- `📝 Update installation instructions`
- `♻️ Refactor API client for better performance`
- `✅ Add tests for pagination handling`

## Testing

- All new features should include corresponding tests
- Run the test suite before submitting a pull request: `npm test`
- Ensure your changes don't break existing functionality
- If you're fixing a bug, consider adding a test that would have caught the bug

## Documentation

- Update the README.md with any necessary changes
- Document new features, options, or behavior changes
- Consider updating examples if relevant
- Use a conversational tone that matches the existing documentation
- For command examples, use the format shown in the README (e.g., `my-org/my-repo` for repository names)

## Review Process

- All submissions require review
- You may be asked to make changes before your PR is accepted
- Once approved, your PR will be merged by a maintainer

## Additional Resources

- [GitHub Pull Request Documentation](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests)
- [Test documentation](../test/readme.md) for detailed testing information

Thanks for contributing to action-reporting-cli!
