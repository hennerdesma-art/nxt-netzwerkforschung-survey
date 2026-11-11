from pathlib import Path
import ast, re, base64
from playwright.sync_api import sync_playwright
ROOT=Path('/mnt/data/nxt-netzwerkforschung-survey')
pagefile=ROOT/'tests/network_studio_reset_smoke.py'
source=pagefile.read_text()
# Only extract app HTML fixture functions by parsing their definitions without running main test.
ns={'__file__':str(pagefile)}
source=source[:source.index('with sync_playwright() as pw:')]
exec(compile(source,str(pagefile),'exec'),ns)
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 page=browser.new_page()
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.set_content(ns['inline_app'](),wait_until='domcontentloaded')
 page.locator('#email').fill('test@example.org')
 page.locator('#password').fill('testing-password')
 page.locator('#login-form button').click()
 page.wait_for_selector('.stat-grid')
 viz=(ROOT/'js/network-viz.js').read_text()
 html=page.evaluate('''async (src)=>{const old=window.fetch;window.fetch=async()=>({ok:true,text:async()=>src});try{return await window.NXTNetworkTools.standaloneHtml([{id:'n1',code:'A',label:'Alpha',building:'5',degree:1,inDegree:0,outDegree:1},{id:'n2',code:'B',label:'Beta',building:'16',degree:1,inDegree:1,outDegree:0}],[{source:'n1',target:'n2'}],{layout:'orbit3d',labels:true,sizeMode:'degree',spread:1})}finally{window.fetch=old}}''',viz)
 assert '<script>' in html
 new=browser.new_page(viewport={'width':1280,'height':780})
 faults=[];new.on('pageerror',lambda e:faults.append(str(e)))
 new.set_content(html,wait_until='load')
 new.wait_for_selector('.network-graph-canvas',timeout=5000)
 assert new.locator('canvas').is_visible()
 assert not errors and not faults,(errors,faults)
 print('PASS: portable HTML graph opens offline with no JS errors, interactive canvas present')
 browser.close()
