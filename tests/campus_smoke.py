"""Browser smoke test for the campus map, with synthetic data only."""
from pathlib import Path
from playwright.sync_api import sync_playwright
import base64

ROOT=Path(__file__).resolve().parents[1]
mock="""
const people=[];let i=0;for(const [b,n] of [['16',19],['21',9],['17',4],['D',4],['5',1],['',2]])for(let j=0;j<n;j++){i++;people.push({id:'p'+i,code:'P'+String(i).padStart(2,'0'),full_name:'Testperson '+i,building:b,room:b?'R'+(j+1):null,role_group:i%3?'Mitarbeitende':'Professor:innen'});}
const interviews=[{id:'i1',person_id:'p1',status:'in_progress'},{id:'i2',person_id:'p2',status:'in_progress'},{id:'i3',person_id:'p3',status:'completed'}];
const edges=Array.from({length:9},(_,j)=>({id:'e'+j,source_person_id:'p'+(j+1),target_person_id:'p'+((j+13)%35+1),topics:[['F','L','S'][j%3]],frequency:String(j%5+1)}));
const answers=[{interview_id:'i1',question_key:'C8_Parkplatz',answer:true},{interview_id:'i1',question_key:'C8_Mensa',answer:true},{interview_id:'i3',question_key:'C8_Mensa',answer:true},{interview_id:'i3',question_key:'C2_Meeting',answer:'ja'}];
const db={from:()=>({select:()=>({limit:async()=>({data:answers,error:null})})})};
window.NXTCampus.mount(document.querySelector('#nxt-campus-workspace'),{people,interviews,edges,locations:[],db});
"""
try:
    with sync_playwright() as p:
        browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
        page=browser.new_page(viewport={'width':1520,'height':980},device_scale_factor=1,accept_downloads=True)
        errors=[];page.on('pageerror',lambda error:errors.append(str(error)))
        page.set_content('<!doctype html><html><head><meta charset="utf-8"></head><body style="background:#f1f5f6"><main style="max-width:1480px;margin:auto;padding:20px"><h1 style="font-size:26px;color:#123c45;font-family:Arial">NXT · Geografische Ebene</h1><div class="nxt-campus-root" id="nxt-campus-workspace"></div></main></body></html>')
        page.add_style_tag(content=(ROOT/'css/campus.css').read_text())
        data=(ROOT/'js/campus-data.js').read_text()
        img='data:image/webp;base64,'+base64.b64encode((ROOT/'assets/nxt-campus-2_5d.webp').read_bytes()).decode()
        original='data:image/webp;base64,'+base64.b64encode((ROOT/'assets/nxt-lageplan.webp').read_bytes()).decode()
        data=data.replace('./assets/nxt-campus-2_5d.webp',img).replace('./assets/nxt-lageplan.webp',original)
        page.add_script_tag(content=data)
        page.add_script_tag(content=(ROOT/'js/campus-view.js').read_text())
        page.evaluate(mock)
        page.wait_for_selector('.nxt-campus-kpi')
        page.wait_for_timeout(400)
        assert page.locator('.nxt-campus-building').count()==5
        assert page.locator('.nxt-campus-kpi strong').first.inner_text()=='37 / 39'
        assert page.locator('.nxt-campus-inspector-numbers b').first.inner_text()=='19'
        page.screenshot(path='/mnt/data/nxt-campus-2_5d-preview-desktop.png',full_page=True)
        page.locator('[data-campus-filter="showGrid"]').check()
        assert page.locator('.nxt-campus-grid').count()==1
        page.locator('[data-campus-filter="showPeople"]').check()
        assert page.locator('.nxt-campus-person').count()==37
        page.locator('[data-campus-action="select-building"][data-id="21"]').first.click()
        assert 'Gebäude 21' in page.locator('.nxt-campus-inspector').inner_text()
        page.locator('[data-campus-action="zoom-in"]').click()
        assert page.locator('.nxt-campus-zoom span').inner_text()=='118 %'
        page.locator('[data-campus-filter="topic"]').select_option('F')
        assert page.locator('.nxt-campus-kpi strong').nth(2).inner_text()=='3'
        page.locator('[data-campus-action="tab"][data-tab="matrix"]').click()
        assert page.locator('.nxt-campus-matrix tbody tr').count()==5
        with page.expect_download() as dl:page.locator('[data-campus-action="export-matrix"]').first.click()
        assert dl.value.suggested_filename=='nxt_gebaeude_kantenmatrix.csv'
        page.locator('[data-campus-action="tab"][data-tab="places"]').click()
        assert page.locator('.nxt-campus-places-table').count()==3
        page.locator('[data-campus-action="tab"][data-tab="quality"]').click()
        assert 'weder geodätisch' in page.locator('.nxt-campus-analysis-panel').inner_text()
        page.locator('[data-campus-action="tab"][data-tab="map"]').click()
        page.locator('[data-campus-action="reference"]').first.click()
        assert page.locator('.nxt-campus-modal').is_visible()
        page.keyboard.press('Escape')
        assert page.locator('.nxt-campus-modal').count()==0
        page.set_viewport_size({'width':390,'height':844})
        page.locator('[data-campus-action="zoom-reset"]').click()
        page.screenshot(path='/mnt/data/nxt-campus-2_5d-preview-mobile.png',full_page=True)
        assert page.locator('.nxt-campus-viewport').is_visible()
        assert not errors,errors
        print('PASS: image coordinate layer, 39 synthetic people, filters, directed graph, matrix CSV, C8/C2 social places, original-plan modal, responsive')
        browser.close()
finally:
    pass
