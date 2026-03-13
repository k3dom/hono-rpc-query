import { defineConfig } from 'vite-plus'

export default defineConfig({
  pack: {
    exports: true,
    dts: {
      sourcemap: true,
    },
  },
  fmt: {
    ignorePatterns: ['CHANGELOG.md'],
    singleQuote: true,
    trailingComma: 'es5',
    semi: false,
    printWidth: 85,
    sortImports: {
      newlinesBetween: false,
    },
  },
  lint: {
    ignorePatterns: ['example/**', 'dist/**'],
    options: {
      typeAware: true,
      typeCheck: true,
    },
  },
  test: {
    include: ['./src/**/*.test.ts'],
  },
})
