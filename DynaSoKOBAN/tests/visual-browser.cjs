const { chromium } = require('../../G2B3/tests/playwright.cjs');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const { pathToFileURL } = require('node:url');
const out = path.resolve(__dirname, '../../test-results/dynasty-visual');
fs.mkdirSync(out, { recursive: true });
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.route('https://**/*', r => r.abort());
    await page.addInitScript(() => {
      sessionStorage.setItem('L2B1A_DYNA_STUDENT_V2', JSON.stringify({ name: '視覺測試', classId:'201', seatNo:'1', isGuest:false }));
      sessionStorage.setItem('CAI_HIDDEN_LEVEL_UNLOCK', '1');
    });
    const open = name => page.goto(pathToFileURL(path.resolve(__dirname, '..', name)).href);
    await open('dynasty-push-game.html');
    await page.evaluate(() => document.getElementById('modal').classList.add('hidden'));
    await page.waitForFunction(() => document.querySelector('.scholar'));
    assert.equal(await page.evaluate(async () => {
      const image = new Image(); image.src = 'assets/scholar/sheet-transparent.png';
      await image.decode(); return image.naturalWidth;
    }), 320);
    for (const n of [1,2,3,4,5]) {
      await page.evaluate(n => { startLevel(n); document.getElementById('modal').classList.add('hidden'); }, n);
      assert.equal(await page.locator('.scholar').count(), 1);
      assert.equal(await page.evaluate(() => [...document.querySelectorAll('.block')].every(el => el.scrollWidth <= el.clientWidth && el.scrollHeight <= el.clientHeight)), true, `level ${n} labels fit`);
      await page.screenshot({ path:path.join(out, `level-${n}.png`), fullPage:true });
    }
    // A controlled board checks visual layers without changing the actual rules.
    await page.evaluate(() => {
      startLevel(1); document.getElementById('modal').classList.add('hidden');
      player = {r:5,c:4}; blocks = [{name:'漢',cls:'block-a',r:5,c:5,tr:5,tc:7}];
      render(); tryMove(0,1);
    });
    assert.deepEqual(await page.evaluate(() => [player.c, blocks[0].c]), [5,6]);
    await page.waitForTimeout(190);
    assert.equal(await page.locator('.scholar').evaluate(el => el.style.backgroundPosition.split(' ')[0]), '0%');
    await page.evaluate(() => { tryMove(0,1); });
    assert.equal(await page.locator('.block.done').count(),1);
    await page.evaluate(() => {
      won = false; document.getElementById('modal').classList.add('hidden');
      player = {r:5,c:7}; blocks[0].r = 6; render();
    });
    assert.equal(await page.locator('.player.target .scholar').count(),1);
    await page.setViewportSize({ width:390, height:844 });
    await page.evaluate(() => { startLevel(5); document.getElementById('modal').classList.add('hidden'); });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),true);
    await page.screenshot({path:path.join(out,'mobile-level-5.png'),fullPage:true});
    await page.setViewportSize({width:1280,height:900});
    await open('dynasty-sequence-game.html');
    await page.screenshot({path:path.join(out,'hidden-intro.png'),fullPage:true});
    await page.locator('#startButton').click();
    assert.equal(await page.locator('.tile').count(),64);
    await page.evaluate(() => { clearInterval(timer); timer=null; });
    await page.locator('.tile').first().click();
    assert.equal(await page.locator('.tile.selected').count(),1);
    await page.screenshot({path:path.join(out,'hidden-board.png'),fullPage:true});
    await page.evaluate(() => { timeLeft=10; updateHud(); });
    assert.equal(await page.locator('#timeTrack').getAttribute('aria-valuenow'),'10');
    await page.evaluate(() => { score=160; finish(); });
    assert.equal(await page.locator('#result').isVisible(),true);
    assert.equal(await page.evaluate(() => JSON.parse(sessionStorage.getItem('CAI_DYNA_HIDDEN_RESULT')).completed),true);
    await page.screenshot({path:path.join(out,'hidden-reward.png'),fullPage:true});
    await page.setViewportSize({width:390,height:844});
    await open('dynasty-sequence-game.html');
    await page.locator('#startButton').click();
    await page.evaluate(() => { clearInterval(timer); timer=null; });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),true);
    await page.screenshot({path:path.join(out,'hidden-mobile.png'),fullPage:true});
    assert.deepEqual(errors,[]);
    console.log('PASS five levels, sprite load/push/idle, goal layer, mobile layout, hidden selection/timer/reward; no page errors.');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode=1; });
