/* Pure game rules; route distance runs from 1000 (departure) to 0 (destination); UI projects travel direction. */
(function(root){
'use strict';
const TYPES={
 sand:{name:'浮沙踏板駱駝',animal:'camel',gear:'sand',hp:100,speed:62,cost:80,goods:0,sale:0,desc:'停在流沙前，為商隊搭路。'},
 wind:{name:'防風罩駱駝',animal:'camel',gear:'wind',hp:100,speed:62,cost:100,goods:0,sale:0,desc:'停在龍捲風前，撐起避風罩。'},
 shield:{name:'引仇盾駱駝',animal:'camel',gear:'archer',hp:600,speed:62,cost:150,goods:0,sale:0,desc:'600 生命，停在射手前吸引箭矢。'},
 silk:{name:'絲綢馬',animal:'horse',gear:null,hp:60,speed:104,cost:100,goods:5,sale:300,desc:'5 單位絲綢，抵達可售 300 元。'},
 imports:{name:'葡萄・琵琶馬',animal:'horse',gear:null,hp:60,speed:104,cost:140,goods:5,sale:540,desc:'3 葡萄＋2 琵琶，抵達售 540 元。'}
};
const ROUTES=[
 {title:'出使西域',tag:'第一關 · 長安西行',origin:'長安',destination:'西域方向',route:['長安','玉門關','大月氏（目標）'],hazards:[[800,'sand'],[550,'wind'],[300,'sand']]},
 {title:'張騫出逃',tag:'第二關 · 重獲自由',origin:'匈奴據點',destination:'大月氏',route:['匈奴據點','大月氏'],hazards:[[810,'sand'],[640,'archer'],[420,'wind']]},
 {title:'返回漢朝',tag:'第三關 · 東歸長安',origin:'大月氏',destination:'長安',route:['大月氏','玉門關','長安'],hazards:[[810,'wind'],[610,'archer'],[390,'sand']]},
 {title:'建立絲路',tag:'第四關 · 往返貿易',origin:'長安',destination:'大秦',route:['長安','玉門關','大月氏','安息','大秦'],hazards:[[820,'sand'],[660,'archer'],[470,'wind'],[260,'sand']]}
];
const HP_DPS={sand:2,wind:5}, RADIUS=19, GUARD_OFFSET=29, ARROW_RANGE=155;
const initial=()=>({chapter:0,leg:'out',money:5000,baseline:null,round:1,won:false});
function routeFor(s){const r=ROUTES[s.chapter];return s.chapter===3&&s.leg==='back'?{...r,origin:'大秦',destination:'長安',route:[...r.route].reverse()}:r;}
function available(s,key){return !!TYPES[key]&&(!TYPES[key].goods||(routeFor(s).origin==='長安'?key==='silk':key==='imports'));}
function canSell(s,key){return available(s,key)&&!(key==='silk'&&routeFor(s).destination==='長安');}
class Battle{
 constructor(state){this.state={...state};this.startState={...state};this.route=routeFor(state);this.time=0;this.timeLimit=state.chapter===0?40:state.chapter<3?60:Math.max(0,180-(state.fourthElapsed||0));this.phase='ready';this.units=[];this.hazards=this.route.hazards.map(([x,type],id)=>({x,type,id,nextShot:0,shot:null}));this.pending=0;this.deliveries=[];this.spent=0;this.losses=0;this.nextId=1;this.cooldown={};this.events=[];this.settled=false;}
 begin(){if(this.phase==='ready'){this.phase='running';if(this.state.ended)this.phase='result';}}
 notify(text){this.events.push(text);if(this.events.length>20)this.events.shift();}
 spawn(key){const t=TYPES[key];if(this.phase!=='running')return {ok:false,reason:'旅程尚未開始或已結束。'};if(!available(this.state,key))return {ok:false,reason:'這座城市沒有提供這種商品馬。'};if(this.state.money<t.cost)return {ok:false,reason:'經費不足，請保留足夠預算。'};if((this.cooldown[key]||0)>this.time+1e-8)return {ok:false,reason:'此種夥伴正在出發，稍候即可再次購買。'};if(this.units.filter(a=>a.alive&&!a.arrived).length>=45)return {ok:false,reason:'路上商隊已滿，請等候夥伴通過。'};
  this.state.money-=t.cost;this.spent+=t.cost;this.cooldown[key]=this.time+.65;
  const a={id:this.nextId++,key,x:1000,hp:t.hp,maxHp:t.hp,alive:true,arrived:false,stopped:false,manualStop:false,guardId:null,waitingFor:null,goods:t.goods,gear:t.gear,spawned:this.time};this.units.push(a);return {ok:true,unit:a};}
 guard(h){return this.units.filter(a=>a.alive&&!a.arrived&&a.stopped&&!a.manualStop&&a.guardId===h.id&&a.gear===h.type&&Math.abs(a.x-(h.x+GUARD_OFFSET))<1);}
 kill(a,reason){if(!a.alive)return;a.alive=false;a.hp=0;a.goods=0;a.gear=null;a.stopped=false;a.guardId=null;this.losses++;this.notify(`${TYPES[a.key].name}${reason}，裝備與貨物一同消失。`);}
 hurt(a,n,reason){a.hp=Math.max(0,a.hp-n);if(a.hp<1e-8)this.kill(a,reason);}
 toggle(id){const a=this.units.find(u=>u.id===id);if(!a||!a.alive||a.arrived||TYPES[a.key].animal!=='camel'||this.phase!=='running')return false;if(a.guardId!=null){this.notify('駐守駱駝正在支援商隊，會留守至生命耗盡。');return false;}a.manualStop=!a.manualStop;a.stopped=a.manualStop;return true;}
 tick(dt){this.time+=dt;
  // Movement is resolved for everyone before protection and incoming damage.
  for(const a of this.units){if(!a.alive||a.arrived||a.stopped)continue;const t=TYPES[a.key],next=a.x-t.speed*dt;
   const target=t.animal==='camel'?this.hazards.find(h=>h.type===a.gear&&a.x>=h.x+GUARD_OFFSET-1&&next<=h.x+GUARD_OFFSET&&!this.guard(h).length):null;
   if(target){a.x=target.x+GUARD_OFFSET;a.stopped=true;a.guardId=target.id;a.waitingFor=null;this.notify(`${t.name}已在${target.type==='sand'?'流沙':target.type==='wind'?'龍捲風':'弓箭手'}前駐守。`);continue;}
   const blocked=t.animal==='camel'?this.hazards.find(h=>h.type!=='archer'&&h.type!==a.gear&&!this.guard(h).length&&a.x>h.x+RADIUS&&next<=h.x+RADIUS+9):null;
   if(blocked){a.x=Math.max(next,blocked.x+RADIUS+9);a.waitingFor=blocked.id;continue;}a.waitingFor=null;a.x=next;
  }
  // Defenders bridge the trap from its near edge, but still pay its damage.
  for(const h of this.hazards.filter(h=>h.type!=='archer'))for(const a of this.units){if(!a.alive||a.arrived||a.gear!==h.type)continue;if(a.guardId===h.id||Math.abs(a.x-h.x)<=RADIUS)this.hurt(a,HP_DPS[h.type]*dt,'在陷阱中耗盡生命');}
  for(const h of this.hazards.filter(h=>h.type==='archer')){if(this.time+1e-8<h.nextShot)continue;const targets=this.units.filter(a=>a.alive&&!a.arrived&&Math.abs(a.x-h.x)<=ARROW_RANGE).sort((a,b)=>Number(b.gear==='archer')-Number(a.gear==='archer')||Math.abs(a.x-h.x)-Math.abs(b.x-h.x)||a.id-b.id);if(targets.length){const a=targets[0];h.nextShot=this.time+1;h.shot={x:a.x,time:this.time,target:a.id};this.hurt(a,10,'被弓箭擊倒');}}
  for(const h of this.hazards.filter(h=>h.type!=='archer')){const guarded=this.guard(h).length>0;for(const a of this.units)if(a.alive&&!a.arrived&&Math.abs(a.x-h.x)<=RADIUS&&a.gear!==h.type&&!guarded)this.kill(a,'未受保護而陷入險境');}
  for(const a of this.units){if(!a.alive||a.arrived||a.x>0)continue;a.x=0;a.arrived=true;if(a.goods>0&&canSell(this.state,a.key)){const value=TYPES[a.key].sale;this.pending+=value;this.deliveries.push({id:a.id,key:a.key,goods:a.goods,value,time:this.time});this.notify(`${TYPES[a.key].name}通過！${value} 元列入本趟待結算收入。`);}a.goods=0;}
 }
 step(dt){if(this.phase!=='running'||!Number.isFinite(dt)||dt<=0)return;let left=Math.min(dt,Math.max(0,this.timeLimit-this.time));while(left>1e-9){const n=Math.min(.025,left);this.tick(n);left-=n;if(this.state.chapter===3&&this.state.leg==='back'&&this.deliveries.length>0&&this.state.money+this.pending-this.state.baseline>=10000){this.endReason='goal';this.phase='finished';break;}}if(this.state.chapter===3)this.state.fourthElapsed=Math.min(180,(this.startState.fourthElapsed||0)+this.time);if(this.time>=this.timeLimit-1e-8){this.time=this.timeLimit;this.phase='finished';this.endReason=this.endReason||'timeout';}}
 canSettle(){return this.state.chapter===3&&this.phase==='running'&&this.deliveries.length>0&&!this.units.some(a=>a.alive&&!a.arrived&&TYPES[a.key].goods);}
 settle(){if(this.settled)return null;if(this.phase!=='finished'&&!this.canSettle())return null;this.settled=true;this.phase='result';this.state.money+=this.pending;if(this.state.chapter===3){const prev=this.startState.fourthTotals||{passed:0,goods:0,spent:0,revenue:0};this.state.fourthTotals={passed:prev.passed+this.deliveries.length,goods:prev.goods+this.deliveries.reduce((n,a)=>n+a.goods,0),spent:prev.spent+this.spent,revenue:prev.revenue+this.pending};if(this.endReason){this.state.ended=true;this.state.won=this.state.leg==='back'&&this.deliveries.length>0&&this.state.money-this.state.baseline>=10000;this.state.finalScore=this.state.money;}}const report={chapter:this.state.chapter,origin:this.route.origin,destination:this.route.destination,starting:this.startState.money,spent:this.spent,passed:this.deliveries.length,goods:this.deliveries.reduce((s,a)=>s+a.goods,0),revenue:this.pending,balance:this.state.money,losses:this.losses,undelivered:this.units.filter(a=>a.alive&&!a.arrived&&TYPES[a.key].goods).length};return report;}
 advance(){if(!this.settled)return null;const s={...this.state};if(s.chapter<3){s.chapter++;if(s.chapter===3){s.baseline=s.money;s.fourthElapsed=0;s.fourthTotals={passed:0,goods:0,spent:0,revenue:0};}}else{if(s.ended)return s;if(s.leg==='back'&&s.money-s.baseline>=10000)s.won=true;s.leg=s.leg==='out'?'back':'out';if(s.leg==='out')s.round++;}return s;}
}
const api={TYPES,ROUTES,initial,routeFor,available,canSell,Battle,HP_DPS,ARROW_RANGE,RADIUS};if(typeof module!=='undefined'&&module.exports)module.exports=api;root.SilkBattle=api;
})(typeof window!=='undefined'?window:globalThis);
