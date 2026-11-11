(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const data = window.KNOWLEDGE_BASE;
  const core = window.EvidenceGraph;
  if (!data || !core) { $('detail').textContent='Δεν φορτώθηκε η βάση τεκμηρίων. Διατηρήστε μαζί τους φακέλους assets και data με το index.html.'; return; }
  const issues = core.validate(data);
  if (issues.length) { $('detail').textContent='Απαιτείται διόρθωση της βάσης: '+issues.join(' · '); console.error(issues); return; }
  const topics = {environment:'Εξωτερικό περιβάλλον',structure:'Οργανωσιακή δομή',culture:'Κουλτούρα',leadership:'Ηγεσία'};
  const colors = {environment:'#67cdb1',structure:'#69abf0',culture:'#bb9af7',leadership:'#efba70'};
  const scopes = {company:'Νομική εταιρεία',group:'Όμιλος',clinic:'Κλινική / μονάδα',national:'Εθνικό περιβάλλον',mixed:'Μικτή περίμετρος'};
  const types = {entity:'Οντότητα',function:'Διοικητική λειτουργία',policy:'Πολιτική / πρακτική',metric:'Δημοσιευμένος δείκτης',risk:'Κίνδυνος',technology:'Τεχνολογία',context:'Πλαίσιο'};
  const kinds = {fact:'Δημοσιευμένο στοιχείο',claim:'Εταιρική δήλωση',context:'Εξωτερικό πλαίσιο',gap:'Ανοιχτό ζήτημα'};
  const relationKinds = {reported:'Δημοσιευμένη σχέση',context:'Θεματική συσχέτιση',interpretation:'Ερμηνευτική σύνδεση'};
  const nodesById = new Map(data.nodes.map(n=>[n.id,n]));
  const evidenceById = new Map(data.evidence.map(e=>[e.id,e]));
  const sourcesById = new Map(data.sources.map(s=>[s.id,s]));
  const state = {topic:'all',scope:'all',period:'all',search:'',context:true,selected:'company',selectionType:'node',view:'graph',zoom:1,x:0,y:0};
  let visible={nodes:[],edges:[]}, positions=new Map(), drag=null, wasDragged=false, toastTimer;
  const svg=$('graph'), viewport=$('viewport');
  const NS='http://www.w3.org/2000/svg';
  function element(name,attrs={},text) { const e=document.createElementNS(NS,name); Object.entries(attrs).forEach(([k,v])=>e.setAttribute(k,v)); if(text!=null)e.textContent=text; return e; }
  function el(tag,cls,text) {const e=document.createElement(tag);if(cls)e.className=cls;if(text!=null)e.textContent=text;return e;}
  function nodeColor(n) {return colors[n.topics[0]] || '#89bbc4';}
  function badge(text,kind='') {return el('span','type-badge '+kind,text);}
  function notification(message) {$('toast').textContent=message;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,3500);}
  function sourceLink(source, pages, label) {
    const a=el('a','',label || source.title);
    a.href=source.url+(pages && pages.length ? '#page='+pages[0] : '');
    a.target='_blank';a.rel='noopener noreferrer';return a;
  }
  function citation(ref) {
    const s=sourcesById.get(ref.sourceId), box=el('div','citation');
    box.append(sourceLink(s,ref.pdfPages,s.title+' ↗'));
    if(ref.pdfPages.length) {
      const pageLine=el('small','','Σελίδες PDF: ');
      ref.pdfPages.forEach((p,i)=>{
        const a=sourceLink(s,[p],String(p));a.style.display='inline';a.setAttribute('aria-label',s.title+', σελίδα PDF '+p);pageLine.append(a);
        if(i<ref.pdfPages.length-1)pageLine.append(document.createTextNode(', '));
      });box.append(pageLine);
    }
    if(ref.printedPages)box.append(el('small','','Έντυπη αρίθμηση: '+ref.printedPages));
    return box;
  }
  function evidenceCard(e,expanded=false) {
    const card=el('article','evidence-card');card.dataset.evidence=e.id;
    const head=el('div','evidence-heading');head.append(el('span','evidence-id',e.id),badge(kinds[e.kind]||e.kind,e.kind));card.append(head,el('h3','',e.title),el('p','',e.finding));
    const meta=el('p','','Περίμετρος: '+(scopes[e.scope]||e.scope)+' · '+e.period);card.append(meta);
    if(e.limitation){const d=el('details');d.open=expanded;d.append(el('summary','','Όρια & ανοιχτό ερώτημα'),el('p','',e.limitation));card.append(d);}
    e.refs.forEach(r=>card.append(citation(r)));
    return card;
  }
  function relatedEvidence(ids){return [...new Set(ids)].map(id=>evidenceById.get(id)).filter(Boolean);}
  function renderDetail(scroll=true) {
    const target=$('detail');target.replaceChildren();
    if(state.selectionType==='evidence') {
      const e=evidenceById.get(state.selected);if(!e)return;
      target.append(badge('Τεκμήριο '+e.id),el('h2','',e.title),evidenceCard(e,true));
      const connected=data.nodes.filter(n=>n.evidenceIds.includes(e.id));
      if(connected.length){target.append(el('h3','detail-section-title','ΣΧΕΤΙΚΟΙ ΚΟΜΒΟΙ'));const list=el('div','relation-list');connected.forEach(n=>{const b=el('button','relation-button',n.label+' ↗');b.onclick=()=>revealNode(n.id);list.append(b);});target.append(list);}
    } else if(state.selectionType==='edge') {
      const edge=data.edges.find(e=>e.id===state.selected);if(!edge)return;
      target.append(badge(relationKinds[edge.kind],edge.kind==='reported'?'':'context'),el('h2','',edge.label),el('p','detail-summary',nodesById.get(edge.source).label+' → '+nodesById.get(edge.target).label));
      if(edge.summary)target.append(el('p','detail-summary',edge.summary));
      const meta=el('div','detail-meta');[scopes[edge.scope]||edge.scope,edge.period].filter(Boolean).forEach(v=>meta.append(el('span','',v)));target.append(meta);
      if(edge.kind!=='reported')target.append(el('p','review-note','Η σύνδεση οργανώνει τη διερεύνηση. Δεν αποδεικνύει αιτιότητα ή οργανωτική υπαγωγή.'));
      relatedEvidence(edge.evidenceIds).forEach(e=>target.append(evidenceCard(e)));
    } else {
      const n=nodesById.get(state.selected);if(!n){target.append(el('p','detail-summary','Επιλέξτε κόμβο ή σύνδεση για να δείτε την τεκμηρίωσή του.'));return;}
      target.append(badge(types[n.type]||n.type),el('h2','',n.label));
      if(n.metric)target.append(el('div','detail-metric',n.metric));
      target.append(el('p','detail-summary',n.summary));
      const meta=el('div','detail-meta');n.scopes.forEach(s=>meta.append(el('span','',scopes[s]||s)));n.periods.forEach(p=>meta.append(el('span','',p)));target.append(meta);
      target.append(el('h3','detail-section-title','ΤΕΚΜΗΡΙΑ · '+n.evidenceIds.length));
      relatedEvidence(n.evidenceIds).forEach(e=>target.append(evidenceCard(e)));
      const edges=data.edges.filter(e=>e.source===n.id||e.target===n.id);
      if(edges.length){target.append(el('h3','detail-section-title','ΣΥΝΔΕΣΕΙΣ · '+edges.length));const list=el('div','relation-list');edges.forEach(e=>{const other=nodesById.get(e.source===n.id?e.target:e.source);const b=el('button','relation-button');const t=el('span','',other.label);t.append(el('small','',e.label));b.append(t,el('b','','↗'));b.onclick=()=>selectEdge(e.id);list.append(b);});target.append(list);}
    }
    target.append(el('p','review-note','Εντοπισμός και οργάνωση με βοήθεια ΤΝ. Εκκρεμεί τελικός έλεγχος από τα μέλη της ομάδας.'));
    if(scroll)target.scrollTop=0;
  }
  function selectNode(id) {const keepFocus=document.activeElement?.classList.contains('graph-node');state.selected=id;state.selectionType='node';positions=computeLayout(visible.nodes,visible.edges);renderGraph();fit();renderDetail();document.querySelectorAll('.node-card').forEach(b=>{const selected=b.dataset.nodeId===id;b.classList.toggle('selected',selected);b.setAttribute('aria-pressed',String(selected));});if(keepFocus)[...$('nodes').children].find(n=>n.dataset.node===id)?.focus({preventScroll:true});}
  function revealNode(id) {reset(false);state.selected=id;state.selectionType='node';render();if(innerWidth<951)$('detail').scrollIntoView({behavior:'smooth',block:'nearest'});}
  function selectEdge(id) {state.selected=id;state.selectionType='edge';renderDetail();highlight();}
  function showEvidence(id) {state.selected=id;state.selectionType='evidence';renderDetail();highlight();$('detail').scrollIntoView({behavior:'smooth',block:'nearest'});}
  function computeLayout(ns,es) {
    const ps=new Map();if(!ns.length)return ps;
    const root=ns.find(n=>state.selectionType==='node'&&n.id===state.selected)||ns.find(n=>n.type==='entity')||ns[0];
    const nearIds=new Set(es.filter(e=>e.source===root.id||e.target===root.id).flatMap(e=>[e.source,e.target]));
    const near=ns.filter(n=>n.id!==root.id&&nearIds.has(n.id));
    const far=ns.filter(n=>n.id!==root.id&&!nearIds.has(n.id));
    const order=(a,b)=>a.topics[0].localeCompare(b.topics[0])||a.label.localeCompare(b.label,'el');near.sort(order);far.sort(order);
    ps.set(root.id,{x:600,y:430,n:root});
    function ring(items,rx,ry,offset){items.forEach((n,i)=>{const angle=-Math.PI/2+offset+i*Math.PI*2/items.length;ps.set(n.id,{x:600+Math.cos(angle)*rx,y:430+Math.sin(angle)*ry,n});});}
    if(near.length){ring(near,far.length?340:430,far.length?245:310,0);ring(far,520,375,.1);}else ring(far,430,310,0);
    return ps;
  }
  function labelLines(label){const words=label.split(' '),lines=[];let line='';words.forEach(w=>{if((line+' '+w).trim().length>21&&line){lines.push(line);line=w;}else line=(line+' '+w).trim();});if(line)lines.push(line);if(lines.length>3)return[lines[0],lines[1],lines.slice(2).join(' ').slice(0,22)+'…'];return lines;}
  function renderGraph() {
    const eg=$('edges'),ng=$('nodes');eg.replaceChildren();ng.replaceChildren();
    visible.edges.forEach(e=>{
      const p=positions.get(e.source),q=positions.get(e.target);
      const g=element('g',{'data-edge':e.id});
      const path=`M ${p.x} ${p.y} L ${q.x} ${q.y}`;
      const line=element('path',{d:path,class:'edge '+e.kind});const hit=element('path',{d:path,class:'edge-hit'});
      hit.append(element('title',{},`${nodesById.get(e.source).label} → ${nodesById.get(e.target).label}: ${e.label}`));
      hit.addEventListener('click',evt=>{if(wasDragged)return;evt.stopPropagation();selectEdge(e.id);});g.append(line,hit);eg.append(g);
    });
    visible.nodes.forEach(n=>{
      const p=positions.get(n.id),c=nodeColor(n),r=(state.selectionType==='node'&&state.selected===n.id?34:n.id==='company'?28:n.id==='group'?26:n.type==='entity'?22:n.type==='metric'?16:18);
      const g=element('g',{class:'graph-node '+n.type,transform:`translate(${p.x},${p.y})`,'data-node':n.id,role:'button',tabindex:'0','aria-label':n.label+' · '+n.evidenceIds.length+' τεκμήρια','aria-pressed':'false'});
      g.append(element('title',{},n.label+' — '+n.summary));
      g.append(element('circle',{r:r+8,stroke:c,class:'node-halo'}));
      g.append(element('circle',{r,fill:c+'42',stroke:c,class:'node-body'}));
      const symbol=n.id==='company'?'IA':n.id==='group'?'Ο':({entity:'◇',function:'⊞',policy:'≡',metric:'↗',risk:'!',technology:'⌘',context:'·'}[n.type]||'·');
      g.append(element('text',{'text-anchor':'middle','dominant-baseline':'central',class:'node-symbol'},symbol));
      const txt=element('text',{class:'node-label','text-anchor':'middle',y:r+24});labelLines(n.label).forEach((line,i)=>txt.append(element('tspan',{x:0,dy:i?18:0},line)));g.append(txt);
      g.addEventListener('click',evt=>{evt.stopPropagation();if(!wasDragged)selectNode(n.id);});
      g.addEventListener('keydown',evt=>{if(evt.key==='Enter'||evt.key===' '){evt.preventDefault();selectNode(n.id);}});
      ng.append(g);
    });
    $('empty-state').hidden=visible.nodes.length>0;
    highlight();
  }
  function renderList(){const list=$('node-list');list.replaceChildren();if(!visible.nodes.length){list.append(el('p','','Δεν βρέθηκαν κόμβοι για τα επιλεγμένα φίλτρα.'));return;}visible.nodes.forEach(n=>{const selected=state.selectionType==='node'&&state.selected===n.id;const b=el('button','node-card'+(selected?' selected':''));b.dataset.nodeId=n.id;b.setAttribute('aria-pressed',String(selected));b.append(el('small','',n.topics.map(t=>topics[t]).join(' · ')),el('strong','',n.label),el('p','',n.summary),el('small','',n.evidenceIds.length+' τεκμήρια · '+n.scopes.map(s=>scopes[s]).join(' / ')));b.onclick=()=>selectNode(n.id);list.append(b);});}
  function highlight(){
    const activeNodes=new Set(),activeEdges=new Set();
    if(state.selectionType==='node'){
      activeNodes.add(state.selected);visible.edges.filter(e=>e.source===state.selected||e.target===state.selected).forEach(e=>{activeEdges.add(e.id);activeNodes.add(e.source);activeNodes.add(e.target);});
    }else if(state.selectionType==='edge'){
      const e=data.edges.find(x=>x.id===state.selected);if(e){activeEdges.add(e.id);activeNodes.add(e.source);activeNodes.add(e.target);}
    }else {visible.nodes.filter(n=>n.evidenceIds.includes(state.selected)).forEach(n=>activeNodes.add(n.id));visible.edges.filter(e=>e.evidenceIds.includes(state.selected)).forEach(e=>activeEdges.add(e.id));}
    document.querySelectorAll('.graph-node').forEach(g=>{const selected=state.selectionType==='node'&&g.dataset.node===state.selected;g.classList.toggle('selected',selected);g.setAttribute('aria-pressed',String(selected));g.classList.toggle('dimmed',activeNodes.size>0&&!activeNodes.has(g.dataset.node));g.classList.remove('quiet-label');});
    const boxes=[];
    [...document.querySelectorAll('.graph-node:not(.dimmed)')].sort((a,b)=>Number(b.classList.contains('selected'))-Number(a.classList.contains('selected'))).forEach(g=>{
      const pos=positions.get(g.dataset.node),b=g.querySelector('.node-label').getBBox();
      const box={x:pos.x+b.x-5,y:pos.y+b.y-4,w:b.width+10,h:b.height+8};
      if(boxes.some(a=>box.x<a.x+a.w&&box.x+box.w>a.x&&box.y<a.y+a.h&&box.y+box.h>a.y))g.classList.add('quiet-label');else boxes.push(box);
    });
    document.querySelectorAll('[data-edge] .edge').forEach(p=>{const active=activeEdges.has(p.parentNode.dataset.edge);p.classList.toggle('active',active);const edge=data.edges.find(e=>e.id===p.parentNode.dataset.edge);p.style.stroke=active?nodeColor(nodesById.get(edge.target)):'';});
  }
  function transform(){viewport.setAttribute('transform',`translate(${state.x},${state.y}) scale(${state.zoom})`);$('zoom-level').textContent=Math.round(state.zoom*100)+'%';}
  function fit(){
    if(!positions.size){state.zoom=1;state.x=0;state.y=0;transform();return;}
    const ps=[...positions.values()],minX=Math.min(...ps.map(p=>p.x))-100,maxX=Math.max(...ps.map(p=>p.x))+100,minY=Math.min(...ps.map(p=>p.y))-75,maxY=Math.max(...ps.map(p=>p.y))+95;
    state.zoom=Math.min(1.8,Math.min(1140/(maxX-minX),780/(maxY-minY)));
    state.x=600-(minX+maxX)/2*state.zoom;state.y=440-(minY+maxY)/2*state.zoom;transform();
  }
  function zoom(factor,cx=600,cy=480){const old=state.zoom;state.zoom=Math.max(.35,Math.min(3.5,old*factor));state.x=cx-(cx-state.x)*state.zoom/old;state.y=cy-(cy-state.y)*state.zoom/old;transform();}
  function point(evt){const matrix=svg.getScreenCTM();return matrix?new DOMPoint(evt.clientX,evt.clientY).matrixTransform(matrix.inverse()):{x:0,y:0};}
  svg.addEventListener('pointerdown',evt=>{
    if(evt.button!==0)return;const p=point(evt),node=evt.target.closest('[data-node]');wasDragged=false;
    drag={x:p.x,y:p.y,clientX:evt.clientX,clientY:evt.clientY,panX:state.x,panY:state.y,id:node?.dataset.node,edgeId:evt.target.closest('[data-edge]')?.dataset.edge};
    if(drag.id){const pos=positions.get(drag.id);drag.nodeX=pos.x;drag.nodeY=pos.y;}
    svg.setPointerCapture(evt.pointerId);
  });
  svg.addEventListener('pointermove',evt=>{
    if(!drag)return;const p=point(evt);if(Math.hypot(evt.clientX-drag.clientX,evt.clientY-drag.clientY)>4)wasDragged=true;if(!wasDragged)return;
    if(drag.id){const pos=positions.get(drag.id);pos.x=drag.nodeX+(p.x-drag.x)/state.zoom;pos.y=drag.nodeY+(p.y-drag.y)/state.zoom;updateNodePosition(drag.id);}else{state.x=drag.panX+p.x-drag.x;state.y=drag.panY+p.y-drag.y;transform();}
  });
  function endDrag(evt){if(!drag)return;const clickedId=drag.id,edgeId=drag.edgeId;drag=null;if(svg.hasPointerCapture(evt.pointerId))svg.releasePointerCapture(evt.pointerId);if(!wasDragged&&evt.type!=='pointercancel'){if(clickedId)selectNode(clickedId);else if(edgeId)selectEdge(edgeId);}setTimeout(()=>wasDragged=false,0);}
  svg.addEventListener('pointerup',endDrag);svg.addEventListener('pointercancel',endDrag);
  svg.addEventListener('wheel',evt=>{if(!evt.ctrlKey)return;evt.preventDefault();const p=point(evt);zoom(evt.deltaY<0?1.12:1/1.12,p.x,p.y);},{passive:false});
  function updateNodePosition(id){const p=positions.get(id);const g=[...$('nodes').children].find(n=>n.dataset.node===id);if(g)g.setAttribute('transform',`translate(${p.x},${p.y})`);[...$('edges').children].forEach(g=>{const edge=visible.edges.find(e=>e.id===g.dataset.edge);if(edge.source!==id&&edge.target!==id)return;const a=positions.get(edge.source),b=positions.get(edge.target);g.querySelectorAll('path').forEach(path=>path.setAttribute('d',`M ${a.x} ${a.y} L ${b.x} ${b.y}`));});}
  function render(){
    visible=core.filterGraph(data,state);
    if(state.selectionType==='node'&&!visible.nodes.some(n=>n.id===state.selected))state.selected=visible.nodes[0]?.id||null;
    if(state.selectionType==='edge'&&!visible.edges.some(e=>e.id===state.selected)){state.selectionType='node';state.selected=visible.nodes[0]?.id||null;}
    positions=computeLayout(visible.nodes,visible.edges);
    $('visible-count').textContent=visible.nodes.length+(visible.nodes.length===1?' κόμβος · ':' κόμβοι · ')+visible.edges.length+(visible.edges.length===1?' σχέση':' σχέσεις');
    $('graph-title').textContent=state.topic==='all'?'ΣΥΝΟΛΙΚΟΣ ΧΑΡΤΗΣ':topics[state.topic].toLocaleUpperCase('el');
    document.querySelectorAll('[data-topic]').forEach(b=>{const active=b.dataset.topic===state.topic;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));});
    renderGraph();renderList();fit();renderDetail(false);
  }
  function reset(doRender=true){state.topic='all';state.scope='all';state.period='all';state.search='';state.context=true;state.selected='company';state.selectionType='node';$('search').value='';$('scope').value='all';$('period').value='all';$('context-toggle').checked=true;if(doRender)render();}
  $('search').addEventListener('input',evt=>{state.search=evt.target.value;render();});
  $('scope').addEventListener('change',evt=>{state.scope=evt.target.value;render();});
  $('period').addEventListener('change',evt=>{state.period=evt.target.value;render();});
  $('context-toggle').addEventListener('change',evt=>{state.context=evt.target.checked;render();});
  document.querySelectorAll('[data-topic]').forEach(b=>b.onclick=()=>{state.topic=b.dataset.topic;render();});
  $('reset').onclick=()=>reset();$('empty-reset').onclick=()=>reset();$('clear-selection').onclick=()=>revealNode('company');
  $('zoom-in').onclick=()=>zoom(1.2);$('zoom-out').onclick=()=>zoom(1/1.2);$('fit').onclick=fit;
  function switchView(view){state.view=view;$('graph-wrap').hidden=view!=='graph';$('node-list').hidden=view!=='list';['graph','list'].forEach(v=>{$(v+'-view').classList.toggle('active',v===view);$(v+'-view').setAttribute('aria-pressed',String(v===view));});}
  $('graph-view').onclick=()=>switchView('graph');$('list-view').onclick=()=>switchView('list');
  const expand=el('button','icon-button','⤢');expand.id='expand-graph';expand.title='Μεγάλη προβολή';expand.setAttribute('aria-label','Μεγάλη προβολή γράφου');expand.setAttribute('aria-pressed','false');$('export').before(expand);
  function toggleWide(){const enabled=document.querySelector('.workspace').classList.toggle('wide');expand.textContent=enabled?'⤡':'⤢';expand.setAttribute('aria-pressed',String(enabled));expand.setAttribute('aria-label',enabled?'Κλείσιμο μεγάλης προβολής':'Μεγάλη προβολή γράφου');document.body.classList.toggle('graph-expanded',enabled);}
  expand.onclick=toggleWide;document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('info-dialog').open&&document.querySelector('.workspace').classList.contains('wide'))toggleWide();});
  document.querySelectorAll('[data-tour]').forEach(b=>b.onclick=()=>{
    reset(false);if(b.dataset.tour==='people')state.topic='culture';if(b.dataset.tour==='structure')state.topic='structure';if(b.dataset.tour==='digital'){state.search='SAP';$('search').value='SAP';}
    const matching=core.filterGraph(data,state).nodes;state.selected=(b.dataset.tour==='digital'?matching.find(n=>core.normalize(n.label).includes('sap')):matching.find(n=>n.type==='metric'||n.type==='function'))?.id||matching[0]?.id||'company';render();switchView('graph');
  });
  function runRetrieval(query){
    $('question').value=query;const results=core.retrieve(data,query,6),container=$('retrieval-results');container.replaceChildren();
    if(!core.tokenize(query).length){container.append(el('p','result-count','Γράψτε ένα θέμα, έναν δείκτη ή μια διοικητική λειτουργία.'));return;}
    container.append(el('p','result-count',results.length?results.length+' σχετικά τεκμήρια · σειρά συνάφειας, όχι βαθμολογία αξιοπιστίας':'Δεν βρέθηκαν σχετικά τεκμήρια στο επιλεγμένο σώμα πηγών.'));
    results.forEach(({evidence:e,reasons})=>{const r=el('article','retrieval-result'),b=el('button','',e.id+' · '+e.title+' ↗');b.onclick=()=>showEvidence(e.id);r.append(b,el('p','',e.finding),el('small','',reasons.slice(0,2).join(' · ')));const links=el('div');e.refs.forEach(ref=>{const s=sourcesById.get(ref.sourceId);links.append(sourceLink(s,ref.pdfPages,s.title+(ref.pdfPages.length?' · PDF '+ref.pdfPages.join(', '):'')+' ↗'));});r.append(links);container.append(r);});
  }
  $('retrieval-form').onsubmit=evt=>{evt.preventDefault();runRetrieval($('question').value);};
  document.querySelectorAll('[data-question]').forEach(b=>b.onclick=()=>runRetrieval(b.dataset.question));
  function dialog(title,content){$('dialog-title').textContent=title;$('dialog-content').replaceChildren(content);$('info-dialog').showModal();}
  function showMethod(){
    const content=el('div');
    const sections=[
      ['Τι περιέχει η πρώτη έκδοση','Επιλεγμένα τεκμήρια από τις εταιρικές εκθέσεις 2025 και Α΄ εξαμήνου 2026, το OECD και το ΕΒΕΑ. Η κάλυψη είναι στοχευμένη και δεν ισοδυναμεί με πλήρη αποτύπωση κάθε διαθέσιμης πληροφορίας.'],
      ['Πώς διαβάζεται ο γράφος','Κάθε κόμβος αντιπροσωπεύει οντότητα, λειτουργία, πολιτική, κίνδυνο ή δείκτη. Το χρώμα δείχνει την κύρια θεματική: πράσινο για περιβάλλον, μπλε για δομή, μωβ για κουλτούρα και χρυσαφί για ηγεσία. Οι κόμβοι μπορούν να ανήκουν σε περισσότερες θεματικές.'],
      ['Τι σημαίνουν οι συνδέσεις','Η συνεχής γραμμή παραπέμπει σε δημοσιευμένη σχέση. Η διακεκομμένη γραμμή εκφράζει θεματική συσχέτιση της έρευνας. Η επιλογή μιας σύνδεσης εμφανίζει την ακριβή περιγραφή και τις πηγές της. Ο γράφος δεν αποτελεί λειτουργικό οργανόγραμμα και οι συνδέσεις δεν αποδεικνύουν αιτιότητα.'],
      ['Διαφορετικές περίμετροι και χρόνοι','Η νομική εταιρεία, ο ενοποιημένος Όμιλος, οι κλινικές και οι εθνικοί δείκτες παραμένουν διακριτά επίπεδα. Η περίοδος ενός οικονομικού δείκτη διαφέρει από την ημερομηνία δημοσίευσης. Το προσωπικό τέλους έτους δεν συγκρίνεται χωρίς προσαρμογή με το μέσο προσωπικό εξαμήνου.'],
      ['Παραπομπές και κατάσταση ελέγχου','Οι αριθμοί PDF είναι 1-based και οδηγούν στην αντίστοιχη σελίδα του αρχικού αρχείου, εφόσον το υποστηρίζει ο αναγνώστης PDF. Η έντυπη αρίθμηση αναφέρεται χωριστά. Η εταιρική περιγραφή μιας πολιτικής δεν αποτελεί απόδειξη καθημερινής εφαρμογής. Εκκρεμεί τελικός ανθρώπινος έλεγχος.'],
      ['Ανάκτηση τεκμηρίων και μελλοντικό GraphRAG','Η σημερινή έκδοση χρησιμοποιεί λεξική αντιστοίχιση και συνδέσεις του γράφου για να προτείνει σχετικά τεκμήρια. Δεν καλεί μοντέλο, δεν παράγει απαντήσεις με LLM και δεν χρησιμοποιεί κλειδιά API. Η παραγωγή απαντήσεων με ελέγξιμες παραπομπές αποτελεί επόμενο στάδιο.'],
      ['Χρήση ΤΝ και ακαδημαϊκό πλαίσιο','Η ΤΝ βοήθησε στην οργάνωση των τεκμηρίων, στον σχεδιασμό, στην ανάπτυξη κώδικα και στον τεχνικό έλεγχο. Δεν δηλώνεται έλεγχος ή συνεισφορά των φοιτητών που δεν έχει πραγματοποιηθεί. Το πρωτότυπο υποστηρίζει την προετοιμασία και δεν αντικαθιστά τα απαιτούμενα Word, PowerPoint και δηλώσεις.']
    ];sections.forEach(([h,p])=>content.append(el('h3','',h),el('p','',p)));dialog('Μεθοδολογία & όρια',content);
  }
  function showSources(){const content=el('div');data.sources.forEach(s=>{const item=el('article','source-item');item.append(el('strong','',s.title));item.append(el('p','',s.publishedDate?'Ημερομηνία πηγής: '+s.publishedDate:'Ημερομηνία δημοσίευσης: δεν ορίζεται'));const refs=data.evidence.filter(e=>e.refs.some(r=>r.sourceId===s.id));item.append(el('p','',refs.length+' τεκμήρια στη βάση'),sourceLink(s,[], 'Άνοιγμα πρωτότυπης πηγής ↗'));if(s.localFile)item.append(el('p','', 'Πρωτότυπο στον ερευνητικό φάκελο: '+s.localFile));content.append(item);});content.append(el('p','','Οι σύνδεσμοι ανοίγουν τις δημόσιες πηγές. Τα πλήρη PDF δεν έχουν αντιγραφεί σε αυτό το αποθετήριο. Ο φάκελος ΓΕΜΗ δεν έχει ανακτηθεί· η ταυτότητα υποστηρίζεται από τις εκθέσεις και το ΕΒΕΑ.'));dialog('Πηγές της βάσης',content);}
  $('method-button').onclick=showMethod;$('method-footer').onclick=showMethod;$('sources-button').onclick=showSources;$('close-dialog').onclick=()=>$('info-dialog').close();
  $('info-dialog').addEventListener('click',evt=>{if(evt.target===$('info-dialog')){const r=evt.target.getBoundingClientRect();if(evt.clientX<r.left||evt.clientX>r.right||evt.clientY<r.top||evt.clientY>r.bottom)evt.target.close();}});
  $('export').onclick=()=>{
    const ids=new Set([...visible.nodes.flatMap(n=>n.evidenceIds),...visible.edges.flatMap(e=>e.evidenceIds)]),evidence=data.evidence.filter(e=>ids.has(e.id)),sourceIds=new Set(evidence.flatMap(e=>e.refs.map(r=>r.sourceId)));
    const out={meta:data.meta,filters:{topic:state.topic,scope:state.scope,period:state.period,search:state.search,context:state.context},sources:data.sources.filter(s=>sourceIds.has(s.id)),nodes:visible.nodes,edges:visible.edges,evidence};
    const blob=new Blob([JSON.stringify(out,null,2)],{type:'application/json;charset=utf-8'}),url=URL.createObjectURL(blob),a=el('a');a.href=url;a.download='iatriko-evidence-graph.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);notification('Εξαγωγή ορατού γράφου και τεκμηρίων σε JSON.');
  };
  $('node-count').textContent=data.nodes.length;$('edge-count').textContent=data.edges.length;$('evidence-count').textContent=data.evidence.length;$('source-count').textContent=data.sources.length;
  const periodSelect=$('period');periodSelect.replaceChildren(new Option('Όλες οι περίοδοι','all'));[...new Set(data.nodes.flatMap(n=>n.periods.map(String)))].sort().forEach(p=>periodSelect.append(new Option(p,p)));
  document.querySelectorAll('[data-topic]').forEach(b=>b.querySelector('.count').textContent=b.dataset.topic==='all'?data.nodes.length:data.nodes.filter(n=>n.topics.includes(b.dataset.topic)).length);
  $('coverage-note').textContent='Κάλυψη: εκθέσεις 2025 / Α΄ εξαμήνου 2026 και επιλεγμένες θεσμικές πηγές. Βάση: '+(data.meta.preparedDate||'2026-11-11')+'.';
  render();
})();
