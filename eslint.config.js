import tseslint from 'typescript-eslint'

export default tseslint.config(
  ...tseslint.configs.recommended,
  { ignores: ['dist/', 'build.js'] },
  {
    rules: {
      // ponytail: Express forces `any` for req augmentation. Type properly when Express 5 types mature.
      '@typescript-eslint/no-explicit-any': 'off',
      // Express global namespace augmentation is idiomatic
      '@typescript-eslint/no-namespace': 'off',
      // Ternary side-effect pattern for Redis pipeline branching
      '@typescript-eslint/no-unused-expressions': 'off',
    },
  },
)
