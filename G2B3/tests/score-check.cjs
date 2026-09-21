const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const forge = require('node-forge');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const keys = crypto.generateKeyPairSync('rsa', {modulusLength: 2048});
const cert = forge.pki.createCertificate();
cert.publicKey = forge.pki.publicKeyFromPem(keys.publicKey.export({type:'spki',format:'pem'}));
cert.serialNumber = '01'; cert.validity.notBefore = new Date();
cert.validity.notAfter = new Date(Date.now() + 86400000);
cert.setSubject([{name:'commonName',value:'test'}]); cert.setIssuer(cert.subject.attributes);
cert.sign(forge.pki.privateKeyFromPem(keys.privateKey.export({type:'pkcs8',format:'pem'})), forge.md.sha256.create());
const pem = forge.pki.certificateToPem(cert);
const audience = '403500919614-4c109l85fn6hul7nng2nskbs9kn4reis.apps.googleusercontent.com';
function token(overrides = {}, header = {}) {
  const claims = {aud:audience,iss:'https://accounts.google.com',exp:Math.floor(Date.now()/1000)+3600,
    iat:Math.floor(Date.now()/1000),sub:'student-1',email:'student@st.tc.edu.tw',email_verified:true,hd:'st.tc.edu.tw',...overrides};
  const body = [Buffer.from(JSON.stringify({alg:'RS256',kid:'test-key',...header})).toString('base64url'),
    Buffer.from(JSON.stringify(claims)).toString('base64url')].join('.');
  return body+'.'+crypto.sign('RSA-SHA256',Buffer.from(body),keys.privateKey).toString('base64url');
}
function backend() {
  const rows = [Array(10).fill('existing header')];
  const cache = new Map();
  const sheet = {
    getLastRow:()=>rows.length, appendRow: row=>rows.push(row),
    getRange: (r,c)=>({getValue:()=>rows[r-1]?.[c-1] || '',setValue:value=>{rows[r-1][c-1]=value;},
      createTextFinder: value=>({matchEntireCell:()=>({findNext:()=>rows.slice(1).some(row=>row[c-1]===value)})})})
  };
  const context = vm.createContext({
    CacheService:{getScriptCache:()=>({get:k=>cache.get(k),put:(k,v)=>cache.set(k,v),remove:k=>cache.delete(k)})},
    UrlFetchApp:{fetch:()=>({getResponseCode:()=>200,getContentText:()=>JSON.stringify({'test-key':pem}),getAllHeaders:()=>({'Cache-Control':'max-age=3600'})})},
    SpreadsheetApp:{openById:()=>({getSheetByName:()=>sheet})},
    LockService:{getScriptLock:()=>({waitLock(){},releaseLock(){}})},
    Utilities:{formatDate:()=> '2026/09/21'},
    ContentService:{MimeType:{JSON:'json'},createTextOutput:text=>({setMimeType:()=>JSON.parse(text)})}
  });
  for (const file of ['gas/Forge.js','gas/Auth.js','gas/程式碼.js']) vm.runInContext(read(file),context);
  const post = overrides=>context.doPost({postData:{contents:JSON.stringify({
    idToken:token(),unitName:'二上第1課_商周至隋唐的國家與社會',submissionId:'11111111-1111-4111-8111-111111111111',
    class:'201',seat:'1',name:'學生',score:100,stars:3,...overrides})}});
  return {context, rows, post};
}
test('GAS verifies real RSA signatures and rejects invalid identity claims before writing',()=>{
  const {post,rows} = backend();
  for (const idToken of [undefined,'invalid',token({aud:'another-app'}),token({exp:1}),token({hd:'other.edu.tw'}),
      token({email_verified:false}),token({iss:'attacker'}),token({}, {alg:'none'}),token({sub:''}),token({email:'other@example.com'})]) {
    assert.equal(post({idToken}).status,'error');
    assert.equal(rows.length,1);
  }
  const signed = token();
  const parts = signed.split('.');
  parts[1] = Buffer.from(JSON.stringify({...JSON.parse(Buffer.from(parts[1],'base64url')),email:'forged@st.tc.edu.tw'})).toString('base64url');
  assert.equal(post({idToken:parts.join('.')}).status,'error');
  const result = post({email:'forged@st.tc.edu.tw'});
  assert.equal(result.status,'success',JSON.stringify(result));
  assert.equal(rows[1][1],'student@st.tc.edu.tw');
});
test('GAS validates score fields, protects sheet text and deduplicates retries',()=>{
  const {post,rows} = backend();
  for (const input of [{score:-1},{score:1001},{stars:1.5},{unitName:'arbitrary-sheet'},{submissionId:''},{name:''}]) {
    assert.equal(post(input).status,'error');
  }
  assert.equal(rows.length,1);
  assert.equal(post({name:'=IMPORTXML("x")'}).status,'success');
  assert.equal(rows[1][4],'\'=IMPORTXML("x")');
  assert.equal(post().status,'success'); assert.equal(rows.length,2);
  assert.equal(rows[0][10],'作業識別碼');
});
function frontend(fetch) {
  const elements = new Map();
  const firebaseCalls = [];
  const firebaseService = {
    isConfigured:()=>true,
    submitScore:async data=>{firebaseCalls.push(data);return {status:'success'};}
  };
  const context = vm.createContext({crypto,fetch,AbortController,setTimeout,clearTimeout,
    atob:value=>Buffer.from(value,'base64').toString('binary'),
    FirebaseService:firebaseService,
    window:{addEventListener(){},FirebaseService:firebaseService},document:{getElementById:id=>{
      if(!elements.has(id)) elements.set(id,{}); return elements.get(id);
    }},console});
  vm.runInContext(read('app.js'),context);
  vm.runInContext('gameState.challenge.completed=true; gameState.student.registered=true; gameState.student.email="student@st.tc.edu.tw";',context);
  return {context,elements,firebaseCalls};
}
test('upload sends the unified score shape to Firebase',async()=>{
  const {context,elements,firebaseCalls} = frontend(async()=>{});
  await context.uploadScoreToGAS();
  assert.match(elements.get('certCloudSyncPill').className,/success/);
  assert.equal(firebaseCalls.length,1);
  assert.deepEqual(
    Object.fromEntries(['classId','seatNo','email'].map(key => [key, firebaseCalls[0].profile[key]])),
    {classId:'201',seatNo:'1',email:'student@st.tc.edu.tw'}
  );
});
test('guest mode does not submit a formal score',async()=>{
  const {context,firebaseCalls} = frontend(async()=>{});
  vm.runInContext('gameState.student.registered=false;',context);
  await context.uploadScoreToGAS();
  assert.equal(firebaseCalls[0].isGuest,true);
});
