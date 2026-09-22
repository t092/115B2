const {chromium}=require('../../G2B3/tests/playwright.cjs'),assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url');
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{
 const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('https://**/*',r=>r.abort());
 await page.goto(pathToFileURL(path.resolve(__dirname,'../index.html')).href,{waitUntil:'domcontentloaded'});
 await page.locator('#guestBtn').waitFor({state:'visible'});
 assert.match(await page.locator('#guestBtn').textContent(),/純體驗.*不記錄成績/);
 await page.locator('#guestBtn').click();
 assert.equal(await page.evaluate(()=>CAI.getStudent().isGuest),true);
 await page.locator('#startBtn').click();
 await page.waitForURL('**/dynasty-push-game.html');
 assert.equal(await page.evaluate(()=>CAI.getStudent().isGuest),true);
 assert.deepEqual(errors,[]);
 console.log('PASS dynasty entry: guest session persists into the Firebase-era game entry');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
