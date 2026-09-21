const playwright = require('./playwright.cjs');
const {chromium}=playwright;
const assert=require('node:assert/strict');
const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const root=path.resolve(__dirname,'..');
const output=path.resolve(root,'../test-results');fs.mkdirSync(output,{recursive:true});
const server=http.createServer((req,res)=>{
  const file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname==='/'?'/index.html':new URL(req.url,'http://localhost').pathname));
  if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
  fs.readFile(file,(error,data)=>{if(error){res.writeHead(404).end();return;}
    res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css'})[path.extname(file)]||'application/octet-stream');res.end(data);
  });
});
(async()=>{
 let browser;
 try {
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const url='http://127.0.0.1:'+server.address().port;
  browser=await chromium.launch({headless:true,channel:'msedge',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const context=await browser.newContext({viewport:{width:1440,height:1100}});
  await context.route('https://fonts.googleapis.com/**',r=>r.abort());
  await context.route('https://fonts.gstatic.com/**',r=>r.abort());
  const page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  const start=async p=>{
    await p.waitForFunction(()=>document.getElementById('mazeRenderMode').textContent==='3D 探索');
    await p.evaluate(()=>{sounds.enabled=false;goToUnit('tab-challenge');goToStage(2);});
    await p.waitForTimeout(250);
  };
  await page.goto(url,{waitUntil:'domcontentloaded'});await start(page);
  await page.locator('#stageMaze').screenshot({path:path.join(output,'maze-desktop.png')});
  assert.equal(await page.locator('#mazeScene canvas').count(),2);
  assert.equal(await page.locator('#mazeInteract').isVisible(),false);
  // No dialogue button or spacebar: movement alone must open the first question.
  for(const key of ['ArrowRight','ArrowRight','ArrowDown']){await page.keyboard.press(key);await page.waitForTimeout(190);}
  await page.waitForFunction(()=>document.getElementById('mazeModal').classList.contains('show'));
  const before=await page.evaluate(()=>JSON.stringify(playerPos));
  await page.keyboard.press('ArrowDown');
  assert.equal(await page.evaluate(()=>JSON.stringify(playerPos)),before);
  await page.locator('#mazeOptions button').nth(0).click();
  assert.equal(await page.evaluate(()=>mazeGatesUnlockedCount),0);
  await page.locator('#mazeOptions button').nth(1).click();
  assert.equal(await page.evaluate(()=>mazeGatesUnlockedCount),1);
  assert.equal(await page.evaluate(()=>gameState.score),20);
  await page.evaluate(()=>document.querySelectorAll('#mazeOptions button')[1].click());
  assert.equal(await page.evaluate(()=>gameState.score),20);
  const hasFirstMarker=await page.evaluate(()=>{
    const c=document.getElementById('mazeRadar'),d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;
    for(let i=0;i<d.length;i+=4)if(d[i]===94&&d[i+1]===224&&d[i+2]===180)return true;
    return false;
  });assert.equal(hasFirstMarker,false);
  await page.waitForTimeout(1000);
  assert.equal(await page.locator('#mazeModal').evaluate(e=>e.classList.contains('show')),false);
  // Place player near each remaining guardian; the next frame must open its question automatically.
  for(const id of [3,4]){
    await page.evaluate(id=>{
      const spots=id===3?[[7,5],[7,6],[7,7],[8,7],[9,7]]:[[11,7],[11,8],[12,8],[13,8],[13,7]];
      for(const [x,y]of spots){playerPos={x,y};if(MazeAdventure.canInteract(id))break;}
      MazeAdventure.refresh();
    },id);
    await page.waitForFunction(()=>document.getElementById('mazeModal').classList.contains('show'));
    await page.locator('#mazeOptions button').nth(id===3?0:1).click();await page.waitForTimeout(1000);
  }
  assert.equal(await page.evaluate(()=>mazeGatesUnlockedCount),3);
  assert.equal(await page.evaluate(()=>gameState.score),60);
  await page.setViewportSize({width:390,height:844});await page.waitForTimeout(250);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.locator('#stageMaze').screenshot({path:path.join(output,'maze-mobile.png')});
  await page.evaluate(()=>{playerPos={x:13,y:9};MazeAdventure.refresh();});
  await page.locator('#mazeInteract').click();
  await page.evaluate(()=>document.getElementById('mazeInteract').click());
  assert.equal(await page.evaluate(()=>gameState.score),90);
  await page.waitForTimeout(1500);assert.equal(await page.evaluate(()=>gameState.challenge.currentStage),3);
  assert.deepEqual(errors,[]);console.log('PASS HTTP: automatic encounters, answer lock, single scoring, radar removal, mobile, jade, progression');

  const local=await context.newPage(),localErrors=[];local.on('pageerror',e=>localErrors.push(e.message));
  await local.goto(pathToFileURL(path.join(root,'index.html')).href,{waitUntil:'domcontentloaded'});await start(local);
  await local.locator('#stageMaze').screenshot({path:path.join(output,'maze-local-file.png')});
  assert.equal(await local.locator('#mazeRenderNotice').isVisible(),false);
  // Let the first guardian approach the stationary player: patrol contact also triggers automatically.
  await local.waitForFunction(()=>document.getElementById('mazeModal').classList.contains('show'),{},{timeout:15000});
  const radar=()=>local.evaluate(()=>document.getElementById('mazeRadar').toDataURL());
  const frozen=await radar();await local.waitForTimeout(1200);assert.equal(await radar(),frozen);
  await local.locator('#mazeOptions button').nth(1).click();await local.waitForTimeout(1000);
  await local.evaluate(()=>returnToHandout());
  const pos=await local.evaluate(()=>JSON.stringify(playerPos)),r=await radar();
  await local.keyboard.press('ArrowDown');await local.waitForTimeout(1200);
  assert.equal(await local.evaluate(()=>JSON.stringify(playerPos)),pos);assert.equal(await radar(),r);
  assert.deepEqual(localErrors,[]);console.log('PASS file://: real 3D, guardian-initiated encounter, dialog/stage pause');

  const fallback=await context.newPage();await fallback.route('**/maze-scene.bundle.js',r=>r.abort());
  await fallback.goto(url,{waitUntil:'domcontentloaded'});
  await fallback.waitForFunction(()=>document.getElementById('mazeRenderMode').textContent.includes('相容模式'));
  assert.match(await fallback.locator('#mazeRenderNotice').textContent(),/檔案未載入/);
  await fallback.evaluate(()=>{sounds.enabled=false;goToUnit('tab-challenge');goToStage(2);});
  for(const key of ['ArrowRight','ArrowRight','ArrowDown']){await fallback.keyboard.press(key);await fallback.waitForTimeout(190);}
  await fallback.waitForFunction(()=>document.getElementById('mazeModal').classList.contains('show'));
  const noGPU=await context.newPage();
  await noGPU.addInitScript(()=>{const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){if(type==='webgl2'||type==='webgl')return null;return original.call(this,type,...args);};});
  await noGPU.goto(url,{waitUntil:'domcontentloaded'});
  await noGPU.waitForFunction(()=>document.getElementById('mazeRenderMode').textContent.includes('相容模式'));
  assert.match(await noGPU.locator('#mazeRenderNotice').textContent(),/WebGL/);
  console.log('PASS fallback: missing bundle / unavailable WebGL explain the cause; automatic encounters still work');
 } finally {if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(e=>{console.error(e);process.exitCode=1;});
