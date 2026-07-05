const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');

const [,, inputArg, outputArg] = process.argv;

if (!inputArg || !outputArg) {
  console.log('Usage: node scripts/export-cover.js <cover.html> <output.png>');
  process.exit(1);
}

function findChrome() {
  const candidates = [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    process.env.LOCALAPPDATA + '/Google/Chrome/Application/chrome.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
  ];
  for (const p of candidates) {
    try { if (fs.existsSync(p)) return p; } catch {}
  }
  throw new Error('未找到 Chrome/Chromium，请在脚本中手动指定路径（executablePath）');
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
  await page.setViewport({ width: 1080, height: 1440, deviceScaleFactor: 2 });
  await page.goto('file://' + htmlPath, { waitUntil: 'networkidle0' });
  await page.evaluate(() => document.fonts.ready);
  await new Promise(r => setTimeout(r, 1000));

  await page.screenshot({
    path: outPath,
    type: 'png',
    clip: { x: 0, y: 0, width: 1080, height: 1440 },
  });

  console.log(`✓ 封面导出：${outPath}`);
  await browser.close();
})();
