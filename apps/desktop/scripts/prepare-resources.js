// Stages everything the packaged Host app needs into apps/desktop/resources/, which
// electron-builder then copies verbatim into the installed app (see the "extraResources"
// entry in apps/desktop/package.json). Run before `electron-builder` — see the "dist" npm
// script.
//
// The packaged app has no .env and isn't part of the npm workspace, so this has to produce
// a fully self-contained copy of the API: its own node_modules (production deps only), the
// internal @clinic-care/shared-types package placed by hand (it's a workspace-only package,
// "npm install" can't resolve it from outside the monorepo), a Prisma Client generated
// straight into that node_modules (no separate `prisma generate` step needed at runtime),
// and the `prisma` CLI itself + schema.prisma (needed on every Host boot to `db push` a
// possibly-fresh local Mongo before the API can seed/serve — see main.ts's startApiServer).
const { execSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.join(__dirname, '..', '..', '..');
const apiDir = path.join(repoRoot, 'apps', 'api');
const webDir = path.join(repoRoot, 'apps', 'web');
const sharedTypesDir = path.join(repoRoot, 'packages', 'shared-types');
const resourcesDir = path.join(__dirname, '..', 'resources');
const stagedApiDir = path.join(resourcesDir, 'api');

function run(command, cwd) {
  console.log(`$ ${command}  (in ${cwd})`);
  execSync(command, { cwd, stdio: 'inherit', shell: true });
}

function copyDir(from, to) {
  fs.mkdirSync(to, { recursive: true });
  fs.cpSync(from, to, { recursive: true });
}

function main() {
  console.log('--- Cleaning resources/ ---');
  fs.rmSync(resourcesDir, { recursive: true, force: true });
  fs.mkdirSync(stagedApiDir, { recursive: true });

  console.log('--- Copying apps/api/dist ---');
  copyDir(path.join(apiDir, 'dist'), path.join(stagedApiDir, 'dist'));

  console.log('--- Copying schema.prisma (needed for `prisma db push` on every Host boot) ---');
  fs.mkdirSync(path.join(stagedApiDir, 'prisma'), { recursive: true });
  fs.copyFileSync(path.join(apiDir, 'prisma', 'schema.prisma'), path.join(stagedApiDir, 'prisma', 'schema.prisma'));

  console.log('--- Writing a trimmed package.json (prod deps, minus the workspace-only one) ---');
  const apiPackageJson = JSON.parse(fs.readFileSync(path.join(apiDir, 'package.json'), 'utf-8'));
  const stagedDeps = { ...apiPackageJson.dependencies };
  delete stagedDeps['@clinic-care/shared-types']; // hand-placed below — "*" isn't resolvable outside the workspace
  fs.writeFileSync(
    path.join(stagedApiDir, 'package.json'),
    JSON.stringify({ name: '@clinic-care/api', version: apiPackageJson.version, private: true, dependencies: stagedDeps }, null, 2),
  );

  console.log('--- npm install (production deps + the prisma CLI, for db push on every Host boot) ---');
  run('npm install --omit=dev --no-audit --no-fund', stagedApiDir);
  run('npm install --no-save --no-audit --no-fund prisma@6.19.3', stagedApiDir);

  console.log('--- Placing @clinic-care/shared-types by hand ---');
  const stagedSharedTypesDir = path.join(stagedApiDir, 'node_modules', '@clinic-care', 'shared-types');
  copyDir(path.join(sharedTypesDir, 'dist'), path.join(stagedSharedTypesDir, 'dist'));
  const sharedTypesPackageJson = JSON.parse(fs.readFileSync(path.join(sharedTypesDir, 'package.json'), 'utf-8'));
  fs.writeFileSync(
    path.join(stagedSharedTypesDir, 'package.json'),
    JSON.stringify(
      { name: sharedTypesPackageJson.name, version: sharedTypesPackageJson.version, main: 'dist/index.js', types: 'dist/index.d.ts' },
      null,
      2,
    ),
  );

  console.log('--- Generating the Prisma Client (default output: node_modules/.prisma/client, forwarded from @prisma/client) ---');
  const schemaPath = path.join(stagedApiDir, 'prisma', 'schema.prisma');
  run(`node "${path.join(stagedApiDir, 'node_modules', 'prisma', 'build', 'index.js')}" generate --schema="${schemaPath}"`, stagedApiDir);

  console.log('--- Copying apps/web/dist ---');
  copyDir(path.join(webDir, 'dist'), path.join(resourcesDir, 'web', 'dist'));

  console.log('\nDone. Resources staged at', resourcesDir);
}

main();
