const preset = require('@instahealth/config/eslint-flat.cjs')

module.exports = [
  ...preset,
  {
    // Core is platform-agnostic — enforced, not hoped (CORE-01 acceptance criteria).
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            { name: 'react', message: 'packages/core is platform-agnostic — no React.' },
            { name: 'react-dom', message: 'packages/core is platform-agnostic — no React DOM.' },
            {
              name: 'react-native',
              message: 'packages/core is platform-agnostic — no React Native.',
            },
            { name: 'next', message: 'packages/core is platform-agnostic — no Next.js.' },
          ],
          patterns: [
            'react/*',
            'react-dom/*',
            'react-native/*',
            'react-native-*',
            'next/*',
            'expo*',
          ],
        },
      ],
    },
  },
  { ignores: ['node_modules/**', 'coverage/**', 'src/types/database.ts'] },
]
