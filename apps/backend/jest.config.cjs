/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: 'src',
  // Some suites leave background handles (the unref'd idle sweeper, a lazy Redis socket); they're
  // cleaned in test-setup's afterAll, but forceExit guards against an open-handle teardown hang that
  // otherwise reports a suite as "failed" with zero failed tests.
  forceExit: true,
  setupFilesAfterEnv: ['<rootDir>/test-setup.ts'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  testMatch: ['**/*.test.ts'],
  moduleNameMapper: {
    '^@features/(.*)$': '<rootDir>/features/$1',
    '^@lib/(.*)$': '<rootDir>/lib/$1',
    '^@db/(.*)$': '<rootDir>/db/$1',
    '^@middlewares/(.*)$': '<rootDir>/middlewares/$1',
    '^@shared/(.*)$': '<rootDir>/shared/$1',
    '^@engine/(.*)$': '<rootDir>/engine/$1',
    '^@games/(.*)$': '<rootDir>/games/$1',
  },
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/../tsconfig.json' }],
  },
};
