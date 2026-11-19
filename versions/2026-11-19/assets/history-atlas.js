(() => {
  'use strict';
  const H=window.HISTORY_TIMELINE||{steps:[],sources:[]}, P=window.PEOPLE_TIMELINE||{people:[],sources:[]}, C=window.CONTEXT_TIMELINE||{events:[],sources:[]}, M=window.MEDIA_CATALOG||{photos:[],locations:[]};
  const people=new Map(P.people.map(p=>[p.id,p])), positions=new Map(M.locations.map(p=>[p.id,p]));
  const firstSeen=new Map(); H.steps.forEach(s=>s.locations.forEach(l=>{if(!firstSeen.has(l.id))firstSeen.set(l.id,s.year);}));
  const bounds={region:[18.5,34.4,30.6,48.6],attica:[23.59,37.85,23.94,38.14],romania:[20.1,43.3,30.1,48.6]};
  const scopeNames={company:'Εταιρεία',group:'Όμιλος',clinic:'Κλινική'};
  const clamp=y=>Math.max(1984,Math.min(2026,Math.trunc(Number(y)||2026)));
  function roleYears(r){
    const obs=(r.observedYears||[]).filter(Number.isFinite);
    if(r.startYear===null||r.startYear===undefined||r.precision==='snapshot')return obs;
    const end=Math.min(2026,r.endYear??Math.max(r.startYear,...obs));
    return Array.from({length:Math.max(0,end-r.startYear+1)},(_,i)=>r.startYear+i);
  }
  function roleVisible(r,y){return roleYears(r).includes(Number(y));}
  function roleLabel(r){
    if(r.startYear==null||r.precision==='snapshot')return 'Καταγραφές '+(r.observedYears||[]).join(' · ');
    const end=r.endYear??Math.max(r.startYear,...r.observedYears);
    return r.startYear===end?String(end):r.startYear+'–'+end;
  }
  function scene(year,selected=[]){
    year=clamp(year); const step=H.steps.filter(s=>s.year<=year).at(-1);
    const roles=P.people.filter(p=>!selected.length||selected.includes(p.id)).flatMap(p=>p.roles.filter(r=>roleVisible(r,year)).map(role=>({person:p,role})));
    const unitIds=[...new Set(roles.flatMap(x=>x.role.unitIds))];
    return {year,step,locations:step?.locations||[],roles,unitIds,personCount:new Set(roles.map(x=>x.person.id)).size,events:C.events.filter(e=>e.year<=year).sort((a,b)=>b.year-a.year).slice(0,3)};
  }
  function projection(view='region'){
    const b=bounds[view]||bounds.region,m=lat=>Math.log(Math.tan(Math.PI/4+lat*Math.PI/360)), k=Math.PI/180;
    const west=b[0]*k,east=b[2]*k,south=m(b[1]),north=m(b[3]),scale=Math.min(700/(east-west),540/(north-south));
    return (lon,lat)=>[380+(lon*k-(west+east)/2)*scale,300-(m(lat)-(north+south)/2)*scale];
  }
  window.ATLAS_MODEL=Object.freeze({scene,roleYears,roleVisible,roleLabel,projection,bounds,firstSeen:Object.fromEntries(firstSeen)});
  if(typeof document==='undefined')return;
  const $=id=>document.getElementById(id), E=(tag,cls='',text='')=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text)e.textContent=text;return e;};
  const S=(tag,attrs={},text='')=>{const e=document.createElementNS('http://www.w3.org/2000/svg',tag);Object.entries(attrs).forEach(([k,v])=>e.setAttribute(k,v));if(text)e.textContent=text;return e;};
  let year=2026, selected=new Set(), view='region', selectedUnit=null, timer=null, currentScene=null;
  const sources={history:new Map(H.sources.map(s=>[s.id,s])),people:new Map(P.sources.map(s=>[s.id,s])),context:new Map(C.sources.map(s=>[s.id,s]))};
  const sourceLink=s=>{const a=E('a','atlas-detail-source',s.title+' ↗');if(/^https?:\/\//.test(s.url)){a.href=s.url;a.target='_blank';a.rel='noopener noreferrer';}return a;};
  function appendSources(node,ids,group){[...new Set(ids||[])].forEach(id=>{const source=sources[group].get(id);if(source)node.append(sourceLink(source));});}
  const photoFor=id=>M.photos.find(p=>p.personId===id&&p.kind==='person');
  const unitPhoto=id=>M.photos.find(p=>p.unitId===id);
  function picture(photo,cls=''){
    const img=E('img',cls);img.src=photo.src;img.alt=photo.alt;img.loading='lazy';img.decoding='async';img.referrerPolicy='no-referrer';
    if(photo.objectPosition)img.style.objectPosition=photo.objectPosition;
    img.addEventListener('error',()=>{img.remove();});return img;
  }
  function avatar(person){
    const box=E('span','atlas-avatar');const initials=person.name.split(/\s+/).slice(0,2).map(x=>x[0]).join('');box.textContent=initials;
    const photo=photoFor(person.id);box.title=photo?'Επαληθευμένη επώνυμη φωτογραφία · πηγή στην κάρτα':'Δεν διαθέτουμε επαληθευμένο πορτρέτο';
    if(photo){const img=picture(photo);img.style.opacity='0';img.addEventListener('load',()=>{img.style.opacity='1';});box.append(img);}
    return box;
  }
  function openDetail(title,build){stop();const content=$('atlas-detail-content');content.replaceChildren(E('h2','',title));build(content);$('atlas-detail-dialog').showModal();}
  function photoCredit(container,photo){if(!photo)return;container.append(sourceLink({title:photo.caption||photo.credit,url:photo.sourceUrl}));}
  function roleDetail(person,r){openDetail(person.name,body=>{
    body.prepend(avatar(person));body.append(E('h3','',r.title),E('p','',scopeNames[r.scope]+' · '+roleLabel(r)));
    if(r.startDate||r.endDate)body.append(E('p','',[(r.startDate?'Έναρξη: '+r.startDate:''),(r.endDate?'Λήξη: '+r.endDate:'')].filter(Boolean).join(' · ')));
    body.append(E('p','',r.note||''));
      if(r.title.includes('ιστορική ιδιότητα'))body.append(E('p','atlas-detail-warning','Ιστορική ιδιότητα ιδρυτή, όχι τεκμήριο καθημερινής διοικητικής αρμοδιότητας σε κάθε έτος.'));
      else if(!r.endDate&&!r.endYear)body.append(E('p','atlas-detail-warning','Δεν γνωρίζουμε ημερομηνία λήξης. Η παρουσίαση σταματά στο τελευταίο έτος επιβεβαίωσης της πηγής.'));
    appendSources(body,r.sourceIds,'people');photoCredit(body,photoFor(person.id));
    const groupPhoto=M.photos.find(p=>p.kind==='group'&&p.personIds?.includes(person.id));
    if(groupPhoto){const fig=E('figure');const img=picture(groupPhoto);img.style.cssText='width:100%;height:auto;border-radius:7px;object-fit:contain';fig.append(img,E('figcaption','atlas-micro',groupPhoto.caption));body.append(fig);photoCredit(body,groupPhoto);}
    body.append(E('p','atlas-micro','Η φωτογραφία αναγνωρίζει το πρόσωπο· δεν χρονολογεί τον συγκεκριμένο ρόλο.'));
  });}
  function unitDetail(location){selectedUnit=location.id;renderMap();const box=$('atlas-unit-detail');box.replaceChildren();const photo=unitPhoto(location.id);
    if(photo)box.append(picture(photo));else{const icon=E('span','atlas-unit-icon');const img=E('img');img.src='assets/illustrations/hospital.svg';img.alt='';icon.append(img);box.append(icon);}
    const copy=E('div');copy.append(E('h3','',location.label),E('p','',location.region+' · καταγραφή από '+firstSeen.get(location.id)));
    const names=[...new Set(currentScene.roles.filter(x=>x.role.unitIds.includes(location.id)).map(x=>x.person.name))];
    if(names.length)copy.append(E('p','',names.join(' · ')));
    const button=E('button','','Πηγή & λεπτομέρειες ↗');button.type='button';button.addEventListener('click',()=>openDetail(location.label,body=>{
      if(photo){const img=picture(photo);img.style.cssText='width:100%;max-height:230px;object-fit:cover;border-radius:8px';body.prepend(img);}
      body.append(E('p','',location.detail));const pos=positions.get(location.id);if(pos){body.append(E('p','',pos.address||location.region),E('p','atlas-detail-warning',pos.basis));body.append(sourceLink({title:'Γεωγραφική πηγή θέσης',url:pos.sourceUrl}));}
      appendSources(body,location.sourceIds,'history');photoCredit(body,photo);
      body.append(E('p','atlas-micro','Η εικόνα είναι αναγνωριστική, όχι φωτογραφικό τεκμήριο του επιλεγμένου έτους.'));
    }));copy.append(button);box.append(copy);
  }
  function togglePerson(id){stop();selected.has(id)?selected.delete(id):selected.add(id);render();renderDirectory();}
  function renderDirectory(){const list=$('atlas-people-options'),scroll=list.scrollTop,focus=document.activeElement?.matches('.atlas-person-option input')?document.activeElement.value:null;list.replaceChildren();const query=$('atlas-person-search').value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('el');
    for(const p of P.people){if(!p.name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('el').includes(query))continue;
      const label=E('label','atlas-person-option');const input=E('input');input.type='checkbox';input.value=p.id;input.checked=selected.has(p.id);input.addEventListener('change',()=>togglePerson(p.id));label.append(input,avatar(p),E('span','',p.name));list.append(label);}
    if(!list.childElementCount)list.append(E('p','atlas-micro','Δεν βρέθηκε όνομα.'));
    list.scrollTop=scroll;if(focus)list.querySelector('input[value="'+focus+'"]')?.focus({preventScroll:true});
  }
  function renderSelected(){const list=$('atlas-selected');list.replaceChildren();for(const id of selected){const p=people.get(id);if(!p)continue;const b=E('button','atlas-chip');b.type='button';b.append(avatar(p),E('span','',p.name+' ×'));b.setAttribute('aria-label','Αφαίρεση '+p.name);b.addEventListener('click',()=>togglePerson(id));list.append(b);}
    $('atlas-clear-people').hidden=!selected.size;$('atlas-selection-label').textContent=selected.size?selected.size+' επιλεγμένα πρόσωπα · οι ρόλοι φιλτράρονται':'Όλα τα τεκμηριωμένα πρόσωπα';
  }
  function geometryPath(geometry,project){const rings=geometry.type==='MultiPolygon'?geometry.coordinates.flat():geometry.type==='Polygon'?geometry.coordinates:[];return rings.map(r=>r.map((p,i)=>{const [x,y]=project(p[0],p[1]);return (i?'L':'M')+x.toFixed(2)+','+y.toFixed(2);}).join('')+'Z').join('');}
  const shortNames={marousi:'Μαρούσι',faliro:'Π. Φάληρο',psychiko:'Ψυχικό',dafni:'Δάφνη',peristeri:'Περιστέρι',thessaloniki:'Θεσσαλονίκη',bucharest:'Βουκουρέστι',ploiesti:'Πλοϊέστι'};
  function renderMap(){const svg=$('atlas-map-svg');svg.replaceChildren();const proj=projection(view),b=bounds[view];
    const grid=S('g',{'aria-hidden':'true'});const step=view==='attica'?.05:2;
    for(let lon=Math.ceil(b[0]/step)*step;lon<=b[2];lon+=step){const a=proj(lon,b[1]),z=proj(lon,b[3]);grid.append(S('path',{class:'atlas-graticule',d:`M${a}L${z}`}));}
    for(let lat=Math.ceil(b[1]/step)*step;lat<=b[3];lat+=step){const a=proj(b[0],lat),z=proj(b[2],lat);grid.append(S('path',{class:'atlas-graticule',d:`M${a}L${z}`}));}svg.append(grid);
    const land=S('g',{'aria-hidden':'true'});for(const feature of window.MAP_GEOGRAPHY?.features||[]){const code=feature.properties.ISO_A3;land.append(S('path',{class:'atlas-country'+(['GRC','ROU'].includes(code)?' is-focus':''),d:geometryPath(feature.geometry,proj)}));}svg.append(land);
    const labels=view==='attica'?[[23.65,38.09,'ΑΤΤΙΚΗ']]:view==='romania'?[[24.9,46.5,'ΡΟΥΜΑΝΙΑ'],[25,43.5,'ΒΟΥΛΓΑΡΙΑ']]:[[24.1,46.4,'ΡΟΥΜΑΝΙΑ'],[25,42.5,'ΒΟΥΛΓΑΡΙΑ'],[21.35,39,'ΕΛΛΑΔΑ']];
    const compact=$('atlas-map').clientWidth<500;
    labels.forEach(([lon,lat,label])=>{const [x,y]=proj(lon,lat);const el=S('text',{x,y,class:'atlas-country-label','text-anchor':'middle'},label);if(compact)el.style.fontSize='20px';svg.append(el);});
    const visible=currentScene.locations.filter(l=>{const p=positions.get(l.id);return p&&p.lon>=b[0]&&p.lon<=b[2]&&p.lat>=b[1]&&p.lat<=b[3];});
    let markers=visible.map(l=>({location:l,ids:[l.id],...positions.get(l.id)}));
    if(view==='region'){
      const attica=markers.filter(m=>m.location.region==='Αττική');markers=markers.filter(m=>m.location.region!=='Αττική');
      if(attica.length)markers.push({id:'attica-cluster',lat:37.99,lon:23.76,ids:attica.map(x=>x.location.id),cluster:true});
    }
    markers.forEach(m=>{
      const id=m.cluster?'attica':m.location.id,[x,y]=proj(m.lon,m.lat);const linked=selected.size&&m.ids.some(i=>currentScene.unitIds.includes(i)),isNew=m.ids.some(i=>firstSeen.get(i)===year),isDim=selected.size&&!linked;
      const g=S('g',{class:'atlas-marker'+(linked?' is-linked':'')+(isNew?' is-new':'')+(isDim?' is-dim':'')+(m.ids.includes(selectedUnit)?' is-current':''),role:'button',tabindex:'0','aria-label':m.cluster?'Αττική · '+m.ids.length+' τοποθεσίες. Μεγέθυνση.':m.location.label});
      g.append(S('circle',{cx:x,cy:y,r:compact?40:25,fill:'transparent'}),S('circle',{cx:x,cy:y,r:m.cluster?24:19,class:'marker-halo'}),S('circle',{cx:x,cy:y,r:m.cluster?15:compact?11:8,class:'marker-dot'}));
      if(m.cluster){const count=S('text',{x,y,class:'atlas-cluster-count'},String(m.ids.length));if(compact)count.style.fontSize='21px';g.append(count);}
      let dx=18,dy=-12; if(id==='ploiesti'){dy=-22;}if(id==='bucharest'){dy=23;}if(id==='thessaloniki'){dx=-135;dy=-8;}if(id==='attica'){dx=25;dy=5;}
      if(view==='attica'){const offsets={marousi:[-85,-27],psychiko:[18,-9],peristeri:[-105,-20],dafni:[20,18],faliro:[-92,32]};[dx,dy]=offsets[id]||[18,-12];}
      if(compact){if(id==='thessaloniki')dx=-195;if(id==='bucharest')dy=32;if(id==='ploiesti')dy=-30;if(view==='attica'&&dx<0)dx-=40;}
      const title=m.cluster?'Αττική · '+m.ids.length:shortNames[id],font=compact?23:15,w=title.length*font*.57+16,h=compact?35:25,lx=x+dx,ly=y+dy;
      g.append(S('path',{class:'atlas-marker-line',d:`M${x},${y}L${lx+5},${ly}`}));const text=S('text',{x:lx,y:ly+2,class:'atlas-map-label'},title);text.style.fontSize=font+'px';g.append(S('rect',{x:lx-7,y:ly-(compact?23:15),width:w,height:h,rx:5,class:'atlas-map-label-bg'}),text);
      const activate=()=>{stop();if(m.cluster){view='attica';renderMap();}else unitDetail(m.location);};g.addEventListener('click',activate);g.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();activate();}});svg.append(g);
    });
    document.querySelectorAll('[data-map-view]').forEach(btn=>btn.setAttribute('aria-pressed',String(btn.dataset.mapView===view)));
    $('atlas-place-count').textContent=currentScene.locations.length+' τοποθεσίες έως '+year;
    $('atlas-map-hint').textContent=view==='region'?'Πατήστε την Αττική για τις επιμέρους μονάδες.':view==='attica'?'Γενικευμένη ακτογραμμή · θέσεις από επίσημες διευθύνσεις.':'Ρουμανία: σημεία πόλεων, όχι ακριβείς θέσεις κλινικών.';
    if(selected.size&&!currentScene.unitIds.length)$('atlas-map-hint').textContent='Δεν τεκμηριώνεται τοπική κατανομή για τους επιλεγμένους ρόλους.';
  }
  function renderRoles(){const list=$('atlas-role-list');list.replaceChildren();$('atlas-role-count').textContent=currentScene.personCount+' πρόσωπα · '+currentScene.roles.length+' καταγραφές';
    $('atlas-role-note').textContent=year===2026?'Για το 2026 τεκμηριώνεται κυρίως το ΔΣ της 2/1. Λιγότερες καταγραφές δεν σημαίνουν λιγότερα στελέχη.':'Ρόλοι που τεκμηριώνονται εντός '+year+' · όχι απαραίτητα ταυτόχρονοι. Οι περίοδοι μπορεί να προκύπτουν από μεταγενέστερα βιογραφικά.';
    for(const {person,role:r} of currentScene.roles){const button=E('button','atlas-role'+(r.startYear===year?' is-new':''));button.type='button';button.dataset.person=person.id;const copy=E('span','atlas-role-copy');copy.append(E('strong','',person.name),E('span','',r.title));const info=E('small');info.append(E('span','atlas-scope',scopeNames[r.scope]),document.createTextNode((r.startYear!=null?'Περίοδος ':'')+roleLabel(r)+(r.endYear===year?' · λήξη εντός έτους':'')));copy.append(info);button.append(avatar(person),copy,E('span','atlas-role-arrow','↗'));button.addEventListener('click',()=>roleDetail(person,r));list.append(button);}
    if(!currentScene.roles.length){const empty=E('div','atlas-role-empty');empty.append(E('span','','…'),E('h3','','Δεν έχουμε καταγραφή για αυτό το έτος.'),E('p','','Αυτό δεν σημαίνει ότι δεν υπήρχε διοίκηση. Δείτε άλλη περίοδο ή τις διαδρομές των επιλεγμένων προσώπων.'));
      const years=P.people.filter(p=>!selected.size||selected.has(p.id)).flatMap(p=>p.roles.flatMap(roleYears)).filter(y=>y>=1984&&y<=2026);const nearest=years.sort((a,b)=>Math.abs(a-year)-Math.abs(b-year))[0];if(nearest){const b=E('button','','Μετάβαση στο '+nearest+' →');b.addEventListener('click',()=>setYear(nearest));empty.append(b);}list.append(empty);}
  }
  function renderCareers(){const section=$('atlas-careers'),list=$('atlas-career-lines');section.hidden=!selected.size;list.replaceChildren();
    for(const id of selected){const p=people.get(id),line=E('div','atlas-career-line'),name=E('div','atlas-career-person');name.append(avatar(p),E('span','',p.name));const events=E('div','atlas-career-events');
      [...p.roles].sort((a,b)=>Math.min(...roleYears(a))-Math.min(...roleYears(b))).forEach(r=>{const b=E('button','atlas-career-event'+(roleVisible(r,year)?' is-active':''));b.type='button';b.append(E('strong','',roleLabel(r)),E('span','',r.title),E('small','',r.startYear==null||r.precision==='snapshot'?'Στιγμιότυπα πηγών':'Τεκμηριωμένη περίοδος'));b.addEventListener('click',()=>{const years=roleYears(r).filter(y=>y>=1984&&y<=2026);setYear(years.at(-1)||year);});events.append(b);});line.append(name,events);list.append(line);}
  }
  function contextArt(category){const svg=S('svg',{viewBox:'0 0 100 75','aria-hidden':'true'});const strokes={fill:'none',stroke:'currentColor','stroke-width':2.5,'stroke-linecap':'round','stroke-linejoin':'round'};
    if(category==='health'){svg.append(S('rect',{x:24,y:12,width:52,height:52,rx:12,...strokes}),S('path',{d:'M50 25V51M37 38H63',...strokes}),S('circle',{cx:14,cy:37,r:4,...strokes}),S('circle',{cx:86,cy:37,r:4,...strokes}));}
    else if(category==='technology'){svg.append(S('rect',{x:28,y:16,width:44,height:44,rx:6,...strokes}));for(const x of [37,50,63])svg.append(S('path',{d:`M${x} 8V16M${x} 60V68`,...strokes}));svg.append(S('path',{d:'M37 38L46 47L63 28M18 28H28M18 49H28M72 28H82M72 49H82',...strokes}));}
    else if(category==='economy'){svg.append(S('path',{d:'M15 60H88M22 52V35H35V52M43 52V25H56V52M64 52V13H77V52',...strokes}),S('path',{d:'M17 24L43 13L61 18L84 7',...strokes}));}
    else {svg.append(S('path',{d:'M16 27L50 10L84 27ZM22 58H78M17 65H83M29 33V53M43 33V53M57 33V53M71 33V53',...strokes}));}return svg;
  }
  function contextDetail(event,hypothesis=false){openDetail(event.title,body=>{body.append(E('p','',event.year+' · '+event.summary));appendSources(body,event.sourceIds,'context');if(hypothesis){const h=event.hypothesis;body.append(E('p','atlas-detail-warning','Δική μας ερευνητική υπόθεση. Δεν αποτελεί εταιρικό εύρημα ή απόδειξη αιτιότητας.'),E('h3','',h.title),E('p','',h.claim),E('h3','','Εναλλακτική εξήγηση'),E('p','',h.alternative),E('h3','','Τι θα χρειαζόταν για έλεγχο'));const ul=E('ul');h.needed.forEach(t=>ul.append(E('li','',t)));body.append(ul);
      if(h.companyEvidenceIds?.length){
        body.append(E('h3','','Σχετικά εταιρικά τεκμήρια'));
        h.companyEvidenceIds.forEach(id=>{
          const e=window.SAP_TIMELINE?.evidence.find(e=>e.id===id);
          if(!e)return;
          body.append(E('p','',id+' · '+e.title));
          e.sources.forEach(ref=>{
            const source=window.SAP_TIMELINE.sources.find(s=>s.id===ref.source);
            if(source)body.append(sourceLink({title:source.title+(ref.pdf_page?' · PDF σ. '+ref.pdf_page:''),url:source.url+(ref.pdf_page?'#page='+ref.pdf_page:'')}));
          });
        });
      }
    }});}
  function renderContext(){const list=$('atlas-context-cards');list.replaceChildren();const hypotheses=$('atlas-show-hypotheses').checked;
    for(const event of currentScene.events){const card=E('article','atlas-context-card '+event.category),art=E('div','atlas-context-art');art.append(E('span','',String(event.year)),contextArt(event.category));const body=E('div','atlas-context-body');body.append(E('h3','',event.title),E('p','',event.summary));const b=E('button','','Γεγονός & πηγή ↗');b.type='button';b.addEventListener('click',()=>contextDetail(event));body.append(b);
      if(hypotheses){const h=event.hypothesis,box=E('div','atlas-hypothesis');box.append(E('span','','ΔΙΚΗ ΜΑΣ ΥΠΟΘΕΣΗ'),E('h4','',h.title),E('p','',h.claim.replace(/^Ερευνητική υπόθεση:\s*/,'')));const more=E('button','','Πώς θα ελεγχθεί; ↗');more.type='button';more.addEventListener('click',()=>contextDetail(event,true));box.append(more);body.append(box);}card.append(art,body);list.append(card);}
    if(!currentScene.events.length)list.append(E('p','atlas-micro','Ο πρώτος επιλεγμένος σταθμός του εξωτερικού πλαισίου είναι το 1989. Δεν προσθέτουμε αναδρομικά γεγονότα πριν συμβούν.'));
  }
  function stop(){if(timer!==null)clearInterval(timer);timer=null;$('atlas-play').setAttribute('aria-pressed','false');$('atlas-play').textContent=year===2026?'▶ Από το 1984':'▶ Αναπαραγωγή';}
  function render(){currentScene=scene(year,[...selected]);$('atlas-year').textContent=year;$('atlas-range').value=year;$('atlas-range').setAttribute('aria-valuetext',String(year));$('atlas-prev').disabled=year===1984;$('atlas-next').disabled=year===2026;
    $('atlas-year-note').textContent=year===1984?'Αφετηρία 1983/1984: οι επίσημες πηγές διαφέρουν. Δείτε τα όρια της αποτύπωσης.':year===2026?'Πηγές ελεγμένες έως 12/11/2026 · όχι ζωντανό μητρώο.':'Αναδρομική τεκμηρίωση · η δημοσίευση μπορεί να είναι μεταγενέστερη.';
    document.querySelectorAll('[data-atlas-year]').forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.atlasYear)===year)));
    renderSelected();renderMap();renderRoles();renderCareers();renderContext();
    const location=currentScene.locations.find(l=>l.id===selectedUnit);if(location)unitDetail(location);else{$('atlas-unit-detail').replaceChildren(E('p','atlas-unit-empty atlas-micro','Επιλέξτε σημείο στον χάρτη για μονάδα, φωτογραφία και πηγές.'));selectedUnit=null;}
    $('atlas-live').textContent=year+': '+currentScene.locations.length+' τοποθεσίες, '+currentScene.personCount+' πρόσωπα στο αρχείο.';
    const url=new URL(locationHref());if(selected.size)url.searchParams.set('people',[...selected].join(','));else url.searchParams.delete('people');url.hash='year-'+year;history.replaceState(null,'',url);
  }
  function locationHref(){return window.location.href;}
  function setYear(value,playback=false){if(!playback)stop();year=clamp(value);render();if(year===2026)stop();else if(timer===null)stop();}
  $('atlas-play').addEventListener('click',()=>{if(timer!==null){stop();return;}if(year===2026)setYear(1984,true);$('atlas-play').textContent='Ⅱ Παύση';$('atlas-play').setAttribute('aria-pressed','true');timer=setInterval(()=>setYear(year+1,true),1700);});
  $('atlas-prev').addEventListener('click',()=>setYear(year-1));$('atlas-next').addEventListener('click',()=>setYear(year+1));$('atlas-range').addEventListener('input',e=>setYear(e.target.value));
  document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});window.addEventListener('pagehide',stop);
  $('atlas-open-people').addEventListener('click',()=>{stop();const open=$('atlas-directory').hidden;$('atlas-directory').hidden=!open;$('atlas-open-people').setAttribute('aria-expanded',String(open));if(open)$('atlas-person-search').focus();});
  $('atlas-clear-people').addEventListener('click',()=>{stop();selected.clear();render();renderDirectory();});$('atlas-person-search').addEventListener('input',renderDirectory);$('atlas-show-hypotheses').addEventListener('change',()=>{stop();renderContext();});
  $('atlas-close-dialog').addEventListener('click',()=>$('atlas-detail-dialog').close());$('atlas-detail-dialog').addEventListener('click',e=>{if(e.target===$('atlas-detail-dialog')){const r=e.target.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)e.target.close();}});
  document.querySelectorAll('[data-map-view]').forEach(b=>b.addEventListener('click',()=>{stop();view=b.dataset.mapView;renderMap();}));
  for(const y of [1984,1997,2007,2010,2020,2025,2026]){const b=E('button','',String(y));b.type='button';b.dataset.atlasYear=y;b.addEventListener('click',()=>setYear(y));$('atlas-year-jumps').append(b);}
  for(const event of C.events){const b=E('button','',event.year+' · '+event.title);b.type='button';b.addEventListener('click',()=>{setYear(event.year);$('atlas-context-cards').scrollIntoView({block:'center',behavior:'instant'});});$('atlas-context-index').append(b);}
  for(const id of ['marousi','thessaloniki']){const photo=unitPhoto(id);if(photo){const a=E('a');a.href=photo.sourceUrl;a.target='_blank';a.rel='noopener noreferrer';a.append(picture(photo),E('span','',id==='marousi'?'Ιατρικό Κέντρο Αθηνών ↗':'Ιατρικό Διαβαλκανικό ↗'));$('atlas-photo-strip').append(a);}}
  $('atlas-directory-count').textContent='('+P.people.length+')';
  const sourceList=$('atlas-source-list'),seenUrls=new Set();for(const group of Object.values(sources))for(const source of group.values()){if(seenUrls.has(source.url))continue;seenUrls.add(source.url);sourceList.append(sourceLink(source));}
  for(const photo of M.photos){const box=E('div','atlas-media-entry');box.append(sourceLink({title:photo.caption||photo.alt,url:photo.sourceUrl}),E('p','',photo.credit),E('p','',photo.rights));$('atlas-media-sources').append(box);}
  if(M.map){$('atlas-map-credit').href=M.map.sourceUrl;$('atlas-map-credit').target='_blank';$('atlas-map-credit').rel='noopener noreferrer';$('atlas-map-credit').textContent='Natural Earth ↗';$('atlas-media-sources').append(sourceLink({title:M.map.credit+' · '+M.map.license,url:M.map.licenseUrl}));}
  for(const p of M.locations){const box=E('div','atlas-media-entry');box.append(sourceLink({title:(shortNames[p.id]||p.id)+' · '+(p.accuracy==='city'?'κέντρο πόλης':'διεύθυνση μονάδας'),url:p.sourceUrl}));if(p.credit)box.append(E('p','',p.credit));$('atlas-media-sources').append(box);}
  const limits=[...new Set(H.steps.flatMap(s=>s.limitations||[]))];const ul=E('ul');limits.forEach(t=>ul.append(E('li','',t)));$('atlas-history-limits').append(ul);const pul=E('ul');(P.limitations||[]).forEach(t=>pul.append(E('li','',t)));$('atlas-people-limits').append(pul);
  const initial=new URL(window.location.href);const match=initial.hash.match(/year-(\d{4})/);year=match?clamp(match[1]):2026;(initial.searchParams.get('people')||'').split(',').filter(id=>people.has(id)).forEach(id=>selected.add(id));
  renderDirectory();render();stop();window.addEventListener('resize',()=>renderMap());window.addEventListener('hashchange',()=>{const m=window.location.hash.match(/year-(\d{4})/);if(m)setYear(m[1]);});
})();
