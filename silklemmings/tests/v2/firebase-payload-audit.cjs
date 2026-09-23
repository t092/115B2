const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const path = require('node:path');
const writes = [];
const storage = new Map();
const firestore = () => ({collection: name => ({doc: id => ({set: async payload => writes.push({name, id, payload})})})});
firestore.FieldValue = {serverTimestamp: () => 'mock-server-time'};
const context = {console, crypto: require('node:crypto'), sessionStorage: {getItem: k => storage.get(k), setItem: (k,v) => storage.set(k,v)}};
context.window = context;
context.CAI_FIREBASE_CONFIG = {apiKey:'mock',authDomain:'mock',projectId:'mock',appId:'mock'};
context.CAI_FIREBASE_OPTIONS = {anonymousSession:true};
context.firebase = {apps:[],initializeApp:()=>({}),auth:()=>({currentUser:{uid:'mock-uid'}}),firestore};
vm.runInNewContext(fs.readFileSync(path.resolve(__dirname,'../../../firebase-service.js'),'utf8'),context);
(async () => {
  const profile = {registered:true,email:'test@example.test',classId:'701',seatNo:'1',name:'模擬'};
  for (const [unitId,baseScore,bonusScore] of [['G2B3',500,0],['G2B3L21',500,0],['DynaSoKOBAN',100,150],['silklemmings',40930,0]]) {
    const result = await context.FirebaseService.submitScore({unitId,profile,score:baseScore+bonusScore,baseScore,bonusScore,completed:true,hiddenLevelUnlocked:bonusScore>0,hiddenLevelCompleted:bonusScore>0});
    assert.equal(result.status,'success');
    const p = writes.at(-1).payload;
    assert.equal(p.unitName,unitId);
    assert.equal(p.totalScore,baseScore+bonusScore);
    assert.equal(p.score,p.totalScore);
    assert.equal(p.uid,'mock-uid');
    assert.equal(p.status,'pending_review');
    assert.equal(typeof p.class,'string');
    assert.equal(typeof p.seat,'string');
    assert.equal(p.completed,true);
  }
  await context.FirebaseService.submitScore({unitId:'G2B3',isGuest:true});
  await context.FirebaseService.submitScore({unitId:'G2B3',profile:{registered:false}});
  assert.equal(writes.length,4);
  console.log('PASS: four unit payloads, score arithmetic, roster fields, guest/non-roster no writes. Mock transport only; not a live Firestore upload.');
})().catch(error=>{console.error(error);process.exitCode=1;});
