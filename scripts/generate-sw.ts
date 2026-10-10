import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const ts = require('typescript') as typeof import('typescript');
const ROUTES = [
  { url: '/', file: 'index.html' },
  { url: '/calendar/', file: 'calendar/index.html' },
  { url: '/settings/', file: 'settings/index.html' },
] as const;

function isStaticAsset(file: string): boolean {
  return (
    /^_next\/static\/.*\.(?:js|css)$/.test(file)
    || file === 'manifest.webmanifest'
    || /^icons\/.*\.(?:png|svg|webp)$/.test(file)
    || /^design\/.*\.svg$/.test(file)
    || /^fonts\/.*\.(?:woff2?|ttf|otf)$/.test(file)
  );
}

export function buildPrecacheUrls(files: readonly string[]): string[] {
  const staticAssets = [...new Set(files
    .map((file) => file.replaceAll('\\', '/').replace(/^\/+/, ''))
    .filter((file) => !file.split('/').includes('..') && isStaticAsset(file)))]
    .sort()
    .map((file) => `/${file}`);

  return [...ROUTES.map((route) => route.url), ...staticAssets];
}

async function walk(directory: string, prefix = ''): Promise<string[]> {
  const entries = await readdir(path.join(directory, prefix), { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const relative = path.posix.join(prefix, entry.name);
    if (entry.isDirectory()) files.push(...await walk(directory, relative));
    else if (entry.isFile()) files.push(relative);
  }
  return files;
}

async function generateServiceWorker(): Promise<void> {
  const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const outputDirectory = path.join(projectRoot, 'out');
  const outputFiles = await walk(outputDirectory);
  const urls = buildPrecacheUrls(outputFiles);
  const hash = createHash('sha256');
  const digestFiles = [...ROUTES.map((route) => route.file), ...urls.filter((url) => url !== '/' && !ROUTES.some((route) => route.url === url)).map((url) => url.slice(1))];

  for (const file of digestFiles) {
    hash.update(file);
    hash.update(await readFile(path.join(outputDirectory, file)));
  }

  const cacheName = `todolist-static-${Date.now().toString().padStart(13, '0')}-${hash.digest('hex').slice(0, 12)}`;
  const workerPath = path.join(projectRoot, 'src/pwa/service-worker.ts');
  const workerSource = await readFile(workerPath, 'utf8');
  const compiled = ts.transpileModule(workerSource, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.None,
    },
    reportDiagnostics: true,
  });
  if (compiled.diagnostics?.some((diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error)) {
    throw new Error('Service worker transpilation failed. Run pnpm typecheck:sw for diagnostics.');
  }

  const header = `const __PWA_CACHE_NAME__ = ${JSON.stringify(cacheName)};\nconst __PWA_PRECACHE_URLS__ = ${JSON.stringify(urls)};\n`;
  await writeFile(path.join(outputDirectory, 'sw.js'), `${header}${compiled.outputText}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await generateServiceWorker();
}
