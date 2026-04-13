import tseslint from 'typescript-eslint';

export default tseslint.config(
  tseslint.configs.strictTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/explicit-module-boundary-types': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
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
      'docker/',
      '**/*.config.js',
      '**/*.config.ts',
      '**/*.config.d.ts',
      '**/*.d.ts',
      '**/*.test.ts',
      '**/*.test.js',
      '**/.gitkeep',
    ],
  },
);
