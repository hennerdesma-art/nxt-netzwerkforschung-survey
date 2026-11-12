const fs=require('fs');const vm=require('vm');const path=require('path');const assert=require('assert').strict;
const src=fs.readFileSync(path.join(__dirname,'..','supabase','functions','team-access','index.ts'),'utf8').replace(/^import .*?;\n/m,'');
const adminId='11111111-1111-4111-8111-111111111111', userId='22222222-2222-4222-8222-222222222222';
const members=[{user_id:adminId,role:'admin',active:true,display_name:'Admin',created_at:'2026-11-01'},{user_id:userId,role:'interviewer',active:true,display_name:'Interviewer',created_at:'2026-11-02'}];
const users=[{id:adminId,email:'admin@example.edu',email_confirmed_at:'2026-11-01'},{id:userId,email:'team@example.edu',email_confirmed_at:'2026-11-02'}];
const audit=[];
class Q {constructor(table){this.table=table;this.filters=[];this.pendingInsert=null;this.pendingUpdate=null;this.count=false;}select(_s,options){this.count=options?.count==='exact';return this}eq(k,v){this.filters.push([k,v]);return this}gte(k,v){this.filters.push([k,v]);return this}order(){return this}limit(){return this}maybeSingle(){return Promise.resolve({data:this.records()[0]||null,error:null})}single(){return this.maybeSingle()}insert(row){this.pendingInsert=row;return this}update(patch){this.pendingUpdate=patch;return this}records(){const tbl=this.table==='survey_members'?members:audit;return tbl.filter(x=>this.filters.every(([k,v])=>k==='created_at'?true:x[k]===v))}then(resolve,reject){if(this.pendingInsert){const tbl=this.table==='survey_members'?members:audit;tbl.push(this.pendingInsert);resolve({data:null,error:null});return}if(this.pendingUpdate){for(const m of this.records())Object.assign(m,this.pendingUpdate);resolve({data:null,error:null});return}if(this.count){resolve({data:null,count:this.records().length,error:null});return}resolve({data:this.records(),error:null});}}
const clientAdmin={from:t=>new Q(t),auth:{admin:{listUsers:async()=>({data:{users},error:null}),generateLink:async({email})=>{const newUser={id:'33333333-3333-4333-8333-333333333333',email};users.push(newUser);return {data:{user:newUser,properties:{hashed_token:'a1'.repeat(32)}},error:null}},deleteUser:async()=>({})}}};
const clientPublic={auth:{getUser:async token=>{if(token==='tok-admin-'+('a'.repeat(70)))return {data:{user:{id:adminId}},error:null};if(token==='tok-member-'+('a'.repeat(70)))return {data:{user:{id:userId}},error:null};return {data:{user:null},error:{message:'bad jwt'}}}}};
let handler;
const Deno={env:{get:k=>({SUPABASE_URL:'https://test.supabase.co',SUPABASE_SECRET_KEYS:'{"default":"service-secret"}',SUPABASE_PUBLISHABLE_KEYS:'{"default":"public-key"}'})[k]||null},serve:h=>{handler=h}};
const context={createClient:(_u,k)=>k==='service-secret'?clientAdmin:clientPublic,Deno,Response,URL,Date,Map,Set,JSON,Math,encodeURIComponent,console};
vm.runInNewContext(src,context);
async function invoke(body,token='tok-admin-'+('a'.repeat(70)),origin='https://hennerdesma-art.github.io') {const req=new Request('https://test.supabase.co/functions/v1/team-access',{method:'POST',headers:{Origin:origin,Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify(body)});const result=await handler(req);return {status:result.status,data:await result.json()}}
(async()=>{
 let r=await invoke({action:'list'});assert.equal(r.status,200);assert.equal(r.data.members.length,2);
 r=await invoke({action:'list'},'tok-member-'+('a'.repeat(70)));assert.equal(r.status,403);
 r=await invoke({action:'invite',email:'bad-email',display_name:'Test'});assert.equal(r.status,400);
 r=await invoke({action:'invite',email:'new@example.edu',display_name:'New Team Member',role:'interviewer'});assert.equal(r.status,200);assert.equal(r.data.status,'invited');assert(r.data.invite_link.includes('#nxt_invite='));assert(!r.data.invite_link.includes('service-secret'));assert.equal(members.length,3);assert.equal(audit[0].action,'invite');
 r=await invoke({action:'invite',email:'new@example.edu',display_name:'Duplicate Person'});assert.equal(r.status,409);
 r=await invoke({action:'set_active',user_id:adminId,active:false});assert.equal(r.status,403);
 r=await invoke({action:'set_active',user_id:userId,active:false});assert.equal(r.status,200);assert.equal(members.find(x=>x.user_id===userId).active,false);
 r=await invoke({action:'list'},'tok-admin-'+('a'.repeat(70)),'https://evil.invalid');assert.equal(r.status,403);
 console.log('Team-access Edge Function smoke tests: PASS (list, authorization, invite, duplicate, disable, self-protect, origin)');
})().catch(e=>{console.error(e);process.exit(1)});