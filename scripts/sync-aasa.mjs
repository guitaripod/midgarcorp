import { copyFileSync, mkdirSync } from 'node:fs';

/** Copies registry/generated/apple-app-site-association into public/.well-known so the build serves the same bytes. */
function syncAasa() {
  const source = new URL('../../../registry/generated/apple-app-site-association', import.meta.url);
  const targetDir = new URL('../public/.well-known/', import.meta.url);
  mkdirSync(targetDir, { recursive: true });
  copyFileSync(source, new URL('apple-app-site-association', targetDir));
}

syncAasa();
