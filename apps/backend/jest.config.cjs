/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: 'src',
  moduleFileExtensions: ['ts', 'js', 'json'],
  testMatch: ['**/*.test.ts'],
  moduleNameMapper: {
    '^@features/(.*)$': '<rootDir>/features/$1',
    '^@lib/(.*)$': '<rootDir>/lib/$1',
    '^@db/(.*)$': '<rootDir>/db/$1',
    '^@middlewares/(.*)$': '<rootDir>/middlewares/$1',
    '^@shared/(.*)$': '<rootDir>/shared/$1',
    '^@engine/(.*)$': '<rootDir>/engine/$1',
  },
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/../tsconfig.json' }],
  },
};
