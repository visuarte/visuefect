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
    'no-console': 'off',
    'no-underscore-dangle': 'off',
    'func-names': 'off',
    'no-param-reassign': 'off',
    // relax a few rules to reduce noise for existing codebase
    'max-len': 'off',
    'no-plusplus': 'off',
    'no-empty': 'off',
    'import/extensions': 'off',
    'no-unused-expressions': 'off',
    'class-methods-use-this': 'off',
    'consistent-return': 'off',
    'no-unused-vars': 'off',
    'import/no-named-as-default': 'off',
    'no-await-in-loop': 'off',
    'no-restricted-syntax': 'off',
    'no-shadow': 'off',
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