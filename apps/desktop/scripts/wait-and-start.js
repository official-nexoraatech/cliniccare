const waitOn = require('wait-on');
const { spawn } = require('node:child_process');
const path = require('node:path');

async function main() {
  await waitOn({
    resources: ['http://localhost:5173', 'http-get://localhost:4100/api/auth/me'],
    validateStatus: (status) => status > 0,
    timeout: 180000,
  });

  const tscBin = path.join(__dirname, '..', '..', '..', 'node_modules', '.bin', 'tsc');
  const build = spawn(tscBin, ['-p', 'tsconfig.json'], { stdio: 'inherit', shell: true });

  build.on('exit', (code) => {
    if (code !== 0) process.exit(code);

    const electronBin = path.join(__dirname, '..', '..', '..', 'node_modules', '.bin', 'electron');
    const electron = spawn(electronBin, ['.'], { stdio: 'inherit', shell: true });
    electron.on('exit', (electronCode) => process.exit(electronCode ?? 0));
  });
}

main().catch((error) => {
  console.error('[desktop] failed to start:', error.message);
  process.exit(1);
});
