/* First-person maze. Rendering and portraits are original Canvas/vector artwork. */
const mage = { hp: 100, x: 1, y: 1, dir: 0, enemies: [], battle: null, ended: false, paid: false, timer: null };
const mageDirs = [[1,0],[0,1],[-1,0],[0,-1]];
const mageNames = ['玄鐵城衛','沙海妖狐','渡江幽魂'];
function magePortrait(kind) {
  const shapes = kind === 0
    ? '<path fill="#667d98" d="M25 155L30 77 60 58 90 77 95 155Z"/><path fill="#bccbdc" d="M35 28L60 14 85 28 82 70 38 70Z"/><path stroke="#ffb94d" stroke-width="7" d="M44 45h12m8 0h12"/><path fill="#344457" d="M17 79h25v50H17zm61 0h25v50H78z"/><path stroke="#cee7ff" stroke-width="6" d="M103 48v107"/>'
    : kind === 1
    ? '<path fill="#db774d" d="M30 89Q-15 27 22 34L56 106Q106 30 115 69L94 151H27Z"/><path fill="#ffcb8a" d="M29 26L53 40 87 22 82 73 59 94 35 73Z"/><path fill="#712c47" d="M33 31l15 17H37zm49-2L70 47h12z"/><path stroke="#59243d" stroke-width="5" d="M42 59l10 3m15 0l10-4"/><path fill="#633054" d="M44 90h31l14 62H29Z"/><circle fill="#ffd783" cx="60" cy="112" r="10"/>'
    : kind === 2
    ? '<path fill="#49cab9" d="M16 159Q38 109 29 69Q22 19 61 15Q103 22 91 75L111 151 81 137 63 160 48 139Z"/><path fill="#173958" d="M39 47Q60 21 81 47L75 82H45Z"/><path stroke="#c3fff4" stroke-width="7" d="M46 57h9m11 0h9"/><path fill="#b9fff0" d="M49 107l12-20 10 20-10 24Z"/>'
    : '<path fill="#7257ad" d="M24 156L32 101 85 101 101 156Z"/><path fill="#e6ba91" d="M39 61h43v43H39Z"/><path fill="#eee0c4" d="M40 89l21 39 21-39-21 12Z"/><path fill="#8168c4" d="M13 66L42 53 59 5 76 37 86 55 107 66Z"/><path fill="#eeb954" d="M57 28l7 8-9 1Z"/><path fill="#1e2945" d="M44 76h12v9H44zm23 0h12v9H67Z"/><path stroke="#bb8a58" stroke-width="7" d="M105 66v91"/><circle fill="#86eeff" cx="105" cy="60" r="12"/><path fill="#ed657d" d="M24 113h25v24H24Z"/><text x="27" y="130" fill="white" font-size="13">59</text>';
  return `<svg viewBox="0 0 120 170" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${shapes}</svg>`;
}
const mageSprites = [0,1,2].map(k => { const img = new Image(); img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(magePortrait(k)); img.onload = () => renderMaze(); return img; });
function initMazeGame() {
  clearInterval(mage.timer);
  Object.assign(mage,{hp:100,x:1,y:1,dir:0,battle:null,ended:false,paid:false});
  mage.enemies = Object.values(mazeGates).map((q,i) => ({...q,kind:i,solved:false}));
  const root = document.getElementById('mazeGrid');
  root.innerHTML = `<canvas id="mageView" width="800" height="480" aria-label="第一人稱古堡迷宮"></canvas><div class="mage-hud"><span>不及格大學士</span><strong id="mageHP"></strong><span id="mageHeading"></span></div><div class="mage-hands">${magePortrait(3)}<span>咒語筆記<br>「我記得……下一句是？」</span></div><div id="mageOverlay" hidden></div><div id="mageNotice" role="status" aria-live="polite"></div>`;
  mage.timer = setInterval(mageTick,1000);
  renderMaze();
}
function mageActive() {
  return gameState.challenge.currentStage === 2 && document.getElementById('tab-challenge').classList.contains('active') && !document.querySelector('.game-modal.show');
}
function mageWalkable(x,y) { return mazeMap[y]?.[x] === 0; }
// Breadth-first path distance respects walls, including around corners.
function magePath(from,to) {
  const queue = [{x:from.x,y:from.y,path:[]}], seen = new Set([`${from.x},${from.y}`]);
  while(queue.length) {
    const p = queue.shift(); if(p.x===to.x && p.y===to.y) return p.path;
    for(const [dx,dy] of mageDirs) { const x=p.x+dx,y=p.y+dy,key=`${x},${y}`;
      if(mageWalkable(x,y) && !seen.has(key)) {seen.add(key);queue.push({x,y,path:[...p.path,{x,y}]});}
    }
  } return null;
}
function mageTick() {
  if(!mageActive() || mage.battle || mage.ended) return;
  for(const e of mage.enemies.filter(e=>!e.solved)) {
    const path = magePath(e,mage);
    let next;
    if(path && path.length<=2) next=path[0];
    else { const choices=mageDirs.map(([dx,dy])=>({x:e.x+dx,y:e.y+dy})).filter(p=>mageWalkable(p.x,p.y)); next=choices[Math.floor(Math.random()*choices.length)]; }
    if(next && !mage.enemies.some(other=>other!==e&&!other.solved&&other.x===next.x&&other.y===next.y)) Object.assign(e,next);
    if(e.x===mage.x&&e.y===mage.y) {mageStartBattle(e);break;}
  } renderMaze();
}
function moveMazePlayer(dx,dy) {
  if(!mageActive() || mage.battle || mage.ended) return;
  if(dx) mage.dir=(mage.dir+dx+4)%4;
  else {const d=mageDirs[mage.dir], sign=dy<0?1:-1, x=mage.x+d[0]*sign,y=mage.y+d[1]*sign;
    if(mageWalkable(x,y)) {mage.x=x;mage.y=y;} else document.getElementById('mageNotice').textContent='前方是石牆，試著轉向。';
  }
  const enemy=mage.enemies.find(e=>!e.solved&&e.x===mage.x&&e.y===mage.y);
  if(enemy) mageStartBattle(enemy);
  renderMaze();
}
function renderMaze() {
  const canvas=document.getElementById('mageView'); if(!canvas) return;
  const ctx=canvas.getContext('2d'), w=canvas.width,h=canvas.height, angle=mage.dir*Math.PI/2, fov=Math.PI/3;
  const sky=ctx.createLinearGradient(0,0,0,h); sky.addColorStop(0,'#101525');sky.addColorStop(.5,'#303950');sky.addColorStop(.51,'#514350');sky.addColorStop(1,'#171827');ctx.fillStyle=sky;ctx.fillRect(0,0,w,h);
  const depth=[];
  for(let x=0;x<w;x+=2) {
    const ray=angle+Math.atan((2*x/w-1)*Math.tan(fov/2)); let dist=.01;
    while(dist<16 && mageWalkable(Math.floor(mage.x+.5+Math.cos(ray)*dist),Math.floor(mage.y+.5+Math.sin(ray)*dist))) dist+=.025;
    const z=dist*Math.cos(ray-angle);depth[x/2]=z;const height=Math.min(h*3,440/z), top=(h-height)/2;
    const hitX=mage.x+.5+Math.cos(ray)*dist,hitY=mage.y+.5+Math.sin(ray)*dist;
    const vertical=Math.abs(hitX-Math.round(hitX))<.04, u=(vertical?hitY:hitX)%1;
    const light=Math.max(18,57-z*7)+(vertical?0:6);
    ctx.fillStyle=`hsl(222,19%,${light}%)`;ctx.fillRect(x,top,2,height);
    ctx.fillStyle='rgba(10,15,27,.4)'; for(let row=0;row<5;row++) {ctx.fillRect(x,top+row*height/4,2,Math.max(1,height*.012));if((u+(row%2)*.5)%1<.035)ctx.fillRect(x,top+row*height/4,2,height/4);}
  }
  mage.enemies.filter(e=>!e.solved).map(e=>({...e,d:Math.hypot(e.x-mage.x,e.y-mage.y)})).sort((a,b)=>b.d-a.d).forEach(e=>{
    const dx=e.x-mage.x,dy=e.y-mage.y, forward=dx*Math.cos(angle)+dy*Math.sin(angle),side=-dx*Math.sin(angle)+dy*Math.cos(angle);
    if(forward<.15) return; const size=390/forward,cx=w/2+side/forward*w/(2*Math.tan(fov/2)), left=cx-size*.35;
    const img=mageSprites[e.kind]; if(!img.complete||!img.naturalWidth)return;
    for(let x=Math.max(0,Math.floor(left/2)*2);x<Math.min(w,left+size*.7);x+=2) if(forward<depth[x/2]+.05)ctx.drawImage(img,(x-left)/(size*.7)*120,0,2/(size*.7)*120,170,x,h/2-size*.38,2,size);
  });
  // Small navigational map accompanies the first-person scene.
  ctx.fillStyle='rgba(8,15,29,.8)';ctx.fillRect(12,64,116,132);
  mazeMap.forEach((row,y)=>row.forEach((v,x)=>{ctx.fillStyle=v?'#303b52':'#7a8597';ctx.fillRect(18+x*12,70+y*12,10,10);}));
  mage.enemies.filter(e=>!e.solved).forEach(e=>{ctx.fillStyle=['#f2b657','#ff9875','#63dfd1'][e.kind];ctx.fillRect(20+e.x*12,72+e.y*12,6,6);});
  ctx.save();ctx.translate(23+mage.x*12,75+mage.y*12);ctx.rotate(angle);ctx.fillStyle='#fff';ctx.beginPath();ctx.moveTo(5,0);ctx.lineTo(-4,-4);ctx.lineTo(-4,4);ctx.fill();ctx.restore();ctx.fillStyle='#dae5f5';ctx.font='11px sans-serif';ctx.fillText('白箭頭：你　彩點：敵人',17,190);
  document.getElementById('mageHP').textContent=`♥ ${mage.hp} / 100`;
  document.getElementById('mageHeading').textContent=['面向東','面向南','面向西','面向北'][mage.dir];
  const solved=mage.enemies.filter(e=>e.solved).length;
  document.getElementById('mazeGatesUnlocked').textContent=solved;
  mage.enemies.forEach(e=>document.querySelector(`#mazeTargets li[data-gate="${e.key}"]`)?.classList.toggle('done',e.solved));
  document.getElementById('mazeMessage').textContent=`生命 ${mage.hp}／100 · 已擊敗 ${solved}／3。探索途中可查看講義，敵人會暫停。`;
}
function mageStartBattle(enemy) {
  mage.battle=enemy;
  const overlay=document.getElementById('mageOverlay');overlay.hidden=false;
  overlay.innerHTML=`<div class="mage-battle-heading"><span>遭遇戰 · ${mageNames[enemy.kind]}</span><strong>補完咒語才能施法</strong></div><div class="mage-duel"><figure>${magePortrait(3)}<figcaption>不及格大學士<br>攻擊魔法專精 · 記憶力待補考</figcaption></figure><span>⚡</span><figure>${magePortrait(enemy.kind)}<figcaption>${mageNames[enemy.kind]}</figcaption></figure></div><p class="mage-spell">「史之力，聽我號令——」<br>${enemy.q}</p><div class="mage-answers"></div><p class="mage-feedback" role="status">選出正確的咒語片段！答對擊敗敵人；答錯敵人反擊，生命 −20。</p>`;
  enemy.options.forEach((opt,i)=>{const b=document.createElement('button');b.textContent=opt;b.onclick=()=>mageAnswer(i,b);overlay.querySelector('.mage-answers').appendChild(b);});
  overlay.querySelector('button').focus();
}
function mageAnswer(index,button) {
  const e=mage.battle;if(!e||mage.ended)return;
  const overlay=document.getElementById('mageOverlay'),fb=overlay.querySelector('.mage-feedback');
  if(index!==e.answer) {
    mage.hp=Math.max(0,mage.hp-20); sounds.wrong();button.disabled=true;
    fb.textContent=`咒語卡住了！${mageNames[e.kind]}反擊 −20。剩餘 ${mage.hp} 生命。提示：${e.hint}`;
    renderMaze();if(mage.hp===0)mageFinish(false);return;
  }
  e.solved=true;sounds.correct();mage.battle=null;
  overlay.innerHTML=`<div class="mage-result"><h3>✦ 咒語完成！</h3>${magePortrait(e.kind)}<p>${mageNames[e.kind]}已被擊敗。</p><p>${e.hint}</p><button class="primary-btn" id="mageContinue">繼續探索</button></div>`;
  // Keep exploration paused until feedback is dismissed.
  mage.battle={feedback:true};
  document.getElementById('mageContinue').onclick=()=>{mage.battle=null;overlay.hidden=true;if(mage.enemies.every(e=>e.solved))mageFinish(true);};
  renderMaze();document.getElementById('mageContinue').focus();
}
function mageFinish(won) {
  mage.ended=true;mage.battle=null;clearInterval(mage.timer);
  const overlay=document.getElementById('mageOverlay');overlay.hidden=false;
  overlay.innerHTML=`<div class="mage-result">${magePortrait(3)}<h3>${won?'迷宮討伐成功！':'咒語忘光，闖關失敗！'}</h3><p>剩餘生命 ${mage.hp}／100</p><strong>本關得分：${mage.hp} 分</strong><p>${won?'三位敵人都已擊敗，準備迎接天命轉盤。':'生命歸零。可以重新以 100 生命挑戰，或以 0 分前往下一關。'}</p><button id="mageNext" class="primary-btn">前往下一關</button>${won?'':'<button id="mageRetry" class="primary-btn">再來一次</button>'}</div>`;
  document.getElementById('mageNext').onclick=()=>{if(!mage.paid){mage.paid=true;addPoints(mage.hp,won?3:0,won?'不及格大學士逆襲':null);}goToStage(3);};
  document.getElementById('mageRetry')?.addEventListener('click',()=>initMazeGame());
  document.getElementById('mageNext').focus();renderMaze();
}
