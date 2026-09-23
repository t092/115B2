const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url');
const path=require('node:path'),fs=require('node:fs');
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 const page=await browser.newPage({viewport:{width:1440,height:1100}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.goto(pathToFileURL(path.resolve(__dirname,'../index.html')).href+'?test');await page.locator('#dialogOK').click();
  const checks=await page.evaluate(()=>{
   const checks=[],t=window.silkTest;
   const check=(v,s)=>{if(!v)throw Error(s);checks.push(s);};
   const close=(n,m)=>Math.abs(n-m)<1e-6;
   const member=(type='camel',gear={},load=0)=>({type,gear,good:'silk',load,guardTarget:null});
   const reset=(f,chapter=0)=>{if(document.querySelector('#dialog').open)document.querySelector('#dialog').close();t.setState({chapter,money:600,leg:'out',baseline:null,round:1,won:false});t.setFleet([...f,member('horse',{},1)]);t.launch();return t.get().units;};
   let a=reset([member('camel'),member('horse'),member('camel',{archer:true}),member('horse',{archer:true})]);
   check(JSON.stringify(a.map(x=>x.hp))==='[100,60,600,560,60]','base HP 100/60; shield HP 600/560');
   a[0].hp=37;t.equip(0,'archer');check(a[0].hp===537&&a[0].maxHp===600,'shield adds 500 to current and maximum HP');t.equip(0,'archer');check(a[0].hp===537,'repeat shield cannot stack or heal');
   t.equip(4,'sand');check(!a[4].gear.sand&&a[4].load===1,'loaded animal cannot equip or silently lose cargo');
   t.setState({chapter:0,money:600});t.setFleet([member('horse',{sand:true},1)]);t.launch();check(t.get().phase==='prep'&&t.get().state.money===600,'invalid mixed gear and cargo rejected at launch');
   a=reset([member('camel',{sand:true})]);t.equip(0,'wind');t.equip(0,'archer');check(Object.keys(a[0].gear).length===1&&a[0].hp===100,'camel rejects second equipment and shield bonus');t.setState({chapter:0,money:600});t.setFleet([member('camel',{sand:true,wind:true}),member('horse',{},1)]);t.launch();check(t.get().phase==='prep','invalid multi-equipment camel cannot launch');
   for(const [kind,x,dps] of [['sand',480,2],['wind',790,5]]){
    a=reset([member('camel',{[kind]:true}),member('horse')]);a[0].x=x;a[0].stopped=true;a[1].x=x-25;
    t.step(1);check(close(a[0].hp,100-dps),kind+' stopped defender takes exact per-second damage');check(a[1].alive&&a[1].hp===60,kind+' stopped camel protects moving companion without damage');
    t.step(1);check(close(a[0].hp,100-2*dps),kind+' damage repeats while stationary');
    a=reset([member('camel',{[kind]:true}),member('horse')]);a[0].x=x;a[0].stopped=true;a[0].hp=.01;a[1].x=x;
    t.step(.02);check(!a[0].alive&&!a[1].alive,kind+' defender death removes protection within the same tick');check(!Object.keys(a[0].gear).length&&a[0].load===0&&a[0].hp===0,kind+' death destroys equipment and cargo');
    a=reset([member('camel',{[kind]:true}),member('horse')]);a[0].x=x;a[0].stopped=true;a[1].x=x;t.toggleAnimal(0);t.step(.02);check(!a[1].alive,kind+' moving camel does not provide a safe crossing');
    a=reset([member('horse',{[kind]:true}),member('horse')]);a[0].x=x;a[1].x=x;t.toggleAnimal(0);t.step(.02);check(!a[0].stopped&&!a[1].alive,kind+' horse cannot stop to protect others');
    a=reset([member('camel'),member('horse')]);a[0].x=x;a[0].stopped=true;a[1].x=x;t.step(.02);check(!a[0].alive&&!a[1].alive,kind+' unprotected contact is instant death for both species');
    a=reset([member('camel',{archer:true})]);a[0].x=x;t.step(.02);check(!a[0].alive,kind+' shield HP does not replace matching trap equipment');
    a=reset([member('camel',{[kind]:true})]);a[0].x=x;a[0].stopped=true;document.querySelector('#pauseBtn').click();t.step(10);check(a[0].hp===100,kind+' global pause stops damage');document.querySelector('#pauseBtn').click();
   }
   // Fractional frame sizes produce the same standing damage.
   a=reset([member('camel',{wind:true})]);a[0].x=790;a[0].stopped=true;t.step(2);const once=a[0].hp;
   a=reset([member('camel',{wind:true})]);a[0].x=790;a[0].stopped=true;for(let i=0;i<200;i++)t.step(.01);check(close(a[0].hp,once),'damage independent of frame size');
   // First chapter sand is at 480; commands stop at its center without overshoot.
   a=reset([member('camel',{sand:true})]);a[0].x=478;a[0].guardTarget=0;t.step(.1);check(a[0].x===480&&a[0].stopped&&a[0].hp<100,'ordered camel stops on trap and takes damage');
   // Moving horse equipping remains moving; stopped camel equipping remains stopped.
   a=reset([member('horse'),member('camel')]);a[1].stopped=true;const x0=a[0].x,x1=a[1].x;t.equip(0,'sand');t.equip(1,'wind');t.step(.1);check(a[0].x>x0&&!a[0].stopped&&a[1].x===x1&&a[1].stopped,'equipping preserves horse motion and camel stop state');
   // Archer 1 at x780 is stationary with a 260-unit range.
   a=reset([member('camel',{archer:true}),member('camel')],1);a[0].x=850;a[0].stopped=true;a[1].x=780;a[1].stopped=true;
   const archer=t.get().hazards.find(h=>h.type==='archer'),origin=archer.x;t.step(.02);check(a[0].hp===590&&a[1].hp===100,'archer prefers farther in-range shield over nearer unshielded target');
   t.step(.5);check(a[0].hp===590,'archer respects one-second fire cooldown');t.step(.5);check(a[0].hp===580,'archer second arrow deals exactly 10');check(archer.x===origin,'archer never moves');
   a[0].hp=10;t.step(1);check(!a[0].alive&&!Object.keys(a[0].gear).length,'shield carrier death removes shield');t.step(1);check(a[1].hp===90,'archer retargets a living unshielded animal after shield death');
   a=reset([member('camel',{archer:true}),member('camel')],1);a[0].x=150;a[0].stopped=true;a[1].x=780;a[1].stopped=true;t.step(.02);check(a[0].hp===600&&a[1].hp===90,'out-of-range shield cannot draw aggro');
   a=reset([member('camel',{archer:true})],1);a[0].x=900;a[0].stopped=true;document.querySelector('#dispatchBtn').click();check(a[1].waiting===false,'merchant waits at origin until explicit dispatch');
   return checks;
  });
  // UI locks are not merely a text promise.
  await page.evaluate(()=>silkTest.setState({chapter:0,money:600}));
  assert.equal(await page.locator('[data-prep-equip="sand"]').first().isDisabled(),true);
  assert.equal(await page.getByLabel('夥伴 1 載貨量',{exact:true}).isDisabled(),true);
  await page.locator('#addBtn').click();
  const n=await page.locator('.fleet-row').count();
  await page.locator(`[data-prep-equip="archer"][data-i="${n-1}"]`).click();
  assert.equal(await page.getByLabel(`夥伴 ${n} 載貨量`,{exact:true}).isDisabled(),true);
  assert.equal(await page.locator(`[data-prep-equip="archer"][data-i="${n-1}"]`).isDisabled(),true);
  await page.screenshot({path:path.join(__dirname,'combat-desktop.png'),fullPage:true});
  await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.join(__dirname,'combat-mobile.png'),fullPage:true});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  assert.deepEqual(errors,[]);
  const report={passed:true,checks:[...checks,'equipment UI permanently locks cargo and equipped buttons','mobile layout'],errors};
  fs.writeFileSync(path.join(__dirname,'combat-results.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
