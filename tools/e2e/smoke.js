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

  try {
    console.log('Navigating to http://localhost:5174/');
    await page.goto('http://localhost:5174/', { waitUntil: 'networkidle' });
    // Wait a bit for UI to render
    await page.waitForTimeout(500);

    // Try to ensure viewport exists
    await page.waitForSelector('#viewport', { timeout: 3000 }).catch(() => { console.warn('No #viewport found'); });

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