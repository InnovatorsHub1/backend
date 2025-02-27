import type { Config } from '@jest/types';

const config: Config.InitialOptions = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  verbose: true,
  coverageDirectory: '/tmp/coverage',
  collectCoverage: true,
  testPathIgnorePatterns: ['/node_modules/'],
  transform: {
    '^.+\\.ts?$': ['ts-jest', {
      tsconfig: 'tsconfig.json',
      compiler: 'typescript',
      diagnostics: {
        ignoreCodes: [151001]
      }
    }]
  },
  testMatch: ['<rootDir>/test/**/*.ts'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!test/**/*.ts?(x)',
    '!**/node_modules/**'
  ],
  coverageThreshold: {
    global: {
      branches: 1,
      functions: 1,
      lines: 1,
      statements: 1
    }
  },
  coverageReporters: ['text', 'text-summary'],
  moduleNameMapper: {
    '^@gateway/(.*)$': '<rootDir>/src/$1',
  },
  setupFiles: ['reflect-metadata'],
  moduleFileExtensions: ['ts', 'js', 'json']
};

export default config;