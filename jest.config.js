module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/backend/tests/**/*.test.js'],
  collectCoverageFrom: [
    'backend/services/**/*.js',
    'backend/models/**/*.js',
    '!**/node_modules/**'
  ],
  testTimeout: 30000,
  verbose: true,
  forceExit: true,
  clearMocks: true,
  resetMocks: true
};
