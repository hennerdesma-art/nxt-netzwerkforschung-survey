"""Offline Chromium smoke test. Uses synthetic data; no real backend credentials."""
import os
import time
import subprocess
import base64
import re
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
MOCK = r'''
window.NXT_CONFIG={SUPABASE_URL:'https://mock.supabase.co', SUPABASE_PUBLISHABLE_KEY:'sb_publishable_mock', AUTH_EMAIL:'test@example.org', TARGET_COUNT:40};
const persons=Array.from({length:9},(_,i)=>({id:'p'+(i+1),code:'NXT-'+String(i+1).padStart(3,'0'),full_name:'Person '+String(i+1).padStart(3,'0'),role_group:i%2?'Wissenschaftliche Mitarbeitende':'Professor:innen',building:['5','16','17','21','D'][i%5],room:String(100+i),professional_title:'',unit:''}));
const interviews=[{id:'i1',person_id:'p1',status:'completed',interviewer_name:'Testteam',version:2,started_at:'2026-11-10T10:20:00Z',updated_at:'2026-11-10T11:00:00Z'}, {id:'i2',person_id:'p2',status:'in_progress',interviewer_name:'Testteam',version:1,started_at:'2026-11-10T12:00:00Z',updated_at:'2026-11-10T12:30:00Z'}];
const edges=[{id:'e1',interview_id:'i1',source_person_id:'p1',target_person_id:'p2',topics:['Forschung'],frequency:'woechentlich',exchange_mode:'persoenlich'}, {id:'e2',interview_id:'i1',source_person_id:'p1',target_person_id:'p3',topics:['Lehre'],frequency:'monatlich',exchange_mode:'digital'}];
const locations=[];const answers=[{interview_id:'i1',question_key:'no_exchange',answer:false}];
const data={persons, interviews, edges, locations, answers, survey_members:[{user_id:'mock-id',role:'admin',active:true,display_name:'NXT Testteam'}]};
class Query {constructor(t){this.t=t;this.filters=[];this.kind='select';} select(){return this;} eq(k,v){this.filters.push([k,v]);return this;} maybeSingle(){return Promise.resolve({data:this.result()[0]||null,error:null});} single(){let r;if(this.kind==='insert'){r=(Array.isArray(this.payload)?this.payload:[this.payload]).map((x,i)=>({id:'x'+Math.random().toString(36).slice(2),version:0,status:'planned',...x})); data[this.t].push(...r);}else r=this.result();return Promise.resolve({data:r[0]||null,error:null});} limit(){return Promise.resolve({data:this.result(),error:null});} range(from,to){return Promise.resolve({data:this.result().slice(from,to+1),error:null});} insert(payload){this.kind='insert';this.payload=payload;return this;} result(){return data[this.t].filter(r=>this.filters.every(([k,v])=>r[k]===v));} then(ok){if(this.kind==='insert'){data[this.t].push(...(Array.isArray(this.payload)?this.payload:[this.payload]).map(x=>({id:'x'+Math.random(),...x})));return Promise.resolve({data:this.payload,error:null}).then(ok);}return Promise.resolve({data:this.result(),error:null}).then(ok);}}
const db={auth:{getSession:async()=>({data:{session:null},error:null}),signInWithPassword:async({password})=>password==='testing-password'?{data:{user:{id:'mock-id'}},error:null}:{error:{message:'bad password'}},signOut:async()=>({})},from:t=>new Query(t),channel:()=>({on(){return this},subscribe(){return this}}),removeChannel:async()=>{},rpc:async(name,params)=>{const i=interviews.find(x=>x.id===params.p_interview_id);if(!i||i.version!==params.p_expected_version)return {error:{message:'INTERVIEW_CONFLICT_OR_MISSING'}};Object.assign(i,{version:i.version+1,status:params.p_status,interviewer_name:params.p_interviewer_name,updated_at:new Date().toISOString()});edges.splice(0,edges.length,...params.p_edges.map((e,idx)=>({...e,id:'e_'+idx,interview_id:i.id,source_person_id:i.person_id})));return {data:i.version,error:null};}};
window.supabase={createClient:()=>db};
window.XLSX={utils:{book_new:()=>({SheetNames:[]}),aoa_to_sheet:a=>({a}),book_append_sheet:(wb,ws,name)=>wb.SheetNames.push(name),encode_col:x=>'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[x]},writeFile:(wb,name)=>{window.mockExport={sheets:wb.SheetNames,name}}};
'''
server = subprocess.Popen(['python3','-m','http.server','8769','--bind','127.0.0.1'],cwd=ROOT,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
try:
    with sync_playwright() as p:
        browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
        page=browser.new_page(viewport={'width':1440,'height':960},device_scale_factor=1)
        errors=[]
        page.on('pageerror',lambda error:errors.append(str(error)))
        page.route('**/cdn.jsdelivr.net/**',lambda route:route.fulfill(status=200,content_type='text/javascript',body='window.__CDN_LOADED=true;'))
        page.route('**/cdn.sheetjs.com/**',lambda route:route.fulfill(status=200,content_type='text/javascript',body=''))
        page.route('**/js/config.js',lambda route:route.fulfill(status=200,content_type='text/javascript',body=MOCK))
        html=(ROOT/'index.html').read_text()
        css=(ROOT/'css/styles.css').read_text()
        app=(ROOT/'js/app.js').read_text()
        logo='data:image/png;base64,'+base64.b64encode((ROOT/'assets/nxt-logo.png').read_bytes()).decode('ascii')
        app=app.replace('./assets/nxt-logo.png',logo)
        html=html.replace('./assets/nxt-logo.png',logo)
        html=re.sub(r'<link rel=\"stylesheet\"[^>]+>', '<style>'+css+'</style>',html)
        html=re.sub(r'<script defer[^>]+></script>', '',html)
        html=html.replace('</body>','<script>'+MOCK+'</script><script>'+app+'</script></body>')
        page.set_content(html,wait_until='domcontentloaded')
        page.wait_for_selector('#password',timeout=15000)
        page.locator('#password').fill('wrongwrong')
        page.locator('#login-form button').click()
        page.locator('.form-error').wait_for(timeout=5000)
        page.locator('#password').fill('testing-password')
        page.locator('#login-form button').click()
        page.wait_for_selector('.stat-grid',timeout=15000)
        page.locator('.toast-region').evaluate('(el)=>el.replaceChildren()')
        page.screenshot(path='/mnt/data/nxt-web-preview-desktop.png',full_page=True)
        assert page.locator('.stat-number').count()==4
        page.locator('[data-route="people"]').first.click()
        page.wait_for_selector('#people-list')
        assert page.locator('#people-list tbody tr').count()==9
        page.locator('[data-action="open-interview"]').first.click()
        page.wait_for_selector('[data-field="role_group"]',timeout=10000)
        page.locator('[data-field="role_group"]').select_option('Professor:innen')
        page.locator('[data-action="next-step"]').click()
        page.locator('[data-action="add-edge"]').click()
        page.locator('[data-edge-field="target_person_id"]').last.select_option('p4')
        page.locator('[data-action="save-draft"]').click()
        page.get_by_text('Interviewentwurf zentral gespeichert.').wait_for(timeout=10000)
        page.locator('[data-route="export"]').first.click()
        page.locator('[data-action="export-xlsx"]').click()
        page.wait_for_function("window.mockExport && window.mockExport.sheets.length===7",timeout=10000)
        assert 'Edges' in page.evaluate('window.mockExport.sheets')
        page.set_viewport_size({'width':390,'height':844})
        page.locator('[data-route="dashboard"]').first.evaluate('(el)=>el.click()')
        page.locator('.toast-region').evaluate('(el)=>el.replaceChildren()')
        page.screenshot(path='/mnt/data/nxt-web-preview-mobile.png',full_page=True)
        assert not errors, 'Browser errors: '+str(errors)
        print('SMOKE TEST PASSED: login, wrong password, dashboard, persons, edit, save, 7-sheet export, mobile. Screenshots saved.')
        browser.close()
finally:
    server.terminate()
    server.wait(timeout=5)
