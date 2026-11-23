// End-to-end test of the Phase 1 "definition of success", in a real Chromium
// browser emulating an Android phone with a simulated camera.
// Usage: npm run build && npm run test:e2e
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync, statSync } from 'node:fs';
import assert from 'node:assert/strict';
import JSZip from 'jszip';

const { chromium, devices } = createRequire(import.meta.url)('playwright');
const OUT = new URL('./output/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
const PORT = 4179;
const URL_ = `http://localhost:${PORT}/`;

const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'pipe', detached: true });
await new Promise((res, rej) => {
  server.stdout.on('data', (d) => String(d).includes('Local') && res());
  server.on('exit', (c) => rej(new Error(`preview exited ${c}`)));
  setTimeout(() => rej(new Error('preview did not start')), 30000);
});

const results = [];
async function step(name, fn) {
  const t0 = Date.now();
  try {
    await fn();
    results.push(`PASS  ${name} (${Date.now() - t0} ms)`);
  } catch (e) {
    results.push(`FAIL  ${name}: ${e.message.split('\n')[0]}`);
    throw e;
  }
}

const browser = await chromium.launch({
  args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'],
});
const phone = devices['Pixel 7'];

// A test "coin" image for the Upload path.
const fixtureCtx = await browser.newContext({ viewport: { width: 600, height: 600 } });
const fx = await fixtureCtx.newPage();
await fx.setContent('<body style="margin:0;background:#333"><div style="width:500px;height:500px;margin:50px;border-radius:50%;background:radial-gradient(#e0a060,#8a4a1a)"></div></body>');
const FIXTURE = `${OUT}fixture-coin.jpg`;
await fx.screenshot({ path: FIXTURE, type: 'jpeg' });
await fixtureCtx.close();

let backupPath, csvPath;
try {
  const ctx = await browser.newContext({ ...phone, permissions: ['camera'], acceptDownloads: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(URL_);

  async function capture(viaUpload) {
    if (viaUpload) {
      await page.getByTestId('upload-input').setInputFiles(FIXTURE);
    } else {
      const take = page.getByRole('button', { name: 'Take Photo' });
      await take.waitFor();
      await page.waitForFunction(() => !document.querySelector('.actions .btn.primary')?.disabled);
      await take.click();
    }
    await page.getByTestId('captured-preview').waitFor();
    await page.getByRole('button', { name: 'Continue' }).click();
  }

  await step('Scan 20 coins with Save & Next Coin (18 live camera, 2 upload)', async () => {
    for (let i = 0; i < 20; i++) {
      const upload = i === 3 || i === 11;
      await capture(upload); // front
      await capture(upload); // back
      await page.getByRole('heading', { name: 'Identify coin' }).waitFor();
      await page.getByLabel('Denomination').selectOption('Cent');
      await page.getByLabel('Year').fill(String(1940 + i));
      await page.getByLabel('Mint mark').selectOption(i % 2 ? 'D' : 'none');
      if (i === 0) {
        await page.getByLabel('Series').fill('Lincoln Wheat');
        await page.getByLabel('Low ($)').fill('0.05');
        await page.getByLabel('High ($)').fill('0.25');
        await page.getByLabel('Pricing source').fill('Manual test entry');
        await page.screenshot({ path: `${OUT}03-identify.png` });
      }
      // double-tap to prove it does not create duplicates
      const save = page.getByRole('button', { name: 'Save & Next Coin' });
      await save.dblclick();
      await page.getByRole('heading', { name: 'Front (heads)' }).waitFor();
      if (i === 0) await page.screenshot({ path: `${OUT}01-front-after-save.png` });
    }
    await page.getByText('20 saved this session').waitFor();
  });

  await step('Collection shows all 20 records', async () => {
    await page.getByRole('button', { name: /Collection/ }).click();
    await page.getByTestId('coin-list').waitFor();
    assert.equal(await page.getByTestId('coin-list').locator('li').count(), 20);
    assert.match(await page.getByTestId('stat-coins').innerText(), /^20/);
    await page.getByText('1 of 20 valued').waitFor();
    await page.screenshot({ path: `${OUT}04-collection.png` });
  });

  await step('Close and reopen: data persists', async () => {
    await page.close();
    const p2 = await ctx.newPage();
    await p2.goto(URL_);
    await p2.getByRole('button', { name: /Collection/ }).click();
    await p2.getByTestId('coin-list').waitFor();
    assert.equal(await p2.getByTestId('coin-list').locator('li').count(), 20);
    globalThis.page2 = p2;
  });
  const p2 = globalThis.page2;

  await step('Open a coin, correct identification, save', async () => {
    await p2.getByRole('button', { name: /1940 Cent/ }).click();
    await p2.getByRole('heading', { name: 'Coin details' }).waitFor();
    await p2.locator('.pair.large img').first().waitFor();
    await p2.getByLabel('Year').fill('1909');
    await p2.getByLabel('Mint mark').selectOption('S');
    await p2.getByRole('button', { name: 'Save changes' }).click();
    await p2.getByRole('button', { name: 'Saved' }).waitFor();
    await p2.screenshot({ path: `${OUT}05-detail.png` });
    await p2.getByRole('button', { name: '‹ Collection' }).click();
    await p2.getByRole('button', { name: /1909-S Cent/ }).waitFor();
  });

  await step('Find Price: links open pre-searched; entering a price records source and date', async () => {
    await p2.getByRole('button', { name: /1941-D Cent/ }).click();
    await p2.getByRole('button', { name: /Find Price/ }).click();
    const ebay = p2.getByRole('link', { name: /eBay sold prices/ });
    const href = await ebay.getAttribute('href');
    assert.match(href, /ebay\.com\/sch\/i\.html\?_nkw=1941%20D%20Cent&LH_Sold=1&LH_Complete=1/);
    assert.equal(await p2.getByTestId('research-links').locator('a').count(), 6);
    const [popup] = await Promise.all([p2.waitForEvent('popup'), ebay.click()]);
    await popup.close();
    await p2.getByLabel('Low ($)').fill('0.10');
    await p2.getByLabel('High ($)').fill('0.50');
    assert.equal(await p2.getByLabel('Pricing source').inputValue(), 'eBay sold listings');
    assert.equal(await p2.getByLabel('Value type').inputValue(), 'completed_sales');
    assert.match(await p2.getByLabel('Pricing date').inputValue(), /^\d{4}-\d{2}-\d{2}$/);
    await p2.screenshot({ path: `${OUT}09-find-price.png`, fullPage: true });
    await p2.getByRole('button', { name: 'Save changes' }).click();
    await p2.getByRole('button', { name: 'Saved' }).waitFor();
    await p2.getByRole('button', { name: '‹ Collection' }).click();
    await p2.getByText('2 of 20 valued').waitFor();
  });

  await step('Filter by mint mark D shows 10', async () => {
    await p2.getByLabel('Mint mark filter').selectOption('D');
    assert.equal(await p2.getByTestId('coin-list').locator('li').count(), 10);
  });

  await step('Download full backup and CSV', async () => {
    await p2.getByRole('button', { name: /Backup/ }).click();
    let dl = p2.waitForEvent('download');
    await p2.getByRole('button', { name: /Download full backup/ }).click();
    backupPath = `${OUT}backup.zip`;
    await (await dl).saveAs(backupPath);
    const zip = await JSZip.loadAsync(readFileSync(backupPath));
    const json = JSON.parse(await zip.file('backup.json').async('string'));
    assert.equal(json.items.length, 20);
    assert.equal(Object.keys(zip.files).filter((f) => f.startsWith('photos/') && !zip.files[f].dir).length, 40);
    dl = p2.waitForEvent('download');
    await p2.getByRole('button', { name: /Export spreadsheet/ }).click();
    csvPath = `${OUT}collection.csv`;
    await (await dl).saveAs(csvPath);
    assert.equal(readFileSync(csvPath, 'utf8').trim().split('\r\n').length, 21);
    await p2.getByText(/Last backup:/).waitFor();
    await p2.screenshot({ path: `${OUT}06-backup.png` });
    results.push(`INFO  backup size ${(statSync(backupPath).size / 1024).toFixed(0)} KB for 20 coins / 40 photos`);
  });
  assert.deepEqual(errors, [], 'no page errors');
  await ctx.close();

  await step('Restore backup on a fresh device (new browser profile)', async () => {
    const c = await browser.newContext({ ...phone });
    const p = await c.newPage();
    p.on('dialog', (d) => d.accept());
    await p.goto(URL_);
    await p.getByRole('button', { name: /Backup/ }).click();
    await p.getByTestId('restore-input').setInputFiles(backupPath);
    await p.getByText('Restored 20 coins and 40 photos.').waitFor();
    await p.getByRole('button', { name: /Collection/ }).click();
    await p.getByTestId('coin-list').waitFor();
    assert.equal(await p.getByTestId('coin-list').locator('li').count(), 20);
    await p.getByRole('button', { name: /1909-S Cent/ }).waitFor();
    await c.close();
  });

  await step('Camera permission denied: clear message, Upload still works', async () => {
    const c = await chromium.launch(); // no fake camera flags
    const cx = await c.newContext({ ...phone });
    const p = await cx.newPage();
    await p.goto(URL_);
    await p.getByText(/Camera permission was refused|Could not start the live camera|not available/).waitFor();
    await p.screenshot({ path: `${OUT}07-camera-denied.png` });
    await p.getByTestId('upload-input').setInputFiles(FIXTURE);
    await p.getByTestId('captured-preview').waitFor();
    await c.close();
  });
} finally {
  await browser.close();
  try { process.kill(-server.pid); } catch {}
  console.log('\n' + results.join('\n'));
}
