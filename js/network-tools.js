/* NXT network analysis / GraphML tools. Local, dependency-free, no database writes. */
(() => {
  'use strict';
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const clamp=(v,a,b)=>Math.max(a,Math.min(v,b));

  function components(nodes,edges,kind='weak'){
    const ids=new Set(nodes.map(n=>n.person?.id??n.id));
    const adj=new Map([...ids].map(x=>[x,new Set()]));
    for(const e of edges){const a=e.source_person_id??e.source,b=e.target_person_id??e.target;if(!ids.has(a)||!ids.has(b))continue;adj.get(a).add(b);if(kind==='weak')adj.get(b).add(a)}
    if(kind==='strong'){
      let index=0;const indices=new Map(),low=new Map(),stack=[],onStack=new Set(),groups=[];
      function visit(v){indices.set(v,index);low.set(v,index++);stack.push(v);onStack.add(v);
        for(const w of adj.get(v)){if(!indices.has(w)){visit(w);low.set(v,Math.min(low.get(v),low.get(w)))}else if(onStack.has(w))low.set(v,Math.min(low.get(v),indices.get(w)))}
        if(low.get(v)===indices.get(v)){const group=[];let w;do{w=stack.pop();onStack.delete(w);group.push(w)}while(w!==v);groups.push(group)}
      }
      for(const v of ids)if(!indices.has(v))visit(v);return groups;
    }
    const seen=new Set(),groups=[];
    for(const id of ids){if(seen.has(id))continue;const stack=[id],group=[];seen.add(id);while(stack.length){const node=stack.pop();group.push(node);for(const nbr of adj.get(node))if(!seen.has(nbr)){seen.add(nbr);stack.push(nbr)}}groups.push(group)}
    return groups;
  }

  function filter(model,prefs){
    const allNodes=model.nodes;
    const allEdges=model.validEdges||[];
    const categories=allNodes.map(n=>String(prefs.categoryField==='role_group'?n.person.role_group||'Ohne Angabe':n.building||'Ohne Gebäude'));
    const uniqueCats=[...new Set(categories)].sort((a,b)=>a.localeCompare(b,'de'));
    const chosen=Array.isArray(prefs.enabledCategories)?prefs.enabledCategories:null;
    let nodes=allNodes.filter((n,i)=>!chosen||chosen.includes(categories[i]));
    const categoryIds=new Set(nodes.map(n=>n.person.id));
    const edgeMatches=e=>categoryIds.has(e.source_person_id)&&categoryIds.has(e.target_person_id)
      && (prefs.topic==='all'||(e.topics||[]).includes(prefs.topic))
      && (prefs.showLoops||e.source_person_id!==e.target_person_id);
    let categoryEdges=allEdges.filter(edgeMatches);
    if(!prefs.multipleEdges){const seen=new Set();categoryEdges=categoryEdges.filter(e=>{const k=e.source_person_id+'|'+e.target_person_id;if(seen.has(k))return false;seen.add(k);return true})}
    // "Recalculate" controls whether components are evaluated after attribute/category filtering.
    const compNodes=prefs.recalculateComponents!==false?nodes:allNodes;
    const compEdges=prefs.recalculateComponents!==false?categoryEdges:allEdges;
    const groups=components(compNodes,compEdges,prefs.componentMode||'weak');
    const compSize=new Map(groups.flatMap(g=>g.map(id=>[id,g.length])));
    const minSize=clamp(Number(prefs.componentMin)||1,1,Math.max(1,allNodes.length));
    nodes=nodes.filter(n=>(compSize.get(n.person.id)||1)>=minSize);
    if(prefs.onlyInterviewed)nodes=nodes.filter(n=>n.interviewStatus!=='planned');
    if(prefs.hideIsolates){const deg=new Map(nodes.map(n=>[n.person.id,0]));for(const e of categoryEdges){if(deg.has(e.source_person_id))deg.set(e.source_person_id,deg.get(e.source_person_id)+1);if(deg.has(e.target_person_id))deg.set(e.target_person_id,deg.get(e.target_person_id)+1)}nodes=nodes.filter(n=>deg.get(n.person.id)>0)}
    const sort=(a,b)=>prefs.metric==='alpha'?a.person.full_name.localeCompare(b.person.full_name,'de'):
      prefs.metric==='in'?b.inDegree-a.inDegree:prefs.metric==='out'?b.outDegree-a.outDegree:
      prefs.metric==='building'?a.building.localeCompare(b.building,'de'):b.degree-a.degree;
    nodes.sort(sort);
    const maxNodes=clamp(Number(prefs.limit)||nodes.length,1,allNodes.length||1);
    nodes=nodes.slice(0,maxNodes);
    const ids=new Set(nodes.map(n=>n.person.id));
    categoryEdges=categoryEdges.filter(e=>ids.has(e.source_person_id)&&ids.has(e.target_person_id));
    return {nodes,edges:categoryEdges,categories:uniqueCats,componentGroups:groups,componentSizes:compSize,componentSize:groups.reduce((m,g)=>Math.max(m,g.length),0)};
  }

  function statistics(nodes,edges){
    const n=nodes.length,byId=new Map(nodes.map(node=>[node.person.id,node]));
    const adj=new Map(nodes.map(node=>[node.person.id,new Set()]));
    const indegree=new Map(nodes.map(node=>[node.person.id,0]));
    const outdegree=new Map(nodes.map(node=>[node.person.id,0]));
    const groups=components(nodes,edges,'weak');
    for(const e of edges){if(!adj.has(e.source_person_id)||!adj.has(e.target_person_id))continue;adj.get(e.source_person_id).add(e.target_person_id);outdegree.set(e.source_person_id,outdegree.get(e.source_person_id)+1);indegree.set(e.target_person_id,indegree.get(e.target_person_id)+1)}
    const closeness=new Map();let sumReach=0;
    for(const node of nodes){const from=node.person.id,dist=new Map([[from,0]]),queue=[from];for(let k=0;k<queue.length;k++){const current=queue[k];for(const target of adj.get(current)){if(!dist.has(target)){dist.set(target,dist.get(current)+1);queue.push(target)}}}
      const reachable=dist.size-1,distSum=[...dist.values()].reduce((a,b)=>a+b,0);
      closeness.set(from,reachable>0&&distSum>0?reachable/distSum*(reachable/Math.max(n-1,1)):0);sumReach+=reachable;
    }
    return {n,m:edges.length,weakComponents:groups.length,strongComponents:components(nodes,edges,'strong').length,largestComponent:Math.max(0,...groups.map(g=>g.length)),density:n>1?edges.length/n/(n-1):0,closeness,indegree,outdegree,reachRate:n>1?sumReach/n/(n-1):0,byId};
  }

  function assortativity(nodes,edges,attribute='building'){
    const values=new Map(nodes.map(n=>[n.person.id,attribute==='building'?(n.person.building||''):(n.person.role_group||'')]));
    const valid=edges.filter(e=>values.has(e.source_person_id)&&values.has(e.target_person_id)&&values.get(e.source_person_id)&&values.get(e.target_person_id));
    const categories=[...new Set([...valid.flatMap(e=>[values.get(e.source_person_id),values.get(e.target_person_id)])])].sort((a,b)=>a.localeCompare(b,'de'));
    const matrix=categories.map(()=>categories.map(()=>0));const indices=new Map(categories.map((category,i)=>[category,i]));
    for(const e of valid){matrix[indices.get(values.get(e.source_person_id))][indices.get(values.get(e.target_person_id))]+=1}
    const m=valid.length,rows=matrix.map(a=>a.reduce((s,x)=>s+x,0)),cols=categories.map((_,i)=>matrix.reduce((s,r)=>s+r[i],0));
    const same=matrix.reduce((sum,r,i)=>sum+r[i],0), expected=m?rows.reduce((sum,v,i)=>sum+v*cols[i],0)/(m*m):0;
    const r=m&&1-expected>1e-12?(same/m-expected)/(1-expected):null;
    return {categories,matrix,valid:m,excluded:edges.length-m,same,sameShare:m?same/m:0,expected,coefficient:r};
  }

  function textAnalysis(edges){
    const topics={F:0,L:0,S:0,A:0,unknown:0};const words=new Map();let withNotes=0;
    const stop=new Set('und oder aber dass die der das den dem des ein eine einen einer eines im in am an bei mit zu zum zur von für auf aus ist sind wurde werden durch auch noch sowie hier sehr mehr zum einen nach vor wenn als ohne über unter bezieht pro eine ich wir es sich nicht keine'.split(' '));
    for(const edge of edges){const key=(edge.topics||[])[0];topics[Object.hasOwn(topics,key)?key:'unknown']++;
      const note=String(edge.note||'').slice(0,1600);if(!note)continue;withNotes++;
      for(const raw of note.toLocaleLowerCase('de').match(/\p{L}{4,}/gu)||[]){if(stop.has(raw))continue;words.set(raw,(words.get(raw)||0)+1)}
    }
    const frequencies=[...words.entries()].filter(([_,count])=>count>=2).sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0],'de')).slice(0,25);
    return {topics,withNotes,frequencies,total:edges.length};
  }

  function graphML(nodes,edges){
    const all=new Set(nodes.map(n=>n.person.id));const idMap=new Map(nodes.map((n,i)=>[n.person.id,'n'+i]));
    const bodyNodes=nodes.map(n=>`<node id="${idMap.get(n.person.id)}"><data key="label">${esc(n.person.full_name)}</data><data key="code">${esc(n.person.code)}</data><data key="building">${esc(n.person.building||'')}</data><data key="group">${esc(n.person.role_group||'')}</data></node>`).join('\n');
    const bodyEdges=edges.filter(e=>all.has(e.source_person_id)&&all.has(e.target_person_id)).map((e,i)=>`<edge id="e${i}" source="${idMap.get(e.source_person_id)}" target="${idMap.get(e.target_person_id)}"><data key="topic">${esc((e.topics||[])[0]||'')}</data></edge>`).join('\n');
    return `<?xml version="1.0" encoding="UTF-8"?>\n<graphml xmlns="http://graphml.graphdrawing.org/xmlns"><key id="label" for="node" attr.name="label" attr.type="string"/><key id="code" for="node" attr.name="code" attr.type="string"/><key id="building" for="node" attr.name="building" attr.type="string"/><key id="group" for="node" attr.name="group" attr.type="string"/><key id="topic" for="edge" attr.name="topic" attr.type="string"/><graph id="NXT" edgedefault="directed">${bodyNodes}${bodyEdges}</graph></graphml>`;
  }

  function parseGraphML(input){
    if(input.length>2_000_000||/<!doctype|<!entity/i.test(input))throw Error('GraphML zu groß oder enthält nicht unterstützte XML-Deklarationen.');
    const doc=new DOMParser().parseFromString(input,'application/xml');
    if(doc.querySelector('parsererror'))throw Error('Ungültige GraphML-Datei.');
    const xmlNodes=[...doc.getElementsByTagNameNS('*','node')];const xmlEdges=[...doc.getElementsByTagNameNS('*','edge')];
    if(!xmlNodes.length||xmlNodes.length>250||xmlEdges.length>2500)throw Error('GraphML muss 1–250 Knoten und maximal 2.500 Kanten enthalten.');
    const keys=new Map([...doc.getElementsByTagNameNS('*','key')].map(k=>[k.getAttribute('id'),k.getAttribute('attr.name')]));
    const getData=(el,names)=>[...el.getElementsByTagNameNS('*','data')].map(d=>[keys.get(d.getAttribute('key'))||d.getAttribute('key'),d.textContent||'']).find(([key])=>names.includes(String(key).toLowerCase()))?.[1]||'';
    const nodeMap=new Map();const people=xmlNodes.map((n,i)=>{
      const id=n.getAttribute('id');if(!id||nodeMap.has(id))throw Error('Doppelte oder leere GraphML-Knoten-ID.');
      const internal='preview-'+i;nodeMap.set(id,internal);
      return {id:internal,code:(getData(n,['code'])||id).slice(0,50),full_name:(getData(n,['label','name'])||id).slice(0,180),building:getData(n,['building','gebäude','location']).slice(0,80),role_group:getData(n,['group','category','type','role']).slice(0,100),room:null};
    });
    const edges=xmlEdges.map((e,i)=>({id:'preview-edge-'+i,source_person_id:nodeMap.get(e.getAttribute('source')),target_person_id:nodeMap.get(e.getAttribute('target')),topics:[getData(e,['topic','type'])].filter(Boolean),note:''}));
    if(edges.some(e=>!e.source_person_id||!e.target_person_id))throw Error('GraphML enthält Kanten mit unbekannten Knoten.');
    return {people,edges};
  }

  function saveFile(name,body,type){const blob=body instanceof Blob?body:new Blob([body],{type});const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.rel='noopener';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2000)}

  async function standaloneHtml(nodes,edges,prefs){
    const resp=await fetch('./js/network-viz.js',{cache:'no-store'});if(!resp.ok)throw Error('Netzwerkbibliothek konnte nicht geladen werden.');
    const source=(await resp.text()).replace(/<\/script/gi,'<\\/script');
    const safePayload=JSON.stringify({nodes,edges,prefs}).replace(/</g,'\\u003c').replace(/\u2028/g,'\\u2028');
    return `<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>NXT Netzwerk-Plot (vertraulich)</title><style>body{margin:0;background:#f4f8f8;color:#18353c;font:14px system-ui;padding:18px}header{display:flex;justify-content:space-between;gap:15px;align-items:center}main{max-width:1200px;margin:auto}.network-scene{background:white;border:1px solid #d9e7e7;border-radius:16px;padding:12px}.network-canvas-shell{height:72vh;min-height:400px;position:relative}.network-graph-canvas{display:block;width:100%;height:100%;touch-action:none}.network-tooltip{position:absolute;background:white;border:1px solid #b6d2d3;padding:10px;border-radius:8px;pointer-events:none}.network-selection,.network-legend{color:#50767b}.network-scene-meta{display:flex;gap:8px}.pill{background:#e7f4f3;padding:5px 9px;border-radius:15px}.building-legend{display:none}</style></head><body><main><header><h1>NXT · Netzwerkvisualisierung</h1><small>Vertrauliche Forschungsdaten · ausschließlich lokal speichern</small></header><p>Mit Maus oder Finger drehen; mit Mausrad oder +/- zoomen. Knoten antippen, um Verbindungen hervorzuheben.</p><div class="network-scene"><div class="network-canvas-shell"><canvas class="network-graph-canvas" tabindex="0"></canvas><div class="network-tooltip" hidden></div></div><div class="network-scene-meta"></div><div class="building-legend"></div><p class="network-selection"></p><p class="network-legend">Gerichtete Kanten · algorithmisches Layout, keine tatsächliche Entfernung</p></div></main><script>${source}<\/script><script>window.NXTNetworkViz.mount(document.querySelector('.network-scene'),${safePayload});<\/script></body></html>`;
  }
  window.NXTNetworkTools={components,filter,statistics,assortativity,textAnalysis,graphML,parseGraphML,saveFile,standaloneHtml,esc};
})();
