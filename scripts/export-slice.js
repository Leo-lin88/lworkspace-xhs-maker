const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');

function findChrome() {
  const candidates = [
    // Windows Chrome
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    process.env.LOCALAPPDATA + '/Google/Chrome/Application/chrome.exe',
    // macOS Chrome
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

const [,, inputArg, outputDirArg, sliceHeightArg] = process.argv;

if (!inputArg) {
  console.log('Usage: node scripts/export-slice.js <input.html> [output-dir] [slice-height=1440]');
  console.log('  固定高度切片 | 顶底强制留白 | 智能避开文字行');
  process.exit(1);
}

(async () => {
  const htmlPath = path.resolve(inputArg);
  const outputDir = outputDirArg
    ? path.resolve(outputDirArg)
    : path.join(path.dirname(htmlPath), '产出');
  const sliceHeight = parseInt(sliceHeightArg) || 1440;

  // ═══ 配置 ═══
  const MARGIN = 48;
  const CONTENT_HEIGHT = sliceHeight - MARGIN * 2;  // 1344px
  const SEARCH_RANGE = 100;
  const MIN_LAST_SLICE = 300;

  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  const browser = await puppeteer.launch({
    headless: 'new',
    executablePath: findChrome(),
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1080, height: 1920, deviceScaleFactor: 2 });
  await page.goto('file://' + htmlPath, { waitUntil: 'networkidle0' });
  await page.evaluate(() => document.fonts.ready);
  await new Promise(r => setTimeout(r, 1500));

  const totalHeight = await page.evaluate(() => document.body.scrollHeight);
  const bgColor = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);

  /**
   * 在目标 Y 附近找安全切割点
   */
  async function findSafeCutPoint(targetY) {
    if (targetY >= totalHeight) return totalHeight;

    const safeCut = await page.evaluate((params) => {
      const { targetY, searchRange, totalHeight } = params;
      const searchTop = Math.max(0, targetY - searchRange);
      const searchBottom = Math.min(totalHeight, targetY + searchRange);

      const gaps = [];

      // 块级边界：原有组件 + v3.1 新增组件
      const blockSelectors = [
        // 原有
        '.card, .step, .steps, .hl-block, .pitfall, .section, .flow-row, .compare',
        '.img-wrap, .transform-block, .cost-table, .footer, .header, .page-break, hr',
        '.decision-tree, .dt-question, .dt-fork, .dt-path-card, .scene-tags',
        '.param-panel, .param-row, .conclusion-bar, .note-card',
        // v3.1 新增
        '.quote-block, .big-number, .score-card, .ck-group, .chat'
      ].join(', ');

      const blocks = document.querySelectorAll(blockSelectors);

      for (const el of blocks) {
        const rect = el.getBoundingClientRect();
        const top = rect.top + window.scrollY;
        const bottom = rect.bottom + window.scrollY;

        if (top >= searchTop && top <= searchBottom) {
          gaps.push({ y: top, priority: 1 });
        }
        if (bottom >= searchTop && bottom <= searchBottom) {
          gaps.push({ y: bottom, priority: 1 });
        }
      }

      // 文本行容器：原有 + v3.1 新增
      const textContainerSels = [
        // 原有
        '.card-body, .step-desc, .pitfall-body, .hl-block, .subtitle, .desc, p',
        '.dt-path-desc, .dt-path-result, .pr-note, .pr-name, .cb-text, .nc-body',
        '.scene-tag, .st-label',
        // v3.1 新增
        '.step-title, .card-title, .loc, .pretitle',
        '.bn-num, .bn-desc',
        '.q-text, .q-author',
        '.ck-text',
        '.ch-content',
        '.dt-q-text',
        '.sc-title, .sc-desc',
        '.tf-prompt'
      ].join(', ');

      const textContainers = document.querySelectorAll(textContainerSels);
      for (const container of textContainers) {
        const rect = container.getBoundingClientRect();
        const containerTop = rect.top + window.scrollY;
        const containerBottom = rect.bottom + window.scrollY;
        if (containerBottom < searchTop || containerTop > searchBottom) continue;

        const style = getComputedStyle(container);
        const fontSize = parseFloat(style.fontSize);
        const lineHeight = parseFloat(style.lineHeight) || fontSize * 1.8;
        const paddingTop = parseFloat(style.paddingTop) || 0;

        let lineY = containerTop + paddingTop + lineHeight;
        while (lineY < containerBottom) {
          if (lineY >= searchTop && lineY <= searchBottom) {
            gaps.push({ y: Math.round(lineY), priority: 2 });
          }
          lineY += lineHeight;
        }
      }

      if (gaps.length === 0) return targetY;

      gaps.sort((a, b) => {
        if (a.priority !== b.priority) return a.priority - b.priority;
        return Math.abs(a.y - targetY) - Math.abs(b.y - targetY);
      });

      return gaps[0].y;
    }, { targetY, searchRange: SEARCH_RANGE, totalHeight });

    return safeCut;
  }

  // ═══ 构建切割点 ═══
  const firstPageContent = sliceHeight - MARGIN;
  const cutPoints = [0];
  let currentY = 0;

  // 第一页
  const firstTarget = firstPageContent;
  if (firstTarget < totalHeight) {
    const firstCut = await findSafeCutPoint(firstTarget);
    const minFirst = firstPageContent * 0.6;
    cutPoints.push(Math.max(firstCut, minFirst));
    currentY = cutPoints[cutPoints.length - 1];
  }

  // 后续页
  while (currentY + CONTENT_HEIGHT < totalHeight) {
    const targetCut = currentY + CONTENT_HEIGHT;
    const safeCut = await findSafeCutPoint(targetCut);
    const minAdvance = currentY + CONTENT_HEIGHT * 0.5;
    const finalCut = Math.max(safeCut, minAdvance);
    cutPoints.push(finalCut);
    currentY = finalCut;
  }
  cutPoints.push(totalHeight);

  // 最后一段太短则合并
  if (cutPoints.length > 2) {
    const lastHeight = cutPoints[cutPoints.length - 1] - cutPoints[cutPoints.length - 2];
    if (lastHeight < MIN_LAST_SLICE) {
      cutPoints.splice(cutPoints.length - 2, 1);
      console.log(`末段仅 ${lastHeight}px，已合并到前一张`);
    }
  }

  const totalSlices = cutPoints.length - 1;
  console.log(`页面总高: ${totalHeight}px → ${totalSlices} 张`);
  console.log(`每页: ${sliceHeight}px | 有效内容: ${CONTENT_HEIGHT}px | 顶底留白: ${MARGIN}px\n`);

  // ═══ 导出（文件中转法，避免内存传输卡死） ═══
  const tempDir = path.join(outputDir, '__temp');
  if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

  for (let i = 0; i < totalSlices; i++) {
    const y = Math.round(cutPoints[i]);
    const nextY = Math.round(cutPoints[i + 1]);
    const contentH = nextY - y;
    const isFirst = (i === 0);
    const isLast = (i === totalSlices - 1);

    const filePath = path.join(outputDir, `${String(i + 1).padStart(2, '0')}.png`);

    let outputHeight, contentY;
    if (isFirst) {
      outputHeight = sliceHeight;
      contentY = 0;
    } else if (isLast) {
      outputHeight = Math.min(contentH + MARGIN * 2, sliceHeight * 2);
      contentY = MARGIN;
    } else {
      outputHeight = sliceHeight;
      contentY = MARGIN;
    }

    const tempFile = path.join(tempDir, `seg_${i}.png`);
    await page.screenshot({
      path: tempFile,
      type: 'png',
      clip: { x: 0, y, width: 1080, height: contentH }
    });

    const compositorHtml = `<!DOCTYPE html><html><head><style>
      *{margin:0;padding:0}
      body{width:1080px;height:${outputHeight}px;overflow:hidden;background:${bgColor}}
      img{position:absolute;left:0;top:${contentY}px;width:1080px}
    </style></head><body>
      <img src="file:///${tempFile.replace(/\\/g, '/')}" />
    </body></html>`;

    const compHtmlPath = path.join(tempDir, `comp_${i}.html`);
    fs.writeFileSync(compHtmlPath, compositorHtml);

    const compPage = await browser.newPage();
    await compPage.setViewport({ width: 1080, height: outputHeight, deviceScaleFactor: 2 });
    await compPage.goto('file://' + compHtmlPath, { waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, 300));

    await compPage.screenshot({
      path: filePath,
      type: 'png',
      clip: { x: 0, y: 0, width: 1080, height: outputHeight }
    });

    await compPage.close();

    const info = isFirst ? '(首页)' : isLast ? '(末页)' : '';
    console.log(`✓ 第${i + 1}张 → ${path.basename(filePath)} | 内容${Math.round(contentH)}px → 输出${outputHeight}px ${info}`);
  }

  fs.rmSync(tempDir, { recursive: true, force: true });

  await browser.close();
  console.log(`\n完成！${totalSlices} 张 → ${outputDir}`);
})();
