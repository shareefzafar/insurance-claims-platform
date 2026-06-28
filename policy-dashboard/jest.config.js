/** @type {import('jest').Config} */
export default {
  testEnvironment: 'jsdom',
  transform:       {},
  testMatch: ['**/tests/unit/**/*.test.js'],
  collectCoverageFrom: [
    'src/utils/**/*.js',
  ],
  coverageThreshold: {
    global: { lines: 80, functions: 80, branches: 75, statements: 80 },
  },
};