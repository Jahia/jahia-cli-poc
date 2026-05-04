import eslint from '@eslint/js';
import { config, configs } from 'typescript-eslint';
import prettier from 'eslint-config-prettier';
import functional from 'eslint-plugin-functional';

// eslint-disable-next-line @typescript-eslint/no-deprecated
export default config(
  eslint.configs.recommended,
  ...configs.strictTypeChecked,
  ...configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.json', './tsconfig.eslint.json'],
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    plugins: {
      functional,
    },
    rules: {
      // Functional programming preferences
      'functional/no-let': 'warn',
      'functional/prefer-immutable-types': 'off',
      'functional/no-loop-statements': 'warn',
      'functional/functional-parameters': 'off',
      'functional/no-classes': 'off',
      'functional/no-this-expressions': 'off',

      // Prefer arrow functions where possible
      'prefer-arrow-callback': 'error',
      'prefer-const': 'error',
      'no-var': 'error',

      // TypeScript strictness
      '@typescript-eslint/explicit-function-return-type': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports' },
      ],
    },
  },
  prettier,
  {
    ignores: ['dist/', 'node_modules/', 'bin/', 'oclif.manifest.json', 'coverage/'],
  },
);
