"""Regression test: all 38 partner rows remain full-height and readable.

Runs entirely in Chromium with synthetic personnel data; no real database access.
"""
from pathlib import Path
import base64
import re
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
source = (ROOT / 'tests/questionnaire_v7_smoke.py').read_text(encoding='utf-8')
assert "MOCK=r'''" in source
mock = source.split("MOCK=r'''", 1)[1].split("'''", 1)[0]
assert 'Array.from({length:9}' in mock
mock = mock.replace('Array.from({length:9}', 'Array.from({length:39}')
mock = mock.replace("full_name:'Testperson '+String(i+1).padStart(2,'0')", "full_name:'Prof. Dr.-Ing. Beispielmitarbeiterin mit langem Nachnamen '+String(i+1).padStart(2,'0')")

html = (ROOT / 'index.html').read_text(encoding='utf-8')
css = (ROOT / 'css/styles.css').read_text(encoding='utf-8')
js = (ROOT / 'js/app.js').read_text(encoding='utf-8')
q = (ROOT / 'js/questionnaire.js').read_text(encoding='utf-8')
logo = 'data:image/png;base64,' + base64.b64encode((ROOT / 'assets/nxt-logo.png').read_bytes()).decode('ascii')
js = js.replace('./assets/nxt-logo.png', logo)
html = re.sub(r'<link rel="stylesheet"[^>]+>', '<style>' + css + '</style>', html)
html = re.sub(r'<script defer[^>]+></script>', '', html)
html = html.replace('</body>', '<script>' + mock + '</script><script>' + q + '</script><script>' + js + '</script></body>')

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    page = browser.new_page(viewport={'width': 1365, 'height': 900}, device_scale_factor=1)
    errors = []
    page.on('pageerror', lambda err: errors.append(str(err)))
    page.set_content(html, wait_until='domcontentloaded')
    page.wait_for_selector('#email')
    page.locator('#email').fill('test@example.org')
    page.locator('#password').fill('testing-password')
    page.locator('#login-form button').click()
    page.wait_for_selector('.stat-grid')
    assert page.locator('.stat-number').first.inner_text() == '39'
    page.locator('[data-route="people"]').first.click()
    page.locator('[data-action="open-interview"]').first.click()
    page.wait_for_selector('[data-answer="Einwilligung"]')
    page.locator('[data-answer="Einwilligung"]').select_option(label='Ja, ich bin einverstanden.')
    page.locator('[data-action="next-step"]').click()
    page.wait_for_selector('#peer-results .q-peer')
    assert page.locator('.q-peer').count() == 38, 'Expected all 38 non-self people'

    def assert_visible_rows(device):
        result = page.evaluate('''() => {
          const list = document.querySelector('#peer-results');
          const cards = [...list.querySelectorAll('.q-peer')];
          const measurements = cards.map(el => {
            const card = el.getBoundingClientRect();
            const name = el.querySelector('.q-peer-name strong').getBoundingClientRect();
            const check = el.querySelector('.q-peer-check').getBoundingClientRect();
            return {height:card.height, nameInside:name.top >= card.top && name.bottom <= card.bottom,
                    checkInside:check.top >= card.top && check.bottom <= card.bottom};
          });
          return {count:cards.length, minHeight:Math.min(...measurements.map(m=>m.height)),
                  allInside:measurements.every(m=>m.nameInside && m.checkInside),
                  listHeight:list.clientHeight, scrollHeight:list.scrollHeight,
                  viewportWidth:window.innerWidth, pageScrollWidth:document.documentElement.scrollWidth};
        }''')
        assert result['count'] == 38, (device, result)
        assert result['minHeight'] >= 65, (device, result)
        assert result['allInside'], (device, result)
        assert result['scrollHeight'] <= result['listHeight'] + 2, (device, result)
        assert result['pageScrollWidth'] <= result['viewportWidth'] + 2, (device, result)
        return result

    desktop = assert_visible_rows('desktop')
    page.locator('.q-peer').first.scroll_into_view_if_needed()
    page.screenshot(path='/mnt/data/nxt-peer-list-fixed-desktop.png', full_page=False)
    page.locator('#peer-search').fill('P25')
    assert page.locator('.q-peer').count() == 1
    assert 'P25' in page.locator('.q-peer').first.inner_text()
    page.locator('#peer-search').fill('')
    assert page.locator('.q-peer').count() == 38
    page.locator('[data-action="toggle-peer"]').first.click()
    assert page.locator('.q-peer.selected').count() == 1
    assert page.locator('.q-peer.selected [data-edge-field]').count() >= 5
    page.locator('[data-action="toggle-peer"]').first.click()
    assert page.locator('.q-peer.selected').count() == 0

    page.set_viewport_size({'width':390,'height':844})
    page.wait_for_timeout(80)
    mobile = assert_visible_rows('mobile')
    page.locator('.q-peer').first.scroll_into_view_if_needed()
    page.screenshot(path='/mnt/data/nxt-peer-list-fixed-mobile.png',full_page=False)
    assert not errors, errors
    print('SUCCESS: all 38 rows readable, no clipped names, no internal grid compression, desktop/mobile, search and selection functional')
    print('desktop', desktop)
    print('mobile', mobile)
    browser.close()