/* NXT Netzwerkforschung - shared, authenticated survey front end. */
(() => {
  'use strict';
  const config = window.NXT_CONFIG || {};
  let autosaveTimer = null;
  const root = document.getElementById('app');
  const state = {
    db: null, user: null, member: null, people: [], interviews: [], edges: [], locations: [],
    route: 'dashboard', query: '', filter: 'all', form: null, step: 0, busy: false,
    channel: null, poll: null, modal: '', draftDirty: false
  };
  const I = {
    layout:'<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
    users:'<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
    clipboard:'<rect x="5" y="5" width="14" height="16" rx="2"/><rect x="9" y="3" width="6" height="4" rx="1"/><path d="M9 13h6M9 17h6"/>',
    network:'<circle cx="5" cy="7" r="2"/><circle cx="19" cy="7" r="2"/><circle cx="12" cy="18" r="2"/><path d="M6.8 8.2l4.1 8M17.2 8.2l-4.1 8M7 7h10"/>',
    download:'<path d="M12 3v12m0 0 4-4m-4 4-4-4M4 17v4h16v-4"/>',
    plus:'<path d="M12 5v14M5 12h14"/>',search:'<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
    arrow:'<path d="M5 12h14m-6-6 6 6-6 6"/>',chevron:'<path d="m9 18 6-6-6-6"/>',
    chart:'<path d="M3 3v18h18M7 15l4-4 4 2 5-8"/>',shield:'<path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z"/><path d="m9 12 2 2 4-4"/>',
    lock:'<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
    logout:'<path d="M10 17l5-5-5-5m5 5H3M12 3h7a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-7"/>',
    menu:'<path d="M4 6h16M4 12h16M4 18h16"/>',x:'<path d="M18 6 6 18M6 6l12 12"/>',
    check:'<path d="m4 12 5 5L20 6"/>',clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    location:'<path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/>',
    file:'<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6M8 13h8M8 17h8"/>',
    alert:'<path d="M12 9v4M12 17h.01M10 3 2 18a2 2 0 0 0 2 3h16a2 2 0 0 0 2-3L14 3a2 2 0 0 0-4 0Z"/>',
    refresh:'<path d="M20 11a8 8 0 0 0-14-5L3 9M3 4v5h5M4 13a8 8 0 0 0 14 5l3-3m0 5v-5h-5"/>',
    trash:'<path d="M3 6h18M8 6V4h8v2M6 6l1 15h10l1-15M10 10v7M14 10v7"/>',
    save:'<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z"/><path d="M7 3v6h9V3M7 21v-9h10v9"/>',
    upload:'<path d="M12 16V3m-5 5 5-5 5 5M4 17v4h16v-4"/>',
    info:'<circle cx="12" cy="12" r="10"/><path d="M12 11v6M12 7h.01"/>'
  };
  const icon = (name,size=18) => `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${I[name]||I.info}</svg>`;
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmt = date => date ? new Intl.DateTimeFormat('de-DE',{day:'2-digit',month:'2-digit',year:'numeric'}).format(new Date(date)) : '\u2014';
  const fmtTime = date => date ? new Intl.DateTimeFormat('de-DE',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}).format(new Date(date)) : '\u2014';
  const initials = text => String(text||'?').split(/\s+/).filter(Boolean).slice(0,2).map(a=>a[0]).join('').toUpperCase();
  const clean = text => String(text??'').trim();
  const qs = (sel,el=document) => el.querySelector(sel);
  const escapeExcel = value => typeof value==='string' && /^[=+@\-\t\r]/.test(value) ? "'"+value : (value ?? '');
  const personName = id => state.people.find(p=>p.id===id)?.full_name || 'Unbekannte Person';
  const personCode = id => state.people.find(p=>p.id===id)?.code || 'UNKNOWN';
  const statusFor = id => state.interviews.find(i=>i.person_id===id)?.status || 'planned';
  const badge = status => ({completed:'<span class="pill green">Abgeschlossen</span>',in_progress:'<span class="pill orange">In Bearbeitung</span>',planned:'<span class="pill gray">Offen</span>'}[status] || '<span class="pill gray">Offen</span>');
  function toast(msg,type='info'){
    const box=document.createElement('div');box.className='toast '+(type==='error'?'error':type==='success'?'success':'');box.textContent=msg;
    document.getElementById('toast-region').append(box);setTimeout(()=>box.remove(),6500);
  }
  function showSetup(message=''){
    root.innerHTML=`<div class="auth-screen"><div class="auth-visual"><img class="brand-logo" src="./assets/nxt-logo.png" alt="Hochschule Reutlingen NXT Logo"><div><span class="auth-tag">${icon('shield',15)} Forschungsplattform</span><h1 class="auth-title">Ein Platz f\u00fcr <span>unser Netzwerk.</span></h1><p class="auth-sub">Interviewplattform mit gemeinsamer Datenbank, Netzwerkbeziehungen und wissenschaftlichem Excel-Export.</p></div><small class="auth-foot">NXT | Hochschule Reutlingen</small></div><div class="auth-right"><div class="auth-card"><div class="auth-icon">${icon('lock',26)}</div><span class="eyebrow" style="display:block;margin-top:24px">Einrichtung</span><h2>Backend verbinden</h2><p>Der Quellcode ist installiert. Vor der Nutzung muss ein eigenes Supabase-Projekt mit gesch\u00fctztem Zugang angebunden werden.</p>${message?`<div class="form-error">${esc(message)}</div>`:''}<div class="info-note">1. SQL-Datei <strong>sql/001_initial_schema.sql</strong> ausf\u00fchren.<br>2. Im Supabase-Dashboard einen Auth-Benutzer mit dem Team-Passwort erstellen.<br>3. In <strong>js/config.js</strong> die Projekt-URL und den Publishable Key eintragen (Login-E-Mail ist optional).<br>4. Benutzer-ID in <strong>survey_members</strong> freischalten.<br><br>Weitere Details stehen in README.md.</div></div></div></div>`;
  }
  function renderLogin(error=''){
    root.innerHTML=`<div class="auth-screen"><div class="auth-visual"><img class="brand-logo" src="./assets/nxt-logo.png" alt="Hochschule Reutlingen - NXT"><div><span class="auth-tag">${icon('network',15)} Forschungsprojekt | 2026</span><h1 class="auth-title">Vernetzung <span>verstehen.</span><br>Wissen verbinden.</h1><p class="auth-sub">Digitale Interviewerfassung f\u00fcr die Netzwerkforschung an der Fakult\u00e4t NXT. Gemeinsam erheben, sicher verwalten und wissenschaftlich auswerten.</p><div class="auth-detail"><span>Personen &amp; Beziehungen</span><span>Live synchronisiert</span><span>Excel &amp; Netzwerkanalyse</span></div></div><small class="auth-foot">NXT | REUTLINGEN UNIVERSITY</small></div><div class="auth-right"><div class="auth-card"><div class="auth-icon">${icon('lock',26)}</div><span class="eyebrow" style="display:block;margin-top:24px">Gesch\u00fctzter Bereich</span><h2>Willkommen zur\u00fcck.</h2><p>Melde dich mit dem Team-Passwort an, um Interviews sicher zu erfassen und die gemeinsamen Ergebnisse einzusehen.</p><form id="login-form">${config.AUTH_EMAIL ? "" : `<div class="field"><label for="email">E-Mail-Adresse</label><input id="email" name="email" type="email" autocomplete="email" placeholder="name@hochschule.de" required></div>`}<div class="field"><label for="password">Passwort</label><input id="password" name="password" type="password" autocomplete="current-password" placeholder="Passwort eingeben" required minlength="6"></div>${error?`<div class="form-error">${esc(error)}</div>`:''}<button class="btn btn-primary" type="submit">${icon('lock')} Sicher anmelden ${icon('arrow')}</button></form><div class="info-note">Alle Interviews werden in der zentralen Datenbank gespeichert. Das Passwort wird nicht im Website-Code hinterlegt.</div></div></div></div>`;
    (config.AUTH_EMAIL ? qs('#password') : qs('#email'))?.focus();
  }
  async function start(){
    const invalid = !config.SUPABASE_URL || /REPLACE/.test(config.SUPABASE_URL)||!config.SUPABASE_PUBLISHABLE_KEY||/REPLACE/.test(config.SUPABASE_PUBLISHABLE_KEY);
    if(invalid){showSetup();return;}
    if(!window.supabase?.createClient){showSetup('Die Supabase-Bibliothek konnte nicht geladen werden. Bitte Internetzugang und Skript-Freigaben pr\u00fcfen.');return;}
    try{
      state.db=window.supabase.createClient(config.SUPABASE_URL,config.SUPABASE_PUBLISHABLE_KEY,{auth:{autoRefreshToken:true,persistSession:true,detectSessionInUrl:false}});
      const {data,error}=await state.db.auth.getSession();if(error) throw error;
      if(data.session){await authenticated(data.session.user);}else{renderLogin();}
    }catch(e){renderLogin('Verbindung zur Anmeldung fehlgeschlagen. '+(e.message||''));}
  }
  async function authenticated(user){
    state.user=user;
    const {data,error}=await state.db.from('survey_members').select('user_id,display_name,role,active').eq('user_id',user.id).maybeSingle();
    if(error || !data?.active){await state.db.auth.signOut();state.user=null;renderLogin('Dieses Konto ist noch nicht f\u00fcr die Forschungsumfrage freigeschaltet.');return;}
    state.member=data;
    try{await reloadData(false);subscribeChanges();render();}catch(e){showSetup('Die Anmeldung funktioniert, aber die Datentabellen sind nicht erreichbar: '+(e.message||''));}
  }
  async function reloadData(reRender=true){
    const tables=['persons','interviews','edges','locations'];
    const result=await Promise.all(tables.map(t=>state.db.from(t).select('*').limit(3000)));
    result.forEach((r,i)=>{if(r.error)throw Error(tables[i]+': '+r.error.message);});
    [state.people,state.interviews,state.edges,state.locations]=result.map(r=>r.data||[]);
    state.people.sort((a,b)=>a.full_name.localeCompare(b.full_name,'de'));
    if(reRender && !(state.route==='interview' && state.draftDirty))render();
  }
  function subscribeChanges(){
    if(state.channel)return;
    try{
      state.channel=state.db.channel('nxt-survey-sync')
        .on('postgres_changes',{event:'*',schema:'public',table:'interviews'},()=>reloadData().catch(()=>{}))
        .on('postgres_changes',{event:'*',schema:'public',table:'persons'},()=>reloadData().catch(()=>{}))
        .on('postgres_changes',{event:'*',schema:'public',table:'edges'},()=>reloadData().catch(()=>{}))
        .subscribe();
    }catch(e){console.warn('Realtime unavailable:',e.message);}
    state.poll=setInterval(()=>reloadData().catch(()=>{}),30000);
  }
  async function logout(){
    clearTimeout(autosaveTimer);
    if(state.channel){await state.db.removeChannel(state.channel);state.channel=null;}
    if(state.poll){clearInterval(state.poll);state.poll=null;}
    await state.db.auth.signOut();state.user=null;state.member=null;state.form=null;renderLogin();
  }
  function counts(){
    const total=state.people.length,done=state.interviews.filter(i=>i.status==='completed').length,
      ongoing=state.interviews.filter(i=>i.status==='in_progress').length;
    return {total,done,ongoing,pending:Math.max(0,total-done-ongoing),edges:state.edges.length,progress:total?Math.round(done/total*100):0};
  }
  const tabs=[['dashboard','layout','Dashboard'],['people','users','Personen'],['interviews','clipboard','Interviews'],['network','network','Netzwerk'],['export','download','Datenexport']];
  function shell(page){
    const team=state.member?.display_name||'Interview-Team';
    return `<div class="shell" id="shell"><div class="mobile-mask" data-action="close-nav"></div><aside class="sidebar"><div class="sidebar-logo"><img src="./assets/nxt-logo.png" alt="NXT Hochschule Reutlingen"></div><span class="sidebar-caption">Research Workspace</span><nav class="nav-list" aria-label="Hauptnavigation">${tabs.map(([key,ico,name])=>`<button type="button" class="nav-item ${state.route===key||(state.route==='interview'&&key==='interviews')?'active':''}" data-action="navigate" data-route="${key}">${icon(ico)} ${name}</button>`).join('')}</nav><div class="side-footer"><div class="side-foot-card"><span class="pill">NXT | PROJEKT 2026</span><h4>Fachlicher Austausch &amp; r\u00e4umliche N\u00e4he</h4><p>Erfassung von Personen, Interaktionen und Standorten f\u00fcr die Netzwerkforschung.</p></div><div class="sidebar-bottom">Hochschule Reutlingen &middot; NXT<br>Gesch\u00fctzter Team-Zugang</div></div></aside><div class="main"><header class="topbar"><div style="display:flex;gap:15px;align-items:center"><button type="button" class="btn btn-light btn-icon menu-toggle" data-action="open-nav" aria-label="Men\u00fc \u00f6ffnen">${icon('menu')}</button><div><div class="topbar-title">NXT <span style="color:var(--teal)">/ Netzwerkforschung</span></div><div class="topbar-kicker">Interviewerfassung &amp; Auswertung</div></div></div><div class="top-actions"><span class="live-dot">Zentral verbunden</span><button type="button" data-action="refresh" class="btn btn-light btn-sm" title="Daten aktualisieren">${icon('refresh')}<span class="top-label">Aktualisieren</span></button><div class="avatar" title="${esc(team)}">${esc(initials(team))}</div><button type="button" data-action="logout" class="btn btn-light btn-sm btn-icon" title="Abmelden" aria-label="Abmelden">${icon('logout')}</button></div></header><main class="content">${page}</main></div></div><div id="modal-host"></div>`;
  }
  function render(){
    if(!state.user||!state.member){renderLogin();return;}
    const pages={dashboard:renderDashboard,people:renderPeople,interviews:renderInterviews,interview:renderInterview,network:renderNetwork,export:renderExport};
    root.innerHTML=shell((pages[state.route]||renderDashboard)());
  }
  function pageHead(label,title,description,actions=''){
    return `<div class="page-head"><div><div class="eyebrow">${label}</div><h1>${title}</h1><p>${description}</p></div>${actions?`<div class="page-actions">${actions}</div>`:''}</div>`;
  }
  function empty(title,description,ico='users',action=''){
    return `<div class="empty-state"><div class="empty-icon">${icon(ico,25)}</div><h3>${title}</h3><p>${description}</p>${action}</div>`;
  }
  function stat(label,number,desc,ico){return `<div class="stat-card"><div class="stat-top"><span class="stat-label">${label}</span><span class="stat-icon">${icon(ico)}</span></div><div class="stat-number">${number}</div><div class="stat-desc">${desc}</div></div>`;}
  function renderDashboard(){
    const c=counts();const target=Number(config.TARGET_COUNT)||40;
    const recent=[...state.interviews].filter(i=>i.started_at).sort((a,b)=>new Date(b.updated_at)-new Date(a.updated_at)).slice(0,5);
    const top=`${icon('plus',16)} Interview starten`;
    return `<section class="hero"><div class="hero-copy"><div class="eyebrow">NXT | Forschungsdashboard</div><h1>Netzwerke verstehen.<br>Zusammenh\u00e4nge entdecken.</h1><p>Die zentrale Arbeitsoberfl\u00e4che f\u00fcr eure Interviewerhebung: strukturiert, transparent und team\u00fcbergreifend.</p><button class="btn" data-action="navigate" data-route="people">${top} ${icon('arrow')}</button></div><div class="hero-ring"><div><strong>${c.progress}%</strong><small>abgeschlossen</small></div></div></section>
    <div class="stat-grid">${stat('Erfasste Personen',c.total,`Projektziel: ca. ${target} Personen`,'users')}${stat('Abgeschlossene Interviews',c.done,'Vollst\u00e4ndig dokumentiert','check')}${stat('In Bearbeitung',c.ongoing,`${c.pending} noch nicht begonnen`,'clock')}${stat('Fachliche Kanten',c.edges,'Gerichtete Austauschbeziehungen','network')}</div>
    <div class="dash-grid"><div class="panel"><div class="panel-inner"><div class="panel-head"><div><h2>Interviewfortschritt</h2><small>Aktueller Stand der Erhebung</small></div><span class="pill">${c.progress}% Fortschritt</span></div><div class="progress-row"><span class="progress-row-title">Abgeschlossen</span><div class="progress-track"><div class="progress-fill" style="width:${c.total?100*c.done/c.total:0}%"></div></div><strong>${c.done}</strong></div><div class="progress-row"><span class="progress-row-title">In Bearbeitung</span><div class="progress-track"><div class="progress-fill" style="width:${c.total?100*c.ongoing/c.total:0}%;background:#e0aa56"></div></div><strong>${c.ongoing}</strong></div><div class="progress-row"><span class="progress-row-title">Offen</span><div class="progress-track"><div class="progress-fill" style="width:${c.total?100*c.pending/c.total:0}%;background:#aac3c8"></div></div><strong>${c.pending}</strong></div><div class="notice-box" style="margin-top:26px">${icon('info')}<span>${c.total===0?'Beginnt mit dem Anlegen oder Importieren eurer Personenliste.':`Aktuell sind ${c.done} von ${c.total} Personen abgeschlossen. Beim Erfassen werden neue Kanten zentral gespeichert.`}</span></div></div></div>
    <div class="panel"><div class="panel-inner"><div class="panel-head"><h2>Letzte Interviews</h2><button class="text-link" data-action="navigate" data-route="interviews">Alle ansehen</button></div>${recent.length?`<div class="activity-list">${recent.map(i=>`<div class="activity-entry"><span class="activity-bubble">${esc(initials(personName(i.person_id)))}</span><div style="min-width:0"><strong>${esc(personName(i.person_id))}</strong><small>${fmtTime(i.updated_at)}</small></div>${badge(i.status)}</div>`).join('')}</div>`:empty('Noch keine Interviews','Hier erscheinen eure letzten erhobenen Interviews.','clipboard')}</div></div></div>`;
  }
  function renderPeopleTable(list){
    if(!list.length)return empty('Keine Personen gefunden',state.people.length?'Bitte Suchbegriff oder Statusfilter anpassen.':'Lege die erste Person an oder importiere eure vorhandene Shortlist.','users',state.people.length?'':'<button class="btn btn-primary btn-sm" data-action="add-person">Person anlegen</button>');
    return `<div class="table-wrap"><table class="data-table"><thead><tr><th>Person</th><th>Gruppe</th><th>Standort</th><th>Interviewstatus</th><th>Aktion</th></tr></thead><tbody>${list.map(p=>`<tr><td><div class="person-cell"><span class="person-avatar">${esc(initials(p.full_name))}</span><div><strong>${esc(p.full_name)}</strong><small>${esc(p.code)}</small></div></div></td><td>${esc(p.role_group||'Noch offen')}</td><td>${esc([p.building?`Geb. ${p.building}`:'',p.room?`Raum ${p.room}`:''].filter(Boolean).join(' \u00b7 ')||'Noch offen')}</td><td>${badge(statusFor(p.id))}</td><td><button class="btn btn-light btn-sm" data-action="open-interview" data-person="${esc(p.id)}">${statusFor(p.id)==='completed'?'Ansehen / bearbeiten':'Interview \u00f6ffnen'} ${icon('chevron',14)}</button></td></tr>`).join('')}</tbody></table></div>`;
  }
  function filteredPeople(){
    return state.people.filter(p=>{
      const query=state.query.toLocaleLowerCase('de');
      return (state.filter==='all'||state.filter===statusFor(p.id))&&`${p.full_name} ${p.code} ${p.role_group||''} ${p.building||''}`.toLocaleLowerCase('de').includes(query);
    });
  }
  function renderPeople(){
    return pageHead('Personenverzeichnis','Alle Personen im \u00dcberblick','Alle Mitarbeiterinnen und Mitarbeiter sowie ihre Interview- und Standortdaten.',`<button class="btn btn-light" data-action="import-people">${icon('upload')} Liste importieren</button><button class="btn btn-primary" data-action="add-person">${icon('plus')} Neue Person</button>`)+`<div class="panel"><div class="toolbar"><div class="search-wrap">${icon('search')}<input id="people-search" class="search-input" type="search" placeholder="Person oder Geb\u00e4ude suchen ..." value="${esc(state.query)}" aria-label="Personen suchen"></div><select id="people-filter" class="filter-select" aria-label="Interviewstatus filtern"><option value="all" ${state.filter==='all'?'selected':''}>Alle Status</option><option value="planned" ${state.filter==='planned'?'selected':''}>Offen</option><option value="in_progress" ${state.filter==='in_progress'?'selected':''}>In Bearbeitung</option><option value="completed" ${state.filter==='completed'?'selected':''}>Abgeschlossen</option></select><span class="muted small" id="people-count">${filteredPeople().length} Personen</span></div><div id="people-list">${renderPeopleTable(filteredPeople())}</div></div>`;
  }
  function renderInterviews(){
    const records=state.people.map(p=>({p,i:state.interviews.find(i=>i.person_id===p.id)}))
      .sort((a,b)=>({'in_progress':0,'planned':1,'completed':2}[a.i?.status||'planned'])-({'in_progress':0,'planned':1,'completed':2}[b.i?.status||'planned']));
    return pageHead('Erhebung','Interview\u00fcbersicht','Starte neue Gespr\u00e4che, setze Entw\u00fcrfe fort und pr\u00fcfe abgeschlossene Datens\u00e4tze.',`<button class="btn btn-primary" data-action="navigate" data-route="people">${icon('plus')} Interview starten</button>`)+`<div class="panel">${records.length?`<div class="table-wrap"><table class="data-table"><thead><tr><th>Person</th><th>Bearbeitung</th><th>Letzte Aktualisierung</th><th>Status</th><th>Aktion</th></tr></thead><tbody>${records.map(({p,i})=>`<tr><td><div class="person-cell"><span class="person-avatar">${esc(initials(p.full_name))}</span><div><strong>${esc(p.full_name)}</strong><small>${esc(p.code)}</small></div></div></td><td>${esc(i?.interviewer_name||'\u2014')}</td><td>${fmtTime(i?.updated_at)}</td><td>${badge(i?.status)}</td><td><button class="btn btn-light btn-sm" data-action="open-interview" data-person="${esc(p.id)}">${i?'Fortsetzen':'Beginnen'} ${icon('chevron',14)}</button></td></tr>`).join('')}</tbody></table></div>`:empty('Personenliste noch leer','Zuerst m\u00fcssen die Interviewpersonen angelegt oder importiert werden.','clipboard','<button class="btn btn-primary" data-action="navigate" data-route="people">Zum Personenverzeichnis</button>')}</div>`;
  }
  const option = (value,label,selected) => `<option value="${esc(value)}" ${String(value)===String(selected??'')?'selected':''}>${esc(label)}</option>`;
  const selectField = (label,field,items,value,extra='') => `<div class="field"><label>${label}</label><select data-field="${field}" ${extra}>${items.map(([key,name])=>option(key,name,value)).join('')}</select></div>`;
  const textField = (label,field,value,placeholder='',extra='') => `<div class="field"><label>${label}</label><input type="text" data-field="${field}" value="${esc(value||'')}" placeholder="${esc(placeholder)}" ${extra}></div>`;
  const stepNames=['Person & Einordnung','Fachlicher Austausch','R\u00e4umliche Daten','Pr\u00fcfen & Speichern'];
  const groups=[['','Bitte ausw\u00e4hlen'],['Professor:innen','Professor:innen'],['Wissenschaftliche Mitarbeitende','Wissenschaftliche Mitarbeitende'],['Technische Mitarbeitende','Technische Mitarbeitende (Laborassistenz usw.)'],['Sonstige','Sonstige / unklar']];
  const buildings=[['','Bitte ausw\u00e4hlen'],['5','Geb\u00e4ude 5'],['16','Geb\u00e4ude 16'],['17','Geb\u00e4ude 17'],['21','Geb\u00e4ude 21'],['D','Geb\u00e4ude D'],['Werk150','Werk150'],['Sonstiger Standort','Sonstiger Standort']];
  const frequencies=[['','Bitte ausw\u00e4hlen'],['taeglich','T\u00e4glich'],['woechentlich','Mehrmals / einmal w\u00f6chentlich'],['monatlich','Monatlich'],['seltener','Seltener'],['unbekannt','Noch offen']];
  const modes=[['','Bitte ausw\u00e4hlen'],['persoenlich','Pers\u00f6nlich'],['digital','Digital'],['beides','Pers\u00f6nlich und digital'],['sonstiges','Sonstiges']];
  const topics=[['Forschung','Forschung'],['Lehre','Lehre'],['Selbstverwaltung','Selbstverwaltung']];
  async function openInterview(personId){
    clearTimeout(autosaveTimer);
    if(state.draftDirty&&!window.confirm('Der aktuelle Interviewentwurf enth\u00e4lt ungespeicherte \u00c4nderungen. Wirklich wechseln?'))return;
    const p=state.people.find(p=>p.id===personId);
    if(!p){toast('Person konnte nicht gefunden werden.','error');return;}
    state.busy=true;toast('Interview wird ge\u00f6ffnet ...');
    try{
      let interview=state.interviews.find(i=>i.person_id===personId);
      if(!interview){
        const created=await state.db.from('interviews').insert({person_id:personId,status:'in_progress',started_at:new Date().toISOString()}).select('*').single();
        if(created.error){
          if(created.error.code==='23505'){
            const existing=await state.db.from('interviews').select('*').eq('person_id',personId).single();
            if(existing.error)throw existing.error;
            interview=existing.data;
          } else throw created.error;
        }else interview=created.data;
      }
      const results=await Promise.all([
        state.db.from('answers').select('question_key,answer').eq('interview_id',interview.id),
        state.db.from('edges').select('*').eq('interview_id',interview.id),
        state.db.from('locations').select('*').eq('person_id',personId)
      ]);
      results.forEach(r=>{if(r.error)throw r.error;});
      const answers=Object.fromEntries(results[0].data.map(a=>[a.question_key,a.answer]));
      state.form={personId,interviewId:interview.id,version:interview.version,status:interview.status,started_at:interview.started_at,changeRevision:0,
        interviewer_name:interview.interviewer_name||'',interview_notes:interview.notes||'',
        role_group:p.role_group||'',professional_title:p.professional_title||'',unit:p.unit||'',
        building:p.building||'',room:p.room||'',answers,
        edges:results[1].data.map(e=>({target_person_id:e.target_person_id,frequency:e.frequency||'',topics:e.topics||[],exchange_mode:e.exchange_mode||'',note:e.note||''})),
        locations:results[2].data.map(l=>({building:l.building,place:l.place||'',frequency:l.frequency||'',notes:l.notes||''}))};
      state.route='interview';state.step=0;state.draftDirty=false;render();window.scrollTo(0,0);
    }catch(e){toast('Interview konnte nicht geladen werden: '+(e.message||e),'error');}
    finally{state.busy=false;}
  }
  function formStepA(){const f=state.form;
    return `<div class="form-title"><div><span class="eyebrow">Abschnitt A / 01</span><h2>Person und Einordnung</h2><p>Zuordnung und berufliche Selbstbezeichnung der befragten Person.</p></div><span class="pill orange">Fragenfassung vorl\u00e4ufig</span></div>
    <div class="notice-box warn">${icon('alert')}<span>Diese erste Maske basiert auf den R\u00fcckmeldungen vom 10.11.2026. Die exakte Formulierung des vollst\u00e4ndigen Fragenkatalogs muss noch \u00fcbernommen werden.</span></div>
    <div class="question"><span class="question-num">A1 &middot; ZUGEH\u00d6RIGKEIT</span><h3>Welcher Mitarbeitergruppe der Fakult\u00e4t NXT ordnen Sie sich zu?</h3><p>Einfachauswahl, entsprechend der \u00dcberarbeitung des Fragebogens.</p>${selectField('Mitarbeitergruppe', 'role_group',groups,f.role_group)}</div>
    <div class="question"><span class="question-num">A2 &middot; BERUFLICHE SELBSTBEZEICHNUNG</span><h3>Welche berufliche Selbstbezeichnung w\u00fcrden Sie sich geben?</h3><div class="field-grid">${textField('Berufliche Selbstbezeichnung','professional_title',f.professional_title,'z. B. wissenschaftliche Mitarbeit')}${textField('Bereich / organisatorische Zuordnung','unit',f.unit,'z. B. Labor, Werk150, Verwaltung')}</div><p style="margin-top:10px">Die genaue Abgrenzung zwischen Werk150, Laboren und weiteren Einheiten ist noch abzustimmen.</p></div>
    <div class="question"><span class="question-num">INTERVIEWMETADATEN</span><h3>Wer f\u00fchrt das Gespr\u00e4ch?</h3>${textField('Name des Interviewers / der Interviewerin','interviewer_name',f.interviewer_name,'Name der erhebenden Person')}</div>`;
  }
  function edgeCard(edge,index){
    const others=state.people.filter(p=>p.id!==state.form.personId);
    return `<div class="edge-row" data-edge-index="${index}"><div class="edge-row-head"><strong>Fachliche Verbindung ${index+1}</strong><button type="button" class="btn btn-danger btn-sm" data-action="delete-edge" data-index="${index}" title="Verbindung entfernen">${icon('trash',14)} Entfernen</button></div>
      <div class="field field-full"><label>Austauschpartner:in</label><select data-edge-field="target_person_id" data-index="${index}">${option('','Person ausw\u00e4hlen',edge.target_person_id)}${others.map(p=>option(p.id,p.full_name+' ('+p.code+')',edge.target_person_id)).join('')}</select></div>
      <div class="field"><label>H\u00e4ufigkeit des Austauschs</label><select data-edge-field="frequency" data-index="${index}">${frequencies.map(x=>option(...x,edge.frequency)).join('')}</select></div>
      <div class="field"><label>Form des Austauschs</label><select data-edge-field="exchange_mode" data-index="${index}">${modes.map(x=>option(...x,edge.exchange_mode)).join('')}</select></div>
      <div class="field field-full"><span class="field-label">Inhalt des Austauschs (Mehrfachnennung)</span><div class="check-tiles">${topics.map(([id,name])=>`<label class="check-tile"><input type="checkbox" data-topic="${id}" data-index="${index}" ${(edge.topics||[]).includes(id)?'checked':''}>${name}</label>`).join('')}</div></div>
      <div class="field field-full"><label>Erg\u00e4nzungen / konkreter Austauschinhalt</label><input type="text" data-edge-field="note" data-index="${index}" placeholder="Optionaler Kommentar" value="${esc(edge.note||'')}"></div></div>`;
  }
  function formStepB(){const f=state.form;
    return `<div class="form-title"><div><span class="eyebrow">Abschnitt B / 02</span><h2>Fachlicher Austausch</h2><p>Gerichtete Netzwerkbeziehungen: Wer tauscht sich mit wem inhaltlich aus?</p></div><span class="pill">Kanten erfassen</span></div>
      <div class="notice-box">${icon('network')}<span>Es werden nur die von dieser Person genannten Beziehungen erfasst (<strong>Quelle \u2192 Ziel</strong>). Eine Gegenrichtung wird nicht automatisch angelegt. M\u00f6gliche Inhalte: Forschung, Lehre und Selbstverwaltung.</span></div>
      <div class="question"><span class="question-num">B1 &middot; AUSTAUSCHPARTNER</span><h3>Mit welchen Personen findet regelm\u00e4\u00dfig oder gelegentlich fachlicher Austausch statt?</h3><p>F\u00fcr jede genannte Person eine Verbindung anlegen; Frequenz, Art und Inhalt erfassen.</p><div style="margin-top:19px">${f.edges.length?f.edges.map(edgeCard).join(''):empty('Noch keine Kanten erfasst','Erfasse die erste Austauschbeziehung oder markiere ausdr\u00fccklich, dass keine besteht.','network')}</div><button type="button" class="btn btn-light" data-action="add-edge">${icon('plus')} Austauschpartner hinzuf\u00fcgen</button></div>
      <div class="question"><label class="check-tile"><input type="checkbox" data-answer="no_exchange" ${f.answers.no_exchange?'checked':''}>Die befragte Person nennt keine fachlichen Austauschpartner</label><p style="margin-top:9px">Bewusst keine Austauschpartner = 0 Kanten, nicht dasselbe wie fehlende Antworten.</p></div>`;
  }
  function locationCard(loc,index){return `<div class="location-row"><div class="edge-row-head"><strong>Weiterer Aufenthaltsort ${index+1}</strong><button class="btn btn-danger btn-sm" type="button" data-action="delete-location" data-index="${index}">${icon('trash',14)} Entfernen</button></div>
    <div class="field"><label>Geb\u00e4ude / Standort</label><select data-location-field="building" data-index="${index}">${buildings.map(x=>option(...x,loc.building)).join('')}</select></div>
    <div class="field"><label>Ort / Raum</label><input type="text" value="${esc(loc.place||'')}" data-location-field="place" data-index="${index}" placeholder="z. B. Labor, Cafeteria"></div>
    <div class="field"><label>Aufenthaltsh\u00e4ufigkeit</label><select data-location-field="frequency" data-index="${index}">${frequencies.map(x=>option(...x,loc.frequency)).join('')}</select></div>
    <div class="field"><label>Bemerkung</label><input type="text" value="${esc(loc.notes||'')}" data-location-field="notes" data-index="${index}" placeholder="Optional"></div></div>`;}
  function formStepC(){const f=state.form;
    return `<div class="form-title"><div><span class="eyebrow">Abschnitt C / 03</span><h2>R\u00e4umliche Daten</h2><p>Arbeitsort, B\u00fcro und weitere relevante Aufenthaltsorte.</p></div><span class="pill">R\u00e4umliches Netzwerk</span></div>
    <div class="question"><span class="question-num">C1 &middot; HAUPTARBEITSPLATZ</span><h3>Wo befindet sich der regul\u00e4re Arbeitsplatz?</h3><div class="field-grid">${selectField('Geb\u00e4ude', 'building',buildings,f.building)}${textField('B\u00fcro / Raum','room',f.room,'z. B. 111 oder R111')}</div></div>
    <div class="question"><span class="question-num">C2 &middot; WEITERE AUFENTHALTSORTE</span><h3>Welche weiteren Orte werden im Arbeitsalltag aufgesucht?</h3><p>Optional: Weitere Standorte und Aufenthaltsfrequenzen. Wegl\u00e4ngen werden sp\u00e4ter aus dem Geb\u00e4ude- und Raumplan bestimmt und hier nicht gesch\u00e4tzt.</p><div style="margin-top:20px">${f.locations.map(locationCard).join('')}</div><button type="button" class="btn btn-light" data-action="add-location">${icon('plus')} Aufenthaltsort hinzuf\u00fcgen</button></div>`;
  }
  function formStepD(){const f=state.form;const per=state.people.find(x=>x.id===f.personId);
    const isNone=Boolean(f.answers.no_exchange);
    return `<div class="form-title"><div><span class="eyebrow">Abschnitt D / 04</span><h2>Pr\u00fcfen und abschlie\u00dfen</h2><p>Kontrolliere die Angaben und speichere das Interview zentral.</p></div><span class="pill">Version ${f.version}</span></div>
    <div class="summary-grid"><div class="summary-item"><strong>1</strong><small>Interviewperson</small></div><div class="summary-item"><strong>${f.edges.filter(e=>e.target_person_id).length}</strong><small>Fachliche Kanten</small></div><div class="summary-item"><strong>${f.locations.filter(l=>l.building).length}</strong><small>Weitere Orte</small></div></div>
    <div class="review-row"><span>Person</span><strong>${esc(per?.full_name)}</strong></div>
    <div class="review-row"><span>Mitarbeitergruppe</span><strong>${esc(f.role_group||'Noch nicht erfasst')}</strong></div>
    <div class="review-row"><span>Berufliche Selbstbezeichnung</span><strong>${esc(f.professional_title||'Noch nicht erfasst')}</strong></div>
    <div class="review-row"><span>Arbeitsplatz</span><strong>${esc([f.building?`Geb. ${f.building}`:'',f.room?`Raum ${f.room}`:''].filter(Boolean).join(', ')||'Noch nicht erfasst')}</strong></div>
    <div class="review-row"><span>Fachlicher Austausch</span><strong>${f.edges.filter(e=>e.target_person_id).length} Kanten${isNone?' (keine angegeben)':''}</strong></div>
    <div class="review-row"><span>Interviewer:in</span><strong>${esc(f.interviewer_name||'Noch nicht erfasst')}</strong></div>
    <div class="review-row"><span>Interviewbeginn</span><strong>${fmtTime(f.started_at)}</strong></div>
    <div class="field" style="margin-top:21px"><label>Notizen zum Interview</label><textarea data-field="interview_notes" placeholder="Offene Fragen, Unklarheiten, Hinweise zur Interviewdauer ...">${esc(f.interview_notes||'')}</textarea></div>
    <div class="notice-box ${!f.role_group||(!isNone&&!f.edges.length)?'warn':''}" style="margin-top:20px">${icon('info')}<span>${!f.role_group?'Die Mitarbeitergruppe fehlt noch. Du kannst einen Entwurf sichern oder die Angabe erg\u00e4nzen.':!isNone&&!f.edges.length?'Es sind weder Austauschbeziehungen noch die Option \u201ekein Austausch\u201c markiert.':'Die Daten k\u00f6nnen als Entwurf gespeichert oder als abgeschlossen markiert werden.'}</span></div>`;
  }
  function renderInterview(){
    if(!state.form)return empty('Kein Interview ge\u00f6ffnet','Bitte w\u00e4hle eine Person aus der Liste.','clipboard','<button class="btn btn-primary" data-action="navigate" data-route="people">Personen anzeigen</button>');
    const f=state.form,p=state.people.find(x=>x.id===f.personId);
    return pageHead('Interviewdurchf\u00fchrung',esc(p?.full_name||'Interview'),`${esc(p?.code||'')} \u00b7 Antworten zentral speichern, fachliche Verbindungen strukturiert erfassen.`,`<span id="dirty-indicator" class="pill ${state.draftDirty?'orange':'green'}">${state.draftDirty?'Ungespeichert':'Gespeichert'}</span><button class="btn btn-light" data-action="back-to-interviews">${icon('chevron')} Zur \u00dcbersicht</button>`)+
    `<div class="interview-layout"><aside class="panel interview-rail">${stepNames.map((name,index)=>`<button type="button" class="step-button ${state.step===index?'active':''}" data-action="step" data-step="${index}" aria-current="${state.step===index?'step':'false'}"><span class="step-index">${index+1}</span><span class="step-name">${name}</span></button>`).join('')}<div class="step-separator"></div><div style="padding:10px 8px;font-size:11px;line-height:1.7;color:var(--muted)">${icon('shield',15)} Jede Speicherung wird auf Bearbeitungskonflikte gepr\u00fcft.</div></aside><section class="panel interview-form-card">${[formStepA,formStepB,formStepC,formStepD][state.step]()}<div class="form-footer"><button type="button" class="btn btn-light" data-action="previous-step" ${state.step===0?'disabled':''}>Zur\u00fcck</button><div style="display:flex;gap:9px;flex-wrap:wrap;justify-content:flex-end"><button type="button" class="btn btn-ghost" data-action="save-draft">${icon('save')} Entwurf sichern</button>${state.step<3?`<button type="button" class="btn btn-primary" data-action="next-step">Weiter ${icon('arrow')}</button>`:`<button type="button" class="btn btn-primary" data-action="save-completed">${icon('check')} Abschlie\u00dfen</button>`}</div></div></section></div>`;
  }
  function renderNetwork(){
    const c=counts(), degrees=new Map(state.people.map(p=>[p.id,0]));
    state.edges.forEach(e=>{degrees.set(e.source_person_id,(degrees.get(e.source_person_id)||0)+1);degrees.set(e.target_person_id,(degrees.get(e.target_person_id)||0)+1);});
    const top=[...state.people].sort((a,b)=>(degrees.get(b.id)||0)-(degrees.get(a.id)||0)).slice(0,16);
    const positions=new Map(top.map((p,i)=>[p.id,{x:320+130*Math.cos(2*Math.PI*i/Math.max(top.length,1)-Math.PI/2),y:155+117*Math.sin(2*Math.PI*i/Math.max(top.length,1)-Math.PI/2)}]));
    const edges=state.edges.filter(e=>positions.has(e.source_person_id)&&positions.has(e.target_person_id));
    const svg=top.length?`<svg viewBox="0 0 640 310" role="img" aria-label="Netzwerkvorschau der Personen und Austauschbeziehungen">${edges.map(e=>{const a=positions.get(e.source_person_id),b=positions.get(e.target_person_id);return `<line class="network-link" x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}"><title>${esc(personName(e.source_person_id))} zu ${esc(personName(e.target_person_id))}</title></line>`;}).join('')}${top.map(p=>{const a=positions.get(p.id),deg=degrees.get(p.id)||0;return `<g><circle class="network-node" cx="${a.x}" cy="${a.y}" r="${Math.min(17,10+deg*1.8)}" fill="${deg?'#008b92':'#94bcc0'}"><title>${esc(p.full_name)}: ${deg} Verbindungen</title></circle><text text-anchor="middle" x="${a.x}" y="${a.y+31}">${esc(p.code)}</text></g>`;}).join('')}</svg>`:empty('Noch kein Netzwerk','Sobald die ersten Personen angelegt werden, erscheint hier eine Vorschau.','network');
    const topDegree=[...state.people].sort((a,b)=>(degrees.get(b.id)||0)-(degrees.get(a.id)||0)).slice(0,5);
    return pageHead('Netzwerkmonitor','Fachlicher Austausch','Erste Vorschau des gerichteten Netzwerks aus den erfassten Interviewkanten.',`<button class="btn btn-primary" data-action="navigate" data-route="export">${icon('download')} Kanten exportieren</button>`)+
    `<div class="network-kpi">${stat('Knoten / Personen',c.total,'Erfasste Mitarbeitende','users')}${stat('Gerichtete Kanten',c.edges,'Quelle \u2192 Ziel','network')}${stat('Beziehungslast',c.total?(c.edges/c.total).toFixed(2):'0.00','Kanten je Person (Mittel)','chart')}</div><div class="dash-grid"><div class="panel"><div class="panel-head" style="padding:22px 22px 0"><h2>Netzwerkvorschau</h2><span class="pill">${top.length} sichtbare Knoten</span></div><div class="network-visual">${svg}</div><div class="network-caption">Vereinfachte Vorschau (max. 16 Knoten). Die vollst\u00e4ndige, gerichtete Kantenliste ist im Excel-Export enthalten. Keine automatische Reziprozit\u00e4t.</div></div><div class="panel"><div class="panel-inner"><div class="panel-head"><h2>Am st\u00e4rksten verbunden</h2><small>Ein- und ausgehende Kanten</small></div>${topDegree.length?topDegree.map((p,index)=>`<div class="activity-entry"><span class="activity-bubble">${index+1}</span><div><strong>${esc(p.full_name)}</strong><small>${esc(p.code)}</small></div><span class="pill">${degrees.get(p.id)||0} Kanten</span></div>`).join(''):empty('Keine Netzwerkdaten','Erfasse zun\u00e4chst Interviews.','network')}<div class="notice-box" style="margin-top:20px">${icon('info')}<span>Die Visualisierung ist eine explorative Vorschau, keine statistische Netzwerkanalyse. Exportiere f\u00fcr Gephi, VennMaker oder eine externe Analyse.</span></div></div></div></div>`;
  }
  function renderExport(){
    const c=counts(),canExport=state.member?.role==='admin';
    const sheets=[['Persons','Personenmerkmale, ID, Rolle, Geb\u00e4ude, B\u00fcro'],['Interviews','Interviewer, Zeitpunkt, Status und Version'],['Answers','Frage / Antwort je Interview'],['Edges','Gerichtete Netzwerkkanten mit Frequenz, Art und Inhalt'],['Locations','Weitere Orte und Aufenthaltsfrequenzen'],['Nodes','Gephi-taugliche Knotenliste'],['Datenqualitaet','Offene Angaben und Erhebungsstatus']];
    return pageHead('Daten & Auswertung','Datenexport','Lade die gemeinsamen Interviewdaten als Excel-Arbeitsmappe herunter. Die Daten werden direkt aus Supabase gelesen.')+
      `<div class="export-grid"><div><section class="export-feature"><div class="feature-icon">${icon('download',27)}</div><div><span class="eyebrow">Wissenschaftlicher Export</span><h2>Ein Download. Alle Daten.</h2><p>Der Excel-Export enth\u00e4lt Personen, die Originalantworten, r\u00e4umliche Informationen und gerichtete Netzwerkbeziehungen in getrennten Tabellenbl\u00e4ttern.</p><button class="btn btn-primary" data-action="export-xlsx" ${canExport?'':'disabled'}>${icon('download')} Excel (.xlsx) herunterladen</button>${!canExport?'<p style="margin-top:10px">Export nur mit Administrator-Rechten verf\u00fcgbar.</p>':''}</div></section><div class="notice-box warn" style="margin-top:20px">${icon('alert')}<span>Der Export enth\u00e4lt personenbezogene Forschungsdaten. Nicht in GitHub hochladen und nur \u00fcber zugelassene Hochschulablagen weitergeben. Vor der Erhebung Datenschutz und Hochschulfreigabe pr\u00fcfen.</span></div></div><div class="panel"><div class="panel-inner"><div class="panel-head"><h2>Enthaltene Tabellen</h2><span class="pill">7 Sheets</span></div><div class="sheet-list">${sheets.map(([name,desc])=>`<div class="sheet-item">${icon('file')}<div><strong>${name}</strong><small>${desc}</small></div>${icon('check',14)}</div>`).join('')}</div></div></div></div><div class="stat-grid" style="margin-top:22px">${stat('Personen',c.total,'F\u00fcr Nodes','users')}${stat('Kanten',c.edges,'F\u00fcr Edges','network')}${stat('Abgeschlossen',c.done,'Verwertbare Interviews','check')}${stat('Offene Interviews',c.pending+c.ongoing,'Datenqualit\u00e4t pr\u00fcfen','clock')}</div>`;
  }
  function clearModal(){state.modal='';const host=qs('#modal-host');if(host)host.innerHTML='';}
  function openPersonModal(){
    const used=new Set(state.people.map(p=>p.code));let n=1;while(used.has('NXT-'+String(n).padStart(3,'0')))n++;
    const host=qs('#modal-host');if(!host)return;
    host.innerHTML=`<div class="modal-backdrop" role="presentation"><div class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div class="modal-head"><h2 id="modal-title">Neue Person anlegen</h2><button type="button" class="icon-button" data-action="close-modal" aria-label="Schlie\u00dfen">${icon('x')}</button></div><form id="person-form"><div class="modal-body"><p>Nur tats\u00e4chlich teilnehmende Personen anlegen. Keine personenbezogenen Daten im GitHub-Code speichern.</p><div class="field-grid"><div class="field field-full"><label for="p-name">Vor- und Nachname *</label><input id="p-name" name="full_name" required maxlength="160" placeholder="Name der Person"></div><div class="field"><label for="p-code">Personen-ID *</label><input id="p-code" name="code" required maxlength="40" value="NXT-${String(n).padStart(3,'0')}"></div><div class="field"><label for="p-building">Geb\u00e4ude (optional)</label><select id="p-building" name="building">${buildings.map(x=>option(...x,'')).join('')}</select></div><div class="field field-full"><label for="p-room">Raum (optional)</label><input id="p-room" name="room" placeholder="B\u00fcro / Raum"></div></div></div><div class="modal-foot"><button type="button" class="btn btn-light" data-action="close-modal">Abbrechen</button><button type="submit" class="btn btn-primary">${icon('plus')} Person speichern</button></div></form></div></div>`;
    state.modal='person';qs('#p-name')?.focus();
  }
  function openImportModal(){
    if(state.member?.role!=='admin'){toast('Der Personenimport ist Administratoren vorbehalten.','error');return;}
    const host=qs('#modal-host');if(!host)return;
    host.innerHTML=`<div class="modal-backdrop" role="presentation"><div class="modal modal-wide" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div class="modal-head"><h2 id="modal-title">Personenliste importieren</h2><button type="button" class="icon-button" data-action="close-modal" aria-label="Schlie\u00dfen">${icon('x')}</button></div><form id="import-form"><div class="modal-body"><div class="info-note">Excel- oder CSV-Datei mit Spalten wie <strong>Name</strong>, optional <strong>Personen-ID</strong>, <strong>Geb\u00e4ude</strong>, <strong>Raum</strong>, <strong>Gruppe</strong>. Nur neue Personen werden angelegt; Dubletten werden \u00fcbersprungen. Die Quelldatei wird nicht hochgeladen, sondern lokal im Browser verarbeitet.</div><div class="field" style="margin-top:20px"><label for="import-file">Datei ausw\u00e4hlen *</label><input id="import-file" type="file" name="file" accept=".xlsx,.xls,.csv" required></div><p>Maximal 300 Zeilen. Die Daten werden erst nach deiner Best\u00e4tigung in Supabase gespeichert.</p></div><div class="modal-foot"><button class="btn btn-light" type="button" data-action="close-modal">Abbrechen</button><button class="btn btn-primary" type="submit">${icon('upload')} Import pr\u00fcfen</button></div></form></div></div>`;
    state.modal='import';
  }
  function markDirty(){
    state.draftDirty=true;
    if(state.form)state.form.changeRevision=(state.form.changeRevision||0)+1;
    clearTimeout(autosaveTimer);
    autosaveTimer=setTimeout(()=>{
      if(state.route==='interview'&&state.draftDirty&&!state.busy&&state.form
         &&!state.form.edges.some(e=>!e.target_person_id))
        saveInterview(state.form.status==='completed'?'completed':'in_progress',true);
    },12000);
    const el=qs('#dirty-indicator');if(el){el.className='pill orange';el.textContent='Ungespeichert';}
  }
  function handleInput(e){
    const el=e.target;
    if(el.id==='people-search'){state.query=el.value;refreshPeopleTable();return;}
    if(el.id==='people-filter'){state.filter=el.value;refreshPeopleTable();return;}
    if(!state.form)return;
    if(el.dataset.field){state.form[el.dataset.field]=el.value;markDirty();return;}
    if(el.dataset.answer){state.form.answers[el.dataset.answer]=el.type==='checkbox'?el.checked:el.value;markDirty();return;}
    if(el.dataset.edgeField){
      const edge=state.form.edges[Number(el.dataset.index)];if(edge){edge[el.dataset.edgeField]=el.value;markDirty();}return;
    }
    if(el.dataset.topic){
      const edge=state.form.edges[Number(el.dataset.index)];if(!edge)return;
      const t=new Set(edge.topics||[]);if(el.checked)t.add(el.dataset.topic);else t.delete(el.dataset.topic);
      edge.topics=[...t];markDirty();return;
    }
    if(el.dataset.locationField){
      const location=state.form.locations[Number(el.dataset.index)];if(location){location[el.dataset.locationField]=el.value;markDirty();}
    }
  }
  function refreshPeopleTable(){
    const list=qs('#people-list');if(list)list.innerHTML=renderPeopleTable(filteredPeople());
    const count=qs('#people-count');if(count)count.textContent=filteredPeople().length+' Personen';
  }
  async function saveInterview(status,background=false){
    if(state.busy||!state.form)return;
    const f=state.form;
    clearTimeout(autosaveTimer);
    const revision=f.changeRevision||0;
    if(status==='completed'&&!background){
      if(!clean(f.interviewer_name)){state.step=0;render();toast('Bitte Namen der interviewenden Person eintragen.','error');return;}
      if(!clean(f.role_group)){state.step=0;render();toast('Bitte zuerst die Mitarbeitergruppe erfassen.','error');return;}
      if(!f.edges.length&&!f.answers.no_exchange){state.step=1;render();toast('Bitte mindestens einen Austauschpartner eintragen oder die Option "kein Austausch" markieren.','error');return;}
    }
    if(f.edges.some(e=>!e.target_person_id)){
      state.step=1;render();toast('Bitte bei jeder erfassten Kante eine Zielperson ausw\u00e4hlen oder die leere Zeile entfernen.','error');return;
    }
    if(f.edges.some(e=>e.target_person_id===f.personId)||new Set(f.edges.map(e=>e.target_person_id)).size!==f.edges.length){
      state.step=1;render();toast('Selbstverbindungen und doppelt erfasste Zielpersonen sind nicht zul\u00e4ssig.','error');return;
    }
    if(f.edges.length&&f.answers.no_exchange){
      state.step=1;render();toast('Bitte den Haken "keine Austauschpartner" entfernen, wenn Kanten erfasst wurden.','error');return;
    }
    state.busy=true;
    try{
      const body={p_interview_id:f.interviewId,p_expected_version:f.version,p_status:status,
        p_interviewer_name:clean(f.interviewer_name),p_notes:clean(f.interview_notes),
        p_role_group:clean(f.role_group),p_professional_title:clean(f.professional_title),
        p_unit:clean(f.unit),p_building:clean(f.building),p_room:clean(f.room),
        p_answers:Object.entries(f.answers).map(([question_key,answer])=>({question_key,answer})),
        p_edges:f.edges.map(edge=>({...edge,note:clean(edge.note)})),
        p_locations:f.locations.filter(l=>clean(l.building)).map(l=>({...l}))};
      const {data,error}=await state.db.rpc('save_interview_snapshot',body);
      if(error)throw error;
      f.version=Number(data);f.status=status;state.draftDirty=f.changeRevision!==revision;
      await reloadData(false);
      if(background){
        const indicator=qs('#dirty-indicator');
        if(indicator){indicator.className='pill '+(state.draftDirty?'orange':'green');indicator.textContent=state.draftDirty?'Ungespeichert':'Automatisch gespeichert';}
        if(state.draftDirty)markDirty();
      }else{
        if(status==='completed'){state.route='interviews';state.form=null;toast('Interview abgeschlossen und zentral gespeichert.','success');}
        else toast('Interviewentwurf zentral gespeichert.','success');
        render();
      }
    }catch(e){
      const conflict=/INTERVIEW_CONFLICT/i.test(e.message||'');
      toast(conflict?'Speicherkonflikt: Dieses Interview wurde inzwischen auf einem anderen Ger\u00e4t ge\u00e4ndert. Bitte \u00c4nderungen sichern und die Seite aktualisieren.':'Speichern fehlgeschlagen: '+(e.message||e),'error');
    }finally{state.busy=false;}
  }
  function canLeave(){return !state.draftDirty||window.confirm('Es gibt ungespeicherte Interviewdaten. Wirklich ohne Speichern wechseln?');}
  function navigate(route){
    if(!canLeave())return;
    clearTimeout(autosaveTimer);
    state.route=route;state.form=null;state.draftDirty=false;state.query='';state.filter='all';state.step=0;
    render();window.scrollTo(0,0);
  }
  async function addPerson(form){
    if(state.busy)return;
    const fd=new FormData(form),name=clean(fd.get('full_name')),code=clean(fd.get('code'));
    if(!name||!code){toast('Bitte Name und Personen-ID eingeben.','error');return;}
    if(state.people.some(p=>p.code.toLocaleLowerCase('de')===code.toLocaleLowerCase('de')||p.full_name.toLocaleLowerCase('de')===name.toLocaleLowerCase('de'))){toast('Diese Person oder Personen-ID ist bereits vorhanden.','error');return;}
    state.busy=true;
    try{
      const {error}=await state.db.from('persons').insert({full_name:name,code,building:clean(fd.get('building'))||null,room:clean(fd.get('room'))||null});
      if(error)throw error;
      clearModal();await reloadData();toast('Person erfolgreich angelegt.','success');
    }catch(e){toast('Person konnte nicht gespeichert werden: '+e.message,'error');}
    finally{state.busy=false;}
  }
  function valueFromRow(row,names){
    const map=Object.fromEntries(Object.entries(row).map(([key,val])=>[key.toLowerCase().replace(/[^a-z0-9]/g,''),val]));
    for(const name of names){const v=map[name.toLowerCase().replace(/[^a-z0-9]/g,'')];if(v!==undefined&&v!==null&&String(v).trim())return clean(v);}
    return '';
  }
  async function importPeople(form){
    if(state.busy)return;
    if(state.member?.role!=='admin'){toast('Keine Importberechtigung.','error');return;}
    const file=qs('#import-file',form)?.files[0];
    if(!file){toast('Bitte eine Datei ausw\u00e4hlen.','error');return;}
    if(!window.XLSX){toast('Excel-Bibliothek konnte nicht geladen werden.','error');return;}
    if(file.size>4*1024*1024){toast('Die Datei ist zu gro\u00df (maximal 4 MB).','error');return;}
    state.busy=true;
    try{
      const workbook=window.XLSX.read(await file.arrayBuffer(),{type:'array'});
      const rows=window.XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]],{defval:''});
      if(!rows.length)throw Error('Die Datei enth\u00e4lt keine Datenzeilen.');
      if(rows.length>300)throw Error('Maximal 300 Personen pro Import.');
      const knownNames=new Set(state.people.map(p=>p.full_name.toLocaleLowerCase('de')));
      const knownCodes=new Set(state.people.map(p=>p.code.toLocaleLowerCase('de')));
      let next=1,skipped=0;const records=[];
      for(const row of rows){
        const name=valueFromRow(row,['Name','Full Name','Vollstaendiger Name','Vollstandiger Name','Person','Mitarbeiter']) ||
          [valueFromRow(row,['Vorname','First Name']),valueFromRow(row,['Nachname','Last Name'])].filter(Boolean).join(' ');
        if(!name||knownNames.has(name.toLocaleLowerCase('de'))){skipped++;continue;}
        let code=valueFromRow(row,['Personen-ID','Personen ID','ID','Code','Person ID']);
        if(!code){do{code='NXT-'+String(next++).padStart(3,'0');}while(knownCodes.has(code.toLocaleLowerCase('de')));}
        if(knownCodes.has(code.toLocaleLowerCase('de'))){skipped++;continue;}
        knownNames.add(name.toLocaleLowerCase('de'));knownCodes.add(code.toLocaleLowerCase('de'));
        records.push({full_name:name,code,role_group:valueFromRow(row,['Gruppe','Mitarbeitergruppe','Role','Role Group'])||null,
          building:valueFromRow(row,['Gebaeude','Gebäude','Building'])||null,
          room:valueFromRow(row,['Raum','Room','Buero','Büro'])||null,
          unit:valueFromRow(row,['Bereich','Einheit','Unit','Abteilung'])||null});
      }
      if(!records.length)throw Error('Keine neuen Personen gefunden. '+skipped+' Zeilen waren leer oder doppelt.');
      if(!window.confirm(`${records.length} neue Personen zentral speichern? ${skipped} Zeilen werden \u00fcbersprungen.\nBeispiele: ${records.slice(0,3).map(r=>r.full_name).join(', ')}`))return;
      const {error}=await state.db.from('persons').insert(records);
      if(error)throw error;
      clearModal();await reloadData();toast(`${records.length} Personen erfolgreich importiert.`,`success`);
    }catch(e){toast('Import fehlgeschlagen: '+(e.message||e),'error');}
    finally{state.busy=false;}
  }
  function makeSheet(wb,name,headers,rows){
    const safe=rows.map(row=>headers.map(h=>escapeExcel(row[h])));
    const sheet=window.XLSX.utils.aoa_to_sheet([headers,...safe]);
    sheet['!cols']=headers.map(h=>({wch:Math.min(56,Math.max(15,h.length+3,...rows.slice(0,100).map(r=>String(r[h]||'').length+3)))}));
    if(rows.length)sheet['!autofilter']={ref:`A1:${window.XLSX.utils.encode_col(headers.length-1)}${rows.length+1}`};
    window.XLSX.utils.book_append_sheet(wb,sheet,name);
  }
  async function fetchAllRows(table){
    const all=[];const batchSize=500;
    for(let from=0;from<100000;from+=batchSize){
      const {data,error}=await state.db.from(table).select('*').range(from,from+batchSize-1);
      if(error)throw Error(table+': '+error.message);
      all.push(...(data||[]));
      if((data||[]).length<batchSize)return all;
    }
    throw Error('Exportlimit erreicht. Bitte die Datenbankabfrage eingrenzen.');
  }
  async function exportData(){
    if(state.member?.role!=='admin'){toast('Der Datenexport ist nur f\u00fcr Administratoren freigegeben.','error');return;}
    if(!window.XLSX){toast('Die Excel-Bibliothek ist nicht verf\u00fcgbar.','error');return;}
    if(state.busy)return;state.busy=true;
    try{
      const names=['persons','interviews','edges','locations','answers'];
      const [people,interviews,edges,locations,answers]=await Promise.all(names.map(fetchAllRows));
      const byId=new Map(people.map(p=>[p.id,p]));const interviewById=new Map(interviews.map(i=>[i.id,i]));
      const answerByInterview=new Map();for(const a of answers){if(!answerByInterview.has(a.interview_id))answerByInterview.set(a.interview_id,{});answerByInterview.get(a.interview_id)[a.question_key]=a.answer;}
      const personRows=people.map(p=>({ID:p.id,Code:p.code,Name:p.full_name,Mitarbeitergruppe:p.role_group,Berufsbezeichnung:p.professional_title,Bereich:p.unit,Gebaeude:p.building,Raum:p.room,Anmerkungen:p.notes}));
      const interviewRows=interviews.map(i=>({InterviewID:i.id,PersonenID:i.person_id,Person:byId.get(i.person_id)?.full_name,Status:i.status,Interviewer:i.interviewer_name,Beginn:i.started_at,Abschluss:i.completed_at,DauerMinuten:i.started_at&&i.completed_at?Math.round((new Date(i.completed_at)-new Date(i.started_at))/60000*10)/10:'',LetzteAktualisierung:i.updated_at,Version:i.version,Notizen:i.notes}));
      const answerRows=answers.map(a=>({InterviewID:a.interview_id,PersonCode:byId.get(interviewById.get(a.interview_id)?.person_id)?.code||'',Frage:a.question_key,Antwort:JSON.stringify(a.answer),LetzteAktualisierung:a.updated_at}));
      const edgeRows=edges.map(e=>({Source:byId.get(e.source_person_id)?.code||e.source_person_id,Target:byId.get(e.target_person_id)?.code||e.target_person_id,SourceName:byId.get(e.source_person_id)?.full_name,TargetName:byId.get(e.target_person_id)?.full_name,Frequency:e.frequency,Topics:(e.topics||[]).join(' | '),ExchangeMode:e.exchange_mode,Note:e.note,InterviewID:e.interview_id,Directed:true}));
      const locationRows=locations.map(l=>({PersonCode:byId.get(l.person_id)?.code||'',Person:byId.get(l.person_id)?.full_name,Gebaeude:l.building,Ort:l.place,Frequenz:l.frequency,Anmerkungen:l.notes}));
      const nodeRows=people.map(p=>({Id:p.code,Label:p.full_name,Group:p.role_group,Unit:p.unit,Building:p.building,Room:p.room}));
      const dqRows=people.map(p=>{
        const i=interviews.find(i=>i.person_id===p.id),an=i?answerByInterview.get(i.id)||{}:{};
        const n=edges.filter(e=>e.source_person_id===p.id).length;
        return {PersonCode:p.code,Name:p.full_name,Interviewstatus:i?.status||'planned',FehltMitarbeitergruppe:!p.role_group,FehltGebaeude:!p.building,FehltRaum:!p.room,FehltInterviewer:!i?.interviewer_name,KantenAnzahl:n,KeinAustauschBestatigt:Boolean(an.no_exchange),FachlicherAustauschUngeklaert:n===0&&!an.no_exchange};
      });
      const wb=window.XLSX.utils.book_new();wb.Props={Title:'NXT Netzwerkforschung - Interviewdaten',Subject:'Fachlicher Austausch und raeumliche Naehe',Author:'NXT Research'};
      makeSheet(wb,'Persons',['ID','Code','Name','Mitarbeitergruppe','Berufsbezeichnung','Bereich','Gebaeude','Raum','Anmerkungen'],personRows);
      makeSheet(wb,'Interviews',['InterviewID','PersonenID','Person','Status','Interviewer','Beginn','Abschluss','DauerMinuten','LetzteAktualisierung','Version','Notizen'],interviewRows);
      makeSheet(wb,'Answers',['InterviewID','PersonCode','Frage','Antwort','LetzteAktualisierung'],answerRows);
      makeSheet(wb,'Edges',['Source','Target','SourceName','TargetName','Frequency','Topics','ExchangeMode','Note','InterviewID','Directed'],edgeRows);
      makeSheet(wb,'Locations',['PersonCode','Person','Gebaeude','Ort','Frequenz','Anmerkungen'],locationRows);
      makeSheet(wb,'Nodes',['Id','Label','Group','Unit','Building','Room'],nodeRows);
      makeSheet(wb,'Datenqualitaet',['PersonCode','Name','Interviewstatus','FehltMitarbeitergruppe','FehltGebaeude','FehltRaum','FehltInterviewer','KantenAnzahl','KeinAustauschBestatigt','FachlicherAustauschUngeklaert'],dqRows);
      const date=new Date().toISOString().slice(0,10);window.XLSX.writeFile(wb,`NXT_Netzwerkforschung_${date}.xlsx`,{compression:true});
      toast('Excel-Export wurde erstellt. Bitte ausschlie\u00dflich gesch\u00fctzt ablegen.','success');
    }catch(e){toast('Excel-Export fehlgeschlagen: '+(e.message||e),'error');}
    finally{state.busy=false;}
  }
  async function handleClick(e){
    const btn=e.target.closest('[data-action]');if(!btn||!root.contains(btn))return;
    const a=btn.dataset.action;
    if(a==='navigate'){navigate(btn.dataset.route);return;}
    if(a==='open-nav'){qs('#shell')?.classList.add('nav-open');return;}
    if(a==='close-nav'){qs('#shell')?.classList.remove('nav-open');return;}
    if(a==='refresh'){try{await reloadData();toast('Daten aktualisiert.','success');}catch(err){toast(err.message,'error');}return;}
    if(a==='logout'){if(canLeave())await logout();return;}
    if(a==='add-person'){openPersonModal();return;}
    if(a==='import-people'){openImportModal();return;}
    if(a==='close-modal'){clearModal();return;}
    if(a==='open-interview'){await openInterview(btn.dataset.person);return;}
    if(a==='back-to-interviews'){navigate('interviews');return;}
    if(a==='step'){state.step=Number(btn.dataset.step);render();return;}
    if(a==='next-step'){state.step=Math.min(3,state.step+1);render();window.scrollTo(0,0);return;}
    if(a==='previous-step'){state.step=Math.max(0,state.step-1);render();window.scrollTo(0,0);return;}
    if(a==='add-edge'){
      state.form.edges.push({target_person_id:'',frequency:'',topics:[],exchange_mode:'',note:''});
      if(state.form.answers.no_exchange)state.form.answers.no_exchange=false;
      markDirty();render();return;
    }
    if(a==='delete-edge'){state.form.edges.splice(Number(btn.dataset.index),1);markDirty();render();return;}
    if(a==='add-location'){state.form.locations.push({building:'',place:'',frequency:'',notes:''});markDirty();render();return;}
    if(a==='delete-location'){state.form.locations.splice(Number(btn.dataset.index),1);markDirty();render();return;}
    if(a==='save-draft'){await saveInterview('in_progress');return;}
    if(a==='save-completed'){await saveInterview('completed');return;}
    if(a==='export-xlsx'){await exportData();return;}
  }
  async function handleSubmit(e){
    const form=e.target;
    if(!['login-form','person-form','import-form'].includes(form.id))return;
    e.preventDefault();
    if(form.id==='person-form'){await addPerson(form);return;}
    if(form.id==='import-form'){await importPeople(form);return;}
    const btn=qs('button[type="submit"]',form);if(btn){btn.disabled=true;btn.textContent='Anmeldung wird gepr\u00fcft ...';}
    try{
      const password=qs('#password',form)?.value||'';
      const {data,error}=await state.db.auth.signInWithPassword({email:(config.AUTH_EMAIL || (qs('#email',form)?.value || '').trim()),password});
      if(error)throw error;
      await authenticated(data.user);
    }catch(e){renderLogin('Anmeldung fehlgeschlagen. Bitte Passwort und Netzwerkverbindung pr\u00fcfen.');}
  }
  root.addEventListener('submit',handleSubmit);
  root.addEventListener('click',handleClick);
  root.addEventListener('input',handleInput);
  root.addEventListener('change',handleInput);
  window.addEventListener('beforeunload',e=>{if(state.draftDirty){e.preventDefault();e.returnValue='';}});
  start();
})();
