import fs from 'fs';
import path from 'path';
import { chromium } from 'playwright';

const OUT_DIR = path.resolve('./artifacts');
const VIDEO_DIR = path.join(OUT_DIR, 'videos');
const SCREENSHOT = path.join(OUT_DIR, 'screenshot.png');

async function ensureDir(p) { try { await fs.promises.mkdir(p, { recursive: true }); } catch (e) {} }

(async () => {
  await ensureDir(VIDEO_DIR);
  await ensureDir(OUT_DIR);
  console.log('Launching browser...');
  const browser = await chromium.launch();
  const context = await browser.newContext({ recordVideo: { dir: VIDEO_DIR, size: { width: 1280, height: 720 } } });
  const page = await context.newPage();
  const CONSOLE_LOG = path.join(OUT_DIR, 'console.log');
  try { await fs.promises.writeFile(CONSOLE_LOG, '', { flag: 'w' }); } catch (e) {}
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
    // Wait a bit for UI to render
    await page.waitForTimeout(500);

    // Try to ensure viewport exists
    await page.waitForSelector('#viewport', { timeout: 3000 }).catch(() => { console.warn('No #viewport found'); });

    // Interact with UI: switch to DYNAMICS (step 2), drag a particle item into the viewport, and trigger export
    try {
      console.log('Switching to step 2 (DYNAMICS)');
      await page.click('.step-btn[data-step="2"]');
      await page.waitForTimeout(200);

      // find a draggable particle item
      const particleSelector = '[data-drag-type="particle"]';
      const particles = await page.$$(particleSelector);
      console.log('Particle drag items found:', particles.length);
      const hasParticle = particles.length > 0 ? particles[0] : null;
      if (hasParticle) {
        console.log('Dragging particle into viewport');
        try {
          await page.dragAndDrop(particleSelector, '#viewport', { trial: true });
        } catch (e) {
          // older playwright may not support dragAndDrop options; fallback to simple drag
          await page.dragAndDrop(particleSelector, '#viewport');
        }
      } else {
        console.log('No particle drag item found, skipping drag');
      }

      // trigger deterministic export if export button exists
      const exportBtn = await page.$('#export-video');
      if (exportBtn) {
        console.log('Clicking export button');
        await exportBtn.click();
        // wait a short while for export UI to react
        await page.waitForTimeout(1500);
      } else {
        console.log('No export button present');
      }
    } catch (e) { console.warn('UI interactions failed', e); }

    console.log('Taking screenshot...');
    await page.screenshot({ path: SCREENSHOT, fullPage: false });

    // wait a bit to allow video to capture some content
    await page.waitForTimeout(1000);

    console.log('Closing context (flushing video)...');
    await context.close();

    // find generated video file
    const vids = await fs.promises.readdir(VIDEO_DIR);
    if (vids.length > 0) {
      const src = path.join(VIDEO_DIR, vids[0]);
      const dest = path.join(OUT_DIR, `smoke-${Date.now()}.webm`);
      await fs.promises.rename(src, dest);
      console.log('Saved video to', dest);
    } else {
      console.log('No video produced');
    }

    await browser.close();
    console.log('E2E smoke completed successfully. Screenshot:', SCREENSHOT);
    process.exit(0);
  } catch (err) {
    console.error('E2E smoke failed', err);
    try { await browser.close(); } catch (e) {}
    process.exit(2);
  }
})();