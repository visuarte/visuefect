module.exports = {
  root: true,
  env: {
    browser: true,
    node: true,
    es2021: true
  },
  extends: [
    'airbnb-base'
  ],
  parserOptions: {
    ecmaVersion: 12,
    sourceType: 'module'
  },
  rules: {
    // Phase 1: move selected rules from 'off' to 'warn' to get visibility without failing CI
    'no-console': 'warn',
    'no-underscore-dangle': 'off',
    'func-names': 'off',
    'no-param-reassign': 'warn',
    // relax a few rules to reduce noise for existing codebase
    'max-len': 'off',
    'no-plusplus': 'off',
    'no-empty': 'warn',
    'import/extensions': 'off',
    'no-unused-expressions': 'off',
    'class-methods-use-this': 'off',
    'consistent-return': 'warn',
    'no-unused-vars': ['warn', { args: 'after-used', vars: 'all', ignoreRestSiblings: true }],
    'import/no-named-as-default': 'off',
    'no-await-in-loop': 'off',
    'no-restricted-syntax': 'off',
    'no-shadow': 'warn',
    'no-mixed-operators': 'off',
    'no-bitwise': 'off',
    'import/prefer-default-export': 'off'
  },
  overrides: [
    {
      files: ['test/**/*.js'],
      env: { jest: true },
      rules: {
        'no-unused-expressions': 'off',
        'no-undef': 'off',
        'max-len': 'off'
      }
    }
  ]
};