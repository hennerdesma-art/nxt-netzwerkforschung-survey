/* NXT Netzwerkforschung - shared, authenticated survey front end. */
(() => {
  'use strict';
  const config = window.NXT_CONFIG || {};
  let autosaveTimer = null;
  const root = document.getElementById('app');
  const state = {
    db: null, user: null, member: null, people: [], interviews: [], edges: [], locations: [],
    route: 'dashboard', query: '', filter: 'all', peerQuery:'', peerOnly:false, form: null, step: 0, busy: false,
    channel: null, poll: null, modal: '', draftDirty: false,
    network: {controlsOpen:false,layout:'orbit3d',metric:'degree',limit:39,labels:true,hideIsolates:false,onlyInterviewed:false,sizeMode:'degree',depth:72,topic:'all'}
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
    sliders:'<path d="M4 21v-7m0-4V3m8 18v-4m0-4V3m8 18v-9m0-4V3"/><circle cx="4" cy="12" r="2"/><circle cx="12" cy="15" r="2"/><circle cx="20" cy="10" r="2"/>',
    pencil:'<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L9 17l-4 1 1-4Z"/>',
    maximize:'<path d="M8 3H5a2 2 0 0 0-2 2v3M16 3h3a2 2 0 0 1 2 2v3M8 21H5a2 2 0 0 1-2-2v-3M16 21h3a2 2 0 0 0 2-2v-3"/>',
    sparkles:'<path d="m12 3 1.9 4.8L19 9.7l-5.1 1.3L12 16l-1.9-5L5 9.7l5.1-1.9L12 3Z"/><path d="M5 3v2M4 4h2M19 17v4M17 19h4"/>',
    info:'<circle cx="12" cy="12" r="10"/><path d="M12 11v6M12 7h.01"/>'
  };
  const icon = (name,size=18) => `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${I[name]||I.info}</svg>`;
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmt = date => date ? new Intl.DateTimeFormat('de-DE',{day:'2-digit',month:'2-digit',year:'numeric'}).format(new Date(date)) : '\u2014';
  const fmtTime = date => date ? new Intl.DateTimeFormat('de-DE',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}).format(new Date(date)) : '\u2014';
  const initials = text => String(text||'?').split(/\s+/).filter(Boolean).slice(0,2).map(a=>a[0]).join('').toUpperCase();
  const clean = text => String(text??'').trim();
  const clamp = (min,val,max) => Math.max(min, Math.min(max, val));
  const qs = (sel,el=document) => el.querySelector(sel);
  const escapeExcel = value => typeof value==='string' && /^[=+@\-\t\r]/.test(value) ? "'"+value : (value ?? '');
  const personName = id => state.people.find(p=>p.id===id)?.full_name || 'Unbekannte Person';
  const personCode = id => state.people.find(p=>p.id===id)?.code || 'UNKNOWN';
  const statusFor = id => state.interviews.find(i=>i.person_id===id)?.status || 'planned';
  const badge = status => ({completed:'<span class="pill green">Durchgeführt</span>',declined:'<span class="pill gray">Abgelehnt</span>',in_progress:'<span class="pill orange">In Bearbeitung</span>',planned:'<span class="pill gray">Offen</span>'}[status] || '<span class="pill gray">Offen</span>');
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
      ongoing=state.interviews.filter(i=>i.status==='in_progress').length,declined=state.interviews.filter(i=>i.status==='declined').length;
    return {total,done,ongoing,declined,pending:Math.max(0,total-done-ongoing-declined),edges:state.edges.length,progress:total?Math.round(done/total*100):0};
  }

  function networkPrefs(){
    if(!state.network)state.network={controlsOpen:false,layout:'orbit3d',metric:'degree',limit:39,labels:true,hideIsolates:false,onlyInterviewed:false,sizeMode:'degree',depth:72,topic:'all'};
    return state.network;
  }
  function computeNetworkModel(){
    const prefs=networkPrefs();
    const byId=new Map(state.people.map(person=>[person.id,{person,inDegree:0,outDegree:0,degree:0,building:clean(person.building||'')||'Ohne Gebäude'}]));
    const interviewStatus=new Map(state.interviews.map(i=>[i.person_id,i.status]));
    const validEdges=[];const edgePairs=new Set();
    for(const e of state.edges){
      if(!byId.has(e.source_person_id)||!byId.has(e.target_person_id)||e.source_person_id===e.target_person_id)continue;
      validEdges.push(e); edgePairs.add(e.source_person_id+'|'+e.target_person_id);
      const s=byId.get(e.source_person_id),t=byId.get(e.target_person_id);
      s.outDegree+=1; t.inDegree+=1;
    }
    const nodes=[...byId.values()].map(node=>({...node,degree:node.inDegree+node.outDegree,isolate:false,interviewStatus:interviewStatus.get(node.person.id)||'planned'}));
    nodes.forEach(n=>{n.isolate=n.degree===0;});
    const completedCount=nodes.filter(n=>n.interviewStatus==='completed').length;
    const activeCount=nodes.filter(n=>n.interviewStatus!=='planned').length;
    const density=nodes.length>1?validEdges.length/(nodes.length*(nodes.length-1)):0;
    let reciprocatedEdges=0; const mutualPairs=new Set();
    for(const e of validEdges){
      const reverse=e.target_person_id+'|'+e.source_person_id;
      if(edgePairs.has(reverse)){
        reciprocatedEdges+=1;
        const key=[e.source_person_id,e.target_person_id].sort().join('|');
        mutualPairs.add(key);
      }
    }
    const buildingMatrix=new Map();let crossBuilding=0,withinBuilding=0,unknownBuilding=0;
    const topics={F:0,L:0,S:0,A:0,unknown:0};
    for(const e of validEdges){
      const s=byId.get(e.source_person_id),t=byId.get(e.target_person_id);if(!s||!t)continue;
      const a=clean(s.person.building),b=clean(t.person.building);
      const key=(a||'Ohne Angabe')+'→'+(b||'Ohne Angabe');buildingMatrix.set(key,(buildingMatrix.get(key)||0)+1);
      if(!a||!b)unknownBuilding+=1;
      else if(a!==b)crossBuilding+=1;
      else withinBuilding+=1;
      const topic=(e.topics||[])[0];if(Object.hasOwn(topics,topic))topics[topic]++;else topics.unknown++;
    }
    const weakAdj=new Map(nodes.map(n=>[n.person.id,new Set()]));
    for(const e of validEdges){ weakAdj.get(e.source_person_id)?.add(e.target_person_id); weakAdj.get(e.target_person_id)?.add(e.source_person_id); }
    const components=[]; const seen=new Set();
    for(const node of nodes){
      if(seen.has(node.person.id))continue;
      const stack=[node.person.id], comp=[]; seen.add(node.person.id);
      while(stack.length){
        const cur=stack.pop(); comp.push(cur);
        for(const nxt of weakAdj.get(cur)||[]){ if(!seen.has(nxt)){ seen.add(nxt); stack.push(nxt);} }
      }
      components.push(comp);
    }
    const sorters={
      degree:(a,b)=>b.degree-a.degree||a.person.full_name.localeCompare(b.person.full_name,'de'),
      out:(a,b)=>b.outDegree-a.outDegree||b.degree-a.degree||a.person.full_name.localeCompare(b.person.full_name,'de'),
      in:(a,b)=>b.inDegree-a.inDegree||b.degree-a.degree||a.person.full_name.localeCompare(b.person.full_name,'de'),
      alpha:(a,b)=>a.person.full_name.localeCompare(b.person.full_name,'de'),
      building:(a,b)=>String(a.building).localeCompare(String(b.building),'de')||b.degree-a.degree||a.person.full_name.localeCompare(b.person.full_name,'de')
    };
    // Brandes' directed betweenness identifies potential bridging positions.
    // Normalization is for directed graphs; interpretation is exploratory until survey coverage is high.
    const adj=new Map(nodes.map(n=>[n.person.id,[]]));
    validEdges.forEach(e=>adj.get(e.source_person_id)?.push(e.target_person_id));
    const between=new Map(nodes.map(n=>[n.person.id,0]));
    for(const origin of adj.keys()){
      const stack=[],pred=new Map([...adj.keys()].map(k=>[k,[]]));
      const sigma=new Map([...adj.keys()].map(k=>[k,0]));sigma.set(origin,1);
      const dist=new Map([...adj.keys()].map(k=>[k,-1]));dist.set(origin,0);
      const queue=[origin];let start=0;
      while(start<queue.length){
        const v=queue[start++];stack.push(v);
        for(const w of adj.get(v)||[]){
          if(dist.get(w)<0){dist.set(w,dist.get(v)+1);queue.push(w)}
          if(dist.get(w)===dist.get(v)+1){sigma.set(w,sigma.get(w)+sigma.get(v));pred.get(w).push(v)}
        }
      }
      const delta=new Map([...adj.keys()].map(k=>[k,0]));
      while(stack.length){
        const w=stack.pop();
        for(const v of pred.get(w))delta.set(v,delta.get(v)+(sigma.get(v)/sigma.get(w))*(1+delta.get(w)));
        if(w!==origin)between.set(w,between.get(w)+delta.get(w));
      }
    }
    const denominator=(nodes.length-1)*(nodes.length-2);
    nodes.forEach(n=>{n.betweenness=denominator?between.get(n.person.id)/denominator:0;});
    const nodesSorted=nodes.slice().sort(sorters[prefs.metric]||sorters.degree);
    let visible=nodesSorted.filter(n=>!prefs.onlyInterviewed || n.interviewStatus!=='planned');
    if(prefs.hideIsolates)visible=visible.filter(n=>!n.isolate);
    const limit=clamp(6,Number(prefs.limit)||nodes.length,Math.max(nodes.length,6));
    visible=visible.slice(0,limit);
    const visibleIds=new Set(visible.map(n=>n.person.id));
    const visibleEdges=validEdges.filter(e=>visibleIds.has(e.source_person_id)&&visibleIds.has(e.target_person_id)&&(prefs.topic==='all'||(e.topics||[])[0]===prefs.topic));
    const buildingMix=[...buildingMatrix.entries()].map(([key,count])=>({key,count})).sort((a,b)=>b.count-a.count).slice(0,6);
    return {prefs,nodes,nodesSorted,visible,visibleEdges,edgePairs,counts:{nodes:nodes.length,edges:validEdges.length,isolates:nodes.filter(n=>n.isolate).length,components:components.length,largestComponent:components.reduce((m,c)=>Math.max(m,c.length),0),density,reciprocity:validEdges.length?reciprocatedEdges/validEdges.length:0,mutualPairs:mutualPairs.size,crossBuilding,withinBuilding,unknownBuilding,completedCount,activeCount,coverage:nodes.length?completedCount/nodes.length:0,avgOut:nodes.length?validEdges.length/nodes.length:0},top:{degree:validEdges.length?nodes.slice().sort(sorters.degree).slice(0,5):[],out:validEdges.length?nodes.slice().sort(sorters.out).slice(0,5):[],in:validEdges.length?nodes.slice().sort(sorters.in).slice(0,5):[],between:validEdges.length?nodes.slice().sort((a,b)=>b.betweenness-a.betweenness||a.person.code.localeCompare(b.person.code)).slice(0,5):[]},buildingMix,topics};
  }
  function networkInsights(model){
    const c=model.counts; const insights=[];
    insights.push(`Beobachtete Dichte: ${(c.density*100).toFixed(1)} % der möglichen gerichteten Kanten. Unbefragte Personen erzeugen keine Nullkanten.`);
    insights.push(`Beidseitige Nennung: ${(c.reciprocity*100).toFixed(1)} % der berichteten Kanten haben derzeit eine Gegennennung; fehlende Interviews sind keine Verneinung.`);
    insights.push(`Isolierte Personen: ${c.isolates} von ${c.nodes} haben derzeit keine dokumentierte fachliche Beziehung.`);
    insights.push(`Netzwerkkomponenten: ${c.components} schwach verbundene Teilnetze; größte Komponente: ${c.largestComponent} Personen.`);
    if(c.crossBuilding||c.withinBuilding){
      const total=c.crossBuilding+c.withinBuilding; insights.push(`Zwischen Gebäuden: ${c.crossBuilding} von ${total} räumlich zuordenbaren Kanten (${total?((c.crossBuilding/total)*100).toFixed(1):'0.0'} %). ${c.unknownBuilding} Kanten ohne vollständige Gebäudedaten.`);
    }
    insights.push(`Interviewabdeckung: ${c.completedCount} von ${c.nodes} Personen sind vollstaendig abgeschlossen (${(c.coverage*100).toFixed(1)} %).`);
    return insights;
  }
  function renderRankList(title,sub,list,metricKey){
    if(!list.length)return `<div class="panel"><div class="panel-inner"><div class="panel-head"><h2>${title}</h2><small>${sub}</small></div>${empty('Noch keine Daten','Fuehre zunaechst Interviews durch.','network')}</div></div>`;
    return `<div class="panel"><div class="panel-inner"><div class="panel-head"><h2>${title}</h2><small>${sub}</small></div><div class="activity-list">${list.map((n,index)=>`<div class="activity-entry"><span class="activity-bubble">${index+1}</span><div style="min-width:0"><strong>${esc(n.person.full_name)}</strong><small>${esc(n.person.code)} · ${esc(n.building||'Ohne Gebäude')}</small></div><span class="pill">${metricKey==='degree'?n.degree:metricKey==='out'?n.outDegree:metricKey==='between'?(n.betweenness*100).toFixed(1)+' %':n.inDegree}</span></div>`).join('')}</div></div></div>`;
  }
  function renderBuildingMix(model){
    const items=model.buildingMix;
    return `<div class="panel"><div class="panel-inner"><div class="panel-head"><h2>Standortmix</h2><small>Haeufigste Gebaeude-Verknuepfungen</small></div>${items.length?`<div class="sheet-list">${items.map(item=>`<div class="sheet-item">${icon('location')}<div><strong>${esc(item.key)}</strong><small>${item.count} gerichtete Beziehungen</small></div><span class="pill">${item.count}</span></div>`).join('')}</div>`:empty('Noch kein Standortmix','Fuer diese Analyse werden Kanten und Gebaeudeinformationen benoetigt.','location')}<div class="notice-box" style="margin-top:18px">${icon('info')}<span>Best Practice: Netzwerkmetriken immer zusammen mit Erhebungsabdeckung und Standortdaten interpretieren.</span></div></div></div>`;
  }
  function renderTopicMix(model){
    const label={F:'Forschung',L:'Lehre',S:'Selbstverwaltung',A:'Sonstiges',unknown:'Nicht zugeordnet'};
    const data=Object.entries(model.topics),max=Math.max(1,...data.map(([,v])=>v));
    return `<div class="panel"><div class="panel-inner"><div class="panel-head"><h2>Austauschbereiche</h2><small>B2-Kategorien</small></div><div class="topic-bars">${data.map(([key,count])=>`<div class="topic-row"><div><strong>${label[key]}</strong><span>${count}</span></div><div class="progress-track"><div class="progress-fill" style="width:${Math.round(count/max*100)}%"></div></div></div>`).join('')}</div><div class="network-caption">Mehrfachnennungen sind hier nicht berücksichtigt, da der Fragebogen je Kante einen Hauptbereich speichert.</div></div></div>`;
  }
  function renderNetworkControls(model){
    const p=model.prefs; const maxNodes=Math.max(6, state.people.length || 6);
    return `<div class="network-controls"><div class="network-controls-grid"><div class="field"><label>Layout</label><select data-network-input="layout"><option value="orbit3d" ${p.layout==='orbit3d'?'selected':''}>3D Orbit</option><option value="building" ${p.layout==='building'?'selected':''}>Cluster nach Gebaeude</option><option value="circle" ${p.layout==='circle'?'selected':''}>2D Kreis</option></select></div><div class="field"><label>Sortierung</label><select data-network-input="metric"><option value="degree" ${p.metric==='degree'?'selected':''}>Gesamtgrad</option><option value="out" ${p.metric==='out'?'selected':''}>Out-Degree</option><option value="in" ${p.metric==='in'?'selected':''}>In-Degree</option><option value="building" ${p.metric==='building'?'selected':''}>Gebaeude</option><option value="alpha" ${p.metric==='alpha'?'selected':''}>Alphabetisch</option></select></div><div class="field"><label>Austauschbereich</label><select data-network-input="topic"><option value="all" ${p.topic==='all'?'selected':''}>Alle Bereiche</option><option value="F" ${p.topic==='F'?'selected':''}>Forschung</option><option value="L" ${p.topic==='L'?'selected':''}>Lehre</option><option value="S" ${p.topic==='S'?'selected':''}>Selbstverwaltung</option><option value="A" ${p.topic==='A'?'selected':''}>Sonstiges</option></select></div><div class="field"><label>Sichtbare Knoten <span>${Math.min(maxNodes, Number(p.limit)||maxNodes)} / ${maxNodes}</span></label><input type="range" min="6" max="${maxNodes}" step="1" value="${clamp(6, Number(p.limit)||maxNodes, maxNodes)}" data-network-input="limit"></div><div class="field"><label>3D-Tiefe <span>${Number(p.depth)||72}%</span></label><input type="range" min="0" max="100" step="1" value="${Number(p.depth)||72}" data-network-input="depth"></div></div><div class="network-toggle-row"><label class="q-toggle"><input type="checkbox" data-network-input="labels" ${p.labels?'checked':''}><span><strong>Beschriftungen anzeigen</strong><small>Codes und Namen direkt an den Knoten einblenden.</small></span></label><label class="q-toggle"><input type="checkbox" data-network-input="hideIsolates" ${p.hideIsolates?'checked':''}><span><strong>Isolierte Personen ausblenden</strong><small>Fokus auf aktiv verbundene Knoten.</small></span></label><label class="q-toggle"><input type="checkbox" data-network-input="onlyInterviewed" ${p.onlyInterviewed?'checked':''}><span><strong>Nur interviewte Personen</strong><small>Filtert offene Personen ohne Interview aus.</small></span></label><label class="q-toggle"><input type="checkbox" data-network-input="sizeMode" ${p.sizeMode==='degree'?'checked':''}><span><strong>Knotengröße nach Verbindungsgrad</strong><small>Wenn deaktiviert, erhalten alle Knoten dieselbe Groesse.</small></span></label></div></div>`;
  }
  function renderNetworkScene(model,fullscreen=false){
    const prefs=model.prefs,visible=model.visible.length,edges=model.visibleEdges.length;
    const buildings=[...new Set(model.visible.map(n=>n.building))].sort((a,b)=>a.localeCompare(b,'de'));
    const buildingLegend=buildings.map(building=>`<span class="building-legend-item"><i style="background:${window.NXTNetworkViz?.colorFor?.(building)||'#008b92'}"></i>${esc(building==='Ohne Gebäude'?'Standort offen':`Geb. ${building}`)}</span>`).join('');
    return `<div class="network-scene ${fullscreen?'fullscreen':''}"><div class="network-canvas-shell"><canvas class="network-graph-canvas" tabindex="0" role="img" aria-label="Interaktives gerichtetes Netzwerk mit ${visible} Personen und ${edges} Kanten. Mit Maus oder Finger drehen, mit Mausrad zoomen. Pfeiltasten verändern die Ansicht.">Ihr Browser unterstützt die Netzwerkvisualisierung nicht.</canvas><div class="network-tooltip" hidden></div></div><div class="network-scene-meta"><span class="pill">${visible} von ${model.nodes.length} Knoten</span><span class="pill">${edges} sichtbare Kanten</span><span class="pill">${prefs.layout==='orbit3d'?'Interaktives 3D':prefs.layout==='building'?'Gebäude-Cluster':'2D Kreis'}</span></div><div class="building-legend" aria-label="Legende der Gebäudefarben">${buildingLegend}</div><p class="network-selection" aria-live="polite">Knoten auswählen, um Beziehungen hervorzuheben.</p><p class="network-legend">Farbe: Gebäude · Größe: ${prefs.sizeMode==='degree'?'Gesamtgrad':'einheitlich'} · Pfeile: Richtung der Nennung · 3D-Positionen: algorithmisch, keine realen Standorte.</p></div>`;
  }
  function mountNetworkVisuals(host=document){
    if(!window.NXTNetworkViz?.mount)return;
    const model=computeNetworkModel();
    const data={nodes:model.visible.map(n=>({id:n.person.id,code:n.person.code,label:n.person.full_name,building:n.building,degree:n.degree,inDegree:n.inDegree,outDegree:n.outDegree})),edges:model.visibleEdges.map(e=>({source:e.source_person_id,target:e.target_person_id})),prefs:{...model.prefs}};
    host.querySelectorAll('.network-scene').forEach(scene=>window.NXTNetworkViz.mount(scene,data));
  }
  function openNetworkFullscreen(){
    const model=computeNetworkModel(); const host=qs('#modal-host'); if(!host)return;
    host.innerHTML=`<div class="modal-backdrop"><div class="modal modal-network-fullscreen" role="dialog" aria-modal="true" aria-label="Netzwerk im Vollbild"><div class="modal-head"><div><h2>Netzwerkanalyse · Vollbild</h2><p style="margin:6px 0 0;color:var(--muted);font-size:12px">Ansicht drehen, zoomen und Knoten erkunden.</p></div><button type="button" class="icon-button" data-action="close-modal" aria-label="Schließen">${icon('x')}</button></div><div class="modal-body">${renderNetworkControls(model)}${renderNetworkScene(model,true)}<div class="notice-box" style="margin-top:18px">${icon('sparkles')}<span>Farben kennzeichnen Gebäude; Pfeile zeigen die Nennungsrichtung. Die räumliche Anordnung ist eine explorative Netzwerkprojektion.</span></div></div></div></div>`;
    window.NXTNetworkViz?.cleanup?.();mountNetworkVisuals(host);
    const dialog=qs('.modal-network-fullscreen',host);
    try { dialog?.requestFullscreen?.().catch(()=>{}); } catch(_error) {/* Overlay fallback */}
  }
  const tabs=[['dashboard','layout','Dashboard'],['people','users','Personen'],['interviews','clipboard','Interviews'],['network','network','Netzwerk'],['export','download','Datenexport']];
  function shell(page){
    const team=state.member?.display_name||'Interview-Team';
    return `<div class="shell" id="shell"><div class="mobile-mask" data-action="close-nav"></div><aside class="sidebar"><div class="sidebar-logo"><img src="./assets/nxt-logo.png" alt="NXT Hochschule Reutlingen"></div><span class="sidebar-caption">Research Workspace</span><nav class="nav-list" aria-label="Hauptnavigation">${tabs.map(([key,ico,name])=>`<button type="button" class="nav-item ${state.route===key||(state.route==='interview'&&key==='interviews')?'active':''}" data-action="navigate" data-route="${key}">${icon(ico)} ${name}</button>`).join('')}</nav><div class="side-footer"><div class="side-foot-card"><span class="pill">NXT | PROJEKT 2026</span><h4>Fachlicher Austausch &amp; r\u00e4umliche N\u00e4he</h4><p>Erfassung von Personen, Interaktionen und Standorten f\u00fcr die Netzwerkforschung.</p></div><div class="sidebar-bottom">Hochschule Reutlingen &middot; NXT<br>Gesch\u00fctzter Team-Zugang</div></div></aside><div class="main"><header class="topbar"><div style="display:flex;gap:15px;align-items:center"><button type="button" class="btn btn-light btn-icon menu-toggle" data-action="open-nav" aria-label="Men\u00fc \u00f6ffnen">${icon('menu')}</button><div><div class="topbar-title">NXT <span style="color:var(--teal)">/ Netzwerkforschung</span></div><div class="topbar-kicker">Interviewerfassung &amp; Auswertung</div></div></div><div class="top-actions"><span class="live-dot">Zentral verbunden</span><button type="button" data-action="refresh" class="btn btn-light btn-sm" title="Daten aktualisieren">${icon('refresh')}<span class="top-label">Aktualisieren</span></button><div class="avatar" title="${esc(team)}">${esc(initials(team))}</div><button type="button" data-action="logout" class="btn btn-light btn-sm btn-icon" title="Abmelden" aria-label="Abmelden">${icon('logout')}</button></div></header><main class="content">${page}</main></div></div><div id="modal-host"></div>`;
  }
  function render(){
    if(!state.user||!state.member){renderLogin();return;}
    const pages={dashboard:renderDashboard,people:renderPeople,interviews:renderInterviews,interview:renderInterview,network:renderNetwork,export:renderExport};
    window.NXTNetworkViz?.cleanup?.();
    root.innerHTML=shell((pages[state.route]||renderDashboard)());
    if(state.route==='network')mountNetworkVisuals(root);
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
    <div class="stat-grid">${stat('Erfasste Personen',c.total,`Projektziel: ca. ${target} Personen`,'users')}${stat('Abgeschlossene Interviews',c.done,'Vollst\u00e4ndig dokumentiert','check')}${stat('In Bearbeitung',c.ongoing,`${c.pending} offen · ${c.declined} abgelehnt`,'clock')}${stat('Fachliche Kanten',c.edges,'Gerichtete Austauschbeziehungen','network')}</div>
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
    return pageHead('Personenverzeichnis','Alle Personen im \u00dcberblick','Alle Mitarbeiterinnen und Mitarbeiter sowie ihre Interview- und Standortdaten.',`<button class="btn btn-light" data-action="import-people">${icon('upload')} Liste importieren</button><button class="btn btn-primary" data-action="add-person">${icon('plus')} Neue Person</button>`)+`<div class="panel"><div class="toolbar"><div class="search-wrap">${icon('search')}<input id="people-search" class="search-input" type="search" placeholder="Person oder Geb\u00e4ude suchen ..." value="${esc(state.query)}" aria-label="Personen suchen"></div><select id="people-filter" class="filter-select" aria-label="Interviewstatus filtern"><option value="all" ${state.filter==='all'?'selected':''}>Alle Status</option><option value="planned" ${state.filter==='planned'?'selected':''}>Offen</option><option value="in_progress" ${state.filter==='in_progress'?'selected':''}>In Bearbeitung</option><option value="completed" ${state.filter==='completed'?'selected':''}>Durchgeführt</option><option value="declined" ${state.filter==='declined'?'selected':''}>Abgelehnt</option></select><span class="muted small" id="people-count">${filteredPeople().length} Personen</span></div><div id="people-list">${renderPeopleTable(filteredPeople())}</div></div>`;
  }
  function renderInterviews(){
    const records=state.people.map(p=>({p,i:state.interviews.find(i=>i.person_id===p.id)}))
      .sort((a,b)=>({'in_progress':0,'planned':1,'completed':2,'declined':3}[a.i?.status||'planned'])-({'in_progress':0,'planned':1,'completed':2,'declined':3}[b.i?.status||'planned']));
    return pageHead('Erhebung','Interview\u00fcbersicht','Starte neue Gespr\u00e4che, setze Entw\u00fcrfe fort und pr\u00fcfe abgeschlossene Datens\u00e4tze.',`<button class="btn btn-primary" data-action="navigate" data-route="people">${icon('plus')} Interview starten</button>`)+`<div class="panel">${records.length?`<div class="table-wrap"><table class="data-table"><thead><tr><th>Person</th><th>Bearbeitung</th><th>Letzte Aktualisierung</th><th>Status</th><th>Aktion</th></tr></thead><tbody>${records.map(({p,i})=>`<tr><td><div class="person-cell"><span class="person-avatar">${esc(initials(p.full_name))}</span><div><strong>${esc(p.full_name)}</strong><small>${esc(p.code)}</small></div></div></td><td>${esc(i?.interviewer_name||'\u2014')}</td><td>${fmtTime(i?.updated_at)}</td><td>${badge(i?.status)}</td><td><button class="btn btn-light btn-sm" data-action="open-interview" data-person="${esc(p.id)}">${i?'Fortsetzen':'Beginnen'} ${icon('chevron',14)}</button></td></tr>`).join('')}</tbody></table></div>`:empty('Personenliste noch leer','Zuerst m\u00fcssen die Interviewpersonen angelegt oder importiert werden.','clipboard','<button class="btn btn-primary" data-action="navigate" data-route="people">Zum Personenverzeichnis</button>')}</div>`;
  }
  const option = (value,label,selected) => `<option value="${esc(value)}" ${String(value)===String(selected??'')?'selected':''}>${esc(label)}</option>`;
  const selectField = (label,field,items,value,extra='') => `<div class="field"><label>${label}</label><select data-field="${field}" ${extra}>${items.map(([key,name])=>option(key,name,value)).join('')}</select></div>`;
  const textField = (label,field,value,placeholder='',extra='') => `<div class="field"><label>${label}</label><input type="text" data-field="${field}" value="${esc(value||'')}" placeholder="${esc(placeholder)}" ${extra}></div>`;
  const stepNames=['Einwilligung & Teil A','Teil B · Austausch','Teil C · Wege & Orte','Kontrolle & Abschluss'];
  const groups=[['','Bitte ausw\u00e4hlen'],['Professor:innen','Professor:innen'],['Wissenschaftliche Mitarbeitende','Wissenschaftliche Mitarbeitende'],['Technische Mitarbeitende','Technische Mitarbeitende (Laborassistenz usw.)'],['Sonstige','Sonstige / unklar']];
  const buildings=[['','Bitte ausw\u00e4hlen'],['5','Geb\u00e4ude 5'],['16','Geb\u00e4ude 16'],['17','Geb\u00e4ude 17'],['21','Geb\u00e4ude 21'],['D','Geb\u00e4ude D'],['Werk150','Werk150'],['Sonstiger Standort','Sonstiger Standort'],['anderes Gebäude','anderes Gebäude']];
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
        edges:results[1].data.map(e=>({target_person_id:e.target_person_id,frequency:e.frequency||'',topics:e.topics||[],exchange_mode:e.exchange_mode||'',exchange_medium:e.exchange_medium||'',known_before_nxt:e.known_before_nxt??null,note:e.note||''})),
        locations:Array.from({length:Math.max(6,results[2].data.length)},(_,i)=>{const l=results[2].data[i]||{};return {building:l.building||'',place:l.place||'',frequency:l.frequency||'',notes:l.notes||''};})};
      state.peerQuery='';state.peerOnly=false;state.route='interview';state.step=0;state.draftDirty=false;render();window.scrollTo(0,0);
    }catch(e){toast('Interview konnte nicht geladen werden: '+(e.message||e),'error');}
    finally{state.busy=false;}
  }
  // Questionnaire V7: question wording, answer options and codes are sourced from
  // Fragebogen_NXT_Erfassung_2.xlsx (template P00, Listen, Codebuch).
  const Q = window.NXT_QUESTIONNAIRE || {};
  const qChoice = (key, label, options, value, hint='') => `<div class="field"><label for="q-${esc(key)}">${esc(label)}</label><select id="q-${esc(key)}" data-answer="${esc(key)}">${option('','Bitte auswählen',value)}${options.map(x=>{const [v,l]=Array.isArray(x)?x:[x,x];return option(v,l,value);}).join('')}</select>${hint?`<small class="field-hint">${esc(hint)}</small>`:''}</div>`;
  const qText = (key,label,value,hint='',inputType='text') => `<div class="field"><label for="q-${esc(key)}">${esc(label)}</label><input id="q-${esc(key)}" data-answer="${esc(key)}" type="${inputType}" value="${esc(value??'')}" placeholder="${esc(hint)}"></div>`;
  const qQuestion = (num,question,content,note='') => `<section class="question q-question"><span class="question-num">${esc(num)}</span><h3>${esc(question)}</h3>${note?`<p class="q-question-note">${esc(note)}</p>`:''}<div class="q-question-controls">${content}</div></section>`;
  const qToggle = (key,label,checked,sub='') => `<label class="q-toggle"><input type="checkbox" data-answer="${esc(key)}" ${checked?'checked':''}><span><strong>${esc(label)}</strong>${sub?`<small>${esc(sub)}</small>`:''}</span></label>`;
  const qScale = (key,question,answer) => `<div class="q-scale"><div class="q-scale-title">${esc(question)}</div>${qChoice(key,'Ihre Einschätzung',Q.likert,answer)}</div>`;
  const qHead = (num,title,description) => `<div class="form-title"><div><span class="eyebrow">${esc(Q.version||'FRAGEBOGEN V7')} · ${num}</span><h2>${esc(title)}</h2><p>${esc(description)}</p></div><span class="pill">${num}</span></div>`;
  const consentYes = (v) => String(v||'').startsWith('Ja,');
  const consentNo = (v) => String(v||'').startsWith('Nein,');
  const qAnswer = (key) => state.form?.answers?.[key] ?? '';
  const qCountC8 = () => (Q.encountersC8||[]).filter(([k])=>state.form?.answers?.['C8_'+k]===true).length;
  const qMissingB = () => state.form.edges.filter(e=>!e.frequency||!e.exchange_mode||!e.exchange_medium||!(e.topics||[]).length||e.known_before_nxt===null||e.known_before_nxt===undefined).length;
  function formStepA(){
    const f=state.form, a=f.answers, consent=a.Einwilligung;
    const greeting=(Q.greeting||[]).map(txt=>`<p>${esc(txt)}</p>`).join('');
    const isDeclined=consentNo(consent);
    return `${qHead('EINLEITUNG & TEIL A','Angaben zu Ihrer Person','Einwilligung sowie die Fragen A1 bis A6 aus der Excel-Vorlage.')}
    <div class="q-intro"><span class="eyebrow">Befragung · Wintersemester 2026/27</span><h3>${esc(Q.title)}</h3>${greeting}
      <div class="q-intro-parts"><span><strong>A</strong> Angaben zur Person</span><span><strong>B</strong> Fachlicher Austausch</span><span><strong>C</strong> Wege und Orte</span></div>
      <p><strong>Kontakt bei Fragen:</strong> ${esc(Q.projectContact||'').replace(/\n/g,' · ')}</p>
      <p><strong>Betreuung:</strong> ${esc(Q.supervision||'').replace(/\n/g,' · ')}</p>
    </div>
    <div class="notice-box warn q-privacy">${icon('alert')}<span><strong>Datenschutzhinweis für die Web-Version:</strong> Diese Plattform speichert die Personenliste und die Antworten geschützt in Supabase. Die Formulierung der Excel-Vorlage zur unmittelbaren Pseudonymisierung und Aufbewahrung ist daher nicht ohne Anpassung gültig. Die Forschungsinformation und die Freigabe durch die Hochschule sind vor der echten Erhebung zu prüfen.</span></div>
    ${qQuestion('EINWILLIGUNG',Q.consent_question,qChoice('Einwilligung','Ihre Antwort',Q.consent_options,consent))}
    ${isDeclined?`<div class="notice-box warn">${icon('info')}<span>Teilnahme abgelehnt. Es werden keine weiteren Antworten erhoben. Am Ende bitte „Ablehnung dokumentieren“ wählen.</span></div>`:`
    ${qQuestion('A1',Q.questionsA.A1,qChoice('A1_Gruppe','Ihre Antwort',Q.groups,a.A1_Gruppe))}
    ${qQuestion('A2',Q.questionsA.A2,qChoice('A2_Kategorie','Ihre Antwort (Einfachauswahl)',Q.categories,a.A2_Kategorie))}
    ${qQuestion('A3',Q.questionsA.A3,qText('A3_Selbstbezeichnung','Ihre Antwort (Freitext)',a.A3_Selbstbezeichnung))}
    ${qQuestion('A4',Q.questionsA.A4,qChoice('A4_Alter','Ihre Antwort',Q.ages,a.A4_Alter))}
    ${qQuestion('A5',Q.questionsA.A5,qChoice('A5_Geschlecht','Ihre Antwort',Q.genders,a.A5_Geschlecht))}
    ${qQuestion('A6',Q.questionsA.A6,`<div class="field-grid">${qChoice('A6_vor_NXT','Ihre Antwort',Q.yesno,a.A6_vor_NXT)}${qText('A6_seit','Ja, seit:',a.A6_seit,'Nur bei „Ja“ ausfüllen')}</div>`)}
    `}
    <section class="question"><span class="question-num">VOM PROJEKTTEAM AUSZUFÜLLEN</span><div class="field-grid">
    ${qText('Interview_Nr','Interview-Nr.',a.Interview_Nr,'z. B. 07')}
    <div class="field"><label>Kürzel der interviewenden Person</label><input data-field="interviewer_name" type="text" value="${esc(f.interviewer_name||'')}" placeholder="z. B. NW"></div>
    ${qText('Datum','Datum',a.Datum,'','date')}</div></section>`;
  }
  function qPeerCard(p){
    const idx=state.form.edges.findIndex(e=>e.target_person_id===p.id),selected=idx>=0;
    const edge=selected?state.form.edges[idx]:null;
    const opts=(field,label,choices,val)=>`<div class="field"><label>${esc(label)}</label><select data-edge-field="${field}" data-index="${idx}">${option('','Bitte auswählen',val)}${choices.map(([k,v])=>option(k,`${k} – ${v}`,val)).join('')}</select></div>`;
    return `<article class="q-peer ${selected?'selected':''}" data-peer-id="${esc(p.id)}"><div class="q-peer-main"><button type="button" class="q-peer-select" data-action="toggle-peer" data-person="${esc(p.id)}" aria-pressed="${selected}"><span class="q-peer-check">${selected?icon('check',15):''}</span><span class="q-peer-name"><strong>${esc(p.full_name)}</strong><small>${esc(p.code)} · B1 ${selected?'x':'nicht angekreuzt'}</small></span></button><span class="pill ${selected?'green':'gray'}">${selected?'Austausch':'–'}</span></div>
      ${selected?`<div class="q-peer-fields"><div class="q-peer-help">Bitte B2 bis B6 nur für angekreuzte Personen ausfüllen.</div>
      ${opts('topics_single','B2 · Inhalt der Gespräche',Q.b2,(edge.topics||[])[0]||'')}
      ${opts('frequency','B3 · Wie oft?',Q.b3,edge.frequency)}
      ${opts('exchange_mode','B4 · Zustandekommen',Q.b4,edge.exchange_mode)}
      ${opts('exchange_medium','B5 · Medium',Q.b5,edge.exchange_medium)}
      ${opts('known_before_nxt','B6 · Kannte ich schon vor NXT?',[['true','Ja'],['false','Nein']],edge.known_before_nxt===null||edge.known_before_nxt===undefined?'':String(edge.known_before_nxt))}
      <div class="field"><label>Interne Anmerkung (optional)</label><input type="text" data-edge-field="note" data-index="${idx}" value="${esc(edge.note||'')}"></div></div>`:''}</article>`;
  }
  function renderPeerResults(){
    const q=clean(state.peerQuery).toLocaleLowerCase('de');let others=state.people.filter(p=>p.id!==state.form.personId).sort((x,y)=>x.code.localeCompare(y.code,undefined,{numeric:true}));
    if(q)others=others.filter(p=>`${p.code} ${p.full_name}`.toLocaleLowerCase('de').includes(q));
    if(state.peerOnly)others=others.filter(p=>state.form.edges.some(e=>e.target_person_id===p.id));
    return others.length?others.map(qPeerCard).join(''):'<div class="q-peer-empty">Keine Personen für diesen Filter gefunden.</div>';
  }
  function formStepB(){
    const f=state.form,a=f.answers;
    if(consentNo(a.Einwilligung))return `${qHead('TEIL B','Fachlicher Austausch','Teilnahme wurde abgelehnt.')}<div class="notice-box warn">Bitte nur die Ablehnung dokumentieren.</div>`;
    return `${qHead('TEIL B','Ihr fachlicher Austausch','Netzwerkbogen B1–B6: alle Personen der Shortlist durchgehen.')}
    <div class="notice-box">${icon('info')}<span>${esc(Q.b_intro)}</span></div>
    <div class="q-instructions">${(Q.b_instruction||[]).map(text=>`<div>${esc(text)}</div>`).join('')}</div>
    <div class="q-code-legend">${Object.values(Q.b_explanations).map(text=>`<p>${esc(text)}</p>`).join('')}</div>
    ${qQuestion('B1–B6','Fachlicher Austausch in den letzten 6 Monaten',`<div class="q-peer-toolbar"><div class="q-peer-stats"><strong>${f.edges.length}</strong> von ${Math.max(0,state.people.length-1)} Beziehungen markiert ${qMissingB()?`<span class="pill orange">${qMissingB()} unvollständig</span>`:''}</div>
      <div class="q-peer-filters"><div class="search-wrap">${icon('search')}<input id="peer-search" class="search-input" type="search" placeholder="Person / P-ID suchen" value="${esc(state.peerQuery||'')}" aria-label="Austauschpartner suchen"></div>
      <label class="q-peer-only"><input id="peer-only" type="checkbox" ${state.peerOnly?'checked':''}> Nur angekreuzte</label></div></div>
      <div id="peer-results" class="q-peer-list">${renderPeerResults()}</div>
      ${qToggle('no_exchange','Keine fachlichen Austauschpartner genannt',Boolean(a.no_exchange),'Nur markieren, wenn dies ausdrücklich bestätigt wurde.')}
    `)}
    ${qQuestion('B6 · EINSCHÄTZUNG','Wie sehr trifft die folgende Aussage auf Sie zu?',qScale('B_Aussage_Austausch_wichtig',Q.b_attitude,a.B_Aussage_Austausch_wichtig),'Die Excel-Vorlage verwendet B6 sowohl in der Netzwerkmatrix als auch für diese Aussage.')}`;
  }
  const qYesNo = [['ja','ja'],['nein','nein']];
  function formStepC(){
    const f=state.form,a=f.answers;
    if(consentNo(a.Einwilligung))return `${qHead('TEIL C','Ihre Wege und Orte','Teilnahme wurde abgelehnt.')}<div class="notice-box warn">Bitte nur die Ablehnung dokumentieren.</div>`;
    const days=(prefix)=>`<div class="q-day-grid">${Q.weekdays.map(([k,name])=>qToggle(`${prefix}_${k}`,name,Boolean(a[`${prefix}_${k}`]))).join('')}</div>`;
    const places=(entries,prefix,withDetail)=>`<div class="q-places-list">${entries.map(([key,label])=>`<div class="q-place-row"><div>${esc(label)}</div><div>${qChoice(`${prefix}_${key}`,'ja / nein',qYesNo,a[`${prefix}_${key}`])}</div>${withDetail?`${qText(`${prefix}_${key}_Etage`,'Etage / Flur',a[`${prefix}_${key}_Etage`])}`:''}</div>`).join('')}</div>`;
    const c6=`<div class="q-c6-list">${Array.from({length:6},(_,i)=>{const l=f.locations[i]||{};return `<div class="q-c6-row"><span class="q-row-num">Eintrag ${i+1}</span><div class="field"><label>Gebäude</label><select data-location-field="building" data-index="${i}">${option('','Bitte auswählen',l.building)}${Q.buildings.map(k=>option(k,k,l.building)).join('')}</select></div><div class="field"><label>Raum</label><input type="text" data-location-field="place" data-index="${i}" value="${esc(l.place||'')}" placeholder="Raum"></div></div>`;}).join('')}</div>`;
    const c7=`<div class="q-places-list">${Q.placesC7.map(([k,label])=>`<div class="q-place-row"><div>${esc(label)}</div>${qChoice('C7_'+k,'ja / nein',qYesNo,a['C7_'+k])}${k==='Sonstige'?qText('C7_Sonstige_Text','Anderer Ort',a.C7_Sonstige_Text):''}</div>`).join('')}</div>`;
    const c8=`<div class="q-encounter-header"><span>${qCountC8()} / 3 ausgewählt</span><small>Maximal 3 Kreuze</small></div><div class="q-choice-grid">${Q.encountersC8.map(([key,label])=>qToggle('C8_'+key,label,Boolean(a['C8_'+key]))).join('')}</div>${qText('C8_Sonstige_Text','Sonstige Gebäude / Raum',a.C8_Sonstige_Text)}`;
    const c9=`<div class="q-likert-stack">${Q.statementsC9.map((text,i)=>qScale('C9_'+(i+1),text,a['C9_'+(i+1)])).join('')}</div>`;
    const master=state.people.find(x=>x.id===f.personId);
    return `${qHead('TEIL C','Ihre Wege und Orte auf dem Campus','Fragen C1–C9 gemäß Excel-Vorlage.')}
      <div class="notice-box">${icon('location')}<span>${esc(Q.c_intro)}</span></div>
      <button class="btn btn-light q-map-button" type="button" data-action="open-map">${icon('location')} Lageplan öffnen (Nummern 1–16)</button>
      ${qQuestion('C1',Q.questionsC.C1,`<div class="field-grid">${qChoice('C1_Gebaeude','Gebäude',Q.buildings,a.C1_Gebaeude)}${qText('C1_Raum','Raumnummer',a.C1_Raum,'z. B. 111')}</div>`,master?.building||master?.room?`Bisherige Stammdaten: ${master.building||'Gebäude offen'} / ${master.room||'Raum offen'} – bitte im Interview bestätigen.`:'')}
      ${qQuestion('C2',Q.questionsC.C2,places(Q.spacesC2,'C2',true))}
      ${qQuestion('C3',Q.questionsC.C3,days('C3'))}
      ${qQuestion('C4',Q.questionsC.C4,days('C4'))}
      ${qQuestion('C5',Q.questionsC.C5,`<div class="field-grid">${qChoice('C5_Ankunft','Ihre Antwort',Q.arrivals,a.C5_Ankunft)}${qText('C5_anderer_Ort','anderer Ort:',a.C5_anderer_Ort,'Nur bei „anderer Ort“')}</div>`)}
      ${qQuestion('C6',Q.questionsC.C6,c6)}
      ${qQuestion('C7',Q.questionsC.C7,c7)}
      ${qQuestion('C8',Q.questionsC.C8,c8)}
      ${qQuestion('C9',Q.questionsC.C9,c9)}
      <div class="q-thanks"><h3>${esc(Q.thanks)}</h3><p>${esc(Q.thanks_note)}</p></div>`;
  }
  function formStepD(){
    const f=state.form,a=f.answers,p=state.people.find(x=>x.id===f.personId),isNo=consentNo(a.Einwilligung),isYes=consentYes(a.Einwilligung);
    const answered=Object.entries(a).filter(([key,val])=>!['no_exchange','C8_Anzahl'].includes(key)&&val!==''&&val!==null&&val!==undefined&&val!==false).length;
    return `${qHead('KONTROLLE','Prüfen & Speichern','Antworten kontrollieren, als Entwurf speichern oder abschließen.')}
    <div class="summary-grid"><div class="summary-item"><strong>${isNo?'Nein':isYes?'Ja':'–'}</strong><small>Einwilligung</small></div><div class="summary-item"><strong>${f.edges.length}</strong><small>B1-Kanten</small></div><div class="summary-item"><strong>${answered}</strong><small>Ausgefüllte Angaben</small></div></div>
    <div class="review-row"><span>Person</span><strong>${esc(p?.code)} · ${esc(p?.full_name)}</strong></div>
    <div class="review-row"><span>Interview-Nr.</span><strong>${esc(a.Interview_Nr||'–')}</strong></div>
    <div class="review-row"><span>Kürzel / Interviewer:in</span><strong>${esc(f.interviewer_name||'–')}</strong></div>
    <div class="review-row"><span>Datum</span><strong>${esc(a.Datum||'–')}</strong></div>
    <div class="review-row"><span>A1 · Gruppe</span><strong>${esc(a.A1_Gruppe||'übersprungen')}</strong></div>
    <div class="review-row"><span>A2 · Kategorie</span><strong>${esc(a.A2_Kategorie||'übersprungen')}</strong></div>
    <div class="review-row"><span>B1 · Fachlicher Austausch</span><strong>${f.edges.length} von ${Math.max(0,state.people.length-1)} Personen${a.no_exchange?' · explizit keine':''}</strong></div>
    <div class="review-row"><span>C1 · Büro</span><strong>${esc([a.C1_Gebaeude,a.C1_Raum].filter(Boolean).join(' · ')||'übersprungen')}</strong></div>
    <div class="review-row"><span>C8 · Gesprächsorte</span><strong>${qCountC8()} / max. 3</strong></div>
    <div class="field" style="margin-top:20px"><label>Interne Interviewnotizen (optional)</label><textarea data-field="interview_notes" placeholder="Offene Fragen, Unklarheiten, Interviewdauer ...">${esc(f.interview_notes||'')}</textarea></div>
    <div class="notice-box ${!isYes?'warn':''}" style="margin-top:22px">${icon('info')}<span>${isNo?'Die Person hat die Teilnahme abgelehnt. Bitte nur die Ablehnung dokumentieren.':!isYes?'Die Einwilligung fehlt. Ein Abschluss ist erst nach „Ja“ oder dokumentierter Ablehnung möglich.':'Die Vorlage erlaubt das Überspringen einzelner Fragen. Prüfe offene Felder und sichere danach den Datensatz.'}</span></div>`;
  }
  function renderInterview(){
    if(!state.form)return empty('Kein Interview ge\u00f6ffnet','Bitte w\u00e4hle eine Person aus der Liste.','clipboard','<button class="btn btn-primary" data-action="navigate" data-route="people">Personen anzeigen</button>');
    const f=state.form,p=state.people.find(x=>x.id===f.personId);
    return pageHead('Interviewdurchf\u00fchrung',esc(p?.full_name||'Interview'),`${esc(p?.code||'')} \u00b7 Fragebogen V7 · A1–A6, B1–B6, C1–C9 · Antworten zentral speichern.`,`<span id="dirty-indicator" class="pill ${state.draftDirty?'orange':'green'}">${state.draftDirty?'Ungespeichert':'Gespeichert'}</span><button class="btn btn-light" data-action="back-to-interviews">${icon('chevron')} Zur \u00dcbersicht</button>`)+
    `<div class="interview-layout"><aside class="panel interview-rail">${stepNames.map((name,index)=>`<button type="button" class="step-button ${state.step===index?'active':''}" data-action="step" data-step="${index}" aria-current="${state.step===index?'step':'false'}"><span class="step-index">${index+1}</span><span class="step-name">${name}</span></button>`).join('')}<div class="step-separator"></div><div style="padding:10px 8px;font-size:11px;line-height:1.7;color:var(--muted)">${icon('shield',15)} Jede Speicherung wird auf Bearbeitungskonflikte gepr\u00fcft.</div></aside><section class="panel interview-form-card">${[formStepA,formStepB,formStepC,formStepD][state.step]()}<div class="form-footer"><button type="button" class="btn btn-light" data-action="previous-step" ${state.step===0?'disabled':''}>Zur\u00fcck</button><div style="display:flex;gap:9px;flex-wrap:wrap;justify-content:flex-end"><button type="button" class="btn btn-ghost" data-action="save-draft">${icon('save')} Entwurf sichern</button>${state.step<3?`<button type="button" class="btn btn-primary" data-action="next-step">Weiter ${icon('arrow')}</button>`:`<button type="button" class="btn btn-primary" data-action="save-completed">${icon('check')} ${consentNo(f.answers.Einwilligung)?'Ablehnung dokumentieren':'Abschließen'}</button>`}</div></div></section></div>`;
  }

  function renderNetwork(){
    const model=computeNetworkModel(), c=model.counts, insights=networkInsights(model);
    return pageHead('Netzwerkmonitor','Fachlicher Austausch & Analyse','Gerichtete Austauschbeziehungen – interaktiv erkunden, vergleichen und analysieren.',`<button class="btn btn-light" data-action="toggle-network-controls">${icon('sliders')} Optionen</button><button class="btn btn-light" data-action="open-network-fullscreen">${icon('maximize')} Vollbild</button><button class="btn btn-primary" data-action="navigate" data-route="export">${icon('download')} Kanten exportieren</button>`)+
    `<div class="network-kpi network-kpi-extended">${stat('Knoten / Personen',c.nodes,'Erfasste Mitarbeitende','users')}${stat('Gerichtete Kanten',c.edges,'Quelle → Ziel','network')}${stat('Netzwerkdichte',(c.density*100).toFixed(1)+' %','Kanten / theoretische Maximalzahl','chart')}${stat('Beidseitige Nennung',(c.reciprocity*100).toFixed(1)+' %','Beobachtet; abhängig von Rücklaufquote','refresh')}${stat('Isolierte Personen',c.isolates,'Knoten ohne dokumentierte Kanten','alert')}${stat('Interviewabdeckung',(c.coverage*100).toFixed(1)+' %',`${c.completedCount} abgeschlossen · ${c.activeCount} aktiv`, 'check')}</div>
    <div class="network-layout-grid"><div class="panel network-workbench"><div class="panel-head network-panel-head"><div><h2>Interaktive Netzwerkansicht</h2><small>Oben rechts lassen sich Darstellung und Layout feinjustieren.</small></div><div class="network-panel-actions"><button class="icon-button" data-action="toggle-network-controls" aria-label="Darstellung bearbeiten" title="Darstellung bearbeiten">${icon('pencil')}</button><button class="icon-button" data-action="open-network-fullscreen" aria-label="Netzwerk im Vollbild">${icon('maximize')}</button></div></div>${model.prefs.controlsOpen?renderNetworkControls(model):''}<div class="network-visual network-visual-large">${renderNetworkScene(model,false)}</div><div class="network-caption">Die Filter wirken auf die Netzwerkzeichnung; die Kennzahlen beziehen sich weiterhin auf alle bisher erfassten Kanten. Unbefragte Personen sind nicht automatisch isoliert. 3D-Anordnungen sind keine räumlichen Distanzen.</div></div><div class="network-side-column"><div class="panel"><div class="panel-inner"><div class="panel-head"><h2>Interpretationshinweise</h2><small>Empfohlene Kennzahlen</small></div><div class="insight-list">${insights.map((item,index)=>`<div class="insight-item"><span>${index+1}</span><p>${esc(item)}</p></div>`).join('')}</div><div class="notice-box" style="margin-top:18px">${icon('sparkles')}<span>Best Practice: Dichte, Reziprozität und Zentralität immer gemeinsam mit Rücklaufquote und fehlenden Interviews lesen.</span></div></div></div>${renderBuildingMix(model)}${renderTopicMix(model)}</div></div>
    <div class="dash-grid" style="margin-top:20px">${renderRankList('Zentralste Personen','Gesamtgrad (In + Out)',model.top.degree,'degree')}${renderRankList('Aktive Nennungen / Out-Degree','Wie viele Partner nennt diese Person?',model.top.out,'out')}${renderRankList('Häufig genannte Personen / In-Degree','Wie oft wird diese Person genannt?',model.top.in,'in')}${renderRankList('Vermittelnde Positionen','Betweenness (gerichtete kürzeste Pfade)',model.top.between,'between')}</div>`;
  }

  function renderExport(){
    const c=counts(),canExport=state.member?.role==='admin';
    const sheets=[['Gesamt_Personen','Codierte Antworten: eine Zeile je Person, wie im Original'],['Gesamt_Netzwerk','B1–B6: alle möglichen Personenpaare, inkl. Nullkanten'],['Codebuch','Originalvariablen und Kodierung aus Excel V7'],['Persons','Personenmerkmale, ID, Rolle, Geb\u00e4ude, B\u00fcro'],['Interviews','Interviewer, Zeitpunkt, Status und Version'],['Answers','Frage / Antwort je Interview'],['Edges','Gerichtete Netzwerkkanten mit Frequenz, Art und Inhalt'],['Locations','Weitere Orte und Aufenthaltsfrequenzen'],['Nodes','Gephi-taugliche Knotenliste'],['Datenqualitaet','Offene Angaben und Erhebungsstatus']];
    return pageHead('Daten & Auswertung','Datenexport','Lade die gemeinsamen Interviewdaten als Excel-Arbeitsmappe herunter. Die Daten werden direkt aus Supabase gelesen.')+
      `<div class="export-grid"><div><section class="export-feature"><div class="feature-icon">${icon('download',27)}</div><div><span class="eyebrow">Wissenschaftlicher Export</span><h2>Ein Download. Alle Daten.</h2><p>Der Excel-Export enth\u00e4lt Personen, die Originalantworten, r\u00e4umliche Informationen und gerichtete Netzwerkbeziehungen in getrennten Tabellenbl\u00e4ttern.</p><button class="btn btn-primary" data-action="export-xlsx" ${canExport?'':'disabled'}>${icon('download')} Excel (.xlsx) herunterladen</button>${!canExport?'<p style="margin-top:10px">Export nur mit Administrator-Rechten verf\u00fcgbar.</p>':''}</div></section><div class="notice-box warn" style="margin-top:20px">${icon('alert')}<span>Der Export enth\u00e4lt personenbezogene Forschungsdaten. Nicht in GitHub hochladen und nur \u00fcber zugelassene Hochschulablagen weitergeben. Vor der Erhebung Datenschutz und Hochschulfreigabe pr\u00fcfen.</span></div></div><div class="panel"><div class="panel-inner"><div class="panel-head"><h2>Enthaltene Tabellen</h2><span class="pill">${sheets.length} Sheets</span></div><div class="sheet-list">${sheets.map(([name,desc])=>`<div class="sheet-item">${icon('file')}<div><strong>${name}</strong><small>${desc}</small></div>${icon('check',14)}</div>`).join('')}</div></div></div></div><div class="stat-grid" style="margin-top:22px">${stat('Personen',c.total,'F\u00fcr Nodes','users')}${stat('Kanten',c.edges,'F\u00fcr Edges','network')}${stat('Abgeschlossen',c.done,'Verwertbare Interviews','check')}${stat('Offene Interviews',c.pending+c.ongoing,'Datenqualit\u00e4t pr\u00fcfen','clock')}</div>`;
  }
  function clearModal(){state.modal='';if(document.fullscreenElement){document.exitFullscreen?.().catch(()=>{});}const host=qs('#modal-host');if(host)host.innerHTML='';if(state.route==='network'){window.NXTNetworkViz?.cleanup?.();mountNetworkVisuals(root);}}
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
    if(el.dataset.networkInput){
      if(el.type==='range'&&e.type==='input'){
        const label=el.closest('.field')?.querySelector('label span');if(label)label.textContent=el.value+(el.dataset.networkInput==='depth'?'%':' / '+Math.max(6,state.people.length));
        return;
      }
      if(el.type!=='range'&&e.type==='input')return;
      const prefs=networkPrefs(), key=el.dataset.networkInput;
      if(key==='sizeMode')prefs.sizeMode=el.checked?'degree':'flat';
      else if(['labels','hideIsolates','onlyInterviewed'].includes(key))prefs[key]=el.checked;
      else if(['limit','depth'].includes(key))prefs[key]=Number(el.value);
      else prefs[key]=el.value;
      const dialog=qs('.modal-network-fullscreen');
      if(dialog){
        window.NXTNetworkViz?.cleanup?.();
        const old=dialog.querySelector('.network-scene');
        if(old)old.outerHTML=renderNetworkScene(computeNetworkModel(),true);
        mountNetworkVisuals(dialog);
      }else if(state.route==='network')render();
      return;
    }
    if(!state.form)return;
    if(el.id==='peer-search'){
      state.peerQuery=el.value;const list=qs('#peer-results');if(list)list.innerHTML=renderPeerResults();return;
    }
    if(el.id==='peer-only'){
      state.peerOnly=el.checked;const list=qs('#peer-results');if(list)list.innerHTML=renderPeerResults();return;
    }
    if(el.dataset.field){state.form[el.dataset.field]=el.value;markDirty();return;}
    if(el.dataset.answer){
      const key=el.dataset.answer,val=el.type==='checkbox'?el.checked:el.value;
      if(key.startsWith('C8_')&&el.type==='checkbox'&&val&&qCountC8()>=3&&!state.form.answers[key]){
        el.checked=false;toast('Bei C8 dürfen höchstens 3 Orte angekreuzt werden.','error');return;
      }
      if(key==='no_exchange'&&val&&state.form.edges.length){
        if(!window.confirm('Alle bisher markierten Austauschbeziehungen entfernen?')){el.checked=false;return;}
        state.form.edges=[];
      }
      state.form.answers[key]=val;markDirty();
      if(key==='Einwilligung'||key==='no_exchange'){render();}
      if(key.startsWith('C8_')&&el.type==='checkbox'){
        const counter=qs('.q-encounter-header span');if(counter)counter.textContent=qCountC8()+' / 3 ausgewählt';
      }
      return;
    }
    if(el.dataset.edgeField){
      const edge=state.form.edges[Number(el.dataset.index)];if(!edge)return;
      if(el.dataset.edgeField==='topics_single')edge.topics=el.value?[el.value]:[];
      else if(el.dataset.edgeField==='known_before_nxt')edge.known_before_nxt=el.value===''?null:el.value==='true';
      else edge[el.dataset.edgeField]=el.value;
      markDirty();return;
    }
    if(el.dataset.locationField){
      const location=state.form.locations[Number(el.dataset.index)];if(location){location[el.dataset.locationField]=el.value;markDirty();}return;
    }
  }
  function refreshPeopleTable(){
    const list=qs('#people-list');if(list)list.innerHTML=renderPeopleTable(filteredPeople());
    const count=qs('#people-count');if(count)count.textContent=filteredPeople().length+' Personen';
  }
  async function saveInterview(status,background=false){
    if(state.busy||!state.form)return;
    const f=state.form,a=f.answers;
    clearTimeout(autosaveTimer);
    const revision=f.changeRevision||0;
    const refused=consentNo(a.Einwilligung);
    if(status==='completed'&&!background){
      if(!consentYes(a.Einwilligung)&&!refused){state.step=0;render();toast('Bitte Einwilligung oder Ablehnung dokumentieren.','error');return;}
      if(!clean(f.interviewer_name)){state.step=0;render();toast('Bitte das Kürzel der interviewenden Person eintragen.','error');return;}
      if(qCountC8()>3){state.step=2;render();toast('Bei C8 sind höchstens drei Angaben möglich.','error');return;}
      if(f.locations.slice(0,6).some(l=>!clean(l.building)&&clean(l.place))){state.step=2;render();toast('Bei C6 bitte bei jedem ausgefüllten Raum auch das Gebäude angeben.','error');return;}
      if(f.edges.some(e=>!e.target_person_id)){state.step=1;render();toast('Bei B1 ist eine Zielperson nicht ausgewählt.','error');return;}
      if(f.edges.length&&a.no_exchange){state.step=1;render();toast('B1: Kanten erfasst und gleichzeitig „keine Austauschpartner“ markiert.','error');return;}
      if(refused)status='declined';
    }
    if(f.edges.some(e=>!e.target_person_id)||f.edges.some(e=>e.target_person_id===f.personId)||new Set(f.edges.map(e=>e.target_person_id)).size!==f.edges.length){
      state.step=1;render();toast('B1: Doppelte oder ungültige Austauschbeziehung.','error');return;
    }
    state.busy=true;
    try{
      const answers={...a,Kuerzel:clean(f.interviewer_name)};
      for(let i=0;i<6;i++){
        answers['C6_Gebaeude_'+(i+1)]=f.locations[i]?.building||'';
        answers['C6_Raum_'+(i+1)]=f.locations[i]?.place||'';
      }
      answers.C8_Anzahl=qCountC8();
      const safeAnswers=refused?{
        Interview_Nr:answers.Interview_Nr||'',Kuerzel:answers.Kuerzel||'',Datum:answers.Datum||'',Einwilligung:answers.Einwilligung
      }:answers;
      const body={p_interview_id:f.interviewId,p_expected_version:f.version,p_status:status,
        p_interviewer_name:clean(f.interviewer_name),p_notes:clean(f.interview_notes),
        p_role_group:refused?clean(f.role_group):clean(a.A1_Gruppe||f.role_group),
        p_professional_title:refused?clean(f.professional_title):clean(a.A3_Selbstbezeichnung||f.professional_title),
        p_unit:clean(f.unit),p_building:refused?clean(f.building):clean(a.C1_Gebaeude||f.building),
        p_room:refused?clean(f.room):clean(a.C1_Raum||f.room),
        p_answers:Object.entries(safeAnswers).filter(([k,v])=>v!==undefined).map(([question_key,answer])=>({question_key,answer})),
        p_edges:refused?[]:f.edges.map(e=>({...e,note:clean(e.note),exchange_medium:e.exchange_medium||null,known_before_nxt:e.known_before_nxt??null})),
        p_locations:refused?[]:f.locations.filter(l=>clean(l.building)).map(l=>({...l}))};
      const {data,error}=await state.db.rpc('save_interview_snapshot',body);
      if(error)throw error;
      f.version=Number(data);f.status=status;state.draftDirty=f.changeRevision!==revision;
      await reloadData(false);
      if(background){
        const indicator=qs('#dirty-indicator');
        if(indicator){indicator.className='pill '+(state.draftDirty?'orange':'green');indicator.textContent=state.draftDirty?'Ungespeichert':'Automatisch gespeichert';}
        if(state.draftDirty)markDirty();
      }else{
        if(status==='completed'||status==='declined'){
          state.route='interviews';state.form=null;
          toast(status==='declined'?'Ablehnung dokumentiert.':'Interview zentral gespeichert und abgeschlossen.','success');
        }else toast('Interviewentwurf zentral gespeichert.','success');
        render();
      }
    }catch(e){
      const conflict=/INTERVIEW_CONFLICT/i.test(e.message||'');
      toast(conflict?'Speicherkonflikt: Dieses Interview wurde inzwischen auf einem anderen Gerät geändert. Bitte Daten sichern und die Seite aktualisieren.':'Speichern fehlgeschlagen: '+(e.message||e),'error');
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
  // Codebook-faithful export: the original workbook has one row per person and
  // one row per possible directed person-pair, not only positive edges.
  const excelLookup = (raw,items) => {
    if(raw===undefined||raw===null||raw==='')return '';
    const idx=(items||[]).findIndex(item=>String(Array.isArray(item)?item[0]:item)===String(raw));
    return idx>=0?idx+1:'';
  };
  const excelBinary=(raw) => raw===true||raw==='Ja'||raw==='ja'||raw==='x'||raw===1?1:
    raw===false||raw==='Nein'||raw==='nein'||raw===0?0:'';
  const questionnaireValue=(key,answers,status)=>{
    const v=answers[key];
    if(key==='Kuerzel')return v||'';
    if(key==='Einwilligung')return consentYes(v)?1:consentNo(v)?0:'';
    const maps={
      A1_Gruppe:Q.groups,A2_Kategorie:Q.categories,A4_Alter:Q.ages,
      A5_Geschlecht:Q.genders,B_Aussage_Austausch_wichtig:Q.likert,
      C9_1:Q.likert,C9_2:Q.likert,C9_3:Q.likert,C9_4:Q.likert,C9_5:Q.likert
    };
    if(maps[key])return excelLookup(v,maps[key]);
    if(key==='C5_Ankunft'){
      if(!v)return '';
      if(String(v)==='direkt an meinem Gebäude')return 98;
      if(String(v)==='anderer Ort')return 99;
      const n=parseInt(String(v),10);return n>=10&&n<=16?n:'';
    }
    if(key==='A6_vor_NXT'||key.startsWith('C2_')&&!key.endsWith('_Etage')||
       key.startsWith('C7_')&&!key.endsWith('_Text'))return excelBinary(v);
    if(key.startsWith('C3_')||key.startsWith('C4_')||key.startsWith('C8_')&&key!=='C8_Anzahl'&&!key.endsWith('_Text')){
      if(v===undefined)return status==='completed'?0:'';
      return excelBinary(v);
    }
    if(key==='C8_Anzahl')return (Q.encountersC8||[]).filter(([k])=>answers['C8_'+k]===true).length;
    return v??'';
  };
  function createCodebookExports(wb,people,interviews,edges,answers){
    const byPersonId=new Map(people.map(p=>[p.id,p]));
    const interviewByPerson=new Map(interviews.map(i=>[i.person_id,i]));
    const answersByInterview=new Map();
    for(const a of answers){
      if(!answersByInterview.has(a.interview_id))answersByInterview.set(a.interview_id,{});
      answersByInterview.get(a.interview_id)[a.question_key]=a.answer;
    }
    const edgeByPair=new Map(edges.map(e=>[e.source_person_id+'|'+e.target_person_id,e]));
    const varNames=(Q.codebook||[]).filter(r=>r[1]==='Gesamt_Personen').map(r=>r[0]);
    const rows=people.slice().sort((a,b)=>a.code.localeCompare(b.code,undefined,{numeric:true})).map(p=>{
      const interview=interviewByPerson.get(p.id),a=interview?answersByInterview.get(interview.id)||{}:{},status=interview?.status||'planned';
      const result={ID:p.code,Status:status==='completed'?'durchgeführt':status==='declined'?'abgelehnt':'offen'};
      for(const key of varNames){
        if(key==='ID'||key==='Status')continue;
        result[key]=questionnaireValue(key,a,status);
      }
      return result;
    });
    makeSheet(wb,'Gesamt_Personen',varNames,rows);
    const pairVars=(Q.codebook||[]).filter(r=>r[1]==='Gesamt_Netzwerk').map(r=>r[0]);
    const pairs=[];
    const sortedPeople=people.slice().sort((a,b)=>a.code.localeCompare(b.code,undefined,{numeric:true}));
    for(const ego of sortedPeople){
      const i=interviewByPerson.get(ego.id),a=i?answersByInterview.get(i.id)||{}:{};
      const usable=i?.status==='completed' && (edges.some(e=>e.source_person_id===ego.id)||a.no_exchange===true);
      for(const alter of sortedPeople){
        const own=ego.id===alter.id;const e=!own?edgeByPair.get(ego.id+'|'+alter.id):null;
        const arr=e?.topics||[];const topic=arr[0];
        pairs.push({
          Ego_ID:ego.code,Alter_ID:alter.code,Eigene_Person:own?1:0,
          B1_Austausch:own?'':usable?(e?1:0):'',
          B2_Inhalt:e?excelLookup(topic,Q.b2):'',
          B3_Haeufigkeit:e?excelLookup(e.frequency,Q.b3):'',
          B4_Zustandekommen:e?excelLookup(e.exchange_mode,Q.b4):'',
          B5_Medium:e?excelLookup(e.exchange_medium,Q.b5):'',
          B6_vor_NXT_bekannt:e?excelBinary(e.known_before_nxt):''
        });
      }
    }
    makeSheet(wb,'Gesamt_Netzwerk',pairVars,pairs);
    const cb=(Q.codebook||[]).map(([Variable,Blatt,Frage,Codierung])=>({Variable,Blatt,Frage,Codierung}));
    makeSheet(wb,'Codebuch',['Variable','Blatt','Frage','Codierung'],cb);
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
      const edgeRows=edges.map(e=>({B2_Inhalt:(e.topics||[])[0]||'',B3_Haeufigkeit:e.frequency,B4_Zustandekommen:e.exchange_mode,B5_Medium:e.exchange_medium,B6_vor_NXT_bekannt:e.known_before_nxt,Source:byId.get(e.source_person_id)?.code||e.source_person_id,Target:byId.get(e.target_person_id)?.code||e.target_person_id,SourceName:byId.get(e.source_person_id)?.full_name,TargetName:byId.get(e.target_person_id)?.full_name,Frequency:e.frequency,Topics:(e.topics||[]).join(' | '),ExchangeMode:e.exchange_mode,Note:e.note,InterviewID:e.interview_id,Directed:true}));
      const locationRows=locations.map(l=>({PersonCode:byId.get(l.person_id)?.code||'',Person:byId.get(l.person_id)?.full_name,Gebaeude:l.building,Ort:l.place,Frequenz:l.frequency,Anmerkungen:l.notes}));
      const nodeRows=people.map(p=>({Id:p.code,Label:p.full_name,Group:p.role_group,Unit:p.unit,Building:p.building,Room:p.room}));
      const dqRows=people.map(p=>{
        const i=interviews.find(i=>i.person_id===p.id),an=i?answerByInterview.get(i.id)||{}:{};
        const n=edges.filter(e=>e.source_person_id===p.id).length;
        return {PersonCode:p.code,Name:p.full_name,Interviewstatus:i?.status||'planned',FehltMitarbeitergruppe:!p.role_group,FehltGebaeude:!p.building,FehltRaum:!p.room,FehltInterviewer:!i?.interviewer_name,KantenAnzahl:n,KeinAustauschBestatigt:Boolean(an.no_exchange),FachlicherAustauschUngeklaert:n===0&&!an.no_exchange};
      });
      const wb=window.XLSX.utils.book_new();wb.Props={Title:'NXT Netzwerkforschung - Interviewdaten',Subject:'Fachlicher Austausch und raeumliche Naehe',Author:'NXT Research'};
      createCodebookExports(wb,people,interviews,edges,answers);
      makeSheet(wb,'Persons',['ID','Code','Name','Mitarbeitergruppe','Berufsbezeichnung','Bereich','Gebaeude','Raum','Anmerkungen'],personRows);
      makeSheet(wb,'Interviews',['InterviewID','PersonenID','Person','Status','Interviewer','Beginn','Abschluss','DauerMinuten','LetzteAktualisierung','Version','Notizen'],interviewRows);
      makeSheet(wb,'Answers',['InterviewID','PersonCode','Frage','Antwort','LetzteAktualisierung'],answerRows);
      makeSheet(wb,'Edges',['Source','Target','B2_Inhalt','B3_Haeufigkeit','B4_Zustandekommen','B5_Medium','B6_vor_NXT_bekannt','SourceName','TargetName','Frequency','Topics','ExchangeMode','Note','InterviewID','Directed'],edgeRows);
      makeSheet(wb,'Locations',['PersonCode','Person','Gebaeude','Ort','Frequenz','Anmerkungen'],locationRows);
      makeSheet(wb,'Nodes',['Id','Label','Group','Unit','Building','Room'],nodeRows);
      makeSheet(wb,'Datenqualitaet',['PersonCode','Name','Interviewstatus','FehltMitarbeitergruppe','FehltGebaeude','FehltRaum','FehltInterviewer','KantenAnzahl','KeinAustauschBestatigt','FachlicherAustauschUngeklaert'],dqRows);
      const date=new Date().toISOString().slice(0,10);window.XLSX.writeFile(wb,`NXT_Netzwerkforschung_V7_${date}.xlsx`,{compression:true});
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
    if(a==='toggle-network-controls'){const prefs=networkPrefs();prefs.controlsOpen=!prefs.controlsOpen;if(state.route==='network')render();return;}
    if(a==='open-network-fullscreen'){openNetworkFullscreen();return;}
    if(a==='logout'){if(canLeave())await logout();return;}
    if(a==='add-person'){openPersonModal();return;}
    if(a==='import-people'){openImportModal();return;}
    if(a==='close-modal'){clearModal();return;}
    if(a==='open-interview'){await openInterview(btn.dataset.person);return;}
    if(a==='back-to-interviews'){navigate('interviews');return;}
    if(a==='step'){state.step=Number(btn.dataset.step);render();return;}
    if(a==='next-step'){state.step=Math.min(3,state.step+1);render();window.scrollTo(0,0);return;}
    if(a==='previous-step'){state.step=Math.max(0,state.step-1);render();window.scrollTo(0,0);return;}
    if(a==='open-map'){const host=qs('#modal-host');if(host){host.innerHTML=`<div class="modal-backdrop"><div class="modal modal-map" role="dialog" aria-modal="true" aria-label="Lageplan zur Befragung"><div class="modal-head"><h2>Lageplan zur Befragung · NXT</h2><button type="button" class="icon-button" data-action="close-modal" aria-label="Schließen">${icon('x')}</button></div><div class="modal-body"><img class="q-map-image" src="./assets/nxt-lageplan.webp" alt="Campus-Lageplan mit Gebäude- und Ankunftsortnummern 1 bis 16"></div></div></div>`;}return;}
    if(a==='toggle-peer'){const id=btn.dataset.person;if(!id||id===state.form.personId)return;const index=state.form.edges.findIndex(x=>x.target_person_id===id);if(index>=0)state.form.edges.splice(index,1);else {state.form.edges.push({target_person_id:id,frequency:'',topics:[],exchange_mode:'',exchange_medium:'',known_before_nxt:null,note:''});state.form.answers.no_exchange=false;}markDirty();render();return;}
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
