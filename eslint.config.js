import markdown from '@eslint/markdown'
import globals from 'globals'
import prettierConfig from 'eslint-config-prettier'
import prettierPluginRecommended from 'eslint-plugin-prettier/recommended'

export default [
  prettierConfig,
  prettierPluginRecommended,
  {
    files: ['*.js'],
    ignores: ['build/', 'cache/', 'coverage/', 'dist/', 'node_modules/', 'reports/'],
    languageOptions: {
      globals: {
        ...globals.node,
      },
      parserOptions: {ecmaVersion: 'latest', sourceType: 'module'},
    },
    plugins: {markdown},
    rules: {
      'prettier/prettier': 'error',
    },
  },
  ...markdown.configs.recommended,
  {
    files: ['**/*.md'],
    processor: markdown.processors.markdown,
  },
  {
    files: ['**/*.md/*.js'],
    rules: {},
  },
]
