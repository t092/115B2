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
    assert.match(await page.locator('#certCloudSyncText').innerText(),/Firebase/);
    await page.evaluate(()=>{
      window.FirebaseService={
        isConfigured:()=>true,
        submitScore:async()=>({status:'success'})
      };
      gameState.student.registered=true;
      gameState.student.email='student@st.tc.edu.tw';
    });
    await page.getByRole('button',{name:/儲存成績至 Firebase/}).click();
    await page.waitForTimeout(50);
    assert.match(await page.locator('#certCloudSyncText').innerText(),/等待教師核對/);
    assert.equal(await page.evaluate(()=>gameState.score),125);
    assert.equal(await page.evaluate(()=>gameState.challenge.completed),true);
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    assert.deepEqual(errors,[]);
    console.log('PASS score UI: Firebase guidance, save action and completion preserved');
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
