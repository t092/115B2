/* Shared grid state: the 3D scene and radar always use these same positions. */
window.MazeAdventure = (() => {
  const guardians = [
    {id:2, name:'西周守門衛士', color:'#5ee0b4', route:[[3,3],[3,2],[3,1],[2,1],[1,1]], step:0, direction:1},
    {id:3, name:'戰國竹簡賢士', color:'#e8be76', route:[[7,5],[7,6],[7,7],[8,7],[9,7]], step:0, direction:1},
    {id:4, name:'秦代持戟衛士', color:'#ed9282', route:[[11,7],[11,8],[12,8],[13,8],[13,7]], step:0, direction:1}
  ];
  let frame=0, last=0, patrol=0, lastMove=0, completed=false, view=null, facing=0;
  let initialized=false, loadStarted=false, lastTarget=null, sceneTime=0;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  const el=id=>document.getElementById(id);
  const active=()=>initialized && gameState.challenge.currentStage===2 && el('tab-challenge').classList.contains('active') && !document.hidden;
  const modalOpen=()=>!!document.querySelector('.game-modal.show');
  const near=g=>Math.abs(playerPos.x-g.x)+Math.abs(playerPos.y-g.y)<=1;
  const target=()=>guardians.find(g=>!mazeGates[g.id].unlocked && near(g));
  const state=()=>({map:mazeMap, player:{...playerPos,facing}, guardians:guardians.map(g=>({...g,solved:mazeGates[g.id].unlocked})), unlocked:mazeGatesUnlockedCount, reduced});
  function canInteract(id) {return active() && !completed && !modalOpen() && guardians.some(g=>g.id===id && !mazeGates[id].unlocked && near(g));}
  function interact() {
    if (!active() || completed || modalOpen()) return;
    if(playerPos.x===13 && playerPos.y===9) {
      if(mazeGatesUnlockedCount<3) {el('mazeMessage').textContent='玉璽仍被封印，請先完成三位守護者的考驗。';return;}
      completed=true;
      addPoints(30,2,'咸陽宮玉璽探險家'); sounds.fanfare();
      el('mazeMessage').textContent='已取得玉璽！即將前往天命仕途轉盤。';
      el('mazeInteract').disabled=true;
      setTimeout(()=>{goToStage(3);refresh();},1400);
    }
  }
  function updateUI() {
    const g=target();
    const onSeal=playerPos.x===13 && playerPos.y===9;
    el('mazeInteract').hidden=!onSeal;
    el('mazeInteract').disabled=completed || !onSeal || mazeGatesUnlockedCount<3;
    el('mazeInteract').textContent=mazeGatesUnlockedCount===3 ? '領取玉璽' : '玉璽尚未解鎖';
    const key=g?g.id:onSeal?'seal':null;
    if(!completed && key!==lastTarget) el('mazeMessage').textContent=g?'已找到'+g.name+'，碰觸後自動開始歷史考驗。':onSeal?'玉璽就在眼前，完成三道考驗後即可領取。':'循著雷達，尋找三位歷史守護者。';
    lastTarget=key;
    guardians.forEach(g=>{
      const row=document.querySelector('[data-guardian="'+g.id+'"]');
      row.classList.toggle('is-solved',mazeGates[g.id].unlocked);
      row.querySelector('span').textContent=mazeGates[g.id].unlocked?'已解除封印':near(g)?'已接觸':'巡邏中';
    });
    el('mazeSealStatus').textContent=mazeGatesUnlockedCount===3?'玉璽已解鎖 · 前往 ◆ 領取':'玉璽封印中 · 尚待 '+(3-mazeGatesUnlockedCount)+' 道考驗';
  }
  function checkEncounter() {
    if(!active() || completed || modalOpen()) return;
    const guardian=target();
    if(guardian) triggerMazeGate(guardian.id);
  }
  function drawMap(canvas, full=false) {
    const c=canvas.getContext('2d'), w=canvas.width/15,h=canvas.height/11;
    c.clearRect(0,0,canvas.width,canvas.height);
    mazeMap.forEach((row,y)=>row.forEach((v,x)=>{
      c.fillStyle=v===1?'#47514e':'#172d2b';c.fillRect(x*w,y*h,w,h);
      if(v===1){c.fillStyle='#65716a';c.fillRect(x*w,y*h,w-1,full?4:1);}
    }));
    c.save();c.translate(13.5*w,9.5*h);c.rotate(Math.PI/4);c.fillStyle=mazeGatesUnlockedCount===3?'#9bf1ce':'#9f8b62';c.fillRect(-w*.25,-h*.25,w*.5,h*.5);c.restore();
    guardians.forEach((g,i)=>{if(mazeGates[g.id].unlocked && !full)return;
      const x=(g.x+.5)*w,y=(g.y+.5)*h;c.fillStyle=mazeGates[g.id].unlocked?'#70867a':g.color;
      if(full){c.fillRect(x-w*.2,y-h*.05,w*.4,h*.42);c.beginPath();c.arc(x,y-h*.23,w*.16,0,Math.PI*2);c.fill();}
      else {c.beginPath();c.arc(x,y,w*.33,0,Math.PI*2);c.fill();c.fillStyle='#102523';c.font='bold '+Math.round(w*.46)+'px sans-serif';c.textAlign='center';c.textBaseline='middle';c.fillText(i+1,x,y);}
    });
    c.save();c.translate((playerPos.x+.5)*w,(playerPos.y+.5)*h);
    if(full){c.fillStyle='#e89955';c.beginPath();c.moveTo(0,-h*.12);c.lineTo(-w*.25,h*.36);c.lineTo(w*.25,h*.36);c.fill();c.fillStyle='#f8d3a1';c.beginPath();c.arc(0,-h*.22,w*.18,0,Math.PI*2);c.fill();}
    else {c.rotate(facing);c.fillStyle='#fff9e8';c.beginPath();c.moveTo(0,-h*.35);c.lineTo(w*.27,h*.25);c.lineTo(0,h*.12);c.lineTo(-w*.27,h*.25);c.closePath();c.fill();}
    c.restore();
  }
  function render(dt=0,time=0) {drawMap(el('mazeRadar')); if(view)view.render(state(),dt,time);else drawMap(el('mazeCanvas'),true);}
  function tick(now) {
    frame=0;if(!active()) {last=0;return;}
    const dt=last?Math.min((now-last)/1000,.06):0;last=now;
    if(!modalOpen()&&!completed) {
      patrol+=dt;
      if(patrol>1.1){patrol=0;guardians.forEach(g=>{
        if(mazeGates[g.id].unlocked || near(g))return;
        let n=g.step+g.direction;if(n<0||n>=g.route.length){g.direction*=-1;n=g.step+g.direction;}
        const [x,y]=g.route[n];if(x===playerPos.x&&y===playerPos.y)return;
        g.facing=Math.atan2(x-g.x,y-g.y);g.step=n;g.x=x;g.y=y;
      });}
    }
    checkEncounter();
    const sceneDelta=modalOpen()?0:dt;sceneTime+=sceneDelta;
    updateUI();render(sceneDelta,sceneTime);frame=requestAnimationFrame(tick);
  }
  function refresh(){if(!initialized)return;updateUI();if(active()){if(!frame)frame=requestAnimationFrame(tick);}else{cancelAnimationFrame(frame);frame=0;last=0;}}
  function move(dx,dy) {
    if(!active()||modalOpen()||completed||Math.abs(dx)+Math.abs(dy)!==1)return;
    const now=performance.now();if(now-lastMove<165)return;lastMove=now;
    facing=Math.atan2(dx,-dy);
    const x=playerPos.x+dx,y=playerPos.y+dy;
    if(!mazeMap[y]||mazeMap[y][x]===undefined||mazeMap[y][x]===1)return;
    if(guardians.some(g=>!mazeGates[g.id].unlocked&&g.x===x&&g.y===y)){updateUI();checkEncounter();return;}
    playerPos={x,y};updateUI();checkEncounter();
  }
  function loadView(){
    if(loadStarted)return;loadStarted=true;
    try {
      if(!window.MazeScene) throw new Error('MAZE_BUNDLE_MISSING');
      view=window.MazeScene.createMazeScene(el('mazeScene'),state());
      el('mazeCanvas').hidden=true;
      el('mazeRenderMode').textContent='3D 探索';
      el('mazeRenderNotice').hidden=true;
      refresh();
    } catch(error) {
      console.warn('3D unavailable; using 2D maze',error);
      el('mazeRenderMode').textContent='2D 探索 · 相容模式';
      el('mazeRenderNotice').hidden=false;
      el('mazeRenderNotice').textContent=error.message==='MAZE_BUNDLE_MISSING'
        ? '3D 場景檔案未載入。請確認 maze-scene.bundle.js 與 index.html 放在同一資料夾；目前以 2D 模式繼續遊戲。'
        : '3D 場景未能啟動，可能與瀏覽器的 WebGL 或圖形加速支援有關。請嘗試啟用圖形加速或使用其他瀏覽器；目前以 2D 模式繼續遊戲。';
    }
  }
  function init(){guardians.forEach(g=>{g.step=0;g.direction=1;[g.x,g.y]=g.route[0];g.facing=0;});completed=false;patrol=0;initialized=true;updateUI();render();loadView();}
  function solved(id){if(view)view.celebrate(id);updateUI();drawMap(el('mazeRadar'));}
  el('mazeInteract').addEventListener('click',interact);
  window.addEventListener('keydown',e=>{
    if(!active()||modalOpen()||e.target.closest('input,textarea,select,[contenteditable="true"]'))return;
    const keys={ArrowUp:[0,-1],KeyW:[0,-1],ArrowDown:[0,1],KeyS:[0,1],ArrowLeft:[-1,0],KeyA:[-1,0],ArrowRight:[1,0],KeyD:[1,0]};
    if(keys[e.code]){e.preventDefault();move(...keys[e.code]);}
    if(e.code==='Space' && !e.target.closest('button')){e.preventDefault();interact();}
  });
  document.addEventListener('visibilitychange',refresh);
  return {init,refresh,move,canInteract,solved};
})();
