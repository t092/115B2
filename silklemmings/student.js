/* Same roster lookup and pending-review score service as G2B3. */
(()=>{'use strict';
const $=id=>document.getElementById(id),box=$('loginDialog');let profile=null,pendingProfile=null,busy=false,resolveReady,record=null;
const ready=new Promise(resolve=>resolveReady=resolve);
const read=k=>{try{return JSON.parse(localStorage.getItem(k));}catch{return null;}};
const write=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v));}catch{}};
function key(){return 'silklemmings-result-'+(profile?profile.email:'guest');}
function status(t){$('scoreStatus').textContent=t;$('scoreDialogStatus').textContent=t;}
function enter(p){profile=p;box.close();$('playerLabel').textContent=p?`${p.classId} 班 ${p.seatNo} 號 · ${p.name}`:'訪客遊玩';record=p?read(key()):null;status(p?'通關總金額就是分數；通關後送交教師核對。':'訪客模式：可以遊玩，不會紀錄成績。');$('retryScore').hidden=!(record&&!record.sent);resolveReady();}
$('guestPlay').onclick=()=>{if(!busy)enter(null);};
$('lookupForm').onsubmit=async e=>{e.preventDefault();if(busy)return;busy=true;$('lookupStudent').disabled=true;$('guestPlay').disabled=true;$('loginStatus').textContent='正在查詢學習帳號…';try{const service=window.FirebaseService;if(!service?.isConfigured())throw Error('目前無法連線名冊，可改用訪客遊玩。');const r=await service.loginStudent($('studentEmail').value.trim());if(r.status==='registered'){pendingProfile=r.profile;$('profileClass').textContent=r.profile.classId;$('profileSeat').textContent=r.profile.seatNo;$('profileAlias').value=r.profile.name;$('profileConfirm').hidden=false;$('lookupForm').hidden=true;$('loginStatus').textContent='請確認班級與座號；可修改顯示代號。';}else{$('loginStatus').textContent=r.status==='guest'?'查不到這個帳號。可重新輸入，或選擇訪客遊玩（不紀錄成績）。':r.message||'查詢失敗，請重試或使用訪客模式。';}}catch(err){$('loginStatus').textContent=err.message;}finally{busy=false;$('lookupStudent').disabled=false;$('guestPlay').disabled=false;}};
$('backToLookup').onclick=()=>{pendingProfile=null;$('profileConfirm').hidden=true;$('lookupForm').hidden=false;};
$('confirmStudent').onclick=()=>{if(!pendingProfile)return;const p={...pendingProfile,name:$('profileAlias').value.trim().slice(0,40)||pendingProfile.name};window.FirebaseService.setStudentProfile(p);enter(p);};
box.addEventListener('cancel',e=>e.preventDefault());box.showModal();
async function upload(){if(!profile||!record||record.sent||busy)return;busy=true;$('retryScore').disabled=true;$('retryScoreDialog').disabled=true;status('正在儲存通關成績…');const current=record;try{const service=window.FirebaseService;if(!service?.isConfigured())throw Error('目前無法連線成績服務。');const result=await service.submitScore({unitId:'silklemmings',profile,score:current.score,baseScore:current.score,bonusScore:0,completed:true,isGuest:false,clientSubmissionId:current.id,levelDetails:[{finalMoney:current.score,scoreBasis:'final_balance',startingMoney:5000}]});let success=result.status==='success';
// A lost response can leave an already-created record. Verify the same ID on the server.
if(!success&&window.firebase&&service.getUid()){try{const id=`${service.getUid()}_silklemmings_${current.id}`;const snap=await firebase.firestore().collection('scores').doc(id).get({source:'server'});success=snap.exists&&snap.data().email===profile.email&&snap.data().score===current.score;}catch{}}
if(!success)throw Error(result.message||'成績未送出，請稍後重試。');current.sent=true;write(key(),current);status(`已送出 ${current.score.toLocaleString()} 分，等待教師核對。`);
}catch(err){status(`成績尚未送出：${err.message} 通關分數已暫存，可按「重試送出」。`);}finally{busy=false;$('retryScore').disabled=false;$('retryScoreDialog').disabled=false;$('retryScore').hidden=!!record?.sent;$('retryScoreDialog').hidden=!!record?.sent;}}
$('retryScore').onclick=upload;$('retryScoreDialog').onclick=upload;
function complete(money,runId){$('scoreReceipt').hidden=false;if(!profile){status(`訪客通關：${money.toLocaleString()} 分，不紀錄成績。`);return;}if(record?.id===runId){if(record.sent)status(`已送出 ${record.score.toLocaleString()} 分，等待教師核對。`);else upload();return;}record={id:runId,score:Math.max(0,Math.floor(money)),sent:false};write(key(),record);upload();}
window.SilkStudent={ready,complete,storageKey:()=>profile?'silklemmings-battle-student-'+profile.email:'silklemmings-battle-v2',isGuest:()=>!profile};
})();
