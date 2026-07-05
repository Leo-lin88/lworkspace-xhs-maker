const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');

function findChrome() {
  const candidates = [
    // Windows
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    process.env.LOCALAPPDATA + '/Google/Chrome/Application/chrome.exe',
    // macOS
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    // Windows Edge（系统预装）
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    process.env.LOCALAPPDATA + '/Microsoft/Edge/Application/msedge.exe',
    // macOS Edge
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    // Linux
    '/usr/bin/google-chrome',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
  ];
  for (const p of candidates) {
    try { if (require('fs').existsSync(p)) return p; } catch {}
  }
  throw new Error('未找到 Chrome/Chromium，请在脚本中手动指定路径（executablePath）');
}

const [,, inputArg, outputArg] = process.argv;

if (!inputArg || !outputArg) {
  console.log('Usage: node scripts/export-fullpage.js <input.html> <output.png>');
  process.exit(1);
}

(async () => {
  const htmlPath = path.resolve(inputArg);
  const outPath = path.resolve(outputArg);
  const outDir = path.dirname(outPath);
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const browser = await puppeteer.launch({
    headless: 'new',
    executablePath: findChrome(),
  });
  const page = await browser.newPage();

  await page.setViewport({ width: 1080, height: 800, deviceScaleFactor: 2 });
  await page.goto('file://' + htmlPath, { waitUntil: 'networkidle0' });
  await page.evaluate(() => document.fonts.ready);
  await new Promise(r => setTimeout(r, 1500));

  await page.screenshot({ path: outPath, type: 'png', fullPage: true });
  console.log(`✓ ${outPath}`);

  await browser.close();
})();
