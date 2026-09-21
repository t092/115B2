const {chromium} = require('./playwright.cjs');
const assert = require('node:assert/strict');
const path = require('node:path');
const {pathToFileURL} = require('node:url');
(async()=>{
  const browser = await chromium.launch({channel:'msedge',headless:true});
  try {
    const page = await browser.newPage({viewport:{width:390,height:844}});
    const errors=[]; page.on('pageerror',e=>errors.push(e.message));
    await page.route('https://**/*',route=>route.abort());
    await page.goto(pathToFileURL(path.resolve(__dirname,'../index.html')).href,{waitUntil:'domcontentloaded'});
    await page.evaluate(()=>{sounds.enabled=false;gameState.challenge.completed=true;gameState.score=125;goToUnit('tab-summary');});
    assert.match(await page.locator('#certCloudSyncText').innerText(),/截圖|Google/);
    await page.evaluate(()=>{
      window.SCORE_FORM_CONFIG.URL='https://example.test/test-form';
      window.open=url=>{window.__openedScoreForm=url;};
    });
    await page.getByRole('button',{name:'填寫成績登錄表'}).click();
    assert.match(await page.evaluate(()=>window.__openedScoreForm),/example\.test\/test-form/);
    assert.equal(await page.evaluate(()=>gameState.score),125);
    assert.equal(await page.evaluate(()=>gameState.challenge.completed),true);
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    assert.deepEqual(errors,[]);
    console.log('PASS score UI: certificate guidance, form link and completion preserved');
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
