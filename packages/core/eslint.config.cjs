const preset = require('@instahealth/config/eslint-flat.cjs')

module.exports = [...preset, { ignores: ['node_modules/**'] }]
