let playwright;try{playwright=require(process.env.PLAYWRIGHT_MODULE||'playwright')}catch{playwright=require('C:/Users/grifonxu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')}
const {chromium}=playwright,assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url');
(async()=>{const browser=await chromium.launch({headless:true,channel:'msedge',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});try{
 const context=await browser.newContext({viewport:{width:1440,height:1100},hasTouch:true});await context.route('https://fonts.googleapis.com/**',r=>r.abort());await context.route('https://fonts.gstatic.com/**',r=>r.abort());
 const errors=[];
 async function create(index){const p=await context.newPage();p.on('pageerror',e=>errors.push(e.message));await p.goto(pathToFileURL(path.resolve(__dirname,'../index.html')).href,{waitUntil:'domcontentloaded'});await p.evaluate(index=>{sounds.enabled=false;const random=Math.random;Math.random=()=>index/3+.01;DetectiveGame.init();Math.random=random;goToUnit('tab-challenge');goToStage(5);},index);return p;}
 async function drag(p,id,to){const card=p.locator('[data-evidence="'+id+'"]');await card.scrollIntoViewIfNeeded();const a=await card.boundingBox(),b=await p.locator('[data-verdict="'+to+'"] h5').boundingBox();await p.mouse.move(a.x+a.width/2,a.y+a.height/2);await p.mouse.down();await p.mouse.move(b.x+b.width/2,b.y+b.height/2,{steps:12});await p.mouse.up();}
 const page=await create(1);await page.locator('#stageDetective').screenshot({path:path.join(__dirname,'detective-before.png')});
 await drag(page,'0','true');assert.equal(await page.locator('[data-verdict="true"] [data-evidence="0"]').count(),1);
 await drag(page,'0','false');assert.equal(await page.locator('#errorsFoundCount').textContent(),'1');
 await drag(page,'1','true');assert.equal(await page.evaluate(()=>gameState.score),0);assert.equal(await page.evaluate(()=>gameState.challenge.completed),false);
 await drag(page,'2','false');assert.equal(await page.evaluate(()=>gameState.score),130);assert.equal(await page.evaluate(()=>gameState.challenge.completed),true);
 assert.equal(await page.locator('.verdict-correct').count(),3);assert.equal(await page.locator('#detectiveResults').isVisible(),true);assert.equal(await page.locator('#challengeCompleteModal').evaluate(e=>e.classList.contains('show')),false);
 await page.locator('#stageDetective').screenshot({path:path.join(__dirname,'detective-results.png')});
 await page.locator('#detectiveResults button').click();assert.equal(await page.locator('#challengeCompleteModal').evaluate(e=>e.classList.contains('show')),true);await page.evaluate(()=>completeAllChallenges());assert.equal(await page.evaluate(()=>gameState.score),130);await page.close();
 for(const index of [0,2]){const p=await create(index);for(let i=0;i<3;i++){await p.locator('[data-evidence="'+i+'"]').click();await p.locator('[data-verdict="'+(i===index)+'"] h5').click();}assert.equal(await p.locator('.verdict-correct').count(),3);assert.equal(await p.evaluate(()=>gameState.score),130);await p.close();}
 const mobile=await create(1);await mobile.setViewportSize({width:390,height:844});
 for(let i=0;i<3;i++){await mobile.locator('[data-evidence="'+i+'"]').tap();await mobile.locator('[data-verdict="'+(i!==1)+'"] h5').tap();}
 assert.equal(await mobile.locator('.verdict-wrong').count(),3);assert.equal(await mobile.evaluate(()=>gameState.score),50);assert.equal(await mobile.evaluate(()=>gameState.badges.has('火眼金睛歷史神探')),false);assert.ok(await mobile.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await mobile.locator('#stageDetective').screenshot({path:path.join(__dirname,'detective-mobile.png')});
 assert.deepEqual(errors,[]);console.log('PASS: three random truth branches, pointer dragging/reassignment, immediate grading, scoring once, explanation visibility, touch classification, mobile width, total completion.');
 }finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
