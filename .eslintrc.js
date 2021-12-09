module.exports = {
  env: {
    browser: true,
    es2021: true,
    mocha: true,
  },
  extends: [
    'airbnb-base',
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 12,
    sourceType: 'module',
  },
  plugins: [
    '@typescript-eslint',
  ],
  settings: {
    'import/resolver': {
      node: {
        extensions: ['.js', '.ts'],
      },
    },
  },
  rules: {
    'no-unused-vars': 'off',
    '@typescript-eslint/no-unused-vars': 'error',
    'no-param-reassign': 'off',
    'prefer-template': 'off',
    'no-mixed-operators': 'off',
    'arrow-body-style': 'off',
    'no-plusplus': 'off',
    'prefer-destructuring': 'off',
    'no-continue': 'off',
    'import/extensions': 'off',
    'no-useless-concat': 'off',
    'no-bitwise': 'off',
    'no-use-before-define': ['error', { functions: false, classes: true, variables: true }],
    'no-console': 'off',
    'no-shadow': 'off',
    'max-len': ['warn', { code: 140 }],
  },
};
