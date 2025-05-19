module.exports = {
  parser: '@typescript-eslint/parser',
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:hono/recommended', 
    'prettier', 
  ],
  plugins: ['@typescript-eslint', 'prettier', 'hono'],
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    project: './tsconfig.json', 
  },
  env: {
    es6: true,
    node: true,
  },
  rules: {
    'prettier/prettier': 'error',
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    '@typescript-eslint/no-explicit-any': 'warn', 
    'no-console': ['warn', { allow: ['warn', 'error', 'info'] }], 
  },
  ignorePatterns: ['node_modules/', 'dist/', '.eslintrc.js'],
};
