import js from '@eslint/js';
import eslintConfigPrettier from 'eslint-config-prettier';
import { importX } from 'eslint-plugin-import-x';
import perfectionist from 'eslint-plugin-perfectionist';
import { defineConfig } from 'eslint/config';
import globals from 'globals';
import path from 'path';
import tseslint from 'typescript-eslint';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const reactNativeGlobals = {
  __DEV__: 'readonly',
  FormData: 'readonly',
  XMLHttpRequest: 'readonly',
  fetch: 'readonly',
};

export default defineConfig([
  {
    ignores: ['lib/**', 'node_modules/**'],
  },
  {
    languageOptions: {
      parserOptions: {
        tsconfigRootDir: __dirname,
      },
    },
  },
  {
    files: ['**/*.{js,mjs,cjs,ts,mts,cts,tsx}'],
    plugins: { js },
    extends: ['js/recommended'],
    languageOptions: { globals: { ...globals.node, ...reactNativeGlobals } },
  },
  tseslint.configs.recommended,
  eslintConfigPrettier,
  {
    plugins: {
      'import-x': importX,
      perfectionist,
    },
    settings: {
      'import-x/internal-regex': '^@/',
      'import-x/resolver': {
        typescript: true,
      },
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': [
        'error',
        {
          prefer: 'type-imports',
          fixStyle: 'separate-type-imports',
        },
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      'no-console': 'off',
      'perfectionist/sort-imports': [
        'error',
        {
          type: 'alphabetical',
          order: 'asc',
          ignoreCase: true,
          newlinesBetween: 1,
          tsconfig: { rootDir: '.' },
          internalPattern: ['^@/'],
          groups: [
            'type-import',
            ['value-builtin', 'value-external'],
            'value-internal',
            ['value-parent', 'value-sibling', 'value-index'],
            'side-effect',
            'unknown',
          ],
        },
      ],
      'import-x/no-cycle': [
        'error',
        {
          ignoreExternal: true,
        },
      ],
    },
  },
]);
