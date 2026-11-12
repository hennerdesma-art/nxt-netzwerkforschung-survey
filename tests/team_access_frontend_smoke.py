from pathlib import Path
from zipfile import ZipFile
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[1]
js_path=root/'js/team-access-ui.js'
if not js_path.exists(): js_path=root/'frontend/team-access-ui.js'
js=js_path.read_text()
css_path=root/'css/styles.css'
if css_path.exists(): css=css_path.read_text()
else:
 with ZipFile('/mnt/data/NXT_Netzwerkforschung_Website.zip') as z: css=z.read('css/styles.css').decode()
addon_css=root/'css/team-access.css'
if not addon_css.exists(): addon_css=root/'frontend/team-access.css'
css+='\n'+addon_css.read_text()
html='<!doctype html><html lang="de"><head><meta charset="utf-8"><style>'+css+'</style></head><body><main class="content"><h1>NXT | Einstellungen</h1><div id="mount"></div></main><script>'+js+'</script></body></html>'
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 page=browser.new_page(viewport={'width':1365,'height':900})
 errors=[]
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.set_content(html)
 page.evaluate('''() => {
   const users=[{user_id:'u1',display_name:'Teamleitung',email:'teamleitung@example.org',role:'admin',active:true,email_confirmed:true,last_sign_in_at:'2026-11-10'},{user_id:'u2',display_name:'Mitarbeiterin',email:'mitarbeiterin@example.org',role:'interviewer',active:true,email_confirmed:true}];
   window.mockDb={auth:{getSession:async()=>({data:{session:{access_token:'test-token-'+('a'.repeat(100))}},error:null})},functions:{invoke:async(_name,{body})=>{if(body.action==='list')return {data:{members:users,audit:[]}};if(body.action==='invite'){const email=body.email;users.push({user_id:'u3',display_name:body.display_name,email,role:body.role,active:true,email_confirmed:false});return {data:{status:'invited',invite_link:'https://example.org/#nxt_invite=token123&type=invite',message:'Zugang angelegt'}};}if(body.action==='set_active'){users.find(u=>u.user_id===body.user_id).active=body.active;return {data:{status:'updated'}};}return {error:{message:'unknown'}}}}};
   document.querySelector('#mount').innerHTML=NXTTeamAccess.renderShell();NXTTeamAccess.mount(document.querySelector('#nxt-team-access'),{db:window.mockDb,currentUserId:'u1'});
 }''')
 page.wait_for_selector('text=Teamübersicht')
 page.wait_for_selector('text=Mitarbeiterin')
 page.locator('#team-display-name').fill('Neues Teammitglied')
 page.locator('#team-invite-email').fill('neumitglied@example.org')
 page.locator('#nxt-team-invite-form button[type=submit]').click()
 page.wait_for_selector('#nxt-team-invite-link')
 assert page.locator('#nxt-team-invite-link').input_value().endswith('type=invite')
 assert page.locator('.nxt-team-user').count()==3
 page.screenshot(path=str(root/'team-settings-desktop-preview.png'),full_page=True)
 page.set_viewport_size({'width':390,'height':850})
 page.screenshot(path=str(root/'team-settings-mobile-preview.png'),full_page=True)
 assert not errors, errors
 # New user acceptance + password creation tests
 page2=browser.new_page(viewport={'width':640,'height':800})
 page2.on('pageerror',lambda e:errors.append(str(e)))
 page2.set_content(html)
 page2.evaluate("window.location.hash='#nxt_invite=test-token&type=invite'")
 ok=page2.evaluate('''async () => {const fake={auth:{verifyOtp:async req=>({data:{user:{id:'u3',email:'new@example.org'}},error:null})}};const x=await NXTTeamAccess.acceptInvite(fake);return {user:x.user.email,hash:window.location.hash};}''')
 assert ok['user']=='new@example.org' and ok['hash']=='', ok
 page2.evaluate('''() => {let updated='';const db={auth:{updateUser:async ({password})=>{updated=password;return {error:null}}}};window.acceptSuccess=false;document.body.innerHTML='<div id="m"></div>';document.querySelector('#m').innerHTML=NXTTeamAccess.renderPasswordScreen({email:'new@example.org'});NXTTeamAccess.mountPasswordForm(document.querySelector('#m'),{db,user:{email:'new@example.org'},onSuccess:async()=>{window.acceptSuccess=updated.length===15}})}''')
 page2.locator('#nxt-new-password').fill('Secure-pass-123')
 page2.locator('#nxt-confirm-password').fill('Secure-pass-123')
 page2.locator('#nxt-team-password-form button').click()
 page2.wait_for_function('window.acceptSuccess === true')
 assert not errors,errors
 browser.close()
print('Team settings UI / invitation link / onboarding flow: PASS')