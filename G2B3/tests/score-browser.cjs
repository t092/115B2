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
    const receipts=[];
    await page.route('https://script.google.com/**',async route=>{
      const data = route.request().postDataJSON(); receipts.push(data.submissionId);
      await route.fulfill({status:200,contentType:'application/json',headers:{'Access-Control-Allow-Origin':'*'},
        body:JSON.stringify({status:'success',submissionId:data.submissionId})});
    });
    await page.goto(pathToFileURL(path.resolve(__dirname,'../index.html')).href,{waitUntil:'domcontentloaded'});
    await page.evaluate(()=>{sounds.enabled=false;gameState.challenge.completed=true;gameState.score=125;goToUnit('tab-summary');});
    await page.getByRole('button',{name:'重試上傳',exact:true}).click();
    assert.match(await page.locator('#certCloudSyncText').innerText(),/重新登入/);
    assert.equal(receipts.length,0);
    await page.getByRole('button',{name:'重新登入學校帳號'}).click();
    const credential = 'header.'+Buffer.from(JSON.stringify({email:'test@st.tc.edu.tw',name:'測試學生',exp:Math.floor(Date.now()/1000)+3600})).toString('base64url')+'.test';
    await page.evaluate(credential=>handleGoogleAuthCallback({credential}),credential);
    await page.getByRole('button',{name:'確認資料並重試上傳'}).click();
    await page.waitForFunction(()=>document.getElementById('certCloudSyncPill').classList.contains('success'));
    assert.equal(await page.evaluate(()=>gameState.score),125);
    assert.equal(await page.evaluate(()=>gameState.challenge.completed),true);
    await page.getByRole('button',{name:'重試上傳',exact:true}).click();
    await page.waitForFunction(()=>!scoreUploadInFlight);
    assert.equal(receipts.length,2);assert.equal(receipts[0],receipts[1]);
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    assert.deepEqual(errors,[]);
    console.log('PASS score UI: guest guard, re-login, completion preserved, confirmed response and stable retry receipt');
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
