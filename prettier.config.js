import * as prettierGitHubConfig from '@github/prettier-config'

export default {
  ...prettierGitHubConfig.default,
  // Add your overrides here
  semi: false,
  singleQuote: true,
  tabWidth: 2,
  trailingComma: 'all',
}
