/* 絲路小商人 — dependency-free, local-file friendly. */
(() => {
'use strict';
const $=id=>document.getElementById(id), canvas=$('world'), ctx=canvas.getContext('2d');
const KEY='silklemmings-v1', H=470, END=2500;
let W=1100;
const goods={silk:{name:'絲綢',buy:30,sell:100,color:'#be6858'},cucumber:{name:'胡瓜',buy:40,sell:130,color:'#668b50'},grapes:{name:'葡萄',buy:65,sell:200,color:'#8e769a'},flute:{name:'笛',buy:90,sell:280,color:'#b79046'},pipa:{name:'琵琶',buy:130,sell:390,color:'#d49b59'}};
const chapters=[
 {name:'出使西域',tag:'第一章 · 西漢的外交任務',route:['長安','玉門關','大月氏'],intro:'漢武帝派張騫前往大月氏，尋求結盟對抗匈奴。你是同行的小商人，帶著少量絲綢，踏上未知的西行路。',note:'張騫出使的原始目的，是外交結盟；商貿與文化交流是後續影響。第一章的玉門關是方便辨識路線的後世地標，並非復原首次出使時的關城。'},
 {name:'張騫出逃',tag:'第二章 · 十餘年後的機會',route:['匈奴據點','大月氏'],intro:'被留居多年後，防備終於鬆懈。你與張騫把握機會逃離，重新帶上絲綢，繼續前往大月氏。留意沿途弓箭手！',note:'史載張騫受匈奴拘留十餘年後逃出，繼續西行。重新購貨與沿途箭雨，是策略遊戲的情境設計。'},
 {name:'返回漢朝',tag:'第三章 · 把遠方帶回長安',route:['大月氏','玉門關','長安'],intro:'大月氏不願結盟。雖然外交目標未達成，張騫帶回西域見聞。你可用貿易所得購買胡瓜、葡萄、笛或琵琶，啟程回長安。',note:'商品代表不同時期的西域交流，不表示都由張騫本人一次帶回。史實中的回程還曾再次被拘留，本關以危險路段濃縮呈現。'},
 {name:'建立絲路',tag:'第四章 · 後世商隊接棒',route:['長安','玉門關','大月氏','安息','大秦'],intro:'張騫之後，世代商人串起交流網絡。西行只帶絲綢，在大秦賣出後採買葡萄或琵琶返回。完成往返，累積淨獲利 10,000 元！',note:'本章是跨時代貿易模型。實際貿易多由商人分段轉售；唐代長安交流繁盛，但張騫、漢代匈奴與古羅馬不能全放在唐代同一時空。弓箭手沿用前章的遊戲敵人造型。'}
];
let state={chapter:0,leg:'out',money:600,baseline:null,round:1,won:false};
let fleet=[], units=[], hazards=[], phase='prep', clock=0, paused=false, speed=1, camera=0, follow=true, selected=null, departure=null, last=0, modalAction=null, animalSignature='';
const names={sand:'流沙',wind:'龍捲風',archer:'匈奴弓箭手'};
const gearNames={sand:'浮沙踏板',wind:'防風罩',archer:'引仇盾'};
const DAMAGE={sand:2,wind:5,archer:10}, TRAP_RADIUS=36, ARROW_RANGE=260;
const hasGear=a=>Object.values(a.gear||{}).some(Boolean);
const maxHP=a=>(a.type==='camel'?100:60)+(a.gear?.archer?500:0);
const inTrap=(a,h)=>Math.abs(a.x-h.x)<=TRAP_RADIUS;
const guards=h=>units.filter(a=>a.alive&&!a.arrived&&a.type==='camel'&&a.stopped&&a.gear[h.type]&&inTrap(a,h));
const types={horse:'馬',camel:'駱駝'};
function allowed(){return state.chapter<2||state.chapter===3&&state.leg==='out'?['silk']:state.chapter===2?['cucumber','grapes','flute','pipa']:['grapes','pipa'];}
function route(){const r=chapters[state.chapter].route;return state.chapter===3&&state.leg==='back'?[...r].reverse():r;}
function cost(){return fleet.reduce((n,a)=>n+a.load*goods[a.good].buy,0);}
function total(list=fleet){return list.reduce((n,a)=>n+a.load,0);}
function save(){try{localStorage.setItem(KEY,JSON.stringify(state));}catch{say('此瀏覽器無法儲存進度；仍可繼續遊玩，請勿關閉分頁。');}}
function load(){try{const s=JSON.parse(localStorage.getItem(KEY));if(s&&Number.isInteger(s.chapter)&&s.chapter>=0&&s.chapter<4&&['out','back'].includes(s.leg)&&Number.isFinite(s.money)&&s.money>=0&&(s.baseline===null||Number.isFinite(s.baseline))&&Number.isInteger(s.round)&&s.round>0&&typeof s.won==='boolean')state=s;}catch{}}
function say(t){$('message').textContent=t;}
function modal(tag,title,body,label,action){$('dialogTag').textContent=tag;$('dialogTitle').textContent=title;$('dialogBody').innerHTML=body;$('dialogOK').textContent=label;modalAction=action;$('dialog').showModal();}
$('dialogOK').onclick=()=>{$('dialog').close();const fn=modalAction;modalAction=null;if(fn)fn();};
$('dialog').addEventListener('cancel',e=>{e.preventDefault();});
function history(){modal('沿路讀歷史','真正的絲路，比一條路更豐富',`<p>張騫奉命尋求與大月氏結盟對抗匈奴。他的出使增進漢朝對西域的認識；絲路則是在既有交流基礎上，逐漸活絡的路線網絡。</p><p>漢至唐的交流由世代商旅接力。唐代長安吸引外來商人與使節，流動的不只有商品，還有音樂、信仰、技術與生活方式。</p><div class="history-note"><b>遊戲改編說明</b><br>被俘是真實經歷；「佩服勇氣而不殺、出售剩餘貨物」是虛構劇情。首次出使以玉門關為中繼點是後世地標投射。馬載 5、駱駝載 1、價格、陷阱傷害與引仇盾都屬遊戲平衡設定。商品用「琵琶」而非水果「枇杷」；不宣稱所有商品都由張騫帶回或產自羅馬。大秦市場代表轉口貿易，第四章不是張騫親赴羅馬。</div><p><b>教材與延伸閱讀</b></p><ul><li>提供的 B3L21.pdf，第 2、4、5 頁；B3L21_教師備課.md。</li><li><a href="https://en.chinaculture.org/gb/en_aboutchina/2003-09/24/content_22624.htm" target="_blank" rel="noopener">ChinaCulture：張騫的出使與被俘</a></li><li><a href="https://www.unesco.org/en/silk-roads/about-silk-roads" target="_blank" rel="noopener">UNESCO：絲路的路線網絡與分段貿易</a></li><li><a href="https://en.unesco.org/silkroad/content/main-street-eurasia" target="_blank" rel="noopener">UNESCO：從漢代到唐代的交流</a></li><li><a href="https://www.gdwsw.gov.cn/wsbl/content/post_38154.html" target="_blank" rel="noopener">文史廣東：玉門關的年代與變遷</a></li></ul>`, '回到商隊',null);}
function setup(showStory=false){
 phase='prep';paused=false;clock=0;camera=0;follow=true;units=[];selected=null;animalSignature='';
 createHazards();
 const good=allowed()[0];
 // A playable formation: defenders leave first, merchants wait for explicit dispatch.
 fleet=hazards.map(h=>({type:'camel',good,load:0,gear:{[h.type]:true},guardTarget:h.id}));
 fleet.push({type:'camel',good,load:Math.min(1,Math.floor(state.money/goods[good].buy)),gear:{},guardTarget:null});
 render();renderFleet();renderHazards();renderAnimals();
 $('camera').value=0;$('pauseBtn').textContent='Ⅱ 暫停';say('建議隊形：裝備駱駝先到指定陷阱駐守，載貨駱駝在出發地待命。可先放行貨隊，駱駝會在未受保護的陷阱前等待。駐守者會持續扣血！');
 if(showStory)modal(chapters[state.chapter].tag,chapters[state.chapter].name,`<p>${chapters[state.chapter].intro}</p><div class="history-note">${chapters[state.chapter].note}</div><p>駱駝生命 100、馬 60；引仇盾額外 +500。裝備後不能載貨、不能卸下。未帶對應道具且沒有駐守駱駝保護，接觸陷阱立即死亡。</p><p>裝備駱駝先出發，到指定陷阱自動停下，替夥伴開路：流沙每秒扣 2、龍捲風每秒扣 5。弓箭手每秒一箭傷害 10，優先射程內的引仇盾。貨隊先在起點待命，待通道建立再放行；馬出發後不能在路上停下。</p>`,'開始準備 →',null);
}
function createHazards(){
 const layouts=[[[480,'sand'],[790,'wind'],[1310,'sand']],[[460,'sand'],[780,'archer'],[1190,'wind'],[1570,'archer'],[1950,'sand']],[[420,'wind'],[730,'sand'],[1050,'archer'],[1510,'sand'],[1840,'archer'],[2170,'wind']],[[350,'sand'],[570,'archer'],[820,'wind'],[1100,'sand'],[1370,'archer'],[1610,'wind'],[1900,'sand'],[2130,'archer'],[2350,'wind']]];
 hazards=layouts[state.chapter].map(([x,type],i)=>({x,type,id:i,cooldown:0,shot:null}));
}
function checkpoints(){return state.chapter===1?[]:state.chapter===3?[680,1280,1840]:[1030];}
function render(){
 const c=chapters[state.chapter];$('chapterTag').textContent=c.tag;$('chapterName').textContent=c.name+(state.chapter===3?` · 第 ${state.round} 趟${state.leg==='out'?'西行':'東歸'}`:'');
 $('money').textContent=state.money.toLocaleString();$('phase').textContent=phase==='prep'?'整裝待發':phase==='travel'?(paused?'旅程暫停':'商隊行進中'):'旅程結算';
 document.querySelectorAll('.chapters div').forEach((e,i)=>e.className=i===state.chapter?'active':i<state.chapter?'done':'');
 $('route').innerHTML=route().map(t=>`<span>${t}</span>`).join('');$('brief').textContent=c.intro;
 $('sceneLabel').textContent=route()[0]+' → '+route().at(-1)+(phase==='prep'?' · 遠行的起點':' · 風沙中的旅程');
 $('prep').hidden=phase!=='prep';$('onroad').hidden=phase==='prep';$('panelTitle').textContent=phase==='prep'?'出發前的準備':'商隊行進日誌';
 $('pauseBtn').disabled=phase!=='travel';$('resumeBtn').disabled=phase!=='travel';
 const profit=state.baseline===null?0:state.money-state.baseline;
 $('profitBar').style.width=`${Math.max(0,Math.min(100,profit/100))}%`;
 $('profitText').textContent=state.baseline===null?'第四章起計算，扣除進貨成本':`已實現淨獲利 ${profit.toLocaleString()} / 10,000 元`;
 const party=phase==='prep'?fleet:units.filter(a=>a.alive);
 for(const k of Object.keys(gearNames))$(k+'Count').textContent=`${party.filter(a=>a.gear?.[k]).length}/${party.length}`;
 document.querySelectorAll('[data-tool]').forEach(b=>{b.classList.toggle('selected',selected===b.dataset.tool);b.setAttribute('aria-pressed',String(selected===b.dataset.tool));b.disabled=phase==='result';});
 $('dispatchBtn').disabled=phase!=='travel'||!units.some(a=>a.alive&&a.waiting);
}
function renderFleet(){
 $('fleet').innerHTML=fleet.map((a,i)=>`<div class="fleet-row"><select data-i="${i}" data-field="type" aria-label="夥伴 ${i+1} 種類" ${hasGear(a)?'disabled':''}><option value="horse" ${a.type==='horse'?'selected':''}>馬</option><option value="camel" ${a.type==='camel'?'selected':''}>駱駝</option></select><select data-i="${i}" data-field="good" aria-label="夥伴 ${i+1} 貨物" ${hasGear(a)?'disabled':''}>${allowed().map(k=>`<option value="${k}" ${a.good===k?'selected':''}>${goods[k].name}</option>`).join('')}</select><input type="number" min="0" max="${hasGear(a)?0:a.type==='horse'?5:1}" value="${a.load}" data-i="${i}" data-field="load" aria-label="夥伴 ${i+1} 載貨量" ${hasGear(a)?'disabled':''}><button data-remove="${i}" aria-label="移除夥伴 ${i+1}" ${fleet.length===1||hasGear(a)?'disabled':''}>×</button><div class="gear-row"><span>${i+1} 號 · 生命 ${maxHP(a)} · ${hasGear(a)?'裝備鎖定，不能載貨':'載貨與裝備二擇一'}</span>${Object.entries(gearNames).map(([k,n])=>`<button data-prep-equip="${k}" data-i="${i}" ${a.gear?.[k]||(a.type==='camel'&&hasGear(a))||a.load>0?'disabled':''}>${a.gear?.[k]?'🔒':'＋'} ${n}</button>`).join('')}</div>${a.type==='camel'?`<label class="guard-order">駐守指令 <select data-i="${i}" data-field="guardTarget" aria-label="夥伴 ${i+1} 駐守位置"><option value="" ${a.guardTarget==null?'selected':''}>手動停走</option>${hazards.filter(h=>a.gear?.[h.type]).map(h=>`<option value="${h.id}" ${a.guardTarget===h.id?'selected':''}>${h.id+1}. ${names[h.type]} · 抵達停下</option>`).join('')}</select></label>`:''}</div>`).join('');
 $('addBtn').disabled=fleet.length>=12;quote();render();
}
 function quote(){const n=cost();$('quote').innerHTML=`<details class="prices"><summary>市集單價 · 買入／售出</summary>${allowed().map(k=>`<div>${goods[k].name}<b>${goods[k].buy}／${goods[k].sell} 元</b></div>`).join('')}</details><div>裝載 ${total()} 單位 <b>進貨 ${n} 元</b></div><div>預計售價 <b>${fleet.reduce((v,a)=>v+a.load*goods[a.good].sell,0)} 元</b></div><div class="${n>state.money?'danger':''}">出發後餘額 <b>${state.money-n} 元</b></div><small>夥伴由商團提供；貨物損失不退款。</small>`;$('launchBtn').disabled=n>state.money||total()===0;}
 $('fleet').addEventListener('change',e=>{const el=e.target;if(!el.dataset.field)return;const a=fleet[+el.dataset.i];if(el.dataset.field==='guardTarget')a.guardTarget=el.value===''?null:+el.value;else if(el.dataset.field==='load')a.load=hasGear(a)?0:Math.max(0,Math.min(a.type==='horse'?5:1,Math.floor(Number(el.value)||0)));else if(!hasGear(a))a[el.dataset.field]=el.value;a.load=Math.min(a.load,hasGear(a)?0:a.type==='horse'?5:1);renderFleet();});
 $('fleet').addEventListener('click',e=>{const item=e.target.closest('[data-prep-equip]');if(item){equip(+item.dataset.i,item.dataset.prepEquip);return;}const b=e.target.closest('[data-remove]');if(b&&fleet.length>1&&!hasGear(fleet[+b.dataset.remove])){fleet.splice(+b.dataset.remove,1);renderFleet();}});
 $('addBtn').onclick=()=>{if(fleet.length<12){fleet.push({type:'horse',good:allowed()[0],load:0,gear:{},guardTarget:null});renderFleet();}};
 function equip(id,type){if(!gearNames[type]||phase==='result')return;const a=(phase==='prep'?fleet:units)[id];if(!a||phase==='travel'&&(!a.alive||a.arrived))return;if(a.load>0){say('載貨動物不能裝備道具；請使用空載夥伴。途中不可卸貨換裝。');return;}if(a.type==='camel'&&hasGear(a)&&!a.gear?.[type]){say('一隻駱駝只能裝一種裝備，已裝備後不可更換。');return;}if(a.gear?.[type]){say(`${id+1} 號的${gearNames[type]}已鎖定，不能卸下或重複增加生命。`);return;}a.gear={...a.gear,[type]:true};if(type==='archer'&&phase==='travel'){a.hp+=500;a.maxHp+=500;}say(`${id+1} 號${types[a.type]}裝上${gearNames[type]}，不能再載貨或卸下。${type==='archer'?'生命 +500，吸引射程內弓箭手。':a.type==='horse'?'馬繼續移動，不能駐守護送。':'停在對應陷阱上可守護夥伴，但會持續扣血。'}`);if(phase==='prep')renderFleet();else renderAnimals();render();}
 function renderHazards(){const html=hazards.map(h=>{const g=h.type==='archer'?[]:guards(h);return `<button data-hazard="${h.id}" class="${g.length?'fixed':''}">${h.type==='sand'?'▤':h.type==='wind'?'◎':'➶'} ${h.id+1}. ${names[h.type]} · ${g.length?'駐守中':h.type==='archer'?'10／箭':DAMAGE[h.type]+'／秒'}</button>`;}).join('');if($('hazards').innerHTML!==html)$('hazards').innerHTML=html;}
 function protect(id){const h=hazards[id];if(!h||phase==='result')return;selected=h.type;camera=Math.max(0,Math.min(END-W+100,h.x-W/2));follow=false;$('camera').value=camera;render();say(h.type==='archer'?'弓箭手原地射擊，優先攻擊射程內持引仇盾的動物。選好盾後點空載夥伴裝備。':`${names[h.type]}：未裝備者必須等駱駝駐守才可通過；裝備駱駝每秒受到 ${DAMAGE[h.type]} 傷害。`);}
 $('hazards').onclick=e=>{const b=e.target.closest('[data-hazard]');if(b)protect(+b.dataset.hazard);};
 document.querySelectorAll('[data-tool]').forEach(b=>b.onclick=()=>{selected=selected===b.dataset.tool?null:b.dataset.tool;render();say(!selected?'已切回停走操作：點駱駝可停下或繼續。':`已選${gearNames[selected]}：請點空載夥伴裝備；裝備後不能載貨或卸下。`);});
 function launch(){if(phase!=='prep'||cost()>state.money||total()===0||fleet.some(a=>(hasGear(a)&&a.load>0)||(a.type==='camel'&&Object.values(a.gear||{}).filter(Boolean).length>1)))return;departure=JSON.parse(JSON.stringify(state));state.money-=cost();clock=0;phase='travel';selected=null;units=fleet.map((a,i)=>({...a,gear:{...a.gear},id:i,x:70-i*22,alive:true,arrived:false,stopped:false,waiting:a.load>0,merchant:a.load>0,atStation:false,passed:[],hp:maxHP(a),maxHp:maxHP(a)}));say('守護隊先出發，貨隊在起點待命。等駱駝到陷阱駐守，再按「貨隊出發」；各守護者會持續扣血。');render();renderAnimals();}
 $('launchBtn').onclick=launch;
 function renderAnimals(){const sig=JSON.stringify(units.map(a=>[a.alive,a.arrived,a.stopped,a.waiting,a.atStation,a.waitingFor,a.gear,a.load,a.guardTarget,phase]));if(sig!==animalSignature){animalSignature=sig;$('animals').innerHTML=units.map(a=>`<div class="animal-card"><button data-animal="${a.id}" ${!a.alive||a.arrived?'disabled':''}>${a.id+1} 號${types[a.type]} · ${!a.alive?'死亡':a.arrived?'抵達':a.waiting?'起點待命 → 出發':a.atStation?'中繼點等待':a.stopped?'已停下 → 繼續':a.waitingFor!=null?'等待前方駐守':'行進'} · ${a.load} 貨</button><div class="hp-line"><span id="hp-${a.id}"></span><div class="hp-track"><i id="hpbar-${a.id}"></i></div></div><div class="animal-gear">${Object.entries(gearNames).map(([k,n])=>`<button data-equip="${k}" data-unit="${a.id}" ${a.gear?.[k]||(a.type==='camel'&&hasGear(a))||a.load>0||!a.alive||a.arrived||phase!=='travel'?'disabled':''}>${a.gear?.[k]?'🔒':'＋'} ${n}</button>`).join('')}</div>${a.type==='camel'&&a.alive&&!a.arrived?`<label class="guard-order">前往駐守 <select data-guard-unit="${a.id}"><option value="">手動停走</option>${hazards.filter(h=>a.gear[h.type]&&h.x>=a.x-TRAP_RADIUS).map(h=>`<option value="${h.id}" ${a.guardTarget===h.id?'selected':''}>${h.id+1}. ${names[h.type]}</option>`).join('')}</select></label>`:''}<small>${a.type==='horse'?'出發後持續移動，只在中繼點停下':'點編號停走；選陷阱可自動前往駐守'}</small></div>`).join('');}
 for(const a of units){$('hp-'+a.id).textContent=`生命 ${Math.ceil(a.hp)} / ${a.maxHp}`;$('hpbar-'+a.id).style.width=`${a.hp/a.maxHp*100}%`;}
 const ready=hazards.filter(h=>h.type!=='archer'&&guards(h).length).length,need=hazards.filter(h=>h.type!=='archer').length;
 $('travelStats').innerHTML=`存活 <b>${units.filter(a=>a.alive).length} / ${units.length}</b> · 貨物 <b>${total(units.filter(a=>a.alive))}</b><br>已駐守陷阱 <b>${ready} / ${need}</b><br>流沙 2／秒 · 龍捲風 5／秒<br>弓箭 10／箭 · 每秒一箭`;
 $('dispatchBtn').disabled=phase!=='travel'||!units.some(a=>a.alive&&a.waiting);
 }
 function toggleAnimal(id){if(phase!=='travel')return;const a=units[id];if(!a||!a.alive||a.arrived)return;if(a.waiting){a.waiting=false;say(`${id+1} 號貨隊出發。`);}else if(a.atStation){a.atStation=false;a.stopped=false;}else if(a.type==='camel'){a.stopped=!a.stopped;a.guardTarget=null;say(`${id+1} 號駱駝${a.stopped?'停下；若在陷阱上會駐守並持續扣血':'繼續前進，原地守護立即結束'}。`);}else say('馬在路上無法停下，抵達中繼點才能等待。');renderAnimals();renderHazards();}
 $('animals').onclick=e=>{const tool=e.target.closest('[data-equip]');if(tool){equip(+tool.dataset.unit,tool.dataset.equip);return;}const b=e.target.closest('[data-animal]');if(b)toggleAnimal(+b.dataset.animal);};
 $('animals').onchange=e=>{if(e.target.dataset.guardUnit===undefined)return;const a=units[+e.target.dataset.guardUnit],h=hazards[+e.target.value];if(e.target.value===''){a.guardTarget=null;return;}if(a.alive&&a.type==='camel'&&h&&a.gear[h.type]&&h.x>=a.x-TRAP_RADIUS){a.guardTarget=h.id;a.stopped=false;a.atStation=false;renderAnimals();}};
 $('dispatchBtn').onclick=()=>{if(phase!=='travel')return;units.forEach(a=>{if(a.alive)a.waiting=false;});say('貨隊出發！馬會持續前進，請留意駐守駱駝的生命。');renderAnimals();};
 $('resumeBtn').onclick=()=>{let n=0;units.forEach(a=>{if(a.atStation){a.atStation=false;a.stopped=false;n++;}});say(n?`${n} 位夥伴離開中繼點。`:'目前沒有夥伴在中繼點等待。');renderAnimals();};
 $('pauseBtn').onclick=()=>{if(phase==='travel'){paused=!paused;$('pauseBtn').textContent=paused?'▶ 繼續':'Ⅱ 暫停';render();}};
 $('speedBtn').onclick=()=>{speed=speed===1?2:1;$('speedBtn').textContent=speed+'× 速度';};
 $('camera').oninput=e=>{camera=+e.target.value;follow=false;};$('followBtn').onclick=()=>{follow=true;};
 function retry(){if(!departure)return;state=JSON.parse(JSON.stringify(departure));save();setup();say('已回到本趟出發前的資金；重新配貨與規劃路線。');}
 $('retryBtn').onclick=()=>{modal('重新規劃','回到本趟出發之前？','<p>本趟的進貨款與損失會還原，先前已完成的旅程仍保留。</p><button id="cancelRetry" class="secondary">繼續目前旅程</button>','確認重試',retry);$('cancelRetry').onclick=()=>{$('dialog').close();modalAction=null;};};
 $('resetBtn').onclick=()=>{modal('重新開始','開啟一段新的旅程？','<p>將清除目前遊戲進度，從第一章與 600 元資金重新開始。</p><button id="cancelReset" class="secondary">保留進度，返回遊戲</button>','確認重新開始',()=>{state={chapter:0,leg:'out',money:600,baseline:null,round:1,won:false};save();setup(true);});$('cancelReset').onclick=()=>{$('dialog').close();modalAction=null;};};
 $('historyBtn').onclick=history;
 function kill(a,reason){if(!a.alive)return;a.hp=0;a.alive=false;a.load=0;a.gear={};a.stopped=false;a.waiting=false;a.guardTarget=null;say(`${a.id+1} 號${types[a.type]}${reason}死亡，貨物與道具一同消失，守護立即失效。`);}
 function hurt(a,n,reason){if(!a.alive)return;a.hp=Math.max(0,a.hp-n);if(a.hp<1e-8)kill(a,reason);}
 function tick(dt){
 clock+=dt;
 // Move everyone before resolving hazards, independent of array order.
 for(const a of units){
  if(!a.alive||a.arrived||a.waiting||a.stopped||a.atStation)continue;
  const prev=a.x;const advance=(a.type==='horse'?88:45)*dt;const blocked=a.type==='camel'?hazards.find(h=>h.type!=='archer'&&!a.gear[h.type]&&!guards(h).length&&prev<h.x-TRAP_RADIUS&&prev+advance>=h.x-TRAP_RADIUS-8):null;if(blocked){a.x=Math.min(prev+advance,blocked.x-TRAP_RADIUS-8);a.waitingFor=blocked.id;continue;}a.waitingFor=null;a.x+=(a.type==='horse'?88:45)*dt;
  const target=a.guardTarget==null?null:hazards[a.guardTarget];
  if(a.type==='camel'&&target&&a.gear[target.type]&&prev<=target.x+TRAP_RADIUS&&a.x>=target.x){a.x=target.x;a.stopped=true;}
  // A camel explicitly ordered to a trap walks through intermediate stations.
  const stop=checkpoints().find(x=>prev<x&&a.x>=x&&!a.passed.includes(x));
  if(stop!==undefined){a.passed.push(stop);if(!(a.type==='camel'&&target)){a.x=stop;a.atStation=true;say(`${a.id+1} 號夥伴抵達中繼點，請按放行繼續。`);}}
 }
 // Equipped animals pay ongoing hazard damage even when stopped or guarded by others.
 for(const h of hazards.filter(h=>h.type!=='archer')){
  for(const a of units){if(a.alive&&!a.arrived&&!a.waiting&&inTrap(a,h)&&a.gear[h.type])hurt(a,DAMAGE[h.type]*dt,`在${names[h.type]}中耗盡生命而`);}
 }
 // Archers stand still, choose a living in-range shield first, and shoot every second.
 for(const h of hazards.filter(h=>h.type==='archer')){
  h.cooldown=Math.max(0,h.cooldown-dt);
  const candidates=units.filter(a=>a.alive&&!a.arrived&&!a.waiting&&Math.abs(a.x-h.x)<=ARROW_RANGE);
  candidates.sort((a,b)=>Number(!!b.gear.archer)-Number(!!a.gear.archer)||Math.abs(a.x-h.x)-Math.abs(b.x-h.x)||a.id-b.id);
  if(h.cooldown<=1e-8&&candidates.length){const a=candidates[0];h.cooldown=1;h.shot={time:clock,x:a.x,id:a.id};hurt(a,DAMAGE.archer,'遭弓箭射擊而');}
 }
 // Recompute guardians after all damage: a dead guardian cannot shield even this tick.
 for(const h of hazards.filter(h=>h.type!=='archer')){
  const safe=guards(h).length>0;
  for(const a of units){if(a.alive&&!a.arrived&&!a.waiting&&inTrap(a,h)&&!a.gear[h.type]&&!safe)kill(a,`未受保護，接觸${names[h.type]}而`);}
 }
 for(const a of units){if(!a.alive||a.waiting)continue;if(state.chapter===0&&a.x>=1510){settle(true);return;}if(a.x>=END){a.x=END;a.arrived=true;}}
 const merchants=units.filter(a=>a.merchant);
 if(merchants.length&&merchants.every(a=>!a.alive||a.arrived)){
  if(merchants.some(a=>a.arrived))settle(false);
  else{phase='result';render();modal('旅程暫歇','載貨隊全數陣亡','<p>裝備駱駝需要先停在陷阱上，貨隊才能安全通過。留意守護者生命，以及射程內的引仇盾。重試會還原本趟出發前資金。</p>','回到出發前，重新規劃',retry);}
 }
 }
 function step(dt){
 if(phase!=='travel'||paused||$('dialog').open||!Number.isFinite(dt)||dt<=0)return;
 // Small fixed maximum steps prevent fast horses skipping traps and keep DPS frame independent.
 while(dt>1e-9&&phase==='travel'){const slice=Math.min(dt,.02);tick(slice);dt-=slice;}
 renderAnimals();renderHazards();
 if(follow){const moving=units.filter(a=>a.alive&&!a.arrived&&!a.waiting&&!a.stopped);if(moving.length)camera=Math.max(0,Math.min(END-W+100,Math.max(...moving.map(a=>a.x))-W*.64));$('camera').value=camera;}
 }
 function settle(captured){
 if(phase!=='travel')return;phase='result';const survivors=units.filter(a=>a.alive&&(captured||a.arrived));const cargo=total(survivors),revenue=survivors.reduce((v,a)=>v+a.load*goods[a.good].sell,0);state.money+=revenue;render();
 const receipt=`<div class="receipt"><span>保留下來的貨物</span><b>${cargo} 單位</b><span>出售收入</span><b>＋${revenue.toLocaleString()} 元</b><span>商隊資金</span><b>${state.money.toLocaleString()} 元</b></div>`;
 if(captured){modal('劇情事件 · 被俘不是結束','匈奴騎兵出現了！',`<p>離開玉門關後，你們被匈奴攔下。故事中的匈奴首領佩服你們的勇氣，決定留下商隊，並買下所有仍在夥伴身上的絲綢。</p>${receipt}<div class="history-note">史實：張騫確曾被匈奴拘留十餘年。佩服勇氣、購買貨物與這個被俘地點的安排，屬遊戲改編。</div>`,'多年後，尋找出逃的機會 →',()=>next());return;}
 const profit=state.baseline===null?0:state.money-state.baseline;
 if(state.chapter===3&&state.leg==='back'&&profit>=10000){state.won=true;save();modal('絲路商人 · 通關','你讓東西方相遇了！',`${receipt}<p>第四章淨獲利 <b>${profit.toLocaleString()} 元</b>，達成 10,000 元目標。絲綢、物產與樂器隨商隊往返，文化交流也在路上發生。</p><div class="history-note">記住：張騫為尋求結盟而出使；絲路的長期影響則是商品與文化的雙向流動。</div>`,'繼續自由貿易',()=>{state.leg='out';state.round++;save();setup();});return;}
 modal('抵達 · '+route().at(-1),state.chapter===1?'終於見到大月氏':state.chapter===2?'帶著見聞回到長安':state.leg==='out'?'大秦市場開張了':'絲綢與故事，再次相遇',`${receipt}<p>${state.chapter===1?'大月氏不願與漢朝結盟，但這趟旅程帶來珍貴的地理與風土見聞。現在可購買當地市場的物產，準備回程。':state.chapter===2?'外交目標雖未達成，卻增進了對西域的認識。接下來由後世商隊延續交流。':state.leg==='out'?'出售絲綢後，用所得採買葡萄或琵琶，運回長安出售。':'扣除進貨成本後，淨獲利累計 '+profit.toLocaleString()+' 元；繼續往返直到達標。'}</p>`,state.chapter===3&&state.leg==='out'?'採買回程貨物 →':'繼續旅程 →',next);
 }
 function next(){if(state.chapter<3){state.chapter++;if(state.chapter===3)state.baseline=state.money;}else if(state.leg==='out')state.leg='back';else{state.leg='out';state.round++;}
 // Assistance is kept out of fourth-chapter profit so no soft lock or artificial win.
 const min=goods[allowed()[0]].buy;if(state.money<min){const grant=300-state.money;state.money+=grant;if(state.baseline!==null)state.baseline+=grant;save();setup();modal('商團援助','整頓之後，再次上路','<p>剩餘資金不足採買，商團補足至 300 元。援助不計入第四章獲利。</p>','重新配貨',null);}else{save();setup(state.chapter<4&&state.leg==='out'&&state.round===1);}}
 // Hand-drawn vector world: no external assets or network required.
 function path(points,fill,stroke,width=2){ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(...p):ctx.moveTo(...p));ctx.closePath();if(fill){ctx.fillStyle=fill;ctx.fill();}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=width;ctx.stroke();}}
 function ellipse(x,y,rx,ry,fill){ctx.fillStyle=fill;ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2);ctx.fill();}
 function line(x,y,x2,y2,color,width=2){ctx.strokeStyle=color;ctx.lineWidth=width;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x2,y2);ctx.stroke();}
 function text(t,x,y,size=14,color='#594d34',align='center'){ctx.fillStyle=color;ctx.font=`${Math.max(size*1.3,14*W/(canvas.clientWidth||W))}px "Microsoft JhengHei", sans-serif`;ctx.textAlign=align;ctx.fillText(t,x,y);}
 function gate(x,y,roman=false){ctx.save();ctx.translate(x,y);if(roman){ctx.fillStyle='#d9cba2';ctx.fillRect(-48,-71,96,71);for(let i=-35;i<=35;i+=23){ctx.fillStyle='#faf1cc';ctx.fillRect(i,-67,12,64);}path([[-61,-70],[0,-104],[61,-70]],'#f3e6b9');}else{ctx.fillStyle='#b79e66';ctx.fillRect(-40,-60,80,60);ctx.fillStyle='#c7b278';ctx.fillRect(-51,-64,102,16);for(let i=-48;i<=45;i+=20)ctx.fillRect(i,-76,12,17);path([[-58,-79],[-36,-90],[36,-90],[58,-79]],'#516459');ctx.fillStyle='#ead5a1';ctx.fillRect(-10,-40,20,40);}ctx.fillStyle='#7d7657';ctx.fillRect(-10,-32,20,32);ctx.restore();}
 function palm(x,y,s=1){ctx.save();ctx.translate(x,y);ctx.scale(s,s);line(0,0,5,-58,'#917847',7);for(let i=0;i<6;i++){let a=i*Math.PI/3;path([[5,-58],[5+Math.cos(a)*33,-62+Math.sin(a)*20],[5+Math.cos(a+.5)*17,-54+Math.sin(a+.5)*10]],'#697e51');}ctx.restore();}
 function animal(a,x,y,scale=1){ctx.save();ctx.translate(x,y);ctx.scale(scale,scale);const walk=phase==='travel'&&!paused&&!a.stopped&&!a.waiting&&a.waitingFor==null&&!a.atStation&&!a.arrived&&!$('dialog').open?Math.sin(clock*(a.type==='horse'?12:7)+a.id):0;ellipse(0,17,30,6,'#66593625');const camel=a.type==='camel',color=camel?'#c39854':'#a96e49',dark=camel?'#a3783c':'#794c35';for(let i=0;i<4;i++){const lx=-18+i*12,shift=walk*(i%2?6:-6);line(lx,-1,lx+shift,14,color,6);line(lx+shift,14,lx+shift+5,17,dark,5);}ellipse(0,-9,29,17,color);if(camel){ellipse(-11,-24,10,14,color);ellipse(10,-24,10,14,color);path([[19,-7],[24,-40],[35,-43],[38,-7]],color);ellipse(33,-42,13,9,color);}else{path([[17,-12],[21,-35],[32,-40],[38,-21]],color);ellipse(34,-32,15,9,color);path([[20,-35],[22,-43],[29,-47],[26,-29]],'#624935');}path([[30,-43],[28,-53],[35,-46]],dark);ellipse(38,camel?-44:-35,2,2,'#293f3b');ellipse(42,camel?-39:-28,6,4,'#d8b17d');line(-28,-13,-36,-5,dark,4);ctx.fillStyle='#446d63';ctx.fillRect(-17,-21,34,17);ctx.strokeStyle='#f0cf81';ctx.lineWidth=2;ctx.strokeRect(-17,-21,34,17);
 if(a.load>0){ctx.fillStyle=goods[a.good].color;ctx.fillRect(-15,-32,27,17);line(-14,-26,11,-26,'#f0d39c',2);line(-1,-32,-1,-15,'#efdca7',2);text(String(a.load),-2,-18,10,'#fff8e2');}
 // A little merchant rides with each pack animal.
 ctx.fillStyle='#e4b381';ctx.fillRect(-6,-49,12,13);ellipse(0,-53,9,10,'#efc59a');path([[-11,-55],[-7,-64],[6,-66],[12,-56]],'#365e56');line(-8,-56,9,-56,'#e8d0a0',3);ellipse(4,-52,1.3,1.3,'#39443a');ctx.fillStyle='#406d65';ctx.fillRect(-7,-42,13,11);
 if(a.gear?.sand){for(let i=0;i<4;i++)line(-22+i*12,20,-12+i*12,20,'#e9dcad',5);}
 if(a.gear?.wind){ctx.strokeStyle='#4c9b9c';ctx.lineWidth=2;ctx.beginPath();ctx.arc(0,-27,39,Math.PI,Math.PI*2);ctx.stroke();line(-39,-27,-28,8,'#4c9b9c',2);line(39,-27,29,8,'#4c9b9c',2);}
 if(a.gear?.archer){path([[-27,-28],[-13,-33],[0,-28],[-3,-8],[-13,0],[-24,-8]],'#4b7889','#dfcf8f',2);text('盾',-13,-12,10,'#fff9d8');}
 if(phase!=='prep'){ctx.fillStyle='#8d8061';ctx.fillRect(-29,-88,58,5);ctx.fillStyle=a.hp/a.maxHp>.3?'#458268':'#b25943';ctx.fillRect(-29,-88,58*a.hp/a.maxHp,5);text(String(Math.ceil(a.hp)),0,-94,10,'#355147');}
 if(a.stopped||a.atStation){text('Ⅱ',0,-79,18,'#285e51');}ctx.restore();}
 function drawHazard(h){const x=h.x-camera;if(x<-ARROW_RANGE||x>W+ARROW_RANGE)return;const y=350,safe=h.type!=='archer'&&guards(h).length>0;
 if(h.type==='sand'){ellipse(x,y+8,45,12,'#ac854e');ellipse(x,y+7,32,7,'#94734b');ellipse(x,y+7,17,3,'#bc955a');if(safe){ctx.fillStyle='#c5ae70';ctx.fillRect(x-43,y-4,86,6);for(let i=-40;i<43;i+=12)line(x+i,y-5,x+i,y+3,'#efe0b6',3);}}
 if(h.type==='wind'){ctx.globalAlpha=safe?.35:.8;for(let i=0;i<8;i++){const yy=y-12-i*9,xx=x+Math.sin(clock*4+i)*5;ctx.strokeStyle='#987c55';ctx.lineWidth=4;ctx.beginPath();ctx.ellipse(xx,yy,8+i*4,3+i*.4,0,0,Math.PI*1.8);ctx.stroke();}ctx.globalAlpha=1;if(safe){ctx.strokeStyle='#4c9b9c';ctx.lineWidth=3;ctx.beginPath();ctx.arc(x,y,48,Math.PI,Math.PI*2);ctx.stroke();}}
 if(h.type==='archer'){path([[x-33,y-10],[x,y-54],[x+36,y-10]],'#b99a65');ellipse(x,y-69,9,10,'#d9ab79');path([[x-12,y-75],[x,y-90],[x+12,y-75]],'#77675b');line(x,y-56,x,y-29,'#736553',10);ctx.beginPath();ctx.strokeStyle='#745535';ctx.lineWidth=3;ctx.arc(x+14,y-56,19,-1.5,1.5);ctx.stroke();line(x+15,y-75,x+15,y-37,'#b49c69',1);if(h.shot&&clock-h.shot.time<.35){const t=Math.min(1,(clock-h.shot.time)/.25),tx=x+(h.shot.x-h.x)*t,ty=y-55+45*t;line(tx,ty,tx+(h.shot.x>h.x?-14:14),ty-3,'#6f4631',3);text('−10',h.shot.x-camera,y-75,13,'#a44832');}}
 const label=safe?`✓ ${h.id+1} 駐守通道`:`${h.id+1} ${names[h.type]}`;text(label,x,y+42,12,safe?'#35624e':'#76583b');
 }
 function draw(){
 ctx.clearRect(0,0,W,H);const g=ctx.createLinearGradient(0,0,0,H);g.addColorStop(0,'#f4e9c7');g.addColorStop(1,'#ecd09b');ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
 ellipse(W*.77-camera*.07,74,39,39,'#e5b35d');ellipse(W*.77-camera*.07,74,52,52,'#e5b35d13');
 for(let j=0;j<3;j++){const shift=camera*(.08+j*.08);const p=[[-100,H]];for(let i=-1;i<10;i++)p.push([i*180-shift%180,175+j*38+Math.sin(i*1.8+j)*46]);p.push([W+200,H]);path(p,['#d6ceb0','#d3bc8e','#d9b780'][j]);}
 path([[-20,335],[120,293],[320,304],[470,272],[710,323],[860,299],[1120,331],[1120,470],[-20,470]],'#e6c48a');
 ctx.strokeStyle='#efdaad';ctx.lineWidth=51;ctx.beginPath();ctx.moveTo(0,361);ctx.bezierCurveTo(300,344,750,369,1100,351);ctx.stroke();
 ctx.setLineDash([4,15]);line(0,371,W,371,'#c5a168',1);ctx.setLineDash([]);
 for(let i=0;i<22;i++){const x=((i*157-camera*.7)%1250+1250)%1250-65,y=398+(i*29)%61;line(x,y,x+9,y-2,'#c2a26d',2);if(i%4===0){line(x+2,y,x-2,y-9,'#a6a06e',2);line(x+3,y,x+7,y-7,'#a6a06e',2);}}
 const stations=[80,...checkpoints(),END],labels=route();stations.forEach((x,i)=>{const sx=x-camera;if(sx<-120||sx>W+120)return;gate(sx,300,state.chapter===3&&(state.leg==='out'?i===stations.length-1:i===0));text(labels[i]||labels.at(-1),sx,188,17,'#706549');if(i>0){ellipse(sx+90,309,42,8,'#8aaf9b');palm(sx+106,304,.8);palm(sx+62,302,.6);}});
 hazards.forEach(drawHazard);
 if(phase==='prep'){fleet.forEach((a,i)=>animal({...a,id:i},135+(i%4)*90,350+Math.floor(i/4)*52,1.15));text('風沙之外，是更大的世界。',W*.48,81,W<800?16:20,'#9b8355');text('整備商隊 · 規劃路線 · 啟程遠行',W*.48,109,11,'#9b8355');}
 else units.filter(a=>a.alive).sort((a,b)=>a.x-b.x).forEach(a=>{const x=a.x-camera;if(x>-60&&x<W+60){animal(a,x,342+(a.id%3)*9,.88);text(String(a.id+1),x,279,10,'#5c6750');}});
 // Small compass is decorative; this is a route diagram, not a geographic map.
 line(W-60,50,W-60,90,'#9b8e69');line(W-80,70,W-40,70,'#9b8e69');path([[W-60,48],[W-65,70],[W-55,70]],'#9b8e69');text('N',W-60,39,10,'#9b8e69');
 }
 canvas.addEventListener('click',e=>{const r=canvas.getBoundingClientRect(),sx=(e.clientX-r.left)*W/r.width,x=sx+camera,y=(e.clientY-r.top)*H/r.height;if(phase==='prep'&&gearNames[selected]){const i=fleet.findIndex((a,i)=>Math.abs(sx-(135+(i%4)*90))<40&&Math.abs(y-(320+Math.floor(i/4)*52))<55);if(i>=0){equip(i,selected);return;}}const a=units.find(a=>a.alive&&Math.abs(a.x-x)<32&&y>250&&y<380);if(a){if(gearNames[selected])equip(a.id,selected);else toggleAnimal(a.id);return;}const h=hazards.find(h=>Math.abs(h.x-x)<55&&y>240&&y<410);if(h)protect(h.id);});
 document.addEventListener('keydown',e=>{if(/INPUT|SELECT|BUTTON/.test(e.target.tagName)||$('dialog').open)return;if(e.code==='Space'){e.preventDefault();$('pauseBtn').click();}if(['1','2','3'].includes(e.key))document.querySelectorAll('[data-tool]')[+e.key-1].click();});
 document.addEventListener('visibilitychange',()=>{if(document.hidden&&phase==='travel'&&!paused){paused=true;$('pauseBtn').textContent='▶ 繼續';render();}});
 function frame(t){const dt=Math.min((t-last)/1000,.05);last=t;step(dt*speed);draw();requestAnimationFrame(frame);}
 function resize(){W=innerWidth<=760?680:1100;canvas.width=W;canvas.height=H;canvas.style.aspectRatio=`${W}/${H}`;$('camera').max=END-W+100;camera=Math.min(camera,END-W+100);}
 window.addEventListener('resize',resize);resize();load();setup(!localStorageAvailableSave());requestAnimationFrame(frame);
 function localStorageAvailableSave(){try{return !!localStorage.getItem(KEY);}catch{return false;}}
 // Opt-in deterministic QA surface, absent from normal play.
 if(new URLSearchParams(location.search).has('test'))window.silkTest={get:()=>({state,units,hazards,phase,clock,fleet,departure}),step,setup,launch,protect,equip,toggleAnimal,goods,setState:s=>{Object.assign(state,s);setup();},setFleet:f=>{fleet=f;renderFleet();},save};
})();
