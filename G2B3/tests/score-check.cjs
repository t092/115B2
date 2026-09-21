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
const audience = '985010177875-fg8ipntq0tva6sjdph6geokhh5spf9ll.apps.googleusercontent.com';
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
  const context = vm.createContext({crypto,fetch,AbortController,setTimeout,clearTimeout,
    atob:value=>Buffer.from(value,'base64').toString('binary'),
    window:{addEventListener(){}},document:{getElementById:id=>{
      if(!elements.has(id)) elements.set(id,{}); return elements.get(id);
    }},console});
  vm.runInContext(read('app.js'),context);
  context.testToken = token();
  vm.runInContext('gameState.challenge.completed=true; gameState.student.authenticated=true; gameState.student.idToken=testToken;',context);
  return {context,elements};
}
test('upload only confirms matching server receipts and preserves ID across retries',async()=>{
  let mode = 'network', ids = [];
  const {context,elements} = frontend(async (_url, options)=>{
    const body = JSON.parse(options.body); ids.push(body.submissionId);
    assert.ok(body.idToken); assert.equal(body.email,undefined); assert.notEqual(options.mode,'no-cors');
    if(mode==='network') throw new Error('offline');
    return {ok:true,json:async()=> mode==='success'?{status:'success',submissionId:body.submissionId}:{status:'error',message:'憑證過期'}};
  });
  await context.uploadScoreToGAS();
  assert.match(elements.get('certCloudSyncPill').className,/error/);
  mode='rejected'; await context.uploadScoreToGAS();
  assert.match(elements.get('certCloudSyncText').innerText,/憑證過期/);
  mode='success'; await context.uploadScoreToGAS();
  assert.match(elements.get('certCloudSyncPill').className,/success/);
  assert.equal(new Set(ids).size,1);
});
test('guest and expired logins never submit a score',async()=>{
  let calls=0;
  const {context,elements} = frontend(async()=>{calls++;});
  vm.runInContext('gameState.student.authenticated=false;',context);
  await context.uploadScoreToGAS();
  context.testToken=token({exp:1});
  vm.runInContext('gameState.student.authenticated=true; gameState.student.idToken=testToken;',context);
  await context.uploadScoreToGAS();
  assert.equal(calls,0); assert.match(elements.get('certCloudSyncText').innerText,/重新登入/);
});
