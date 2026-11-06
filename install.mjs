// Downloads the Elsetest binary for this runner and checks it against the release's signed manifest:
// the manifest's Ed25519 signature with Elsetest's release key (the same key `elsetest --update`
// trusts), then the binary's size and SHA-256. No dependencies, so the action needs no build step.
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const server = (process.env.ELSETEST_SERVER || 'https://elsetest.com').replace(/\/$/, '');
const wanted = (process.env.ELSETEST_VERSION || 'latest').trim().replace(/^v/, '');

// Elsetest's release signing key. Its private half never leaves the publishing machine.
const releasePublicKey = crypto.createPublicKey({
  key: Buffer.from('MCowBQYDK2VwAyEAWJD1fpXBqZkB+VCsexHHkwrlzB5yUKHLJ9jcbgkVJDs=', 'base64'),
  format: 'der',
  type: 'spki',
});

function fail(message) {
  console.log(`::error title=Elsetest::${message}`);
  process.exit(1);
}

function target() {
  const arch = process.arch;
  if (process.platform === 'linux' && arch === 'x64') return 'linux-x64';
  if (process.platform === 'win32' && arch === 'x64') return 'win-x64';
  if (process.platform === 'darwin' && (arch === 'x64' || arch === 'arm64')) return `macos-${arch}`;
  return fail(`Elsetest has no build for ${process.platform} ${arch}. Use a Linux, Windows or macOS runner.`);
}

async function get(url) {
  const response = await fetch(url, { headers: { 'User-Agent': 'elsetest-action' } });
  if (!response.ok) fail(`Couldn't download ${url}: HTTP ${response.status}.`);
  return response;
}

async function manifest() {
  const latest = await (await get(`${server}/releases/latest.json`)).json();
  const valid = typeof latest?.manifest === 'string' && typeof latest.signature === 'string'
    && crypto.verify(null, Buffer.from(latest.manifest), releasePublicKey, Buffer.from(latest.signature, 'base64'));
  if (!valid) fail('The release manifest\'s signature is not valid.');
  return JSON.parse(latest.manifest);
}

function output(name, value) {
  fs.appendFileSync(process.env.GITHUB_OUTPUT, `${name}=${value}\n`);
}

const platformTarget = target();
const { version: latestVersion, targets } = await manifest();
const version = wanted === 'latest' ? latestVersion : wanted;
const exe = platformTarget === 'win-x64' ? 'elsetest.exe' : 'elsetest';
// Only the latest release has a signed manifest, so an older version pinned can't be checked.
const file = version === latestVersion
  ? targets[platformTarget]?.elsetest
  : { path: `${version}/${platformTarget}/${exe}` };
if (!file) fail(`Release ${version} has no build for ${platformTarget}.`);
if (!file.sha256) console.log(`::notice title=Elsetest::Version ${version} is not the latest (${latestVersion}), so its download can't be checked against the signed manifest.`);

const dir = path.join(process.env.RUNNER_TEMP || os.tmpdir(), 'elsetest', version);
fs.mkdirSync(dir, { recursive: true });
const dest = path.join(dir, exe);
console.log(`Downloading Elsetest ${version} for ${platformTarget}`);
const data = Buffer.from(await (await get(`${server}/releases/${file.path}`)).arrayBuffer());
if (file.size !== undefined && data.length !== file.size) fail(`The download's size is ${data.length}, not ${file.size}.`);
if (file.sha256 && crypto.createHash('sha256').update(data).digest('hex') !== file.sha256) fail('The download\'s SHA-256 doesn\'t match the signed manifest.');
fs.writeFileSync(dest, data, { mode: 0o755 });

// macOS on Apple silicon only runs signed binaries; an ad-hoc signature is enough.
if (process.platform === 'darwin' && spawnSync('codesign', [ '--verify', dest ]).status !== 0) {
  const signed = spawnSync('codesign', [ '--sign', '-', '--force', dest ], { stdio: 'inherit' });
  if (signed.status !== 0) fail('Couldn\'t sign the binary with codesign.');
}

output('version', version);
output('path', dest);
// Where Elsetest keeps the Chrome it downloads (PUPPETEER_CACHE_DIR), cached per version.
output('cache-dir', path.join(process.env.RUNNER_TOOL_CACHE || os.tmpdir(), 'elsetest-chrome'));
