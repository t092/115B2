const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const path=require('node:path'),fs=require('node:fs');
const {pathToFileURL}=require('node:url');
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 const page=await browser.newPage({viewport:{width:1440,height:1100}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 const closeDialogs=async()=>{for(let n=0;n<3&&await page.locator('#dialog').evaluate(e=>e.open);n++)await page.locator('#dialogOK').click();};
 const runTrip=async()=>{
  await page.locator('#launchBtn').click();
  await page.locator('#dispatchBtn').click();
  const result=await page.evaluate(()=>{for(let i=0;i<4000&&silkTest.get().phase==='travel';i++){if(silkTest.get().units.some(a=>a.atStation))document.querySelector('#resumeBtn').click();silkTest.step(.05);}const g=silkTest.get();return {phase:g.phase,money:g.state.money,cargo:g.units.filter(a=>a.merchant).map(a=>({alive:a.alive,arrived:a.arrived,hp:a.hp,x:a.x})),chapter:g.state.chapter};});
  assert.equal(result.phase,'result',JSON.stringify(result));assert.ok(result.cargo.some(a=>a.alive),JSON.stringify(result));return result;
 };
 try{
  await page.goto(pathToFileURL(path.resolve(__dirname,'../index.html')).href+'?test');await closeDialogs();
  await page.screenshot({path:path.join(__dirname,'desktop.png'),fullPage:true});
  const first=await runTrip();assert.equal(first.money,670);assert.match(await page.locator('#dialogTitle').textContent(),/匈奴/);await page.screenshot({path:path.join(__dirname,'capture.png'),fullPage:true});await closeDialogs();
  assert.equal(await page.evaluate(()=>silkTest.get().state.chapter),1);
  await runTrip();await closeDialogs();assert.equal(await page.evaluate(()=>silkTest.get().state.chapter),2);
  await runTrip();await closeDialogs();assert.equal(await page.evaluate(()=>silkTest.get().state.chapter),3);
  let trips=0;
  while(!await page.evaluate(()=>silkTest.get().state.won)&&trips<40){
   // Fill at most three merchants using real UI. All defenders remain the default formation.
   const leg=await page.evaluate(()=>silkTest.get().state.leg),good=leg==='out'?'silk':'pipa';
   for(let n=0;n<2;n++)await page.locator('#addBtn').click();
   const budget=await page.evaluate(()=>silkTest.get().state.money),buy=good==='silk'?30:130;
   let available=Math.floor(budget/buy);
   const indices=await page.evaluate(()=>silkTest.get().fleet.flatMap((a,i)=>Object.values(a.gear||{}).some(Boolean)?[]:[i]));
   for(const i of indices){await page.locator(`[data-field="type"][data-i="${i}"]`).selectOption("camel");await page.locator(`[data-field="good"][data-i="${i}"]`).selectOption(good);await page.locator(`[data-field="load"][data-i="${i}"]`).fill(String(Math.min(1,available)));await page.locator(`[data-field="load"][data-i="${i}"]`).dispatchEvent('change');available=Math.max(0,available-1);}
   await runTrip();trips++;if(await page.evaluate(()=>silkTest.get().state.won))break;await closeDialogs();
  }
  assert.equal(await page.evaluate(()=>silkTest.get().state.won),true);
  assert.ok(await page.evaluate(()=>silkTest.get().state.money-silkTest.get().state.baseline>=10000));
  await page.screenshot({path:path.join(__dirname,'victory.png'),fullPage:true});
  await closeDialogs();await page.reload();await closeDialogs();assert.equal(await page.evaluate(()=>silkTest.get().state.chapter),3);
  // Retry after a real death restores the funds before purchasing cargo.
  await page.evaluate(()=>{silkTest.setState({chapter:1,money:600});silkTest.setFleet([{type:'horse',good:'silk',load:5,gear:{}}]);silkTest.launch();document.querySelector('#dispatchBtn').click();silkTest.step(10);});
  assert.match(await page.locator('#dialogTitle').textContent(),/陣亡/);await page.locator('#dialogOK').click();assert.equal(await page.evaluate(()=>silkTest.get().state.money),600);
  await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.join(__dirname,'mobile.png'),fullPage:true});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.deepEqual(errors,[]);
  const report={passed:true,fourthChapterLegs:trips,checks:['default stationed defenders protect all four routes','cargo bought and sold through real UI','archer shield formation survives merchant passage','capture settlement','net profit 10000','saved progress','death retry','mobile layout'],errors};
  fs.writeFileSync(path.join(__dirname,'results.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
