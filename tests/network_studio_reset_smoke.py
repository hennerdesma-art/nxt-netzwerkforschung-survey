"""Browser smoke test of NXT studio + settings. Uses in-memory synthetic data only."""
from pathlib import Path
import re, base64, ast
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
source=(ROOT/'tests/network_analysis_smoke.py').read_text()
parsed=ast.parse(source)
MOCK=next(n.value.value for n in parsed.body if isinstance(n,ast.Assign) and any(isinstance(t,ast.Name) and t.id=='MOCK' for t in n.targets))
MOCK += r'''
// In-memory reset test; no network connection or Supabase writes.
const audit=[];
Query.prototype.order=function(){return this;};
const originalFrom=db.from;
db.from=function(t){if(t==='interview_reset_audit'){return {select(){return this},order(){return this},limit:async()=>({data:audit,error:null})};}return originalFrom(t)};
db.rpc=async (name,p)=>{
 if(name!=='reset_interview')return {data:null,error:{message:'UNKNOWN_RPC'}};
 const item=interviews.find(i=>i.id===p.p_interview_id);
 const person=people.find(x=>x.id===item?.person_id);
 if(!item||item.version!==p.p_expected_version||person.code!==p.p_confirm_code)return {data:null,error:{message:'INTERVIEW_CHANGED_RELOAD'}};
 const removed=edges.filter(e=>e.interview_id===item.id).length;
 edges.splice(0,edges.length,...edges.filter(e=>e.interview_id!==item.id));
 Object.assign(item,{status:'planned',version:item.version+1,interviewer_name:null,notes:null,started_at:null,completed_at:null,updated_at:new Date().toISOString()});
 audit.push({person_code:person.code,reset_at:new Date().toISOString(),previous_status:'completed',answers_deleted:0,edges_deleted:removed,locations_deleted:0});
 window.lastReset={person_code:person.code,edges_deleted:removed};
 return {data:{person_code:person.code,answers_deleted:0,edges_deleted:removed,locations_deleted:0},error:null};
};
'''
def inline_app():
 html=(ROOT/'index.html').read_text(encoding='utf-8')
 css=(ROOT/'css/styles.css').read_text(encoding='utf-8')
 js=(ROOT/'js/app.js').read_text(encoding='utf-8').replace('./assets/nxt-logo.png','data:image/png;base64,'+base64.b64encode((ROOT/'assets/nxt-logo.png').read_bytes()).decode())
 q=(ROOT/'js/questionnaire.js').read_text(encoding='utf-8')
 n=(ROOT/'js/network-viz.js').read_text(encoding='utf-8')
 tools=(ROOT/'js/network-tools.js').read_text(encoding='utf-8')
 html=re.sub(r'<link rel="stylesheet"[^>]+>','<style>'+css+'</style>',html)
 html=re.sub(r'<script defer[^>]+></script>','',html)
 return html.replace('</body>','<script>'+MOCK+'</script><script>'+q+'</script><script>'+tools+'</script><script>'+n+'</script><script>'+js+'</script></body>')

with sync_playwright() as pw:
 browser=pw.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 page=browser.new_page(viewport={'width':1510,'height':1010},device_scale_factor=1)
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.set_content(inline_app(),wait_until='domcontentloaded')
 page.locator('#email').fill('test@example.org');page.locator('#password').fill('testing-password');page.locator('#login-form button').click()
 page.wait_for_selector('.stat-grid')
 page.locator('[data-route="network"]').first.click()
 page.wait_for_selector('.network-studio-layout')
 assert page.locator('.network-view-tab').count()==4
 assert page.locator('.network-controls').count()==1
 assert page.locator('.network-graph-canvas').is_visible()
 assert page.locator('[data-network-input="nodeMultiplier"]').count()==1
 assert page.locator('[data-network-category]').count()>=2
 page.screenshot(path='/mnt/data/nxt-network-studio-preview.png',full_page=False)
 # filters
 page.locator('[data-network-input="componentMode"]').select_option('strong')
 page.locator('[data-network-input="layout"]').select_option('circle')
 page.locator('[data-network-input="sizeMode"]').select_option('in')
 page.locator('[data-network-input="categoryField"]').select_option('role_group')
 assert page.locator('[data-network-category]').count()==1
 page.locator('[data-action="network-tab"][data-tab="metrics"]').click()
 page.wait_for_selector('.network-metrics-grid')
 assert page.locator('.network-metrics-grid .stat-card').count()==6
 page.locator('[data-action="network-tab"][data-tab="text"]').click()
 assert 'Austauschbereiche' in page.inner_text('main')
 page.locator('[data-action="network-tab"][data-tab="assort"]').click()
 assert 'Assortativität' in page.inner_text('main')
 # GraphML roundtrip from safe synthetic graph (never uploaded).
 stats=page.evaluate('''()=>{const xml=window.NXTNetworkTools.graphML([{person:{id:'a',full_name:'Alpha',code:'A',building:'5',role_group:'X'}},{person:{id:'b',full_name:'Beta',code:'B',building:'16',role_group:'Y'}}],[{source_person_id:'a',target_person_id:'b',topics:['F']}]);const obj=window.NXTNetworkTools.parseGraphML(xml);return [obj.people.length,obj.edges.length,obj.people[0].full_name,obj.edges[0].topics[0]]}''')
 assert stats==[2,1,'Alpha','F'],stats
 # Settings and protected single reset test.
 page.locator('[data-route="settings"]').first.click()
 page.wait_for_selector('#settings-people-list')
 buttons=page.locator('[data-action="ask-interview-reset"]');assert buttons.count()==18,buttons.count()
 person_count=page.locator('[data-route="people"]').count()
 buttons.first.click()
 button=page.locator('#reset-confirm-button')
 assert button.is_disabled()
 code=page.locator('#reset-confirm-code').get_attribute('placeholder')
 page.locator('#reset-confirm-code').fill(code)
 page.locator('#reset-agree').check()
 assert button.is_enabled()
 button.click()
 page.wait_for_function('Boolean(window.lastReset)',timeout=7000)
 assert page.locator('.data-table').count()>=1
 assert page.locator('[data-action="ask-interview-reset"]').count()==18
 assert not errors,errors
 print('PASS: network controls, graph tabs, components, GraphML, admin reset and audit, no browser errors')
 browser.close()
