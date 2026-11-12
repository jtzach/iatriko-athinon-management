'use strict';
(() => {
  const $=id=>document.getElementById(id), esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const NS='http://www.w3.org/2000/svg';
  const labels={person:'Πρόσωπο',role:'Ρόλος',unit:'Μονάδα',function:'Πεδίο ευθύνης',body:'Όργανο διοίκησης'};
  const verbs={HOLDS_ROLE:'κατέχει ρόλο',RESPONSIBLE_FOR:'έχει αρμοδιότητα',REPORTS_TO:'αναφέρεται σε',MEMBER_OF:'συμμετέχει σε'};
  let data,byId,sources,year=2025,mode='people',person='overview',structure='main',selected=null,visibleNodes=[],visibleEdges=[],zoom=1,viewWidth=1000,viewHeight=640,drag=null,topologySignature='';
  const positions=new Map();
  const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
  const mobileView=matchMedia('(max-width:760px)');
  let motionEnabled=!reducedMotion.matches,animationId=null,lastFrame=0,hoveredNode=null,focusedNode=null;
  const nodeElements=new Map(),nodeBounds=new Map(),edgeElements=[];
  const PERSON_RADIUS=56;
  const make=(tag,attrs={})=>{const n=document.createElementNS(NS,tag);Object.entries(attrs).forEach(([k,v])=>n.setAttribute(k,v));return n;};
  const yearData=()=>data.years.find(y=>Number(y.year)===year);
  const yearly=()=>data.observations.filter(o=>Number(o.year)===year);
  const isPerson=n=>n?.type==='person';
  const posKey=id=>year+':'+mode+':'+id;
  function sourceLinks(ids){return [...new Set(ids||[])].map(id=>{const s=sources.get(id);if(!s)return '';const page=s.pdfPage||Number((s.url?.match(/#page=(\d+)/)||[])[1]);const href=s.url+(page&&!s.url.includes('#')?'#page='+page:'');return '<a href="'+esc(href)+'" target="_blank" rel="noopener noreferrer" title="'+esc(s.title)+'">'+(page?'σ. '+page:'Πηγή')+' ↗</a>';}).join('');}
  function availablePeople(){const active=new Set(yearly().flatMap(e=>[e.source,e.target]));return data.nodes.filter(n=>isPerson(n)&&active.has(n.id)).sort((a,b)=>a.label.localeCompare(b.label,'el'));}
  function updateFilters(){
    if(mode==='structure'){
      const hasChart=yearly().some(e=>e.reportingMode==='organizational_chart');
      if(!hasChart&&structure==='main')structure='audit';
      $('person-filter').innerHTML=(hasChart?'<option value="main">Διευθύνσεις Ομίλου</option>':'')+'<option value="audit">Έλεγχος & διακυβέρνηση</option><option value="all">Όλες οι γραμμές αναφοράς</option>';
      $('person-filter').value=structure;$('person-filter').disabled=false;$('person-filter').setAttribute('aria-label','Εστίαση στη δομή');return;
    }
    const people=availablePeople();
    if(person!=='overview'&&person!==''&&!people.some(p=>p.id===person))person='overview';
    $('person-filter').innerHTML='<option value="overview">Επισκόπηση</option><option value="">Όλα τα πρόσωπα</option>'+people.map(n=>'<option value="'+esc(n.id)+'">'+esc(n.label)+'</option>').join('');
    $('person-filter').value=person;$('person-filter').disabled=false;$('person-filter').setAttribute('aria-label','Εστίαση σε πρόσωπο');
  }
  function selectView(){
    const all=yearly();
    if(mode==='structure'){
      visibleEdges=all.filter(e=>e.type==='REPORTS_TO'&&e.reportingMode!=='information_flow'&&(structure==='all'||structure==='main'&&e.reportingMode==='organizational_chart'||structure==='audit'&&e.reportingMode!=='organizational_chart'));
      const structural=new Set(visibleEdges.flatMap(e=>[e.source,e.target]));
      // Add only a selected role's published remit; don't infer a reporting line from a job title.
      if(selected)visibleEdges.push(...all.filter(e=>e.type==='RESPONSIBLE_FOR'&&structural.has(e.source)&&e.source===selected));
    }else{
      let people=availablePeople();
      if(person==='overview'){
        const weight=n=>(/apostol|αποστολο/i.test(n.id+' '+n.label)?100:0)+(/talar|τάλαρ/i.test(n.id+' '+n.label)?90:0)+all.filter(e=>e.source===n.id).length;
        people=people.sort((a,b)=>weight(b)-weight(a)||a.label.localeCompare(b.label,'el')).slice(0,4);
      }else if(person)people=people.filter(n=>n.id===person);
      const ids=new Set(people.map(n=>n.id));
      visibleEdges=all.filter(e=>ids.has(e.source)&&['HOLDS_ROLE','MEMBER_OF','RESPONSIBLE_FOR'].includes(e.type));
      const roles=new Set(visibleEdges.map(e=>e.target));
      if(selected||person&&person!=='overview'){
        const focusRoles=new Set(all.filter(e=>e.source===(selected||person)&&e.type==='HOLDS_ROLE').map(e=>e.target));
        if(roles.has(selected))focusRoles.add(selected);
        visibleEdges.push(...all.filter(e=>focusRoles.has(e.source)&&e.type==='RESPONSIBLE_FOR'));
      }
    }
    visibleEdges=[...new Map(visibleEdges.map(e=>[e.id,e])).values()];
    const nodeIds=new Set(visibleEdges.flatMap(e=>[e.source,e.target]));
    visibleNodes=data.nodes.filter(n=>nodeIds.has(n.id));
  }
  // Bounds include the complete rendered label, portrait/card and a clear gutter.
  function measureNodes(){
    nodeBounds.clear();
    for(const n of visibleNodes){
      const g=nodeElements.get(n.id),label=g.querySelector('.node-label'),t=label.getBBox();
      if(isPerson(n)){
        const back=make('rect',{class:'person-label-backdrop',x:t.x-7,y:t.y-5,width:t.width+14,height:t.height+10,rx:6});
        g.insertBefore(back,label);
      }else{
        const rect=g.querySelector('.node-shell'),left=Math.min(-100,t.x-16),top=Math.min(-40,t.y-14);
        rect.setAttribute('x',left);rect.setAttribute('y',top);
        rect.setAttribute('width',Math.max(100,t.x+t.width+16)-left);
        rect.setAttribute('height',Math.max(40,t.y+t.height+14)-top);
      }
      const b=g.getBBox(),pad=12;
      nodeBounds.set(n.id,{x:b.x-pad,y:b.y-pad,width:b.width+pad*2,height:b.height+pad*2});
    }
  }
  function computePositions(){
    const bounds=n=>nodeBounds.get(n.id),gap=30,margin=40;
    let groups;
    viewWidth=1000;
    if(mode==='structure'){
      const level=new Map(visibleNodes.map(n=>[n.id,0]));
      for(let i=0;i<6;i++){let changed=false;for(const e of visibleEdges.filter(e=>e.type==='REPORTS_TO')){const next=Math.min(6,(level.get(e.target)||0)+1);if((level.get(e.source)||0)<next){level.set(e.source,next);changed=true;}}if(!changed)break;}
      groups=Array.from({length:Math.max(0,...level.values())+1},(_,i)=>visibleNodes.filter(n=>level.get(n.id)===i));
      const rows=[];
      for(const group of groups){let row=[],width=0;for(const n of group){const w=bounds(n).width;if(row.length&&width+gap+w>viewWidth-margin*2){rows.push(row);row=[];width=0;}row.push(n);width+=(row.length>1?gap:0)+w;}if(row.length)rows.push(row);}
      viewWidth=Math.max(viewWidth,...visibleNodes.map(n=>bounds(n).width+margin*2));
      viewHeight=Math.max(640,margin*2+rows.reduce((sum,row)=>sum+Math.max(...row.map(n=>bounds(n).height))+gap,0));
      let y=margin;
      for(const row of rows){const height=Math.max(...row.map(n=>bounds(n).height)),width=row.reduce((sum,n)=>sum+bounds(n).width,0)+gap*(row.length-1);let x=(viewWidth-width)/2;
        for(const n of row){const b=bounds(n),key=posKey(n.id);if(!positions.has(key))positions.set(key,{x:x-b.x,y:y-b.y+(height-b.height)/2});x+=b.width+gap;}y+=height+gap;}
    }else{
      groups=[visibleNodes.filter(isPerson),visibleNodes.filter(n=>n.type==='role'||n.type==='body'),visibleNodes.filter(n=>!['person','role','body'].includes(n.type))];
      groups[1].sort((a,b)=>{const owner=id=>groups[0].findIndex(n=>visibleEdges.some(e=>e.source===n.id&&e.target===id));return owner(a.id)-owner(b.id);});
      groups[2].sort((a,b)=>{const owner=id=>groups[1].findIndex(n=>visibleEdges.some(e=>e.source===n.id&&e.target===id));return owner(a.id)-owner(b.id);});
      groups=groups.filter(g=>g.length);
      const widths=groups.map(g=>Math.max(...g.map(n=>bounds(n).width))),heights=groups.map(g=>g.reduce((sum,n)=>sum+bounds(n).height,0)+gap*(g.length-1));
      viewWidth=Math.max(1000,widths.reduce((a,b)=>a+b,0)+80*(groups.length+1));
      viewHeight=Math.max(720,...heights.map(h=>h+margin*2));
      const gutter=(viewWidth-widths.reduce((a,b)=>a+b,0))/(groups.length+1||1);let x=gutter;
      groups.forEach((group,i)=>{const extra=(viewHeight-margin*2-heights[i])/Math.max(1,group.length-1);let y=group.length===1?(viewHeight-bounds(group[0]).height)/2:margin;
        for(const n of group){const b=bounds(n),key=posKey(n.id);if(!positions.has(key))positions.set(key,{x:x+(widths[i]-b.width)/2-b.x,y:y-b.y});y+=b.height+gap+extra;}x+=widths[i]+gutter;});
    }
  }
  function linesFor(text,max=24){const words=String(text).split(/\s+/),lines=[''];for(const word of words){if((lines.at(-1)+' '+word).trim().length>max&&lines.at(-1))lines.push(word);else lines[lines.length-1]=(lines.at(-1)+' '+word).trim();}return lines.length>3?[...lines.slice(0,2),lines[2].slice(0,max-1)+'…']:lines;}
  function makeNode(n){
    const g=make('g',{class:'graph-node '+n.type,'data-node':n.id,tabindex:0,role:'button','aria-label':n.label+' — '+(labels[n.type]||n.type)});
    if(isPerson(n)){
      g.appendChild(make('circle',{r:PERSON_RADIUS,class:'node-shell'}));
      if(n.imageUrl){const clip=make('clipPath',{id:'clip-'+n.id});clip.appendChild(make('circle',{r:52}));g.appendChild(clip);const img=make('image',{href:n.imageUrl,x:-52,y:-52,width:104,height:104,preserveAspectRatio:'xMidYMin slice','clip-path':'url(#clip-'+n.id+')'});img.addEventListener('error',()=>img.remove());g.appendChild(img);}
      const initials=make('text',{class:'initials',y:7,'aria-hidden':true});initials.textContent=n.label.split(/\s+/).slice(0,2).map(w=>w[0]).join('');g.insertBefore(initials,g.children[1]||null);
    }else g.appendChild(make('rect',{x:-100,y:-40,width:200,height:80,rx:n.type==='role'?12:22,class:'node-shell'}));
    const text=make('text',{class:'node-label','aria-hidden':true});
    const ls=linesFor(n.label,isPerson(n)?24:23),start=isPerson(n)?79:-(ls.length-1)*9+5;
    ls.forEach((line,i)=>{const span=make('tspan',{x:0,y:start+i*18});span.textContent=line;text.appendChild(span);});g.appendChild(text);
    const title=make('title');title.textContent=n.label;g.appendChild(title);
    g.addEventListener('pointerdown',e=>startDrag(e,n.id));
    g.addEventListener('pointerenter',()=>{hoveredNode=n.id;syncMotion();});
    g.addEventListener('pointerleave',()=>{if(hoveredNode===n.id)hoveredNode=null;syncMotion();});
    g.addEventListener('focus',()=>{focusedNode=n.id;syncMotion();});
    g.addEventListener('blur',()=>{if(focusedNode===n.id)focusedNode=null;syncMotion();});
    g.addEventListener('click',e=>{if(drag?.moved)return;selectNode(n.id);});
    g.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();selectNode(n.id);}if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();const p=positions.get(posKey(n.id)),step=e.shiftKey?30:10;const x=p.x+(e.key==='ArrowLeft'?-step:e.key==='ArrowRight'?step:0),y=p.y+(e.key==='ArrowUp'?-step:e.key==='ArrowDown'?step:0);moveNode(n,x,y);p.homeX=p.x;p.homeY=p.y;p.vx=p.vy=0;drawPositions();}});
    return g;
  }
  function renderGraph(){
    stopMotion();hoveredNode=null;focusedNode=null;
    selectView();const signature=[year,mode,structure,visibleNodes.map(n=>n.id).sort().join(',')].join('|'),topologyChanged=signature!==topologySignature;
    if(topologyChanged){for(const k of positions.keys())if(k.startsWith(year+':'+mode+':'))positions.delete(k);topologySignature=signature;}
    $('graph-nodes').replaceChildren();$('graph-edges').replaceChildren();
    nodeElements.clear();edgeElements.length=0;
    for(const e of visibleEdges){const g=make('g',{class:'graph-edge','data-edge':e.id,'data-type':e.type,'data-reporting':e.reportingMode||''});const line=make('line');g.appendChild(line);const t=make('text');t.textContent=e.evidenceStatus==='role_scope'?'Πεδίο ρόλου':e.type==='REPORTS_TO'?(e.reportingMode==='functional'?'Λειτουργική αναφορά':e.reportingMode==='organizational_chart'?'Οργανωτική αναφορά':e.label):e.label||verbs[e.type]||e.type;const title=make('title');title.textContent=t.textContent;g.appendChild(title);$('graph-edges').appendChild(g);edgeElements.push({edge:e,line});}
    visibleNodes.forEach(n=>{const g=makeNode(n);nodeElements.set(n.id,g);$('graph-nodes').appendChild(g);});
    measureNodes();computePositions();visibleNodes.forEach((n,i)=>{const p=positions.get(posKey(n.id));if(p.homeX===undefined)Object.assign(p,{homeX:p.x,homeY:p.y,vx:0,vy:0,phase:i*2.399});constrain(n,p);});updateViewBox();drawPositions();highlight();
    if(topologyChanged){$('org-stage').scrollTop=0;$('org-stage').scrollLeft=0;}
    const noData=!visibleNodes.length;$('empty-state').hidden=!noData;
    if(noData)$('empty-state').querySelector('b').textContent=mode==='structure'?'Δεν έχουμε τεκμηριωμένες γραμμές αναφοράς γι’ αυτό το έτος.':'Δεν έχουμε τεκμηρίωση γι’ αυτό το έτος.';
    $('graph-list').innerHTML='<ul>'+visibleNodes.map(n=>'<li><button data-select="'+esc(n.id)+'">'+esc(n.label)+'</button><small>'+esc(labels[n.type]||n.type)+'</small></li>').join('')+'</ul>';
    $('graph-description').textContent=year+'. '+visibleNodes.length+' κόμβοι, '+visibleEdges.length+' τεκμηριωμένες σχέσεις. Η θέση στον καμβά δεν δηλώνει ιεραρχία.';
    document.querySelector('.graph-legend').innerHTML=mode==='people'?'<span class="person-key">Πρόσωπο</span><span class="role-key">Ρόλος</span><span class="unit-key">Μονάδα / πεδίο</span>':'<span class="line-key">Διοικητική / οργανωτική</span><span class="dashed-key">Λειτουργική</span>';
    if(topologyChanged)requestAnimationFrame(()=>{if(selected&&nodeElements.has(selected))focusSelectedNode();else if(mobileView.matches)focusMobileCanvas();});
    syncMotion();
  }
  function updateViewBox(keepCenter=false){
    const stage=$('org-stage'),svg=$('org-svg'),oldWidth=svg.clientWidth,oldHeight=svg.clientHeight;
    const cx=(stage.scrollLeft+stage.clientWidth/2)/(oldWidth||1),cy=(stage.scrollTop+stage.clientHeight/2)/(oldHeight||1);
    const scale=Math.max(900,stage.clientWidth)/1000*zoom;
    svg.setAttribute('viewBox',`0 0 ${viewWidth} ${viewHeight}`);
    svg.style.width=(viewWidth*scale)+'px';svg.style.height=(viewHeight*scale)+'px';
    $('zoom-reset').textContent=Math.round(zoom*100)+'%';
    if(keepCenter){stage.scrollLeft=cx*svg.clientWidth-stage.clientWidth/2;stage.scrollTop=cy*svg.clientHeight-stage.clientHeight/2;}
  }
  function focusSelectedNode(){
    if(!selected||!nodeElements.has(selected))return;
    const stage=$('org-stage'),p=positions.get(posKey(selected)),b=nodeBounds.get(selected),scale=$('org-svg').clientWidth/viewWidth;
    stage.scrollLeft=Math.max(0,(p.x+b.x+b.width/2)*scale-stage.clientWidth*.38);
    stage.scrollTop=Math.max(0,(p.y+b.y+b.height/2)*scale-stage.clientHeight/2);
  }
  function focusMobileCanvas(){
    if(!mobileView.matches||!data)return;
    const stage=$('org-stage'),svg=$('org-svg');
    if(mode==='structure'){stage.scrollLeft=(svg.clientWidth-stage.clientWidth)/2;return;}
    const people=visibleNodes.filter(isPerson);if(!people.length){stage.scrollLeft=0;return;}
    const left=Math.min(...people.map(n=>positions.get(posKey(n.id)).x)),scale=Math.min(svg.clientWidth/viewWidth,svg.clientHeight/viewHeight);
    stage.scrollLeft=Math.max(0,left*scale-stage.clientWidth*.38);
  }
  function drawPositions(){
    for(const n of visibleNodes){const p=positions.get(posKey(n.id));nodeElements.get(n.id)?.setAttribute('transform',`translate(${p.x.toFixed(2)},${p.y.toFixed(2)})`);}
    for(const {edge:e,line:l} of edgeElements){const a=positions.get(posKey(e.source)),b=positions.get(posKey(e.target));if(!a||!b)continue;const dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy)||1;const border=(id,direction)=>{if(isPerson(byId.get(id)))return PERSON_RADIUS+3;const box=nodeBounds.get(id),ux=dx/len*direction,uy=dy/len*direction;return Math.min((ux>=0?box.x+box.width-12:-box.x-12)/(Math.abs(ux)||.00001),(uy>=0?box.y+box.height-12:-box.y-12)/(Math.abs(uy)||.00001))+3;};const start=Math.min(len/2,border(e.source,1)),end=Math.min(len/2,border(e.target,-1)+3);Object.entries({x1:a.x+dx/len*start,y1:a.y+dy/len*start,x2:b.x-dx/len*end,y2:b.y-dy/len*end}).forEach(([k,v])=>l.setAttribute(k,v.toFixed(2)));}
  }
  function constrain(n,p){const b=nodeBounds.get(n.id);if(!b)return;p.x=Math.max(16-b.x,Math.min(viewWidth-16-b.x-b.width,p.x));p.y=Math.max(16-b.y,Math.min(viewHeight-16-b.y-b.height,p.y));}
  // Swept rectangles stop movement at the first collision, even during fast dragging,
  // paused animation or keyboard movement. Previously valid positions never overlap.
  function moveNode(n,x,y){
    const p=positions.get(posKey(n.id)),a=nodeBounds.get(n.id),target={x,y};constrain(n,target);
    const dx=target.x-p.x,dy=target.y-p.y;let fraction=1;
    for(const other of visibleNodes){if(other.id===n.id)continue;const q=positions.get(posKey(other.id)),b=nodeBounds.get(other.id);
      const limits=[[p.x,dx,q.x+b.x-a.x-a.width,q.x+b.x+b.width-a.x],[p.y,dy,q.y+b.y-a.y-a.height,q.y+b.y+b.height-a.y]];
      let enter=-Infinity,leave=Infinity,hit=true;
      for(const [origin,delta,low,high] of limits){if(Math.abs(delta)<1e-9){if(origin<=low||origin>=high){hit=false;break;}}else{const t1=(low-origin)/delta,t2=(high-origin)/delta;enter=Math.max(enter,Math.min(t1,t2));leave=Math.min(leave,Math.max(t1,t2));}}
      if(hit&&enter<=leave&&leave>0&&enter>=-1e-7&&enter<fraction)fraction=Math.max(0,enter-.002);
    }
    p.x+=dx*fraction;p.y+=dy*fraction;if(fraction<1)p.vx=p.vy=0;
  }
  function canMove(){return !!data&&motionEnabled&&!reducedMotion.matches&&mode==='people'&&visibleNodes.length>0&&!document.hidden&&!$('org-dialog').open&&(!hoveredNode||!!drag)&&(!focusedNode||!!drag);}
  function stopMotion(){if(animationId!==null)cancelAnimationFrame(animationId);animationId=null;lastFrame=0;}
  function syncMotion(){
    const button=$('motion-toggle');if(!button)return;
    button.disabled=mode!=='people'||reducedMotion.matches||!visibleNodes.length;
    button.textContent=mode!=='people'?'Σταθερή δομή':reducedMotion.matches?'Μειωμένη κίνηση':motionEnabled?'Ⅱ Παύση κίνησης':'▶ Κίνηση';
    button.setAttribute('aria-pressed',String(motionEnabled&&!button.disabled));
    document.body.classList.toggle('motion-active',canMove());
    if(canMove()){if(animationId===null)animationId=requestAnimationFrame(animate);}else stopMotion();
  }
  function animate(time){
    animationId=null;if(!canMove()){lastFrame=0;return;}
    if(lastFrame&&time-lastFrame<30){animationId=requestAnimationFrame(animate);return;}
    const dt=lastFrame?Math.min(1.5,(time-lastFrame)/33.33):1;lastFrame=time;
    const nodes=visibleNodes.map(n=>({n,p:positions.get(posKey(n.id))}));
    for(const {n,p} of nodes){
      p.vx+=(p.homeX-p.x)*.003*dt;p.vy+=(p.homeY-p.y)*.003*dt;
      if(isPerson(n)){p.vx+=Math.sin(time/2300+p.phase)*.085*dt;p.vy+=Math.cos(time/3100+p.phase)*.07*dt;}
    }
    // Gentle springs react to dragging. They express visual proximity, never additional authority.
    for(const e of visibleEdges){const a=positions.get(posKey(e.source)),b=positions.get(posKey(e.target)),dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy)||1,target=isPerson(byId.get(e.source))?265:235,f=Math.max(-1.4,Math.min(1.4,(d-target)*.005))*dt;
      a.vx+=dx/d*f;a.vy+=dy/d*f;b.vx-=dx/d*f;b.vy-=dy/d*f;}
    for(let i=0;i<nodes.length;i++)for(let j=i+1;j<nodes.length;j++){
      const a=nodes[i],b=nodes[j],dx=b.p.x-a.p.x,dy=b.p.y-a.p.y,d2=Math.max(900,dx*dx+dy*dy),repel=650/d2*dt,dist=Math.sqrt(d2);
      a.p.vx-=dx/dist*repel;a.p.vy-=dy/dist*repel;b.p.vx+=dx/dist*repel;b.p.vy+=dy/dist*repel;
    }
    for(const {n,p} of nodes){if(drag?.id===n.id){p.vx=p.vy=0;continue;}p.vx=Math.max(-4,Math.min(4,p.vx*.72));p.vy=Math.max(-4,Math.min(4,p.vy*.72));moveNode(n,p.x+p.vx*dt,p.y+p.vy*dt);}
    drawPositions();animationId=requestAnimationFrame(animate);
  }
  function point(e){const p=new DOMPoint(e.clientX,e.clientY);return p.matrixTransform($('org-svg').getScreenCTM().inverse());}
  function startDrag(e,id){if(e.button!==0)return;const p=point(e),n=positions.get(posKey(id));drag={id,pointer:e.pointerId,x:p.x,y:p.y,ox:n.x,oy:n.y,moved:false,element:e.currentTarget};n.vx=n.vy=0;e.currentTarget.setPointerCapture(e.pointerId);e.currentTarget.classList.add('dragging');syncMotion();}
  $('org-svg').addEventListener('pointermove',e=>{if(!drag||e.pointerId!==drag.pointer)return;const p=point(e),dx=p.x-drag.x,dy=p.y-drag.y;if(Math.hypot(dx,dy)>4)drag.moved=true;moveNode(byId.get(drag.id),drag.ox+dx,drag.oy+dy);drawPositions();});
  function endDrag(){if(!drag)return;drag.element.classList.remove('dragging');if(drag.moved){const name=byId.get(drag.id).label,p=positions.get(posKey(drag.id));p.homeX=p.x;p.homeY=p.y;$('org-status').textContent='Μετακινήθηκε: '+name;}setTimeout(()=>{drag=null;syncMotion();},0);}
  $('org-svg').addEventListener('pointerup',endDrag);$('org-svg').addEventListener('pointercancel',endDrag);
  function highlight(){
    const ids=new Set(selected?[selected]:[]);const connected=new Set();
    if(selected){visibleEdges.filter(e=>e.source===selected||e.target===selected).forEach(e=>{ids.add(e.source);ids.add(e.target);connected.add(e.id);});if(isPerson(byId.get(selected))){visibleEdges.filter(e=>ids.has(e.source)&&e.type==='RESPONSIBLE_FOR').forEach(e=>{ids.add(e.target);connected.add(e.id);});}}
    for(const n of $('graph-nodes').children){n.classList.toggle('selected',n.dataset.node===selected);n.classList.toggle('dimmed',!!selected&&!ids.has(n.dataset.node));n.setAttribute('aria-pressed',String(n.dataset.node===selected));}
    for(const e of $('graph-edges').children){e.classList.toggle('selected',connected.has(e.dataset.edge));e.classList.toggle('dimmed',!!selected&&!connected.has(e.dataset.edge));}
  }
  function selectNode(id){
    if(!byId.has(id))return;const focused=document.activeElement?.dataset.node;selected=id;if(isPerson(byId.get(id))&&!visibleNodes.some(n=>n.id===id)){person=id;updateFilters();}renderGraph();renderInspector();if(focused){const el=Array.from($('graph-nodes').children).find(n=>n.dataset.node===id);el?.focus({preventScroll:true});}$('org-status').textContent=byId.get(id).label;
  }
  function renderInspector(){
    const n=byId.get(selected);if(!n){$('inspector-content').innerHTML='<p class="eyebrow">'+(mode==='structure'?'ΓΡΑΜΜΕΣ ΑΝΑΦΟΡΑΣ':'ΕΞΕΡΕΥΝΗΣΤΕ')+'</p><h2>'+ (mode==='structure'?'Ποιος αναφέρεται<br>πού;':'Ένα πρόσωπο.<br>Οι συνδέσεις του.') +'</h2><p>Πατήστε έναν κόμβο για ρόλους, αρμοδιότητες και πηγές.</p><div class="inspector-hint">'+(mode==='structure'?'Μόνο ρητές σχέσεις υπαγωγής από τις πηγές.':'Η θέση στον καμβά δεν δηλώνει ιεραρχία.')+'</div>';return;}
    const edges=yearly().filter(e=>e.source===n.id||e.target===n.id);
    const years=[...new Set(data.observations.filter(e=>e.source===n.id||e.target===n.id).map(e=>Number(e.year)))].sort((a,b)=>a-b);
    const scopeLabel={company:'Εταιρεία',group:'Όμιλος',clinic:'Μονάδα',subsidiary:'Θυγατρική',mixed:'Πολλαπλά πεδία'};
    const temporalLabel={annual_disclosure:'Ετήσια δημοσίευση',retrospective_biography:'Αναδρομική αναφορά',dated_announcement:'Χρονολογημένη ανακοίνωση',dated_signature:'Υπογραφή έκθεσης'};
    const fmtDate=s=>s?/^\d{4}-\d{2}-\d{2}$/.test(s)?s.split('-').reverse().join('/'):/^\d{4}-\d{2}$/.test(s)?s.slice(5)+'/'+s.slice(0,4):s:'';
    const period=e=>[e.observedAt?'Καταγραφή '+fmtDate(e.observedAt):temporalLabel[e.temporalBasis]||'Καταγραφή '+year,e.validFrom?'Από '+fmtDate(e.validFrom):'',e.validTo?'Έως '+fmtDate(e.validTo):''].filter(Boolean).join(' · ');
    let html=(n.imageUrl?'<img class="inspector-photo" src="'+esc(n.imageUrl)+'" alt="'+esc(n.label)+'">':'')+'<div class="node-type">'+esc(labels[n.type]||n.type)+' · '+year+'</div><h2>'+esc(n.label)+'</h2>'+(n.scope?'<p class="scope-tag">'+esc(scopeLabel[n.scope]||n.scope)+'</p>':'');
    if(n.description)html+='<p>'+esc(n.description)+'</p>'+(n.descriptionType==='role_scope'?'<p><small>Πεδίο ρόλου· δεν συνάγονται πρόσθετες εξουσίες.</small></p>':'');
    html+='<ul class="connection-list">'+edges.map(e=>{const outbound=e.source===n.id,other=byId.get(outbound?e.target:e.source);return '<li><small>'+esc(e.evidenceStatus==='role_scope'?'Πεδίο ρόλου':outbound?(e.label||verbs[e.type]):e.type==='HOLDS_ROLE'?'Κάτοχος ρόλου':e.type==='REPORTS_TO'?'Αναφέρεται εδώ':e.label||verbs[e.type])+'</small><button data-select="'+esc(other?.id)+'">'+esc(other?.label||'')+'</button><small>'+esc(period(e))+'</small><div class="source-links">'+sourceLinks(e.sourceIds)+'</div>'+(e.limitations?.length?'<details><summary style="font-size:10px">Όρια καταγραφής</summary><p>'+esc(Array.isArray(e.limitations)?e.limitations.join(' '):e.limitations)+'</p></details>':'')+'</li>';}).join('')+'</ul>';
    if(!edges.length)html+='<p>Δεν υπάρχει καταγραφή για το επιλεγμένο έτος.</p>';
    html+='<div class="year-jumps" aria-label="Έτη τεκμηρίωσης">'+years.map(y=>'<button data-year="'+y+'" class="'+(year===y?'active':'')+'">'+y+'</button>').join('')+'</div>';
    if(n.sourceIds?.length)html+='<div class="source-links">'+sourceLinks(n.sourceIds)+'</div>';
    if(n.mediaSourceId&&sources.has(n.mediaSourceId))html+='<p><a style="font-size:10px" href="'+esc(sources.get(n.mediaSourceId).url)+'" target="_blank" rel="noopener noreferrer">Πηγή φωτογραφίας ↗</a></p>';
    html+='<p><button id="clear-selection" style="font-size:11px">Καθαρισμός επιλογής ×</button></p>';
    $('inspector-content').innerHTML=html;
  }
  function setYear(y){
    year=Math.max(1984,Math.min(2026,Number(y)));zoom=1;$('year-range').value=year;$('year-value').value=year;
    const d=yearData();$('coverage-label').textContent=d?.coverage==='snapshot'?'Δημοσιευμένο διάγραμμα + ρόλοι':d?.coverage==='partial'?'Μερική τεκμηρίωση':'Χωρίς τεκμήρια';$('coverage-label').title=d?.coverageLabel||'';
    $('coverage-count').textContent=yearly().length+' καταγραφές';
    $('year-marks').innerHTML=data.years.filter(y=>y.observationIds?.length&&([1984,2009,2022,2023,2024,2025,2026].includes(Number(y.year))||Number(y.year)===year)).map(y=>'<button data-year="'+y.year+'" class="'+(Number(y.year)===year?'active':'')+'">'+y.year+'</button>').join('');
    $('temporal-note').textContent=year===2026?'2026: διαθέσιμες καταγραφές έως 12/11. Όχι πλήρες έτος.':'Καταγραφές εντός έτους· όχι ταυτόχρονη πλήρης απογραφή.';
    $('year-prev').disabled=year===1984;$('year-next').disabled=year===2026;
    if(selected&&!yearly().some(e=>e.source===selected||e.target===selected))selected=null;
    updateFilters();renderGraph();renderInspector();
    history.replaceState(null,'','#'+year);$('org-status').textContent=year+' — '+$('coverage-label').textContent;
  }
  function openDialog(title,html){$('dialog-title').textContent=title;$('dialog-content').innerHTML=html;$('org-dialog').showModal();$('close-dialog').focus();syncMotion();}
  function showMethod(){
    const d=yearData();openDialog('Τι δείχνει το οργανόγραμμα;','<p>Δημόσια τεκμηριωμένες καταγραφές προσώπων, ρόλων και αρμοδιοτήτων. Τα έτη χωρίς πηγές παραμένουν κενά. Δεν προεκτείνουμε άγνωστες θητείες.</p><ul><li><b>Πρόσωπα & ρόλοι:</b> ποιος κατέχει τι, με ελεύθερη μετακίνηση κόμβων. Η θέση στον καμβά δεν δηλώνει ιεραρχία.</li><li><b>Δομή διοίκησης:</b> μόνο ρητές γραμμές αναφοράς από οργανόγραμμα ή κείμενο. Η απουσία ακμής σημαίνει έλλειψη τεκμηρίωσης.</li><li><b>Αρμοδιότητες:</b> δημοσιευμένη ευθύνη ή σαφώς σημειωμένο πεδίο του τίτλου, χωρίς εικασίες για εξουσίες.</li></ul><p>Οι καταγραφές του ίδιου έτους μπορεί να αφορούν διαφορετικές ημερομηνίες και διαδοχικούς κατόχους. Πατήστε πρόσωπο για την ακριβή περίοδο.</p>'+(d?.limitations?.length?'<p>'+esc(Array.isArray(d.limitations)?d.limitations.join(' '):d.limitations)+'</p>':'')+'<h3>Πηγές για το '+year+'</h3>'+[...new Set(yearly().flatMap(e=>e.sourceIds||[]))].map(id=>{const s=sources.get(id);return s?'<div class="source-detail"><a href="'+esc(s.url)+'" target="_blank" rel="noopener noreferrer">'+esc(s.title)+' ↗</a><small>'+esc(s.locator||s.published||'')+'</small>'+sourceLinks([id])+'</div>':'';}).join('')+'<p>Οι φωτογραφίες προέρχονται από το υπάρχον <a href="data/media-catalog.json">αρχείο επίσημων πηγών</a>. Δεν αποδίδουν κατ’ ανάγκη την εμφάνιση σε κάθε ιστορικό έτος.</p>');
  }
  function showGraphData(){
    const p=data.provenance||{};openDialog('Ο γράφος και η βάση Neo4j','<p>Η βάση Neo4j οργανώνει πρόσωπα, ρόλους και χρονικά τεκμηριωμένες σχέσεις. Η ιστοσελίδα εμφανίζει εξαγωγή της βάσης· οι μετακινήσεις αλλάζουν μόνο τη διάταξη στον περιηγητή.</p><p>Δεν υπάρχει δημόσια σύνδεση με τη βάση ή αποθήκευση των μετακινήσεών σας στον διακομιστή.</p><ul><li><a href="data/organization-graph.json" download>Εξαγωγή γράφου ↓</a></li><li><a href="data/organization-timeline.json" download>Αρχείο τεκμηρίωσης ↓</a></li><li><a href="https://github.com/jtzach/iatriko-athinon-management/tree/main/neo4j" target="_blank" rel="noopener noreferrer">Αναπαραγωγή στο Neo4j ↗</a></li></ul><p>'+esc(p.engine||p.database||'Neo4j')+' · '+esc(p.version||p.neo4jVersion||'')+'</p><p>Υποστήριξη ΤΝ στην εξαγωγή, μοντελοποίηση, κώδικα και δοκιμές. Ο ουσιαστικός έλεγχος της ομάδας εκκρεμεί.</p>');
  }
  $('year-range').addEventListener('input',e=>setYear(e.target.value));$('year-prev').onclick=()=>setYear(year-1);$('year-next').onclick=()=>setYear(year+1);
  $('person-filter').onchange=e=>{if(mode==='structure'){structure=e.target.value;selected=null;for(const k of positions.keys())if(k.startsWith(year+':structure:'))positions.delete(k);}else{person=e.target.value;selected=person&&person!=='overview'?person:null;}renderGraph();renderInspector();};
  $('reset-layout').onclick=()=>{for(const k of positions.keys())if(k.startsWith(year+':'+mode+':'))positions.delete(k);zoom=1;renderGraph();};
  $('zoom-in').onclick=()=>{zoom=Math.min(2.4,zoom+.2);updateViewBox(true);};$('zoom-out').onclick=()=>{zoom=Math.max(.6,zoom-.2);updateViewBox(true);};$('zoom-reset').onclick=()=>{zoom=1;updateViewBox(true);};
  $('nearest-year').onclick=()=>{const candidates=data.years.filter(y=>y.observationIds?.length&&(mode!=='structure'||data.observations.some(e=>Number(e.year)===Number(y.year)&&e.type==='REPORTS_TO')));if(candidates.length)setYear(candidates.sort((a,b)=>Math.abs(a.year-year)-Math.abs(b.year-year))[0].year);};
  $('method-button').onclick=showMethod;$('graph-data').onclick=showGraphData;$('close-dialog').onclick=()=>$('org-dialog').close();
  $('motion-toggle').onclick=()=>{motionEnabled=!motionEnabled;syncMotion();};
  $('org-dialog').addEventListener('close',syncMotion);
  document.addEventListener('visibilitychange',syncMotion);
  reducedMotion.addEventListener('change',()=>{if(reducedMotion.matches)motionEnabled=false;syncMotion();});
  mobileView.addEventListener('change',()=>requestAnimationFrame(focusMobileCanvas));
  let observedWidth=0;new ResizeObserver(()=>{const width=$('org-stage').clientWidth;if(data&&width!==observedWidth){observedWidth=width;updateViewBox(true);if(mobileView.matches){if(selected)focusSelectedNode();else focusMobileCanvas();}}}).observe($('org-stage'));
  document.addEventListener('click',e=>{const y=e.target.closest('[data-year]');if(y){setYear(y.dataset.year);return;}const n=e.target.closest('[data-select]');if(n){selectNode(n.dataset.select);return;}const m=e.target.closest('[data-mode]');if(m){mode=m.dataset.mode;selected=null;document.querySelectorAll('[data-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b===m)));updateFilters();renderGraph();renderInspector();}if(e.target.closest('#clear-selection')){selected=null;renderGraph();renderInspector();}});
  fetch('data/organization-graph.json').then(r=>{if(!r.ok)throw Error('Dataset unavailable');return r.json();}).then(d=>{
    data=d;byId=new Map(d.nodes.map(n=>[n.id,n]));sources=new Map(d.sources.map(s=>[s.id,s]));
    const hash=Number(location.hash.slice(1));setYear(hash>=1984&&hash<=2026?hash:2025);
    if(new URLSearchParams(location.search).has('qa'))window.OrganizationDebug={getState:()=>({year,mode,person,selected,motionEnabled,motionRunning:animationId!==null,reducedMotion:reducedMotion.matches,hoveredNode,focusedNode,viewWidth,viewHeight,nodes:visibleNodes.map(n=>n.id),edges:visibleEdges.map(e=>e.id),positions:Object.fromEntries(visibleNodes.map(n=>[n.id,{...positions.get(posKey(n.id))}]))}),setYear,selectNode,data};
  }).catch(()=>{$('coverage-label').textContent='Δεν φορτώθηκαν τα δεδομένα';$('empty-state').hidden=false;$('empty-state').innerHTML='<b>Τα δεδομένα δεν είναι διαθέσιμα.</b><p>Δοκιμάστε επαναφόρτωση ή ανοίξτε το αρχείο τεκμηρίωσης.</p><a href="data/organization-timeline.json">Αρχείο πηγών ↗</a>';$('org-status').textContent='Η φόρτωση του γράφου απέτυχε.';});
})();
