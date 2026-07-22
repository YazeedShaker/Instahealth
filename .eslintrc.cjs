// Root ESLint config — workspaces extend the shared preset in packages/config.
module.exports = {
  root: true,
  extends: [require.resolve('./packages/config/eslint-preset.cjs')],
  ignorePatterns: [
    'node_modules',
    '.next',
    '.expo',
    '.turbo',
    'dist',
    'build',
    'coverage',
    'apps/**',
    'packages/**',
  ],
}
