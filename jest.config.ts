import type { Config } from '@jest/types';

const config: Config.InitialOptions = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  verbose: true,
  coverageDirectory: 'coverage',
  collectCoverage: true,
  testPathIgnorePatterns: ['/node_modules/'],
  transform: {
    '^.+\\.ts?$': 'ts-jest'
  },
  testMatch: ['<rootDir>/test/**/*.ts'],
  collectCoverageFrom: ['src/**/*.ts', '!test/**/*.ts?(x)', '!**/node_modules/**'],
  coverageThreshold: {
    global: {
      branches: 1,
      functions: 1,
      lines: 1,
      statements: 1
    }
  },
  coverageReporters: ['text-summary', 'lcov'],
  moduleNameMapper: {
    '^@gateway/(.*)$': '<rootDir>/src/$1',
  },
  // Add these new settings
  globals: {
    'ts-jest': {
      tsconfig: 'tsconfig.json',
      compiler: 'typescript',
      diagnostics: {
        ignoreCodes: [151001]
      }
    }
  },
  setupFiles: ['reflect-metadata'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  rootDir: '.'
};

export default config;