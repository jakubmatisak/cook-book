import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import pluginVue from 'eslint-plugin-vue'
import globals from 'globals'

export default tseslint.config(
  {
    ignores: [
      'dist/**',
      'dev-dist/**',
      'node_modules/**',
      'worker-configuration.d.ts',
      'worker/db/migrations/**',
      '.wrangler/**',
      '.superpowers/**',
      'public/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...pluginVue.configs['flat/recommended'],
  {
    files: ['**/*.vue'],
    languageOptions: { parserOptions: { parser: tseslint.parser } },
  },
  {
    files: ['src/**/*.{ts,vue}', 'tests/unit/**/*.ts'],
    languageOptions: { globals: globals.browser },
  },
  {
    // Rozšírenie do Chromu: čisté JS moduly s globálnym objektom `chrome`.
    files: ['extension/**/*.js'],
    languageOptions: { sourceType: 'module', globals: { ...globals.browser, chrome: 'readonly' } },
  },
  {
    files: ['scripts/**/*.mjs'],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['*.config.{ts,js}'],
    languageOptions: { globals: globals.node },
  },
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      // Sloty tabuľky Vuetify majú názov s bodkou (item.title).
      'vue/valid-v-slot': ['error', { allowModifiers: true }],
      // Prettier rieši formátovanie šablón.
      'vue/max-attributes-per-line': 'off',
      'vue/singleline-html-element-content-newline': 'off',
      'vue/html-self-closing': 'off',
      'vue/html-indent': 'off',
      'vue/html-closing-bracket-newline': 'off',
      'vue/multiline-html-element-content-newline': 'off',
    },
  },
)
