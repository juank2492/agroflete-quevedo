/** @type {import('jest').Config} */
export default {
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/*.spec.ts'],
  moduleNameMapper: {
    '^@agroflete/shared$': '<rootDir>/../shared/src/index.ts',
    // Resuelve imports .js al módulo TypeScript correspondiente.
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  transform: {
    '^.+\\.ts$': [
      '@swc/jest',
      {
        jsc: {
          parser: { syntax: 'typescript', decorators: false },
          target: 'es2022',
        },
        module: { type: 'commonjs' },
      },
    ],
  },
  clearMocks: true,
  setupFiles: ['<rootDir>/src/test/setup-env.ts'],
  collectCoverageFrom: ['src/core/**/*.ts', '!src/core/**/*.spec.ts', '!src/core/app-context.ts'],
  coverageDirectory: '<rootDir>/coverage',
};
