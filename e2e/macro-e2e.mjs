// Browser test of the close-up camera controls, on a simulated phone whose camera
// reports two back lenses, manual focus, zoom and a flashlight.
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import assert from 'node:assert/strict';

const { chromium, devices } = createRequire(import.meta.url)('playwright');
const OUT = new URL('./output/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
const PORT = 4180;
const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'pipe', detached: true });
await new Promise((res, rej) => {
  server.stdout.on('data', (d) => String(d).includes('Local') && res());
  server.on('exit', (c) => rej(new Error(`preview exited ${c}`)));
  setTimeout(() => rej(new Error('preview did not start')), 30000);
});

const STUB = () => {
  window.__applied = [];
  window.__gum = [];
  const caps = {
    zoom: { min: 1, max: 5, step: 0.1 },
    focusDistance: { min: 0.03, max: 5, step: 0.01 },
    focusMode: ['manual', 'continuous'],
    torch: true,
  };
  MediaStreamTrack.prototype.getCapabilities = function () { return caps; };
  MediaStreamTrack.prototype.applyConstraints = async function (c) { window.__applied.push(JSON.parse(JSON.stringify(c))); };
  const realEnum = navigator.mediaDevices.enumerateDevices.bind(navigator.mediaDevices);
  navigator.mediaDevices.enumerateDevices = async () => {
    const list = await realEnum();
    return [...list, { kind: 'videoinput', deviceId: 'ultrawide-1', label: 'camera2 2, facing back', groupId: 'g' }];
  };
  const realGum = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
  navigator.mediaDevices.getUserMedia = (c) => { window.__gum.push(JSON.parse(JSON.stringify(c))); return realGum(c); };
};

const results = [];
const browser = await chromium.launch({ args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] });
try {
  const ctx = await browser.newContext({ ...devices['Pixel 7'], permissions: ['camera'] });
  await ctx.addInitScript(STUB);
  const page = await ctx.newPage();
  await page.goto(`http://localhost:${PORT}/`);
  await page.getByTestId('cam-controls').waitFor();

  await page.getByTestId('macro-btn').click();
  await page.waitForFunction(() => window.__applied.some((c) => c.advanced?.[0]?.focusMode === 'manual'));
  const last = await page.evaluate(() => window.__applied.at(-1).advanced[0]);
  assert.equal(last.focusMode, 'manual');
  assert.equal(last.focusDistance, 0.03);
  results.push('PASS  Close focus ON → manual focus at nearest distance (0.03)');

  await page.getByLabel('Zoom').fill('2.5');
  await page.getByLabel('Light OFF', { exact: false }).count(); // no-op locator check
  await page.getByRole('button', { name: /Light OFF/ }).click();
  const z = await page.evaluate(() => window.__applied.at(-1).advanced[0]);
  assert.equal(z.zoom, 2.5);
  assert.equal(z.torch, true);
  results.push('PASS  Zoom slider (2.5×) and Light toggle applied to camera');
  await page.getByText('Camera info').click();
  await page.screenshot({ path: `${OUT}08-macro-controls.png` });

  await page.getByTestId('lens-btn').click();
  await page.waitForFunction(() => window.__gum.some((c) => c.video?.deviceId?.exact === 'ultrawide-1'));
  results.push('PASS  Lens button reopens camera with the other back lens');

  await page.reload();
  await page.getByTestId('cam-controls').waitFor();
  assert.match(await page.getByTestId('macro-btn').innerText(), /ON/);
  await page.waitForFunction(() => window.__applied.some((c) => c.advanced?.[0]?.focusMode === 'manual' && c.advanced[0].zoom === 2.5));
  results.push('PASS  Settings remembered after closing and reopening');

  await page.getByRole('button', { name: 'Take Photo' }).click();
  await page.getByTestId('captured-preview').waitFor();
  results.push('PASS  Take Photo works with close-up settings on');
  await ctx.close();
} finally {
  await browser.close();
  try { process.kill(-server.pid); } catch {}
  console.log(results.join('\n'));
}
