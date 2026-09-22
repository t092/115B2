const {chromium} = require('../../G2B3/tests/playwright.cjs');
const assert = require('node:assert/strict');
const path = require('node:path');
const {pathToFileURL} = require('node:url');
const fs = require('node:fs');
const out = path.resolve(__dirname,'../../test-results/dynasty-touch');
fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try {
  for(const [width,height] of [[390,844],[844,390],[820,1180],[1180,820]]) {
   const context=await browser.newContext({viewport:{width,height},hasTouch:true,isMobile:true});
   const page=await context.newPage(),errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   await page.route('https://**/*',r=>r.abort());
   await page.addInitScript(()=>{
    sessionStorage.setItem('L2B1A_DYNA_STUDENT_V2',JSON.stringify({name:'觸控測試',classId:'201',seatNo:'1',isGuest:false}));
    sessionStorage.setItem('CAI_HIDDEN_LEVEL_UNLOCK','1');
   });
   const open=name=>page.goto(pathToFileURL(path.resolve(__dirname,'..',name)).href);
   await open('dynasty-push-game.html');
   await page.evaluate(()=>{
    document.getElementById('modal').classList.add('hidden');
    blocks=[{name:'漢',cls:'block-a',r:6,c:2,tr:1,tc:3}]; player={r:5,c:5}; won=false; render();
   });
   for(const label of ['向上','向右','向下','向左']) {
    const button=page.getByRole('button',{name:label,exact:true});
    const rect=await button.boundingBox();
    assert.ok(rect && rect.y>=0 && rect.y+rect.height<=height,`visible control ${width} ${label}`);
    await button.tap();
   }
   assert.deepEqual(await page.evaluate(()=>[player.r,player.c,moves]),[5,5,4]);
   await page.evaluate(()=>{
    blocks=[{name:'漢',cls:'block-a',r:5,c:6,tr:5,tc:8}]; render();
   });
   await page.getByRole('button',{name:'向右',exact:true}).tap();
   assert.deepEqual(await page.evaluate(()=>[player.c,blocks[0].c]),[6,7]);
   await page.evaluate(()=>{startLevel(5);document.getElementById('modal').classList.add('hidden');});
   assert.equal(await page.evaluate(()=>{
    const a=document.querySelector('.player').getBoundingClientRect(),b=document.querySelector('.board-viewport').getBoundingClientRect();
    const controls=document.querySelector('.touch-controls').getBoundingClientRect();
    return a.left>=b.left && a.right<=b.right && a.top>=b.top && a.bottom<=b.bottom && a.bottom<=controls.top;
   }),true,'player visible in scrollable final board');
   await page.screenshot({path:path.join(out,`main-${width}.png`)});
   await open('dynasty-sequence-game.html');
   await page.locator('#startButton').tap();
   await page.evaluate(()=>{clearInterval(timer);timer=null;tiles=Array(64).fill(0);tiles[1]=4;selected=null;render();});
   await page.locator('.tile[data-index="0"]').tap();
   assert.equal(await page.evaluate(()=>selected),0,'tap selects once');
   await page.locator('.tile[data-index="1"]').tap();
   assert.deepEqual(await page.evaluate(()=>tiles.slice(0,2)),[4,0],'second adjacent tap swaps once');
   const cdp=await context.newCDPSession(page);
   async function gesture(index,dx,dy,cancel=false){
    const tile=page.locator(`.tile[data-index="${index}"]`);
    await tile.scrollIntoViewIfNeeded();
    const r=await tile.boundingBox(),x=r.x+r.width/2,y=r.y+r.height/2;
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});
    await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+dx,y:y+dy}]});
    await cdp.send('Input.dispatchTouchEvent',{type:cancel?'touchCancel':'touchEnd',touchPoints:[]});
   }
   await gesture(0,16,0);
   assert.deepEqual(await page.evaluate(()=>tiles.slice(0,2)),[0,4],'short swipe swaps one neighbor');
   await page.evaluate(()=>{tiles[8]=6;render();});
   await gesture(0,0,16);
   assert.deepEqual(await page.evaluate(()=>[tiles[0],tiles[8]]),[6,0],'vertical swipe');
   await gesture(0,16,0,true);
   assert.equal(await page.evaluate(()=>pointerStart),null,'cancel clears gesture');
   assert.deepEqual(await page.evaluate(()=>tiles.slice(0,2)),[6,4],'cancel does not swap');
   await page.locator('.tile[data-index="0"]').tap();
   assert.equal(await page.evaluate(()=>selected),0,'tap works after cancel');
   await page.locator('.tile[data-index="0"]').tap();
   assert.equal(await page.evaluate(()=>selected),null,'second tap deselects');
   await page.screenshot({path:path.join(out,`hidden-${width}.png`)});
   assert.deepEqual(errors,[]);
   console.log(`PASS touch ${width}x${height}: four directions, push, visible player, taps, short/vertical swipe, cancellation.`);
   await context.close();
  }
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
