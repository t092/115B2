/* 講義版面驗證腳本：截圖 + 字級量測（修改前/後各跑一次） */
const path = require('path');
const fs = require('fs');
const { chromium } = require(path.resolve(__dirname, '../../node_modules/playwright'));

const ROOT = process.argv[3] ? path.resolve(process.argv[3]) : path.resolve(__dirname, '..');
const OUT = path.join(__dirname, process.argv[2] || 'after');
const PAGE_URL = 'file:///' + path.join(ROOT, 'index.html').replace(/\\/g, '/');
const VIEWPORTS = [
  { name: 'mobile-375', width: 375, height: 812 },
  { name: 'tablet-820', width: 820, height: 1180 },
  { name: 'desktop-1280', width: 1280, height: 900 }
];

const METRIC_SELECTORS = {
  leadText: '.lead-text',
  articleH3: '.article-header h3',
  cardH4: '.lecture-card h4',
  cardLi: '.lecture-card li',
  strategyP: '.strategy-card p',
  strategyStrong: '.strategy-card strong',
  causeChain: '.cause-chain',
  tableText: '.styled-table',
  tableH4: '.compare-table-box h4',
  bannerH2: '.handout-banner h2',
  bannerP: '.handout-banner p',
  ctaH3: '.handout-footer-cta h3',
  unitBadge: '.unit-badge'
};

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true, channel: 'msedge', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const report = {};
  try {
    for (const vp of VIEWPORTS) {
      const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
      await page.goto(PAGE_URL);
      await page.evaluate(() => document.fonts.ready);
      await page.addStyleTag({ content: '.sound-toggle-btn{visibility:hidden !important;}' });
      await page.waitForTimeout(900);

      await page.locator('#tab-handout').screenshot({ path: path.join(OUT, `handout-${vp.name}.png`) });

      report[vp.name] = await page.evaluate((selectors) => {
        const out = {};
        for (const [key, sel] of Object.entries(selectors)) {
          const el = document.querySelector(sel);
          out[key] = el ? getComputedStyle(el).fontSize : null;
        }
        out.articleLineHeight = getComputedStyle(document.querySelector('.handout-article')).lineHeight;
        out.hScroll = document.documentElement.scrollWidth > document.documentElement.clientWidth;
        return out;
      }, METRIC_SELECTORS);

      // 遊戲關卡頁（僅切換顯示，不啟動計時）
      await page.evaluate(() => {
        document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
        document.getElementById('tab-challenge').classList.add('active');
        document.querySelectorAll('.challenge-stage').forEach(s => s.classList.remove('active'));
        document.getElementById('stageBox').classList.add('active');
      });
      await page.waitForTimeout(700);
      await page.locator('#tab-challenge').screenshot({ path: path.join(OUT, `challenge-${vp.name}.png`) });

      // 證書頁
      await page.evaluate(() => {
        document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
        document.getElementById('tab-summary').classList.add('active');
      });
      await page.waitForTimeout(700);
      await page.locator('#tab-summary').screenshot({ path: path.join(OUT, `summary-${vp.name}.png`) });

      await page.close();
    }

    // 列印模擬（A4 寬度）
    const page = await browser.newPage({ viewport: { width: 794, height: 1123 } });
    await page.goto(PAGE_URL);
    await page.evaluate(() => document.fonts.ready);
    await page.emulateMedia({ media: 'print' });
    await page.evaluate(() => document.body.classList.add('printing-handout'));
    await page.waitForTimeout(500);
    report.printA4 = await page.evaluate((selectors) => {
      const out = {};
      for (const [key, sel] of Object.entries(selectors)) {
        const el = document.querySelector(sel);
        out[key] = el ? getComputedStyle(el).fontSize : null;
      }
      return out;
    }, METRIC_SELECTORS);
    await page.locator('#tab-handout').screenshot({ path: path.join(OUT, 'handout-print.png') });
    await page.close();
  } finally {
    await browser.close();
  }
  fs.writeFileSync(path.join(OUT, 'metrics.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
})().catch(err => { console.error(err); process.exit(1); });
