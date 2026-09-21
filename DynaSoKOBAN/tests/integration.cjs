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
test('client shares G2B3 OAuth and sends credential plus routing discriminator',async()=>{
 const storage=new Map(),calls=[];
 const c=vm.createContext({window:{},sessionStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},atob:s=>Buffer.from(s,'base64').toString('binary'),console,
 fetch:async(url,options)=>{calls.push({url,options});return {ok:true,json:async()=>({status:'success'})};}});
 vm.runInContext(read('DynaSoKOBAN/cai-service.js'),c);
 const config=vm.runInContext('CAI_CONFIG',c),api=c.window.CAI;
 assert.ok(read('G2B3/app.js').includes(config.CLIENT_ID));assert.ok(read('G2B3/app.js').includes(config.GAS_API_URL));
 api.setGuestMode();assert.equal((await api.submitScore({})).status,'guest');assert.equal(calls.length,0);
 const idToken='x.'+Buffer.from(JSON.stringify({exp:Date.now()/1000+300})).toString('base64url')+'.x';
 api.setStudent({email:'student@st.tc.edu.tw',idToken,name:'學生',classId:'201',seatNo:'1'});
 assert.equal((await api.submitScore({totalScore:10})).status,'success');
 const body=JSON.parse(calls[0].options.body);assert.equal(body.idToken,idToken);assert.equal(body.unitName,'DynaSoKOBAN');assert.equal(body.email,undefined);
 await api.getLeaderboard('201');assert.match(calls[1].url,/unitName=DynaSoKOBAN/);
 api.logout();assert.equal(api.getStudent(),null);
});
