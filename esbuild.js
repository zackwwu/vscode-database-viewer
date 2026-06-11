const esbuild = require('esbuild');
const path = require('path');

const isWatchMode = process.argv.includes('--watch');
const isProduction = process.argv.includes('--production');

const options = {
  entryPoints: [path.resolve(__dirname, 'src/extension/extension.ts')],
  bundle: true,
  outfile: path.resolve(__dirname, 'dist/extension.js'),
  platform: 'node',
  target: 'node16',
  format: 'cjs',
  external: ['vscode', 'better-sqlite3'],
  sourcemap: !isProduction,
  minify: isProduction,
};

if (isWatchMode) {
  esbuild
    .context(options)
    .then((ctx) => ctx.watch())
    .catch(() => process.exit(1));
} else {
  esbuild.build(options).catch(() => process.exit(1));
}
