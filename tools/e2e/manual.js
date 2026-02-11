import fs from 'fs';
import path from 'path';
import { chromium } from 'playwright';

const OUT_DIR = path.resolve('./artifacts');
const VIDEO_DIR = path.join(OUT_DIR, 'videos');
const SCREENSHOT = path.join(OUT_DIR, 'manual-screenshot.png');
const CONSOLE_LOG = path.join(OUT_DIR, 'manual-console.log');

async function ensureDir(p) { try { await fs.promises.mkdir(p, { recursive: true }); } catch (e) {} }

(async () => {
  await ensureDir(VIDEO_DIR);
  await ensureDir(OUT_DIR);
  try { await fs.promises.writeFile(CONSOLE_LOG, '', { flag: 'w' }); } catch (e) {}

  console.log('Launching headed browser (for manual UI check)...');
  const browser = await chromium.launch({ headless: false, slowMo: 50 });
  const context = await browser.newContext({ recordVideo: { dir: VIDEO_DIR, size: { width: 1280, height: 720 } } });
  const page = await context.newPage();

  page.on('console', msg => {
    const text = `[console.${msg.type()}] ${msg.text()}\n`;
    try { fs.appendFileSync(CONSOLE_LOG, text); } catch (e) {}
  });
  page.on('pageerror', err => {
    const text = `[pageerror] ${err.stack || err.message}\n`;
    try { fs.appendFileSync(CONSOLE_LOG, text); } catch (e) {}
  });

  try {
    console.log('Navigating to http://localhost:5174/');
    await page.goto('http://localhost:5174/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(500);

    await page.waitForSelector('#viewport', { timeout: 5000 }).catch(() => { console.warn('No #viewport found'); });

    // Switch to DYNAMICS (step 2)
    try {
      console.log('Switching to step 2 (DYNAMICS)');
      await page.click('.step-btn[data-step="2"]');
      await page.waitForTimeout(300);
    } catch (e) { console.warn('Failed to switch steps', e); }

    // Click particle button (click fallback should spawn particle)
    try {
      if (await page.$('[data-drag-item="particle"]')) {
        console.log('Clicking particle button to spawn (click fallback)');
        await page.click('[data-drag-item="particle"]');
        await page.waitForTimeout(500);
      } else {
        console.log('Particle button not found, attempting to use data-drag-type selector');
        if (await page.$('[data-drag-type="particle"]')) {
          await page.click('[data-drag-type="particle"]');
          await page.waitForTimeout(500);
        }
      }
    } catch (e) { console.warn('Particle spawn failed', e); }

    // Force preview (spawns several test elements)
    try {
      if (await page.$('#force-preview')) {
        console.log('Clicking Force Preview');
        await page.click('#force-preview');
        await page.waitForTimeout(800);
      }
    } catch (e) { console.warn('Force preview failed', e); }

    // Spawn multiple three meshes via engine API (if available)
    try {
      console.log('Spawning 3 three meshes via engine API');
      await page.evaluate(() => {
        try {
          const e = window.__VISUEFECT && window.__VISUEFECT.engine;
          if (!e || !e.addThreeMesh) return;
          for (let i = 0; i < 3; i++) e.addThreeMesh({ color: Math.floor(Math.random() * 0xffffff) });
        } catch (err) { console.warn('spawn three meshes failed', err); }
      });
      await page.waitForTimeout(600);
    } catch (e) { console.warn('Spawn meshes failed', e); }

    // Click export button twice to exercise export pipeline longer
    try {
      if (await page.$('#export-video')) {
        console.log('Clicking export button to exercise export (1/2)');
        await page.click('#export-video');
        await page.waitForTimeout(2500);
        console.log('Clicking export button to exercise export (2/2)');
        await page.click('#export-video');
        await page.waitForTimeout(2500);
      } else {
        console.log('No export button present');
      }
    } catch (e) { console.warn('Export click failed', e); }

    console.log('Taking manual screenshot...');
    await page.screenshot({ path: SCREENSHOT, fullPage: false });

    // Keep the UI open for 4 seconds for manual visual inspection (if visible)
    console.log('Waiting a few seconds for manual inspection...');
    await page.waitForTimeout(4000);

    console.log('Closing context (flushing video)...');
    await context.close();

    // Move generated video to a stable name
    const vids = await fs.promises.readdir(VIDEO_DIR);
    if (vids.length > 0) {
      const src = path.join(VIDEO_DIR, vids[vids.length - 1]);
      const dest = path.join(OUT_DIR, `manual-${Date.now()}.webm`);
      await fs.promises.rename(src, dest);
      console.log('Saved video to', dest);
    } else {
      console.log('No video produced');
    }

    await browser.close();
    console.log('Manual UI run completed. Screenshot:', SCREENSHOT, 'Console log:', CONSOLE_LOG);
    process.exit(0);
  } catch (err) {
    console.error('Manual UI run failed', err);
    try { await browser.close(); } catch (e) {}
    process.exit(2);
  }
})();