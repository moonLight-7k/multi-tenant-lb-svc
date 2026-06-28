import { build, context } from 'esbuild'
import { resolve } from 'path'
import { readFileSync } from 'fs'
import { execSync } from 'child_process'

const isDev = process.argv.includes('--dev')
const isProd = process.env.NODE_ENV === 'production'

function git(cmd) {
  try { return execSync(cmd).toString().trim() }
  catch { return 'unknown' }
}

const gitCommit = git('git rev-parse --short HEAD')
const gitCommitCount = git('git rev-list --count HEAD')
const buildTime = new Date().toISOString()
const pkg = JSON.parse(readFileSync(resolve('package.json'), 'utf8'))
const buildVersion = `${pkg.version}+${gitCommitCount}.${gitCommit}`

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
    '@': './src',
  },
  banner: {
    js: "import { createRequire } from 'module'; const require = createRequire(import.meta.url);",
  },
  define: {
    'process.env.BUILD_VERSION': JSON.stringify(buildVersion),
    'process.env.GIT_COMMIT': JSON.stringify(gitCommit),
    'process.env.BUILD_TIME': JSON.stringify(buildTime),
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
