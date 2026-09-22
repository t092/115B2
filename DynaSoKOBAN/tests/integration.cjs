const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'../..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
test('shared GAS routes dynasty scores to separate sheets with verified identity',()=>{
 const sheets=new Map();
 function sheet(){const rows=[];return {rows,appendRow:r=>rows.push(r),setFrozenRows(){},getDataRange:()=>({getValues:()=>rows}),getRange:(r,c)=>{
   const range={setFontWeight:()=>range,setBackground:()=>range,setFontColor:()=>range,setHorizontalAlignment:()=>range,setValues:values=>values[0].forEach((v,i)=>rows[r-1][c-1+i]=v)};return range;
 }};}
 const ss={getSheetByName:n=>sheets.get(n),insertSheet:n=>{const s=sheet();sheets.set(n,s);return s;}};
 let requestedId;
 const context=vm.createContext({SpreadsheetApp:{openById:id=>{requestedId=id;return ss;}},
 LockService:{getScriptLock:()=>({waitLock(){},releaseLock(){}})},Utilities:{formatDate:()=> 'now'},
 ContentService:{MimeType:{JSON:'JSON'},createTextOutput:text=>({setMimeType:()=>JSON.parse(text)})}});
 for(const p of ['G2B3/gas/Auth.js','G2B3/gas/Dynasty.js','G2B3/gas/程式碼.js'])vm.runInContext(read(p),context);
 context.verifyStudentToken=token=>{if(token!=='valid')throw Error('invalid token');return {email:'verified@st.tc.edu.tw'};};
 const data={unitName:'DynaSoKOBAN',action:'submitScore',idToken:'valid',email:'forged@st.tc.edu.tw',name:'學生',classId:'201',seatNo:'1',totalScore:80,moves:12,durationSeconds:30,maxLevel:1,levelDetails:[],isCompleted:false};
 const post=d=>context.doPost({postData:{contents:JSON.stringify(d)}});
 assert.equal(post({...data,idToken:'bad'}).status,'error');assert.equal(sheets.size,0);
 assert.equal(post(data).status,'success');
 assert.equal(requestedId,'1z5m8l6LSthe0-c9d7hKEuDN3LswTsIg5CNGZP_p9uDQ');
 assert.equal(sheets.get('朝代方塊_成績歷程').rows[1][1],'verified@st.tc.edu.tw');
 assert.equal(sheets.has('二上第1課_商周至隋唐的國家與社會'),false);
 const result=context.doGet({parameter:{unitName:'DynaSoKOBAN',action:'getLeaderboard',classId:'201'}});
 assert.equal(result.topList[0].score,80);assert.equal(result.topList[0].email,undefined);
 assert.equal(post({...data,totalScore:100}).status,'success');
 assert.equal(sheets.get('朝代方塊_即時排行榜').rows.length,2);
 assert.equal(context.doGet({parameter:{}}).status,'online');
});
test('client submits dynasty scores through Firebase without Google authentication',async()=>{
  const storage=new Map(),firebaseCalls=[];
  const firebaseService={
   isConfigured:()=>true,
   setStudentProfile:profile=>firebaseCalls.push({type:'profile',profile}),
   submitScore:async data=>{firebaseCalls.push({type:'submit',data});return {status:'success'}},
   getLeaderboard:async()=>({status:'error',topList:[]})
  };
  const c=vm.createContext({window:{FirebaseService:firebaseService},FirebaseService:firebaseService,
  sessionStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},console});
  vm.runInContext(read('DynaSoKOBAN/cai-service.js'),c);
  const config=vm.runInContext('CAI_CONFIG',c),api=c.window.CAI;
  assert.equal(config.UNIT_NAME,'DynaSoKOBAN');
  api.setGuestMode();assert.equal((await api.submitScore({})).status,'guest');assert.equal(firebaseCalls.length,0);
  api.setStudent({name:'學生',email:'student@st.tc.edu.tw',registered:true,classId:'201',seatNo:'1'});
  assert.equal((await api.submitScore({totalScore:10})).status,'success');
  assert.equal(firebaseCalls.find(call=>call.type==='submit').data.profile.classId,'201');
  assert.equal(firebaseCalls.find(call=>call.type==='submit').data.isGuest,false);
  await api.submitScore({
    totalScore:250,baseScore:100,bonusScore:150,hiddenLevelUnlocked:true,
    hiddenLevelCompleted:true,hiddenLevelScore:162,hiddenLevelDurationSeconds:48,
    hiddenReward:'milk_tea',clientSubmissionId:'dyna-test-submission'
  });
  const bonusSubmission=firebaseCalls.filter(call=>call.type==='submit').at(-1).data;
  assert.deepEqual(
    Object.fromEntries(['totalScore','baseScore','bonusScore','hiddenLevelCompleted','hiddenLevelScore','hiddenReward','clientSubmissionId']
      .map(key=>[key,bonusSubmission[key]])),
    {totalScore:250,baseScore:100,bonusScore:150,hiddenLevelCompleted:true,hiddenLevelScore:162,hiddenReward:'milk_tea',clientSubmissionId:'dyna-test-submission'}
  );
  await api.getLeaderboard('201');
  api.logout();assert.equal(api.getStudent(),null);
});
