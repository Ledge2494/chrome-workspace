/** @type {import('jest').Config} */
export default {
  moduleNameMapper: {
    // Map CSS files to identity-obj-proxy first, before alias resolution
    '.*\\.(css|less|scss|sass)$': 'identity-obj-proxy',
    '^@src/(.*)$': '<rootDir>/src/$1',
    '^@assets/(.*)$': '<rootDir>/src/assets/$1',
    // Map React imports to Preact compat for the Jest environment
    '^react$': 'preact/compat',
    '^react-dom$': 'preact/compat',
    '^react/jsx-runtime$': 'preact/jsx-runtime',
  },
  transform: {
    '\\.[jt]sx?$': './babel-jest.js',
  },
  testEnvironment: 'jsdom',
  extensionsToTreatAsEsm: ['.ts', '.tsx'],
  testEnvironmentOptions: {
    customExportConditions: ['node', 'node-addons'],
  },
};
