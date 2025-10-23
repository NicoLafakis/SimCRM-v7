/* ESLint configuration enforcing centralized HubSpot API paths */
module.exports = {
  root: true,
  env: { es2021: true, node: true, browser: false },
  extends: [],
  parserOptions: { ecmaVersion: 2021, sourceType: 'module' },
  rules: {
    'no-restricted-syntax': [
      'error',
      {
        selector: "Literal[value=/.*\\/crm\\/v[34]\\//]",
        message: 'Use apiRegistry.js (buildPath) for HubSpot CRM paths instead of hard-coded literals.'
      }
    ]
  },
  overrides: [
    {
      files: ['server/tools/hubspot/apiRegistry.js'],
      rules: { 'no-restricted-syntax': 'off' }
    }
  ]
}
