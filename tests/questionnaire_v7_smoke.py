"""Offline Chromium regression test. Synthetic data only; never connects to Supabase."""
from pathlib import Path
import base64
import re
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
MOCK=r'''
window.NXT_CONFIG={SUPABASE_URL:'https://mock.invalid', SUPABASE_PUBLISHABLE_KEY:'sb_publishable_test_only', AUTH_EMAIL:'', TARGET_COUNT:39};
const data={persons:Array.from({length:9},(_,i)=>({id:'p'+(i+1),code:'P'+String(i+1).padStart(2,'0'),full_name:'Testperson '+String(i+1).padStart(2,'0'),role_group:null,building:null,room:null,professional_title:null,unit:null})),interviews:[],edges:[],locations:[],answers:[],survey_members:[{user_id:'mock-id',role:'admin',active:true,display_name:'Test Team'}]};
class Query{
 constructor(t){this.t=t;this.filters=[];this.kind='select';this.payload=null;}
 select(){return this;}eq(k,v){this.filters.push([k,v]);return this;}
 maybeSingle(){return Promise.resolve({data:this.result()[0]||null,error:null});}
 single(){if(this.kind==='insert'){const r={id:'id'+(Math.random()+'').slice(2),version:0,...this.payload};data[this.t].push(r);return Promise.resolve({data:r,error:null});}return Promise.resolve({data:this.result()[0]||null,error:null});}
 limit(){return Promise.resolve({data:this.result(),error:null});} range(a,b){return Promise.resolve({data:this.result().slice(a,b+1),error:null});}
 insert(p){this.kind='insert';this.payload=p;return this;}
 result(){return data[this.t].filter(r=>this.filters.every(([k,v])=>r[k]===v));}
 then(fn){if(this.kind==='insert'){const a=Array.isArray(this.payload)?this.payload:[this.payload];data[this.t].push(...a.map(x=>({id:'id'+Math.random(),...x})));return Promise.resolve({data:a,error:null}).then(fn);}return Promise.resolve({data:this.result(),error:null}).then(fn);}
}
const db={auth:{getSession:async()=>({data:{session:null},error:null}),signInWithPassword:async({email,password})=>(email==='test@example.org'&&password==='testing-password')?{data:{user:{id:'mock-id'}},error:null}:{error:{message:'invalid'}},signOut:async()=>({})},from:t=>new Query(t),channel:()=>({on(){return this},subscribe(){return this}}),removeChannel:async()=>{},rpc:async(name,p)=>{const i=data.interviews.find(x=>x.id===p.p_interview_id);if(!i||i.version!==p.p_expected_version)return {error:{message:'INTERVIEW_CONFLICT_OR_MISSING'}};i.version+=1;i.status=p.p_status;i.interviewer_name=p.p_interviewer_name;i.updated_at=new Date().toISOString();data.answers.splice(0,data.answers.length,...p.p_answers.map(x=>({interview_id:i.id,...x})));data.edges.splice(0,data.edges.length,...p.p_edges.map((x,j)=>({id:'e'+j,interview_id:i.id,source_person_id:i.person_id,...x})));data.locations.splice(0,data.locations.length,...p.p_locations.map(x=>({person_id:i.person_id,...x})));window.lastRPC=p;return {data:i.version,error:null};}};
window.supabase={createClient:()=>db};
window.XLSX={utils:{book_new:()=>({SheetNames:[],Sheets:{}}),aoa_to_sheet:a=>({rows:a}),book_append_sheet:(wb,ws,name)=>{wb.SheetNames.push(name);wb.Sheets[name]=ws;},encode_col:n=>String.fromCharCode(65+n)},writeFile:(wb,filename)=>{window.mockExport={sheets:wb.SheetNames,filename,rows:wb.Sheets}}};
'''

def inline_app():
    html=(ROOT/'index.html').read_text(encoding='utf-8')
    css=(ROOT/'css/styles.css').read_text(encoding='utf-8')
    js=(ROOT/'js/app.js').read_text(encoding='utf-8')
    q=(ROOT/'js/questionnaire.js').read_text(encoding='utf-8')
    logo='data:image/png;base64,'+base64.b64encode((ROOT/'assets/nxt-logo.png').read_bytes()).decode('ascii')
    js=js.replace('./assets/nxt-logo.png',logo)
    html=re.sub(r'<link rel="stylesheet"[^>]+>', '<style>'+css+'</style>',html)
    html=re.sub(r'<script defer[^>]+></script>', '',html)
    return html.replace('</body>', '<script>'+MOCK+'</script><script>'+q+'</script><script>'+js+'</script></body>')

with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':1365,'height':900},device_scale_factor=1)
    errors=[]
    page.on('pageerror',lambda err:errors.append(str(err)))
    page.set_content(inline_app(),wait_until='domcontentloaded')
    page.wait_for_selector('#email',timeout=10000)
    page.locator('#email').fill('test@example.org')
    page.locator('#password').fill('testing-password')
    page.locator('#login-form button').click()
    page.wait_for_selector('.stat-grid',timeout=10000)
    assert page.locator('.stat-number').first.inner_text()=='9'
    page.locator('[data-route="people"]').first.click()
    page.locator('[data-action="open-interview"]').first.click()
    page.wait_for_selector('[data-answer="Einwilligung"]',timeout=10000)
    # Intro/consent and all six Section A questions.
    page.locator('[data-answer="Einwilligung"]').select_option(label='Ja, ich bin einverstanden.')
    page.locator('[data-answer="A1_Gruppe"]').select_option(label='Professor:in')
    page.locator('[data-answer="A2_Kategorie"]').select_option(label='Logistik & Operations')
    page.locator('[data-answer="A3_Selbstbezeichnung"]').fill('Projektleitung')
    page.locator('[data-answer="A4_Alter"]').select_option(label='30–39')
    page.locator('[data-answer="A5_Geschlecht"]').select_option(label='keine Angabe')
    page.locator('[data-answer="A6_vor_NXT"]').select_option(label='Ja')
    page.locator('[data-answer="Interview_Nr"]').fill('07')
    page.locator('[data-field="interviewer_name"]').fill('NW')
    page.locator('[data-answer="Datum"]').fill('2026-11-11')
    page.locator('[data-action="next-step"]').click()
    page.wait_for_selector('#peer-results')
    assert page.locator('.q-peer').count()==8
    page.locator('[data-action="toggle-peer"]').first.click()
    page.locator('[data-edge-field="topics_single"]').select_option('F')
    page.locator('[data-edge-field="frequency"]').select_option('4')
    page.locator('[data-edge-field="exchange_mode"]').select_option('S')
    page.locator('[data-edge-field="exchange_medium"]').select_option('P')
    page.locator('[data-edge-field="known_before_nxt"]').select_option('false')
    page.locator('[data-answer="B_Aussage_Austausch_wichtig"]').select_option(label='trifft voll zu')
    page.locator('[data-action="next-step"]').click()
    page.wait_for_selector('[data-answer="C1_Gebaeude"]')
    page.screenshot(path='/mnt/data/nxt-v7-interview-desktop.png',full_page=True)
    page.locator('[data-answer="C1_Gebaeude"]').select_option('21')
    page.locator('[data-answer="C1_Raum"]').fill('111')
    page.locator('[data-answer="C2_Kueche"]').select_option('ja')
    page.locator('[data-answer="C2_Kueche_Etage"]').fill('1. OG')
    page.locator('[data-answer="C3_Mo"]').check()
    page.locator('[data-answer="C4_Fr"]').check()
    page.locator('[data-answer="C5_Ankunft"]').select_option(label='12 Parkplatz Ost')
    page.locator('[data-location-field="building"]').first.select_option('21')
    page.locator('[data-location-field="place"]').first.fill('111')
    page.locator('[data-answer="C7_Mensa"]').select_option('ja')
    page.locator('[data-answer="C8_Parkplatz"]').check()
    page.locator('[data-answer="C8_Digital"]').check()
    page.locator('[data-answer="C8_Kueche"]').check()
    page.locator('[data-answer="C8_Buero"]').click()
    assert not page.locator('[data-answer="C8_Buero"]').is_checked(), 'C8 must reject fourth choice'
    page.locator('[data-answer="C9_1"]').select_option(label='trifft eher zu')
    page.locator('[data-action="next-step"]').click()
    page.locator('[data-action="save-completed"]').click()
    page.wait_for_selector('.stat-grid',timeout=10000) if page.locator('.stat-grid').count() else page.wait_for_selector('[data-route="export"]')
    assert page.evaluate('window.lastRPC.p_status')=='completed'
    assert page.evaluate('window.lastRPC.p_answers.some(x=>x.question_key==="C8_Anzahl" && x.answer===3)')
    assert page.evaluate('window.lastRPC.p_edges[0].known_before_nxt') is False
    page.locator('[data-route="export"]').first.click()
    page.locator('[data-action="export-xlsx"]').click()
    page.wait_for_function('window.mockExport && window.mockExport.sheets.length===10',timeout=10000)
    sheets=page.evaluate('window.mockExport.sheets')
    assert 'Gesamt_Personen' in sheets and 'Gesamt_Netzwerk' in sheets and 'Codebuch' in sheets
    wide=page.evaluate('window.mockExport.rows.Gesamt_Personen.rows')
    assert wide[0].index('A1_Gruppe')>=0
    assert wide[1][wide[0].index('A1_Gruppe')]==1
    net=page.evaluate('window.mockExport.rows.Gesamt_Netzwerk.rows')
    assert len(net)==1+9*9
    page.set_viewport_size({'width':390,'height':844})
    page.locator('[data-route="people"]').first.evaluate('(el)=>el.click()')
    page.locator('[data-action="open-interview"]').nth(1).click()
    page.wait_for_selector('[data-answer="Einwilligung"]')
    page.locator('[data-answer="Einwilligung"]').select_option(label='Nein, ich möchte nicht teilnehmen.')
    assert page.locator('[data-answer="A1_Gruppe"]').count()==0
    page.locator('[data-field="interviewer_name"]').fill('NW')
    page.locator('[data-step="3"]').click()
    page.locator('[data-action="save-completed"]').click()
    page.wait_for_function('window.lastRPC && window.lastRPC.p_status==="declined"',timeout=10000)
    assert page.evaluate('window.lastRPC.p_edges.length')==0
    assert page.evaluate('window.lastRPC.p_answers.filter(a=>a.question_key.startsWith("A")).length')==0
    page.locator('[data-route="dashboard"]').first.evaluate('(el)=>el.click()')
    page.screenshot(path='/mnt/data/nxt-v7-dashboard-mobile.png',full_page=True)

    assert page.locator('.stat-grid').is_visible()
    assert not errors, errors
    print('SUCCESS: V7 consent, A1-A6, B1-B6, C1-C9, C8 max-3, save, 10-sheet coded export, responsive, no JS errors.')
    browser.close()