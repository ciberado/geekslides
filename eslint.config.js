import tseslint from 'typescript-eslint';

export default tseslint.config(
  tseslint.configs.strictTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: {
          allowDefaultProject: [
            'packages/hub/tests/unit/helpers.ts',
            'packages/vscode/esbuild.js',
            'packages/vscode/scripts/extract-css-docs.ts',
          ],
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/explicit-module-boundary-types': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
  {
    files: ['packages/cli/app/**/*.js'],
    ...tseslint.configs.disableTypeChecked,
    rules: {
      ...tseslint.configs.disableTypeChecked.rules,
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
  {
    ignores: [
      'archived/',
      'node_modules/',
      '**/dist/',
      'coverage/',
      'vibe/',
      'e2e/',
      '**/e2e/',
      'how-to/',
      'docker/',
      '**/*.config.js',
      '**/*.config.ts',
      '**/*.config.d.ts',
      '**/*.d.ts',
      '**/*.test.ts',
      '**/*.test.js',
      '**/.gitkeep',
      'packages/cli/bin/',
    ],
  },
);
