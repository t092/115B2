const {chromium}=require('playwright'),assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs');
const {pathToFileURL}=require('node:url');
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'msedge'}),page=await browser.newPage({viewport:{width:1440,height:1150}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 const shot=n=>page.screenshot({path:path.join(__dirname,n+'.png'),fullPage:true});
 const start=async s=>{if(s)await page.evaluate(s=>silkTest.setState(s),s);await page.locator('#dialogOK').click();};
 const click=async key=>page.locator(`[data-unit="${key}"]`).click();
 const direction=async right=>{assert.equal(await page.evaluate(()=>silkTest.forward()),right);const origin=await page.locator('#originLabel').boundingBox(),dest=await page.locator('#destinationLabel').boundingBox();assert.equal(origin.x<dest.x,right);await click('sand');const before=await page.evaluate(()=>silkTest.screenX(silkTest.get().battle.units.at(-1).x));await page.evaluate(()=>silkTest.step(.3));const after=await page.evaluate(()=>silkTest.screenX(silkTest.get().battle.units.at(-1).x));assert.equal(after>before,right);};

 try{
  await page.route('https://www.gstatic.com/**',r=>r.abort());await page.goto(pathToFileURL(path.resolve(__dirname,'../../index.html')).href+'?test');await page.locator('#guestPlay').click();await page.waitForFunction(()=>silkTest.get().imagesReady===8);await start();
  assert.equal(await page.locator('[data-unit="silk"]').isVisible(),true);assert.equal(await page.locator('[data-unit="imports"]').isVisible(),false);assert.equal(await page.locator('#prep').count(),0);assert.equal(await page.locator('aside').count(),0);
  await direction(true);assert.equal(await page.evaluate(()=>silkTest.get().battle.state.money),4920);assert.ok(await page.evaluate(()=>silkTest.get().battle.units[0].x>960));
  await page.evaluate(()=>silkTest.step(.7));await click('sand');assert.equal(await page.evaluate(()=>silkTest.get().battle.units.length),2);assert.ok(await page.evaluate(()=>silkTest.get().battle.units.at(-1).x>980));
  await click('wind');await page.evaluate(()=>silkTest.step(12));await click('silk');assert.equal(await page.evaluate(()=>silkTest.get().battle.units.at(-1).key),'silk');
  await page.locator('#pauseBtn').click();const time=await page.evaluate(()=>silkTest.get().battle.time);await page.waitForTimeout(150);assert.equal(await page.evaluate(()=>silkTest.get().battle.time),time);assert.equal(await page.locator('[data-unit="silk"]').isDisabled(),true);await shot('desktop-battle');await page.locator('#pauseBtn').click();
  await page.evaluate(()=>silkTest.step(60));assert.equal(await page.locator('#dialog').evaluate(e=>e.open),true);assert.match(await page.locator('#dialogTag').textContent(),/40 秒/);assert.ok(await page.evaluate(()=>silkTest.get().battle.deliveries.length>0));await shot('settlement');
  const balance=await page.evaluate(()=>silkTest.get().battle.state.money);await page.locator('#dialogOK').click();await start();assert.equal(await page.evaluate(()=>silkTest.get().battle.state.money),balance);assert.equal(await page.locator('[data-unit="silk"]').isVisible(),false);assert.equal(await page.locator('[data-unit="imports"]').isVisible(),true);
  await direction(true);await click('imports');assert.equal(await page.evaluate(()=>silkTest.get().battle.units.at(-1).key),'imports');
  await start({chapter:2,money:1000});await direction(false);
  await start({chapter:3,money:1000,baseline:1000,leg:'out'});await direction(true);await page.evaluate(()=>silkTest.step(61));assert.equal(await page.locator('#dialog').evaluate(e=>e.open),false);assert.ok(Number(await page.locator('#timer').textContent())<=119);await page.evaluate(()=>silkTest.step(180));assert.match(await page.locator('#dialogTitle').textContent(),/3 分鐘到/);assert.equal(await page.evaluate(()=>silkTest.get().battle.state.ended),true);
  await start({chapter:3,money:1000,baseline:1000,leg:'back'});assert.equal(await page.locator('[data-unit="silk"]').isVisible(),false);assert.match(await page.locator('#originLabel').textContent(),/大秦/);
  await direction(false);await page.locator('#pauseBtn').click();await shot('imports-market');
  await page.setViewportSize({width:390,height:844});await shot('mobile');assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  // Mobile single click buys exactly once; battlefield does not deploy.
  await page.locator('#pauseBtn').click();await page.locator('[data-unit="imports"]').click();const count=await page.evaluate(()=>silkTest.get().battle.units.length);await page.locator('#world').click({position:{x:40,y:150}});assert.equal(await page.evaluate(()=>silkTest.get().battle.units.length),count);assert.equal(await page.evaluate(()=>silkTest.get().battle.units.at(-1).key),'imports');
  await page.setViewportSize({width:320,height:720});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.reload();await page.locator('#guestPlay').click();await page.waitForFunction(()=>silkTest.get().imagesReady===8);assert.match(await page.locator('#originLabel').textContent(),/大秦/);
  assert.deepEqual(errors,[]);const result={passed:true,checks:['eight sprite sheets including enemies and archer loaded from local files','no preparation sidebar','origin-specific visible cards','single click purchase','Chang’an departures move right, returns move left','battlefield click does not purchase','pause freezes clock','40-second first chapter settlement and carried balance','chapter four 180-second final settlement','mobile 390 and 320 widths','mobile single-tap purchase','saved city reload'],errors};fs.writeFileSync(path.join(__dirname,'browser-results.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
