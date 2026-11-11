/* NXT Netzwerkforschung: self-contained interactive 3D graph (no third-party CDN).
   The display is exploratory. 3D coordinates are layout coordinates, not locations. */
(() => {
  'use strict';
  const controllers = new Set();
  const palette = ['#008b92','#335f9e','#ad7b38','#825fa6','#398878','#ad647c','#4c7791','#647c4a'];
  const sharedView = {yaw:-0.38,pitch:0.25,zoom:1.26};
  const clamp = (v,a,b) => Math.min(b,Math.max(a,v));
  function hash(str){let h=2166136261;for(const ch of String(str)){h^=ch.charCodeAt(0);h=Math.imul(h,16777619)}return h>>>0}
  function colorFor(building){return palette[hash(building||'?')%palette.length]}
  function normalizedLayout(nodes,edges,layout){
    const n=nodes.length;
    if(layout==='circle')return nodes.map((node,i)=>{
      const a=i*2*Math.PI/Math.max(1,n)-Math.PI/2;
      return {x:Math.cos(a)*0.84,y:Math.sin(a)*0.84,z:0};
    });
    const fgroups=[...new Set(nodes.map(n=>n.building))].sort();
    const centroid=new Map(fgroups.map((g,i)=>{
      const a=i*2*Math.PI/Math.max(1,fgroups.length);
      return [g,{x:0.74*Math.cos(a),y:0.50*Math.sin(a),z:.37*Math.sin(a+1.7)}];
    }));
    const coords=nodes.map((node,i)=>{
      const z=1-2*(i+.5)/Math.max(1,n),a=(i+1)*2.399963229728653;
      const s=Math.sqrt(Math.max(0,1-z*z));
      if(layout==='building'){
        const c=centroid.get(node.building),r=.15;
        return {x:c.x+r*s*Math.cos(a),y:c.y+r*s*Math.sin(a),z:c.z+r*z};
      }
      return {x:s*Math.cos(a)*.75,y:s*Math.sin(a)*.75,z:z*.75};
    });
    if(layout==='building'||n>90||edges.length===0)return coords;
    // Deterministic spring layout. Drawn in 3D; iterations are bounded for tablets.
    const index=new Map(nodes.map((node,i)=>[node.id,i]));
    const links=edges.map(e=>[index.get(e.source),index.get(e.target)]).filter(([a,b])=>a!==undefined&&b!==undefined&&a!==b);
    for(let iter=0;iter<125;iter++){
      const d=coords.map(()=>({x:0,y:0,z:0}));
      for(let a=0;a<n;a++)for(let b=a+1;b<n;b++){
        const ax=coords[a].x-coords[b].x, ay=coords[a].y-coords[b].y, az=coords[a].z-coords[b].z;
        const ds=Math.max(.08,ax*ax+ay*ay+az*az),f=.00023/ds;
        d[a].x+=ax*f;d[a].y+=ay*f;d[a].z+=az*f;
        d[b].x-=ax*f;d[b].y-=ay*f;d[b].z-=az*f;
      }
      for(const [a,b] of links){
        const ax=coords[b].x-coords[a].x,ay=coords[b].y-coords[a].y,az=coords[b].z-coords[a].z;
        d[a].x+=ax*.0022;d[a].y+=ay*.0022;d[a].z+=az*.0022;
        d[b].x-=ax*.0022;d[b].y-=ay*.0022;d[b].z-=az*.0022;
      }
      coords.forEach((p,i)=>{p.x=clamp((p.x+d[i].x)*.999,-1,1);p.y=clamp((p.y+d[i].y)*.999,-1,1);p.z=clamp((p.z+d[i].z)*.999,-1,1)});
    }
    return coords;
  }
  function mount(el,{nodes=[],edges=[],prefs={}}){
    const canvas=el.querySelector('canvas');if(!canvas)return;
    const tooltip=el.querySelector('.network-tooltip');
    const selection=el.querySelector('.network-selection');
    const ctx=canvas.getContext('2d');if(!ctx)return;
    const view={...sharedView};
    const widthMax=()=>Math.max(300,canvas.clientWidth||800);
    const index=new Map(nodes.map((node,i)=>[node.id,i]));
    const points=normalizedLayout(nodes,edges,prefs.layout);
    let W=0,H=0,dpr=1, projected=[], drag=null,hover=-1,focus=-1,frame=0;
    let visible=true;
    const adjacent=new Map(nodes.map((n,i)=>[i,new Set()]));
    edges.forEach(e=>{const a=index.get(e.source),b=index.get(e.target);if(a!==undefined&&b!==undefined){adjacent.get(a).add(b);adjacent.get(b).add(a)}});
    const radius=n=>prefs.sizeMode==='degree'?clamp(5.5+Math.sqrt(Math.max(0,n.degree))*2,6,17):8;
    const twoD=prefs.layout==='circle';
    function size(){
      const rect=canvas.getBoundingClientRect();const nw=Math.max(300,rect.width||widthMax());
      const nh=Math.max(280,rect.height||Math.min(560,nw*.62));
      const ndpr=Math.min(2,window.devicePixelRatio||1);
      if(nw!==W||nh!==H||ndpr!==dpr){W=nw;H=nh;dpr=ndpr;canvas.width=Math.round(W*dpr);canvas.height=Math.round(H*dpr)}
    }
    function projection(p){
      const cy=Math.cos(view.yaw),sy=Math.sin(view.yaw),cp=Math.cos(view.pitch),sp=Math.sin(view.pitch);
      const x=p.x*cy+p.z*sy,z=-p.x*sy+p.z*cy;
      const y=p.y*cp-z*sp, z2=p.y*sp+z*cp;
      const f=twoD?1:3.7/(3.7-z2*(Number(prefs.depth??72)/100));
      const scale=Math.min(W*.44,H*.44)*view.zoom*f;
      return {x:W/2+x*scale,y:H/2+y*scale,z:z2,s:f};
    }
    function drawLine(a,b,color,width,alpha,arrow){
      const dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy);
      if(d<1)return;
      const tx=b.x-dx/d*arrow,ty=b.y-dy/d*arrow;
      ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(tx,ty);
      ctx.lineWidth=width;ctx.strokeStyle=color;ctx.globalAlpha=alpha;ctx.stroke();
      // An arrowhead near the target preserves the directed meaning.
      const angle=Math.atan2(dy,dx),tip=clamp(5+width,5,10);
      ctx.beginPath();ctx.moveTo(tx,ty);ctx.lineTo(tx-tip*Math.cos(angle-.46),ty-tip*Math.sin(angle-.46));
      ctx.lineTo(tx-tip*Math.cos(angle+.46),ty-tip*Math.sin(angle+.46));ctx.closePath();ctx.fillStyle=color;ctx.fill();ctx.globalAlpha=1;
    }
    function draw(){
      frame=0;if(!canvas.isConnected||!visible)return;
      size(); ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,W,H);
      const g=ctx.createRadialGradient(W*.5,H*.42,5,W*.5,H*.5,Math.max(W,H)*.65);
      g.addColorStop(0,'#eaf9f7');g.addColorStop(1,'#f9fcfd');ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
      projected=points.map(projection);
      if(!twoD){
        ctx.strokeStyle='rgba(0,139,146,.12)';ctx.lineWidth=1.15;
        for(const radius of [.29,.39]){ctx.beginPath();ctx.ellipse(W/2,H/2,Math.min(W,H)*radius,Math.min(W,H)*radius*.5,0,0,2*Math.PI);ctx.stroke()}
      }
      const sortedEdges=edges.slice().sort((a,b)=>((projected[index.get(a.source)]?.z||0)+(projected[index.get(a.target)]?.z||0))-((projected[index.get(b.source)]?.z||0)+(projected[index.get(b.target)]?.z||0)));
      sortedEdges.forEach(edge=>{
        const a=index.get(edge.source),b=index.get(edge.target);if(a===undefined||b===undefined)return;
        const emph=focus>=0?(a===focus||b===focus):hover>=0?(a===hover||b===hover):true;
        drawLine(projected[a],projected[b],emph?'#069298':'#9bb7bb',emph?1.8:1.1,emph?.52:.07,radius(nodes[b])*projected[b].s+2);
      });
      const ordered=nodes.map((node,i)=>i).sort((a,b)=>projected[a].z-projected[b].z);
      for(const i of ordered){
        const node=nodes[i],p=projected[i],near=focus===i||hover===i;
        const unrelated=focus>=0&&i!==focus&&!adjacent.get(focus).has(i);
        const r=radius(node)*p.s*(near?1.2:1);
        ctx.globalAlpha=unrelated?.22:node.degree===0?.58:1;
        ctx.beginPath();ctx.arc(p.x,p.y,r,0,Math.PI*2);ctx.fillStyle=colorFor(node.building);ctx.fill();
        ctx.lineWidth=near?3.5:2;ctx.strokeStyle='#fff';ctx.stroke();
        if(near){ctx.beginPath();ctx.arc(p.x,p.y,r+5,0,Math.PI*2);ctx.strokeStyle='#45a5a6';ctx.lineWidth=2;ctx.stroke()}
        ctx.globalAlpha=1;
        if(prefs.labels&&(!unrelated||focus<0)){
          const label=node.code||String(i+1);ctx.font=(near?'700 12px':'600 11px')+' Inter, Segoe UI, sans-serif';ctx.textAlign='center';
          const textW=ctx.measureText(label).width;
          const bx=p.x,by=p.y+r+13;
          ctx.fillStyle='rgba(255,255,255,.81)';ctx.fillRect(bx-textW/2-3,by-10,textW+6,14);
          ctx.fillStyle='#355c65';ctx.fillText(label,bx,by);
        }
      }
      ctx.textAlign='left';ctx.font='600 11px Inter, Segoe UI, sans-serif';ctx.fillStyle='#77959a';
      ctx.fillText(twoD?'2D-Ansicht':'3D-Ansicht · mit Maus oder Finger drehen',18,H-17);
    }
    function schedule(){if(!frame)frame=window.requestAnimationFrame(draw)}
    function pointAt(x,y){let best=-1,dist=Infinity;
      projected.forEach((p,i)=>{const d=Math.hypot(x-p.x,y-p.y),r=radius(nodes[i])*p.s+10;if(d<r&&d<dist){best=i;dist=d}});
      return best;
    }
    function details(i,html=false){if(i<0)return '';const node=nodes[i];
      if(html)return `<strong>${node.code}</strong><span>${node.label}</span><small>In ${node.inDegree} · Out ${node.outDegree} · Gebäude ${node.building}</small>`;
      return `${node.code} · ${node.label}: ${node.inDegree} eingehend, ${node.outDegree} ausgehend`;
    }
    function setFocus(i){focus=i;if(selection){selection.textContent=i<0?'Knoten auswählen, um Beziehungen hervorzuheben.':details(i);selection.title=selection.textContent}schedule()}
    function mousePos(e){const r=canvas.getBoundingClientRect();return {x:e.clientX-r.left,y:e.clientY-r.top}}
    function pointerDown(e){if(e.button!==0&&e.pointerType==='mouse')return;const p=mousePos(e);drag={x:p.x,y:p.y,startX:p.x,startY:p.y,yaw:view.yaw,pitch:view.pitch,moved:false};canvas.setPointerCapture?.(e.pointerId)}
    function pointerMove(e){const p=mousePos(e);if(drag){
      const dx=p.x-drag.x,dy=p.y-drag.y;
      if(Math.abs(dx)>3||Math.abs(dy)>3)drag.moved=true;
      if(!twoD){view.yaw=drag.yaw+dx*.009;view.pitch=clamp(drag.pitch+dy*.008,-1.43,1.43);sharedView.yaw=view.yaw;sharedView.pitch=view.pitch}
      schedule();return;
    }
      const i=pointAt(p.x,p.y);if(i!==hover){hover=i;canvas.style.cursor=i>=0?'pointer':twoD?'default':'grab';
        if(tooltip){tooltip.hidden=i<0;if(i>=0){tooltip.textContent=details(i);tooltip.style.left=clamp(p.x+12,8,W-225)+'px';tooltip.style.top=clamp(p.y-32,8,H-65)+'px'}}schedule();}
    }
    function pointerUp(e){if(!drag)return;const moved=drag.moved;drag=null;try{canvas.releasePointerCapture(e.pointerId)}catch(_e){};if(!moved){const p=mousePos(e);setFocus(pointAt(p.x,p.y))}}
    function wheel(e){e.preventDefault();view.zoom=clamp(view.zoom*(e.deltaY<0?1.09:.92),.46,2.4);sharedView.zoom=view.zoom;schedule()}
    function keydown(e){let handled=true;if(e.key==='ArrowLeft')view.yaw-=.17;else if(e.key==='ArrowRight')view.yaw+=.17;else if(e.key==='ArrowUp')view.pitch=clamp(view.pitch-.17,-1.43,1.43);else if(e.key==='ArrowDown')view.pitch=clamp(view.pitch+.17,-1.43,1.43);else if(e.key==='+'||e.key==='=')view.zoom=clamp(view.zoom*1.12,.46,2.4);else if(e.key==='-')view.zoom=clamp(view.zoom*.88,.46,2.4);else if(e.key==='Escape')setFocus(-1);else handled=false;
      if(handled){e.preventDefault();sharedView.yaw=view.yaw;sharedView.pitch=view.pitch;sharedView.zoom=view.zoom;schedule()}}
    canvas.addEventListener('pointerdown',pointerDown);
    canvas.addEventListener('pointermove',pointerMove);
    canvas.addEventListener('pointerup',pointerUp);
    canvas.addEventListener('pointercancel',pointerUp);
    canvas.addEventListener('wheel',wheel,{passive:false});
    canvas.addEventListener('keydown',keydown);
    const observer=typeof ResizeObserver!=='undefined'?new ResizeObserver(schedule):null;
    observer?.observe(canvas);schedule();
    const c={destroy(){observer?.disconnect();cancelAnimationFrame(frame);canvas.removeEventListener('pointerdown',pointerDown);canvas.removeEventListener('pointermove',pointerMove);canvas.removeEventListener('pointerup',pointerUp);canvas.removeEventListener('pointercancel',pointerUp);canvas.removeEventListener('wheel',wheel);canvas.removeEventListener('keydown',keydown)}};
    controllers.add(c);return c;
  }
  function cleanup(){for(const c of controllers)c.destroy();controllers.clear()}
  window.NXTNetworkViz={mount,cleanup,colorFor};
})();
