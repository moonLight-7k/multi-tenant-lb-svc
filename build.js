import { build, context } from 'esbuild'
import { resolve } from 'path'

const isDev = process.argv.includes('--dev')
const isProd = process.env.NODE_ENV === 'production'

/** @type {import('esbuild').BuildOptions} */
const buildOptions = {
  entryPoints: [resolve('src/server.ts')],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile: resolve('dist/server.js'),
  minify: isProd,
  sourcemap: !isProd,
  target: ['node24'],
  packages: 'external',
  alias: {
    '@/*': './src/*',
  },
  banner: {
    js: "import { createRequire } from 'module'; const require = createRequire(import.meta.url);",
  },
}

if (isDev) {
  const ctx = await context(buildOptions)
  await ctx.watch()
  console.log('watching for changes...')
} else {
  await build(buildOptions)
  console.log('build complete')
}
