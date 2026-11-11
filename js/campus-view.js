/* NXT 2.5D campus / spatial-social multilayer exploration.
   This module is shown only inside the authenticated app and does not modify survey records.
   Diagram xy and estimated heights are illustration coordinates, never metric distances. */
(() => {
  'use strict';
  const data=window.NXTCampusData;
  if(!data)return;
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const cmp=(a,b)=>String(a).localeCompare(String(b),'de');
  const clamp=(v,min,max)=>Math.min(max,Math.max(min,v));
  const buildingIDs=new Set(data.buildings.map(b=>b.id));
  const buildingById=new Map(data.buildings.map(b=>[b.id,b]));
  const meetingById=new Map(data.meetingCandidates.map(v=>[v.id,v]));
  const p={tab:'map',building:'all',role:'all',topic:'all',frequency:'all',status:'all',direction:'all',minEdges:1,showLinks:true,showBuildingCounts:true,showPeople:false,showMeetings:true,showGrid:false,showLabels:true,showHeat:false,zoom:1,panX:0,panY:0,selection:{type:'building',id:'16'},search:'',reference:false,fullscreen:false};
  let root=null, ctx=null, answers=[], answerProblem='',mountNonce=0,drag=null;
  const titleTopic={...data.topicLabels};
  const statuses={planned:'Offen',in_progress:'In Bearbeitung',completed:'Abgeschlossen',declined:'Abgelehnt'};
  function normalBuilding(v){
    const raw=String(v??'').trim();if(!raw)return '';
    if(buildingIDs.has(raw.toUpperCase()))return raw.toUpperCase();
    const m=raw.match(/(?:^|\b)(?:geb[aä]ude|geb\.|bau)\s*(5|16|17|21|d)(?=\b|\W|$)/i);
    return m&&buildingIDs.has(m[1].toUpperCase())?m[1].toUpperCase():'';
  }
  function boolAnswer(v){return v===true||v===1||typeof v==='string'&&/^(ja|1|true|yes|angekreuzt)$/i.test(v.trim());}
  function byStatus(personId,index){return index.get(personId)?.status||'planned';}
  function buildModel(){
    const people=ctx?.people||[],allEdges=ctx?.edges||[],interviews=ctx?.interviews||[],locations=ctx?.locations||[];
    const interviewsByPerson=new Map(interviews.map(v=>[v.person_id,v]));
    const interviewsById=new Map(interviews.map(v=>[v.id,v]));
    const roster=new Map(people.map(person=>[person.id,{...person,buildingID:normalBuilding(person.building),interviewStatus:byStatus(person.id,interviewsByPerson)}]));
    const roles=[...new Set(people.map(v=>String(v.role_group||'').trim()).filter(Boolean))].sort(cmp);
    const selectedPeople=[...roster.values()].filter(v=>p.role==='all'||(v.role_group||'')===p.role);
    const selectedIds=new Set(selectedPeople.map(v=>v.id));
    const buckets=new Map(data.buildings.map(v=>[v.id,{...v,people:[],within:0,in:0,out:0,connections:0}]));
    const unknown=[];
    selectedPeople.forEach(person=>{if(buckets.has(person.buildingID))buckets.get(person.buildingID).people.push(person);else unknown.push(person)});
    let excludedMissing=0,notInFilters=0,filtered=[];
    for(const edge of allEdges){
      const source=roster.get(edge.source_person_id),target=roster.get(edge.target_person_id);
      if(!source||!target){excludedMissing++;continue;}
      if(!selectedIds.has(source.id)||!selectedIds.has(target.id)){notInFilters++;continue;}
      if(p.status!=='all'&&source.interviewStatus!==p.status)continue;
      if(p.topic!=='all'&&!(Array.isArray(edge.topics)&&edge.topics.includes(p.topic)))continue;
      if(p.frequency!=='all'&&String(edge.frequency||'')!==p.frequency)continue;
      if(p.building!=='all'){
        const s=source.buildingID,t=target.buildingID;
        if(p.direction==='out'&&s!==p.building)continue;
        if(p.direction==='in'&&t!==p.building)continue;
        if(p.direction==='all'&&s!==p.building&&t!==p.building)continue;
      }
      filtered.push({...edge,source,target});
    }
    const aggregates=new Map(),known=[],unplaced=[];
    for(const e of filtered){
      const s=e.source.buildingID,t=e.target.buildingID;
      if(!s||!t){unplaced.push(e);continue;}
      known.push(e);
      if(s===t){buckets.get(s).within++;buckets.get(s).out++;buckets.get(t).in++}
      else {buckets.get(s).out++;buckets.get(t).in++;buckets.get(s).connections++;buckets.get(t).connections++}
      const k=s+'>'+t;
      if(!aggregates.has(k))aggregates.set(k,{source:s,target:t,count:0,topics:{}});
      const a=aggregates.get(k);a.count++;
      for(const topic of e.topics||[])a.topics[topic]=(a.topics[topic]||0)+1;
    }
    const links=[...aggregates.values()].filter(a=>a.count>=p.minEdges).sort((a,b)=>b.count-a.count);
    const buildings=[...buckets.values()];
    const covered=selectedPeople.filter(person=>normalBuilding(person.building)).length;
    const withRooms=selectedPeople.filter(person=>normalBuilding(person.building)&&String(person.room||'').trim()).length;
    const complete=interviews.filter(x=>x.status==='completed').length;
    const cross=known.filter(x=>x.source.buildingID!==x.target.buildingID).length;
    const internal=known.length-cross;
    const allAnswers=answers.filter(a=>{
      const interview=interviewsById.get(a.interview_id);if(!interview)return false;
      if(p.role!=='all'&&roster.get(interview.person_id)?.role_group!==p.role)return false;
      if(p.status!=='all'&&interview.status!==p.status)return false;
      return true;
    });
    const counts=new Map();const unique=new Set();
    allAnswers.forEach(row=>{const key=String(row.question_key||'');if(!boolAnswer(row.answer))return;
      const dedupe=row.interview_id+'|'+key;if(unique.has(dedupe))return;unique.add(dedupe);counts.set(key,(counts.get(key)||0)+1)});
    const placeRows=data.meetingQuestions.map(q=>({...q,n:counts.get(q.key)||0}));
    return {people,roster,interviews,interviewsByPerson,roles,selectedPeople,buckets,buildings,unknown,allEdges,filtered,known,links,unplaced,excludedMissing,notInFilters,covered,withRooms,cross,internal,complete,meetingCounts:counts,placeRows,locations};
  }
  function renderShell(){return '<div id="nxt-campus-workspace" class="nxt-campus-root"><div class="nxt-campus-loading"><span class="spinner"></span> Campusdaten werden vorbereitet …</div></div>'}
  function option(value,label,selected){return `<option value="${esc(value)}" ${String(value)===String(selected)?'selected':''}>${esc(label)}</option>`}
  function kpi(label,value,sub){return `<div class="nxt-campus-kpi"><span>${esc(label)}</span><strong>${esc(value)}</strong><small>${esc(sub)}</small></div>`}
  function renderKpis(m){return `<div class="nxt-campus-kpis">${kpi('Personen mit Gebäude',m.covered+' / '+m.selectedPeople.length,'Bürozuordnung, nicht aktuelle Anwesenheit')}${kpi('Räume bekannt',m.withRooms,'Fehlende Räume separat prüfen')}${kpi('Gefilterte Kanten',m.filtered.length,'Gerichtet, aus gespeicherten Interviews')}${kpi('Zwischen Gebäuden',m.cross,'Nur bei bekanntem Quelle- und Zielgebäude')}${kpi('Im selben Gebäude',m.internal,'Nicht identisch mit demselben Büro')}${kpi('Abgeschlossene Interviews',m.complete,'Datenqualität / Rücklauf beachten')}</div>`}
  function renderFilters(m){
    return `<aside class="panel nxt-campus-filters" aria-label="Räumliche Netzwerkfilter"><div class="nxt-campus-panel-head"><h3><span class="nxt-campus-tiny-icon">⌕</span> Ebenen & Filter</h3><small>Das Diagramm wird sofort aktualisiert.</small></div>
      <div class="nxt-campus-field"><label for="c-building">Gebäude</label><select id="c-building" data-campus-filter="building">${option('all','Alle 5 NXT-Gebäude',p.building)}${data.buildings.map(b=>option(b.id,b.label,p.building)).join('')}</select></div>
      <div class="nxt-campus-field"><label for="c-role">Mitarbeitergruppe</label><select id="c-role" data-campus-filter="role">${option('all','Alle Gruppen',p.role)}${m.roles.map(t=>option(t,t,p.role)).join('')}</select></div>
      <div class="nxt-campus-field"><label for="c-topic">Fachlicher Austausch (B2)</label><select id="c-topic" data-campus-filter="topic">${option('all','Alle Themen',p.topic)}${Object.entries(titleTopic).map(([id,label])=>option(id,label,p.topic)).join('')}</select></div>
      <div class="nxt-campus-field"><label for="c-frequency">Häufigkeit (B3)</label><select id="c-frequency" data-campus-filter="frequency">${option('all','Alle Nennungen',p.frequency)}${[1,2,3,4,5].map(n=>option(n,'Antwortcode '+n,p.frequency)).join('')}</select></div>
      <div class="nxt-campus-field"><label for="c-status">Status des Quellinterviews</label><select id="c-status" data-campus-filter="status">${option('all','Alle gespeicherten',p.status)}${Object.entries(statuses).map(([v,label])=>option(v,label,p.status)).join('')}</select></div>
      <div class="nxt-campus-field"><label for="c-direction">Kantenrichtung bezogen auf Gebäude</label><select id="c-direction" data-campus-filter="direction">${option('all','Ein- und ausgehend',p.direction)}${option('out','Ausgehend',p.direction)}${option('in','Eingehend',p.direction)}</select></div>
      <div class="nxt-campus-field"><label for="c-min">Mindestanzahl je Gebäudekante <b>${p.minEdges}</b></label><input id="c-min" type="range" data-campus-filter="minEdges" min="1" max="8" step="1" value="${p.minEdges}"></div>
      <div class="nxt-campus-switches">
        ${switcher('showLinks','Gerichtete Beziehungen',true)}
        ${switcher('showBuildingCounts','Mitarbeiterzahlen pro Gebäude',true)}
        ${switcher('showPeople','Personenpunkte im Gebäude',true)}
        ${switcher('showMeetings','Treffbereiche / Orte',true)}
        ${switcher('showLabels','Gebäudebezeichnungen',true)}
        ${switcher('showHeat','Dichte als Heatmap',true)}
        ${switcher('showGrid','Bild-Koordinatenraster',true)}
      </div><button class="btn btn-light btn-sm nxt-campus-reset-filters" type="button" data-campus-action="reset-filters">Filter zurücksetzen</button>
      <div class="nxt-campus-filter-foot"><strong>Datengrundlage</strong><p>Gebäude- und Raumeinträge stammen aus <code>Persons</code> und den Interviews. Nennungen aus B1–B6 sind gerichtete Kanten. Die Karte ist schematisch, nicht georeferenziert.</p></div></aside>`;
  }
  function switcher(key,label){return `<label class="nxt-campus-check"><input type="checkbox" data-campus-filter="${key}" ${p[key]?'checked':''}><span>${label}</span></label>`}
  function overlayGrid(){let x='<g class="nxt-campus-grid" aria-hidden="true">';for(let n=0;n<=1000;n+=100)x+=`<line x1="${n}" y1="0" x2="${n}" y2="563"/><text x="${n+3}" y="18">${n}</text>`;for(let n=0;n<=560;n+=80)x+=`<line x1="0" y1="${n}" x2="1000" y2="${n}"/><text x="6" y="${n+29}">${n}</text>`;return x+'</g>'}
  function edgeMarkup(m){if(!p.showLinks)return '';
    let items='';const selection=p.selection?.type==='building'?p.selection.id:null;
    for(const e of m.links){const s=buildingById.get(e.source),t=buildingById.get(e.target);if(!s||!t)continue;
      const marked=selection===e.source||selection===e.target;
      if(s.id===t.id){const radius=19+Math.min(e.count,8)*1.8;items+=`<g class="nxt-campus-edge-group ${marked?'highlight':''}" data-campus-action="select-building" data-id="${esc(s.id)}"><path class="nxt-campus-edge is-loop" d="M ${s.x+12} ${s.y-12} C ${s.x+radius+26} ${s.y-radius-38}, ${s.x-radius-15} ${s.y-radius-43}, ${s.x-12} ${s.y-12}" stroke-width="${Math.min(8,2+e.count)}"/><title>${esc(s.label)}: ${e.count} interne fachliche Kanten</title></g>`;continue}
      const dx=t.x-s.x,dy=t.y-s.y,length=Math.max(1,Math.hypot(dx,dy));const nx=-dy/length,ny=dx/length;
      const sign=cmp(s.id,t.id)<0?1:-1,spread=17*sign;const mx=(s.x+t.x)/2+nx*spread,my=(s.y+t.y)/2+ny*spread;
      const dist=Math.min(23,length*.22);const stx=s.x+(dx/length)*dist,sty=s.y+(dy/length)*dist,ex=t.x-(dx/length)*dist,ey=t.y-(dy/length)*dist;
      const title=`${s.label} → ${t.label}: ${e.count} fachliche Nennungen`;
      items+=`<g class="nxt-campus-edge-group ${marked?'highlight':''}" data-campus-action="select-building" data-id="${esc(s.id)}"><path class="nxt-campus-edge" d="M ${stx.toFixed(1)} ${sty.toFixed(1)} Q ${mx.toFixed(1)} ${my.toFixed(1)} ${ex.toFixed(1)} ${ey.toFixed(1)}" stroke-width="${Math.min(9,2+e.count*1.2)}" marker-end="url(#campus-arrow)"/><title>${esc(title)}</title></g>`;
      if(marked||p.showLabels&&m.links.length<=7)items+=`<text class="nxt-campus-edge-label" x="${mx.toFixed(1)}" y="${(my-4).toFixed(1)}" text-anchor="middle">${e.count}</text>`;
    }return `<g class="nxt-campus-links">${items}</g>`;
  }
  function personDots(m){if(!p.showPeople)return '';
    const nodes=[];for(const b of m.buildings){if(p.building!=='all'&&p.building!==b.id)continue;const people=b.people.slice().sort((a,b)=>cmp(a.code,b.code));people.forEach((person,i)=>{
      const radius=25+Math.sqrt(i)*8,angle=2.399963229728653*i;const x=b.x+Math.cos(angle)*radius,y=b.y+Math.sin(angle)*radius*.62;
      const chosen=p.selection?.type==='person'&&p.selection.id===person.id;
      nodes.push(`<g class="nxt-campus-person ${chosen?'selected':''}" role="button" tabindex="0" data-campus-action="select-person" data-id="${esc(person.id)}"><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="6.5"/><title>${esc(person.code)} · ${esc(person.full_name)} · ${esc(b.label)} · ${esc(person.room||'Raum offen')}</title></g>`);
    })}return `<g class="nxt-campus-persons">${nodes.join('')}</g>`;
  }
  function heatmap(m){if(!p.showHeat)return '';const max=Math.max(1,...m.buildings.map(x=>x.people.length));return `<g class="nxt-campus-heat" pointer-events="none">${m.buildings.map(b=>{const r=55+Math.min(55,b.people.length*3.4),opacity=.07+b.people.length/max*.22;return `<circle cx="${b.x}" cy="${b.y}" r="${r}" fill="url(#nxt-campus-heat-grad)" opacity="${opacity.toFixed(2)}"/>`}).join('')}</g>`}
  function meetingMarkers(){if(!p.showMeetings)return '';
    return `<g class="nxt-campus-meetings">${data.meetingCandidates.map(m=>{
      const active=p.selection?.type==='meeting'&&p.selection.id===m.id;
      return `<g role="button" tabindex="0" class="nxt-campus-meeting ${esc(m.kind)} ${active?'selected':''}" data-campus-action="select-meeting" data-id="${esc(m.id)}"><rect x="${m.x-11}" y="${m.y-11}" rx="5" width="22" height="22" transform="rotate(45 ${m.x} ${m.y})"/><text x="${m.x}" y="${m.y+3.8}" text-anchor="middle">${esc(m.number)}</text><title>${esc(m.label)} – Position ungefähr aus dem Originalplan auf die 2,5D-Grafik übertragen</title></g>`
    }).join('')}</g>`;
  }
  function buildingMarkers(m){const max=Math.max(1,...m.buildings.map(x=>x.people.length));return `<g class="nxt-campus-buildings">${m.buildings.map(b=>{
    const active=p.selection?.type==='building'&&p.selection.id===b.id;
    const faded=p.building!=='all'&&p.building!==b.id;
    const r=18+Math.min(14,Math.sqrt(b.people.length)*3);
    return `<g role="button" tabindex="0" class="nxt-campus-building ${active?'selected':''} ${faded?'muted':''} ${p.showBuildingCounts?'':'without-counts'}" data-campus-action="select-building" data-id="${esc(b.id)}">${p.showBuildingCounts?`<circle class="nxt-campus-building-halo" cx="${b.x}" cy="${b.y}" r="${r+6}"/><circle class="nxt-campus-building-body" cx="${b.x}" cy="${b.y}" r="${r}"/><text x="${b.x}" y="${b.y+5}" text-anchor="middle">${b.people.length}</text>`:`<circle class="nxt-campus-building-hit" cx="${b.x}" cy="${b.y}" r="${r+6}" fill="transparent" pointer-events="all"/>`}${p.showLabels?`<text class="nxt-campus-building-code" x="${b.x}" y="${b.y+r+22}" text-anchor="middle">Bau ${esc(b.id)}</text>`:''}<title>${esc(b.label)}: ${b.people.length} zugeordnete Personen · ${b.in} eingehende / ${b.out} ausgehende Kanten</title></g>`;
  }).join('')}</g>`}
  function mapSvg(m){return `<svg class="nxt-campus-svg" viewBox="0 0 ${data.width} ${data.height}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Interaktive Campuskarte mit Gebäuden, Personen und fachlichen Beziehungen"><defs><marker id="campus-arrow" orient="auto" markerWidth="7" markerHeight="7" refX="7" refY="3" markerUnits="userSpaceOnUse"><path d="M 0 0 L 7 3 L 0 6 Z" fill="#126f87"/></marker><radialGradient id="nxt-campus-heat-grad"><stop offset="0" stop-color="#008e97" stop-opacity=".9"/><stop offset="1" stop-color="#008e97" stop-opacity="0"/></radialGradient></defs>${p.showGrid?overlayGrid():''}${heatmap(m)}${edgeMarkup(m)}${personDots(m)}${meetingMarkers()}${buildingMarkers(m)}</svg>`}
  function renderMap(m){return `<section class="panel nxt-campus-map-panel"><div class="nxt-campus-map-toolbar"><div><h3>2,5D Campusmodell</h3><small>Schematische Lage · ${data.coordinateSystem} · Gebäudehöhen geschätzt</small></div><div class="nxt-campus-map-actions"><button type="button" class="btn btn-light btn-sm nxt-campus-count-toggle" data-campus-action="toggle-building-counts" aria-pressed="${p.showBuildingCounts}" title="Große Kreise mit Mitarbeiterzahlen ein- oder ausblenden">${p.showBuildingCounts?'◉ Zahlen ausblenden':'◎ Zahlen einblenden'}</button><button type="button" class="btn btn-light btn-sm" data-campus-action="reference">Originalplan</button><button type="button" class="btn btn-light btn-sm" data-campus-action="fullscreen">⛶ Vollbild</button></div></div>
    <div class="nxt-campus-viewport" id="nxt-campus-viewport" aria-label="Campuskarte verschiebbar mit der Maus und per Touch">
      <div class="nxt-campus-map-layer" id="nxt-campus-layer" style="transform:translate(calc(-50% + ${p.panX}px),${p.panY}px) scale(${p.zoom})">
        <img class="nxt-campus-background" src="${data.artwork}" alt="Illustrierter isometrischer NXT Campusgrundriss mit Gebäuden 5, 16, 17, 21 und D" draggable="false"><div class="nxt-campus-not-scale">2,5D-KONZEPT · NICHT MASSSTÄBLICH</div>${mapSvg(m)}
      </div>
    </div>
    <div class="nxt-campus-map-foot"><div class="nxt-campus-map-legend"><span><i class="nxt-campus-dot teal"></i> NXT-Gebäude</span><span><i class="nxt-campus-dot orange"></i> soziale Orte</span><span><i class="nxt-campus-dot blue"></i> Anreise</span><span><i class="nxt-campus-line-key"></i> gerichteter Austausch</span></div><div class="nxt-campus-zoom"><button data-campus-action="zoom-out" aria-label="Verkleinern">−</button><span>${Math.round(p.zoom*100)} %</span><button data-campus-action="zoom-in" aria-label="Vergrößern">+</button><button data-campus-action="zoom-reset" aria-label="Ansicht zurücksetzen">↺</button></div></div>
    <div class="nxt-campus-map-note"><strong>Wissenschaftlicher Hinweis:</strong> Die Karte ist eine illustrativ verzerrte 2,5D-Darstellung. Das Raster ist ein Bildraster, keine Meter- oder GPS-Skala. Gebäudehöhen, Treffpunktkoordinaten und gezeichnete Wege sind bisher keine verifizierten Vermessungsdaten. Für Wegeanalysen bitte später die originalen CAD-Pläne und gemessene Tür-zu-Tür-Wege verwenden.</div>
  </section>`}
  function buildingOverview(m){const max=Math.max(1,...m.buildings.map(b=>b.people.length));return `<div class="panel nxt-campus-summary"><header><h3>Bürostandorte</h3><small>Personen nach Hauptgebäude</small></header><div class="nxt-campus-building-bars">${m.buildings.map(b=>`<button type="button" data-campus-action="select-building" data-id="${esc(b.id)}" class="nxt-campus-bar"><span>Bau ${esc(b.id)}</span><i><b style="width:${Math.round(b.people.length/max*100)}%"></b></i><strong>${b.people.length}</strong></button>`).join('')}</div>${m.unknown.length?`<p class="nxt-campus-muted">${m.unknown.length} Personen ohne auswertbare Gebäudeangabe (bei aktiver Mitarbeitergruppen-Auswahl).</p>`:''}</div>`}
  function matrixTable(m,compact=false){const keys=data.buildings.map(b=>b.id),matrix=new Map(m.known.map(e=>[e.source.buildingID+'|'+e.target.buildingID,0]));m.known.forEach(e=>{const k=e.source.buildingID+'|'+e.target.buildingID;matrix.set(k,(matrix.get(k)||0)+1)});
    const max=Math.max(1,...matrix.values());return `<div class="nxt-campus-matrix-wrap"><table class="nxt-campus-matrix"><caption>Gerichtete fachliche Kanten: Zeile = Quelle, Spalte = genanntes Ziel</caption><thead><tr><th scope="col">Quelle ↓ Ziel →</th>${keys.map(k=>`<th scope="col">${esc(k)}</th>`).join('')}<th scope="col">Σ Out</th></tr></thead><tbody>${keys.map(a=>`<tr><th scope="row">${esc(a)}</th>${keys.map(b=>{const v=matrix.get(a+'|'+b)||0;return `<td class="${v?'filled':''}" style="--strength:${(v/max).toFixed(2)}" title="Bau ${esc(a)} → Bau ${esc(b)}: ${v} Nennungen">${v||'–'}</td>`}).join('')}<td>${m.known.filter(e=>e.source.buildingID===a).length}</td></tr>`).join('')}</tbody></table></div>${compact?'':`<p class="nxt-campus-muted">${m.unplaced.length} gefilterte Kanten ohne vollständige räumliche Zuordnung werden nicht in der Matrix gezählt.</p>`}`;
  }
  function placeOverview(m){const n=m.placeRows.filter(q=>q.n>0).sort((a,b)=>b.n-a.n).slice(0,7);return `<div class="panel nxt-campus-summary"><header><h3>Begegnungsorte aus der Befragung</h3><small>C2 · C7 · C8, nur tatsächlich gespeicherte Antworten</small></header>${n.length?`<div class="nxt-campus-places-summary">${n.map(q=>`<div><span>${esc(q.label)} <small>${esc(q.group)}</small></span><strong>${q.n}</strong></div>`).join('')}</div>`:'<p class="nxt-campus-muted">Noch keine auswertbaren positiven Ortsnennungen gespeichert.</p>'}<p class="nxt-campus-muted">Häufigkeiten nach Fragekategorie, nicht an einen bestimmten Kartenpunkt gebunden.</p></div>`}
  function inspector(m){let content='';const selection=p.selection;
    if(selection?.type==='building'&&m.buckets.has(selection.id)){
      const b=m.buckets.get(selection.id),all=[...b.people].sort((a,b)=>cmp(a.full_name,b.full_name));const from=m.known.filter(e=>e.source.buildingID===b.id),to=m.known.filter(e=>e.target.buildingID===b.id);
      content=`<div class="nxt-campus-inspector-h"><span class="nxt-campus-inspector-icon">${esc(b.id)}</span><div><strong>${esc(b.label)}</strong><small>Bildposition X ${b.x} · Y ${b.y}</small></div></div>
        <div class="nxt-campus-inspector-numbers"><div><b>${all.length}</b><small>Zuordnungen</small></div><div><b>${from.length}</b><small>Out-Kanten</small></div><div><b>${to.length}</b><small>In-Kanten</small></div></div>
        <p class="nxt-campus-footnote">Geschätzte Höhe: etwa ${b.heightM} m, EG + 1. OG${b.basement==='assumed'?', Keller angenommen':''}. Nicht vermessen.</p>
        <h4>Zuordnungen & Büros</h4>${all.length?`<div class="nxt-campus-person-list">${all.map(person=>`<button data-campus-action="select-person" data-id="${esc(person.id)}"><span class="nxt-campus-person-code">${esc(person.code)}</span><span>${esc(person.full_name)}<small>${esc(person.room?'Raum '+person.room:'Raum noch offen')}</small></span><span class="nxt-campus-status ${person.interviewStatus}"></span></button>`).join('')}</div>`:'<p class="nxt-campus-muted">Keine Personen unter den aktuellen Filtern zugeordnet.</p>'}
        <p class="nxt-campus-footnote">Bürostandort ≠ Anwesenheitsmessung. Marker zeigen weder eine exakte Raumlage noch die Position innerhalb einer Etage.</p>`;
    }else if(selection?.type==='person'&&m.roster.has(selection.id)){
      const person=m.roster.get(selection.id); const edgeIn=m.filtered.filter(e=>e.target.id===person.id).length,edgeOut=m.filtered.filter(e=>e.source.id===person.id).length;
      content=`<div class="nxt-campus-inspector-h"><span class="nxt-campus-inspector-icon person">${esc(person.code)}</span><div><strong>${esc(person.full_name)}</strong><small>${esc(person.buildingID?'Bau '+person.buildingID:'Gebäude unbekannt')} · ${esc(person.room||'Raum offen')}</small></div></div><div class="nxt-campus-inspector-numbers"><div><b>${edgeIn}</b><small>In-Nennungen</small></div><div><b>${edgeOut}</b><small>Out-Nennungen</small></div></div><p class="nxt-campus-footnote">Status: ${esc(statuses[person.interviewStatus]||'Offen')}. Aus Datenschutzgründen nur für angemeldete Forschungsteam-Mitglieder sichtbar.</p><button class="btn btn-light btn-sm" data-campus-action="select-building" data-id="${esc(person.buildingID||'16')}">Gebäude ansehen</button>`;
    }else if(selection?.type==='meeting'&&meetingById.has(selection.id)){
      const pt=meetingById.get(selection.id);const hits=(pt.questionKeys||[]).map(key=>({key,n:m.meetingCounts.get(key)||0}));
      content=`<div class="nxt-campus-inspector-h"><span class="nxt-campus-inspector-icon meeting">✦</span><div><strong>${esc(pt.label)}</strong><small>Koordinate ${pt.x}, ${pt.y}</small></div></div><p class="nxt-campus-footnote">${esc(pt.source)}. <strong>Position ist nicht verifiziert.</strong></p>${hits.length?`<div class="nxt-campus-inspector-numbers">${hits.map(hit=>`<div><b>${hit.n}</b><small>${esc(hit.key)} · Nennungen</small></div>`).join('')}</div>`:''}<p class="nxt-campus-muted">Die Ortsnamen stammen aus dem markierten Originalplan; ihre Übertragung auf die künstlerische 2,5D-Ansicht ist vorläufig. Breite Antwortkategorien wie Parkplatz/Flur sind nicht auf einen einzelnen Punkt begrenzbar.</p>`;
    }else content='<p class="nxt-campus-muted">Klicke einen Gebäudeknoten, einen Personenpunkt oder einen Treffbereich an.</p>';
    return `<aside class="panel nxt-campus-inspector"><header><h3>Detailinspektor</h3><small>Gebäude · Person · Treffpunkt</small></header>${content}</aside>`;
  }
  function renderMatrix(m){return `<section class="panel nxt-campus-analysis-panel"><header><div><h3>Gerichtete Gebäudebeziehungen</h3><small>Die Matrix zählt Nennungen, keine gegenseitigen Kontakte und keine räumlichen Distanzen.</small></div><button class="btn btn-light btn-sm" data-campus-action="export-matrix">CSV exportieren</button></header>${matrixTable(m)}<div class="nxt-campus-analysis-grid">${kpi('Auswertbare Gebäude-Kanten',m.known.length,'Quelle und Ziel räumlich bekannt')}${kpi('Gebäudeübergreifend',m.cross,'Gerichtet')}${kpi('Innerhalb derselben Gebäude',m.internal,'Keine Raum- oder Etagenkorrektur')}${kpi('Ohne räumliche Zuordnung',m.unplaced.length,'Nicht automatisch einem Gebäude zuordnen')}</div><div class="nxt-campus-note-card"><strong>Interpretation:</strong> Gebäude mit vielen Kanten können durch unterschiedliche Personenzahlen und Interviewabdeckung begünstigt sein. Für die Forschungsfrage sind nach Abschluss aller Interviews zusätzlich Wegdistanzen, Raum- und Etagenverortung sowie ein angemessenes statistisches Vergleichsdesign nötig.</div></section>`}
  function renderPlaces(m){const groupNames=[...new Set(data.meetingQuestions.map(v=>v.group))];return `<section class="panel nxt-campus-analysis-panel"><header><div><h3>Soziale Orte & Begegnungspotenziale</h3><small>Direkt aus den C2-, C7- und C8-Antworten, soweit gespeichert.</small></div></header><div class="nxt-campus-place-groups">${groupNames.map(group=>`<div><h4>${esc(group)}</h4><div class="nxt-campus-places-table">${m.placeRows.filter(x=>x.group===group).map(q=>`<div><span>${esc(q.label)}</span><strong>${q.n}</strong></div>`).join('')}</div></div>`).join('')}</div><div class="nxt-campus-note-card"><strong>Wichtig:</strong> Diese Zahlen erfassen Nennungen, nicht gemessene Begegnungen. Einige Kategorien sind ortsübergreifend (etwa Flure, Teeküchen oder digitale Kommunikation). Die Punktnamen stammen aus dem Originalplan. Die 2,5D-Marker sind noch nicht lagegenau kalibriert; Kategorien wie Flure, Teeküche oder Parkplatz gelten nicht automatisch für nur einen Punkt.</div>${answerProblem?`<p class="nxt-campus-error">Ortsantworten konnten nicht geladen werden: ${esc(answerProblem)}</p>`:''}</section>`}
  function renderQuality(m){const unknownPeople=m.selectedPeople.filter(person=>!normalBuilding(person.building));const unknownRooms=m.selectedPeople.filter(person=>!String(person.room||'').trim());const missingRelated=m.unplaced.length;const coverage=m.selectedPeople.length?Math.round(m.covered/m.selectedPeople.length*100):0;
    return `<section class="panel nxt-campus-analysis-panel"><header><div><h3>Räumliche Datenqualität & Methodik</h3><small>Prüfliste vor der wissenschaftlichen Auswertung</small></div></header><div class="nxt-campus-quality-grid">${kpi('Gebäudeabdeckung',coverage+' %',m.covered+' von '+m.selectedPeople.length+' Personen')}${kpi('Gebäude unbekannt',unknownPeople.length,'Keine Standortschätzung')}${kpi('Raumnummer fehlt',unknownRooms.length,'Für Tür-zu-Tür-Distanzen nacherheben')}${kpi('Unverortete Kanten',missingRelated,'Quelle oder Ziel ohne Gebäude')}</div>
      <div class="nxt-campus-note-card"><h4>Koordinaten- und Höhenmodell</h4><p><code>${esc(data.coordinateSystem)}</code> nutzt ein 1000 × 563 Raster auf der <strong>illustrativen Karte</strong> (Pixelverhältnis 1672 × 941). Das ist weder geodätisch noch maßstäblich. Gebäude liegen auf ungefähr aus der Visualisierung abgeleiteten Zentrumspunkten. EG + 1. OG und ungefähr 7 m für die fünf NXT-Gebäude sind vorläufige Platzhalter, nicht verifizierte Bauhöhen. Ein Keller ist als Annahme vermerkt, nicht als zusätzliche oberirdische Höhe.</p><p>Es sind Baupläne für einzelne Geschosse von 5 und 17 vorhanden; daraus kann noch keine verbindliche Gesamthöhe abgeleitet werden. Die kartografische Darstellung darf nicht für Meterdistanzen oder statistische Signifikanztests verwendet werden.</p></div>
      <div class="nxt-campus-quality-checklist"><h4>Nächste Validierungsschritte</h4><ol><li>Gebäudeeingänge, Etagen- und Raumzuordnungen bestätigen.</li><li>Den Rasterplan anhand CAD-/Lageplandaten kalibrieren; Bildmarker auf echte Koordinaten übertragen.</li><li>Kürzeste begehbare Tür-zu-Tür-Wege und Zeitfenster gesondert messen.</li><li>Die Positionen der benannten Campusorte aus dem Originalplan auf dem 2,5D-Modell kalibrieren, weitere Treffpunkte nacherheben.</li><li>Unvollständige Interviews im Modell ausdrücklich als fehlende Daten kennzeichnen.</li></ol></div>
      ${unknownPeople.length?`<div class="nxt-campus-note-card"><h4>Offene Gebäudezuordnungen</h4><p>${unknownPeople.map(person=>esc(person.code)).join(', ')}</p></div>`:''}</section>`}
  function renderFooter(m){return `<div class="nxt-campus-bottom-row"><span>${m.selectedPeople.length} Personen in aktueller Auswahl · ${m.filtered.length} Kanten · ${m.unplaced.length} unverortet</span><div><button data-campus-action="export-matrix" class="btn btn-light btn-sm">Gebäudematrix CSV</button><button data-campus-action="export-points" class="btn btn-light btn-sm">Knoten-CSV</button><button data-campus-action="go-export" class="btn btn-light btn-sm">Rohdaten in Excel</button></div></div>`}
  function render(m){return `${renderKpis(m)}<div class="nxt-campus-main-tabs" role="tablist" aria-label="Räumliche Analysen">${[['map','Campuskarte'],['matrix','Gebäude-Matrix'],['places','Soziale Treffpunkte'],['quality','Datenqualität']].map(([key,label])=>`<button role="tab" aria-selected="${p.tab===key}" class="${p.tab===key?'active':''}" data-campus-action="tab" data-tab="${key}">${label}</button>`).join('')}</div>
    <div class="nxt-campus-workspace ${p.tab!=='map'?'nxt-campus-workspace-data':''}">${renderFilters(m)}<div class="nxt-campus-main-pane">${p.tab==='map'?`${renderMap(m)}<div class="nxt-campus-lower">${buildingOverview(m)}${placeOverview(m)}</div>`:p.tab==='matrix'?renderMatrix(m):p.tab==='places'?renderPlaces(m):renderQuality(m)}${renderFooter(m)}</div>${p.tab==='map'?inspector(m):''}</div>
    ${p.reference?`<div class="nxt-campus-modal-backdrop" role="presentation"><div class="nxt-campus-modal" role="dialog" aria-modal="true" aria-label="Original Campusplan"><header><strong>Originalplan (Referenz)</strong><button data-campus-action="reference">Schließen ✕</button></header><img src="${data.referencePlan}" alt="Originaler Campuslageplan mit Gebäudekennzeichnungen"/><p>Dieser Plan ist nur der Referenzstand. Die 2,5D-Darstellung wurde künstlerisch erzeugt; die beiden Bilder sind nicht lagegenau übereinander kalibriert.</p></div></div>`:''}`}
  function refresh(){if(!root||!ctx)return;const m=buildModel();root.innerHTML=render(m);updateStageTransform();}
  function updateStageTransform(){const layer=root?.querySelector('#nxt-campus-layer');if(layer)layer.style.transform=`translate(calc(-50% + ${p.panX}px),${p.panY}px) scale(${p.zoom})`;}
  function updateZoomLabel(){const label=root?.querySelector('.nxt-campus-zoom>span');if(label)label.textContent=Math.round(p.zoom*100)+' %';}
  function clickAction(e){const el=e.target.closest('[data-campus-action]');if(!el||!root?.contains(el))return;
    const action=el.dataset.campusAction;
    if(action==='tab'){p.tab=el.dataset.tab;refresh();return}
    if(action==='select-building'){p.selection={type:'building',id:el.dataset.id};refresh();return}
    if(action==='select-person'){p.selection={type:'person',id:el.dataset.id};refresh();return}
    if(action==='select-meeting'){p.selection={type:'meeting',id:el.dataset.id};refresh();return}
    if(action==='zoom-in'){p.zoom=clamp(p.zoom+.18,.8,2.6);updateStageTransform();updateZoomLabel();return}
    if(action==='zoom-out'){p.zoom=clamp(p.zoom-.18,.8,2.6);updateStageTransform();updateZoomLabel();return}
    if(action==='zoom-reset'){p.zoom=1;p.panX=0;p.panY=0;updateStageTransform();updateZoomLabel();return}
    if(action==='toggle-building-counts'){p.showBuildingCounts=!p.showBuildingCounts;refresh();return}
    if(action==='reset-filters'){Object.assign(p,{building:'all',role:'all',topic:'all',frequency:'all',status:'all',direction:'all',minEdges:1,showLinks:true,showBuildingCounts:true,showPeople:false,showMeetings:true,showGrid:false,showLabels:true,showHeat:false});refresh();return}
    if(action==='reference'){p.reference=!p.reference;refresh();return}
    if(action==='fullscreen'){const panel=root.querySelector('.nxt-campus-map-panel');if(!panel)return;const active=!!document.fullscreenElement;if(active){document.exitFullscreen?.().catch(()=>{});}else{panel.requestFullscreen?.().catch(()=>{});}return}
    if(action==='export-matrix'){downloadMatrix(buildModel());return}
    if(action==='export-points'){downloadPoints(buildModel());return}
    if(action==='go-export'){root.closest('#app')?.querySelector('[data-route="export"]')?.click();return}
  }
  function onChange(e){const el=e.target;const key=el.dataset.campusFilter;if(!key)return;
    if(key==='minEdges')p[key]=Number(el.value);else if(key.startsWith('show'))p[key]=Boolean(el.checked);else p[key]=el.value;
    if(key==='building'&&p.building!=='all')p.selection={type:'building',id:p.building};refresh();}
  function onKey(e){if(e.key==='Escape'&&p.reference){p.reference=false;refresh();return}if((e.key==='Enter'||e.key===' ')&&e.target.matches('svg [data-campus-action]')){e.preventDefault();clickAction({target:e.target})}}
  function onPointerDown(e){const viewport=e.target.closest('.nxt-campus-viewport');if(!viewport||!root?.contains(viewport))return;if(e.target.closest('[data-campus-action]'))return;drag={id:e.pointerId,x:e.clientX,y:e.clientY,px:p.panX,py:p.panY};viewport.setPointerCapture?.(e.pointerId)}
  function onPointerMove(e){if(!drag||drag.id!==e.pointerId)return;p.panX=drag.px+e.clientX-drag.x;p.panY=drag.py+e.clientY-drag.y;updateStageTransform()}
  function onPointerUp(e){if(drag&&drag.id===e.pointerId)drag=null}
  function onWheel(e){if(!e.target.closest('.nxt-campus-viewport'))return;e.preventDefault();p.zoom=clamp(p.zoom+(e.deltaY<0?.08:-.08),.8,2.6);updateStageTransform()}
  function csvVal(v){let s=String(v??'');if(/^[\t\r\n\s]*[=+@-]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"'}
  function downloadRows(filename,rows){const content='\ufeff'+rows.map(row=>row.map(csvVal).join(';')).join('\r\n');const url=URL.createObjectURL(new Blob([content],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=filename;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000)}
  function downloadMatrix(m){const rows=[['NXT Campus · gerichtete Gebäudematrix','Konzeptkoordinaten – keine Meter','Quelle → Ziel','Nennungen'],...data.buildings.flatMap(a=>data.buildings.map(b=>['NXT-IMG-1000','nicht geodätisch',a.id+' → '+b.id,m.known.filter(e=>e.source.buildingID===a.id&&e.target.buildingID===b.id).length]))];downloadRows('nxt_gebaeude_kantenmatrix.csv',rows)}
  function downloadPoints(m){const rows=[['Personen-ID','Gebäude','Raum','X Bildkoordinate','Y Bildkoordinate','Interviewstatus','Koordinatensystem','Höhenstatus'],...m.selectedPeople.map(v=>{const b=buildingById.get(normalBuilding(v.building));return [v.code,normalBuilding(v.building)||'',v.room||'',b?.x??'',b?.y??'',v.interviewStatus,data.coordinateSystem,b?'geschätzt':'kein Standort']})];downloadRows('nxt_raeumliche_knoten.csv',rows)}
  async function fetchAnswers(nonce){if(!ctx?.db)return;answerProblem='';try{
      const {data:rows,error}=await ctx.db.from('answers').select('interview_id,question_key,answer').limit(8000);
      if(error)throw new Error(error.message||String(error));if(nonce!==mountNonce||!root)return;answers=Array.isArray(rows)?rows:[];refresh();
    }catch(error){if(nonce!==mountNonce||!root)return;answerProblem=error.message||String(error);refresh()}}
  function mount(element,payload){cleanup();root=element;ctx={people:payload.people||[],edges:payload.edges||[],interviews:payload.interviews||[],locations:payload.locations||[],db:payload.db||null};answers=[];answerProblem='';if(!buildingIDs.has(p.selection?.id)&&p.selection?.type==='building')p.selection={type:'building',id:'16'};
    root.addEventListener('click',clickAction);root.addEventListener('change',onChange);document.addEventListener('keydown',onKey);root.addEventListener('pointerdown',onPointerDown);root.addEventListener('pointermove',onPointerMove);root.addEventListener('pointerup',onPointerUp);root.addEventListener('pointercancel',onPointerUp);root.addEventListener('wheel',onWheel,{passive:false});refresh();fetchAnswers(mountNonce);}
  function cleanup(){mountNonce++;if(root){root.removeEventListener('click',clickAction);root.removeEventListener('change',onChange);document.removeEventListener('keydown',onKey);root.removeEventListener('pointerdown',onPointerDown);root.removeEventListener('pointermove',onPointerMove);root.removeEventListener('pointerup',onPointerUp);root.removeEventListener('pointercancel',onPointerUp);root.removeEventListener('wheel',onWheel);}root=null;ctx=null;answers=[];drag=null;}
  window.NXTCampus={renderShell,mount,cleanup,_tests:{normalBuilding,boolAnswer,buildModel,coordinates:data}};
})();
