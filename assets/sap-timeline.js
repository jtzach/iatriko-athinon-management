/* A curated evidence graph. Time refers to events, not publication availability. */
(function () {
  'use strict';
  const data = window.SAP_TIMELINE;
  if (!data) return;
  const periods = [
    {title:'Πριν από το SAP',date:'Έως το 2024'},
    {title:'Έναρξη εφαρμογής',date:'Ιανουάριος 2025'},
    {title:'Περίοδος μετάβασης',date:'Τέλος 2025'},
    {title:'Διαδοχή ηγεσίας',date:'2 Ιανουαρίου 2026'}
  ];
  const tracks = [
    {id:'roles',title:'Ρόλοι κλινικών'}, {id:'leadership',title:'Ηγεσία'},
    {id:'oversight',title:'Εποπτεία'}, {id:'experience',title:'Εμπειρία ασθενών'}
  ];
  const kinds = {fact:'Τεκμηριώνεται στην πηγή',change:'Τεκμηριωμένη μεταβολή',claim:'Εταιρική ερμηνεία',hypothesis:'Δική μας υπόθεση'};
  const sources = new Map(data.sources.map(s=>[s.id,s]));
  const evidence = new Map(data.evidence.map(e=>[e.id,e]));
  const dates = {A22:'Υπογραφές 27/04/2023',A23:'Υπογραφές 29/04/2024',A24:'Υπογραφές 29/04/2025',A25:'Υπογραφές 30/04/2026',H26:'Υπογραφές 29/09/2026',BOARD22:'Απόφαση 17/06/2022',BOARD26:'Ανακοίνωση 02/01/2026',CFO25:'Ανακοίνωση 03/11/2025',RC23:'Έγκριση 22/04/2024',RC24:'Έγκριση 24/04/2025',TALARIS25:'Δημοσίευση 03/02/2025',JOB_BW:'Ακριβής ημερομηνία μη επαληθευμένη'};
  function node(id,title,sub,x,y,refs,icon='structure',status='fact') {return {id,title,sub,x,y,refs,icon,status};}
  function edge(from,to,label,x,y,refs,status='fact',note='') {return {id:from+'-'+to,from,to,label,x,y,refs,status,note};}
  function getScene(period,track,showHypotheses=false) {
    const p=Math.max(0,Math.min(3,Number(period)||0));
    let nodes=[],edges=[],summary='';
    if(track==='roles') {
      nodes=[node('talaris','Θεόδωρος Τάλαρης','Διοικητικό στέλεχος',22,27,['E06'],'people'),node('regional','Περιφερειακή διεύθυνση','Από Σεπτέμβριο 2024',78,13,['E06']),node('quality-person','Γιάννης Καλοφυσούδης','Διοικητικό στέλεχος',22,77,['E07'],'people'),node('quality','Ποιότητα','Διευθυντής από το 2011',78,70,['E07'])];
      edges=[edge('talaris','regional','κατέχει τον ρόλο',50,15,['E06']),edge('quality-person','quality','κατέχει τον ρόλο',50,70,['E07'])];
      if(p>=1) {nodes.push(node('faliro','Γενική διεύθυνση','Παλαιό Φάληρο · Ιαν. 2025',78,35,['E06'],'hospital','change'));edges.push(edge('talaris','faliro','επιπλέον ρόλος',50,35,['E06'],'change'));}
      if(p>=2) {
        nodes.push(node('peristeri','Γενική διεύθυνση','Περιστέρι · Ιούλ. 2025',78,55,['E06'],'hospital','change'),node('sustainability','Βιώσιμη ανάπτυξη','Παράλληλα · Σεπτ. 2025',78,89,['E07'],'environment','change'));
        edges.push(edge('talaris','peristeri','ανάληψη ρόλου',50,54,['E06'],'change'),edge('quality-person','sustainability','παράλληλη ευθύνη',50,89,['E07'],'change'));
      }
      const ys={regional:10,faliro:30,peristeri:50,quality:70,sustainability:90};nodes.forEach(n=>{if(ys[n.id])n.y=ys[n.id];});edges.forEach(e=>{if(ys[e.to])e.y=ys[e.to];});
      summary=p===0?'Δύο ήδη υπάρχοντες ρόλοι αποτελούν το σημείο σύγκρισης.':p===1?'Προστίθεται ο ρόλος της γενικής διεύθυνσης Π. Φαλήρου. Η πηγή δίνει μήνα, όχι συγκεκριμένη ημέρα.':'Τεκμηριώνονται πρόσθετοι ρόλοι σε συγκεκριμένα στελέχη. Δεν τεκμηριώνεται ότι προκλήθηκαν από το SAP.';
    } else if(track==='leadership') {
      const after=p===3;
      nodes=[node('george','Γεώργιος Αποστολόπουλος','Ιδρυτής',22,20,['E10'],'leadership'),node('vasilis','Βασίλειος Αποστολόπουλος','Μέλος διοίκησης',22,50,['E10'],'people'),node('christos','Χρήστος Αποστολόπουλος','Μέλος διοίκησης',22,80,['E10'],'people'),node('george-role',after?'Εκτελεστικό στέλεχος':'Πρόεδρος ΔΣ',after?'Αναφορά στο ΔΣ · Επίτιμος Πρόεδρος':'Εκτελεστικό μέλος',78,20,['E10'],'company',after?'change':'fact'),node('vasilis-role',after?'Πρόεδρος ΔΣ':'Διευθύνων σύμβουλος','Εκτελεστικό μέλος',78,50,['E10'],'company',after?'change':'fact'),node('christos-role',after?'Διευθύνων σύμβουλος':'Α΄ Αντιπρόεδρος ΔΣ','Εκτελεστικό μέλος',78,80,['E10'],'company',after?'change':'fact')];
      edges=['george','vasilis','christos'].map((id,i)=>edge(id,id+'-role',after?'νέος ρόλος · 02/01/2026':'τεκμηριωμένος ρόλος',50,20+i*30,['E10'],after?'change':'fact'));
      summary=after?'Ρητή διαδοχή στην καθημερινή διοίκηση και στη στρατηγική ανάπτυξη. Οι δύο διάδοχοι είχαν ήδη ευρείες εξουσίες πριν από το SAP.':'Η προγενέστερη σύνθεση τεκμηριώνεται στο πρακτικό του 2022. Δεν εμφανίζουμε το SAP ως αιτία της διαδοχής του 2026.';
    } else if(track==='oversight') {
      nodes=[node('risk','Μονάδα κινδύνων','Εταιρεία και σημαντικές θυγατρικές',22,30,['E05'],'structure'),node('ceo','CEO / Γενικός Διευθυντής','Διοικητική αναφορά',78,13,['E05'],'leadership'),node('audit','ΔΣ / Επιτροπή Ελέγχου','Λειτουργική αναφορά',78,48,['E05'],'company'),node('monthly','Μηνιαίος έλεγχος επιδόσεων','Υπάρχει ήδη το 2022–2023',22,78,['E01'],'report')];
      edges=[edge('risk','ceo','διοικητική αναφορά',50,16,['E05']),edge('risk','audit','λειτουργική αναφορά',50,47,['E05'])];
      if(p>=2) {nodes.push(node('it','Διεύθυνση Πληροφορικής','Ενημέρωση στις 31/10/2025',78,83,['E08'],'technology','change'));edges.push(edge('it','audit','ενημέρωσε για SAP',78,65,['E08'],'change','Συγκεκριμένο συμβάν ενημέρωσης. Δεν αποτυπώνει μόνιμη διοικητική υπαγωγή.'));}
      summary=p<2?'Οι μηχανισμοί ελέγχου προϋπήρχαν. Οι δύο τύποι αναφοράς δεν έχουν το ίδιο διοικητικό νόημα.':'Η ενημέρωση για SAP φτάνει στην Επιτροπή Ελέγχου. Είναι καταγεγραμμένο συμβάν, όχι νέα γραμμή υπαγωγής.';
    } else {
      const after=p>=2;
      nodes=[node('sap','SAP',p===0?'Στόχος ολοκλήρωσης για το 2024':'Παραγωγικά από 01/01/2025',22,24,[p===0?'E02':'E03'],'technology',p===1?'change':'fact'),node('nps','Συνολικός NPS',after?'48 · έτος 2025':'47 · έτος 2024',78,24,['E13'],'people'),node('coordination',after?'Συντονισμός υπηρεσιών':'Αξιολογήσεις ασθενών',after?'Θέμα παραπόνων κατά την εταιρεία':'84.052 · έτος 2024',78,67,[after?'E12':'E13'],'hospital',after?'claim':'fact')];
      if(after) {nodes.push(node('delays','Καθυστερήσεις','Έναρξη και σταθεροποίηση',22,67,['E12'],'report','claim'));edges.push(edge('sap','delays','εταιρική απόδοση',22,46,['E12'],'claim','Η ίδια η εταιρεία αποδίδει καθυστερήσεις στη μετάβαση. Δεν υπάρχει ανεξάρτητη εκτίμηση της επίδρασης.'));}
      summary=after?'Ο συνολικός NPS αυξάνεται, ενώ οι μονάδες ακολουθούν διαφορετικές πορείες. Δεν υπάρχει τεκμηριωμένη αιτιώδης σχέση SAP → μεταβολή NPS.':'Οι αριθμοί αφορούν το 2024. Δεν υπάρχει μέτρηση NPS ειδικά για τον Ιανουάριο 2025 στις πηγές που εξετάσαμε.';
    }
    if(showHypotheses) {
      // Move the entire evidenced scene up before adding one clearly separate hypothesis.
      nodes.forEach(n=>{n.y=7+n.y*.68;});edges.forEach(e=>{e.y=7+e.y*.68;});
      const h=track==='experience'?data.hypotheses[1]:data.hypotheses[0];
      nodes.push({...node(h.id,track==='experience'?'Διαφορετική αφομοίωση;':'Ποιος συντονίζει τα τμήματα;','Υπόθεση προς έλεγχο',50,89,[], 'report','hypothesis'),hypothesisId:h.id});
      // No speculative causal line is drawn as if it were observed.
    }
    return {nodes,edges,summary,period:p,track};
  }
  window.SAP_GRAPH_MODEL={periods,tracks,getScene,kinds};
  if(typeof document==='undefined') return;
  const $=id=>document.getElementById(id), el=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e;};
  if(!$('sap-map'))return;
  const params=new URLSearchParams(location.search);
  let state={period:Math.max(0,Math.min(3,Number(params.get('period'))||0)),track:tracks.some(t=>t.id===params.get('track'))?params.get('track'):'roles',hypotheses:false},scene,selected=null;
  const button=(text,cls,fn)=>{const b=el('button',cls,text);b.type='button';b.addEventListener('click',fn);return b;};
  const personIds={george:'george-apostolopoulos',vasilis:'vasilis-apostolopoulos',christos:'christos-apostolopoulos',talaris:'theodoros-talaris','quality-person':'giannis-kalofysoudis'};
  const portrait=id=>personIds[id]?window.MEDIA_CATALOG?.photos.find(p=>p.kind==='person'&&p.personId===personIds[id]):undefined;
  function reference(r) {
    const s=sources.get(r.source),a=el('a','sap-reference');a.href=s.url+(r.pdf_page?'#page='+r.pdf_page:'');a.target='_blank';a.rel='noopener noreferrer';
    a.textContent=s.title+(r.pdf_page?' · PDF σ. '+r.pdf_page+(r.printed_page!==r.pdf_page?' / έντυπη '+r.printed_page:''):'')+' ↗';
    return a;
  }
  function detail(item) {
    selected=item.id;
    document.querySelectorAll('.sap-node,.sap-edge-label').forEach(b=>b.classList.toggle('is-selected',b.dataset.key===item.id));
    const box=$('sap-detail');box.replaceChildren();
    box.append(el('span','sap-status status-'+item.status,kinds[item.status]),el('h3','',item.title||item.label));
    if(personIds[item.id]){
      const a=el('a','sap-reference','Ακολουθήστε το πρόσωπο στον χάρτη →');a.href='history.html?people='+personIds[item.id]+'#year-'+(state.period===3?2026:state.period===0?2024:2025);box.append(a);
      const photo=portrait(item.id);if(photo){const credit=el('a','sap-reference','Φωτογραφία: '+photo.caption+' ↗');credit.href=photo.sourceUrl;credit.target='_blank';credit.rel='noopener noreferrer';box.append(credit,el('p','sap-meta','Η φωτογραφία αναγνωρίζει το πρόσωπο· δεν χρονολογεί τον ρόλο.'));}
    }
    if(item.hypothesisId) {
      const h=data.hypotheses.find(h=>h.id===item.hypothesisId);
      box.append(el('p','',h.statement),el('h4','','Τι χρειάζεται για να ελεγχθεί;'));
      const list=el('ul');h.missingEvidence.forEach(t=>list.append(el('li','',t)));box.append(list,el('p','sap-detail-limit','Οι παρακάτω πηγές δίνουν το ερευνητικό πλαίσιο. Δεν αποδεικνύουν την υπόθεση.'));
      renderEvidence(box,h.supportingEvidenceIds);return;
    }
    if(item.note)box.append(el('p','sap-detail-limit',item.note));
    renderEvidence(box,item.refs);
    const related=scene.edges.filter(e=>e.from===item.id||e.to===item.id);
    if(related.length) {
      box.append(el('h4','','Οι σχέσεις αυτής της κάρτας'));
      related.forEach(e=>box.append(button(e.label+' → '+scene.nodes.find(n=>n.id===e.to).title,'sap-related',()=>detail(e))));
    }
  }
  function renderEvidence(box,ids) {
    ids.forEach((id,i)=>{
      const e=evidence.get(id),d=el('details','sap-evidence');d.open=i===0;
      d.append(el('summary','',e.title));
      const body=el('div','sap-evidence-body');body.append(el('p','',e.finding),el('p','sap-meta','Περίμετρος: '+e.scope),el('p','sap-meta','Χρόνος γεγονότος / αναφοράς: '+e.event_or_period),el('p','sap-detail-limit',e.limitation));
      e.sources.forEach(r=>{body.append(reference(r),el('small','sap-publication',dates[r.source]||''));});d.append(body);box.append(d);
    });
  }
  function drawLines() {
    const map=$('sap-map'),svg=$('sap-lines'),labels=$('sap-edge-labels');if(!scene)return;
    const mobile=matchMedia('(max-width:620px)').matches;
    const base=state.track==='roles'&&state.period>=2?(mobile?850:760):(mobile?690:620);
    map.style.height=Math.round(base*(state.hypotheses?1.4:1))+'px';
    const bounds=map.getBoundingClientRect();svg.setAttribute('viewBox','0 0 '+bounds.width+' '+bounds.height);svg.replaceChildren();labels.replaceChildren();
    const NS='http://www.w3.org/2000/svg';
    scene.edges.forEach(e=>{
      const a=map.querySelector('[data-key="'+e.from+'"]'),b=map.querySelector('[data-key="'+e.to+'"]');if(!a||!b)return;
      const ar=a.getBoundingClientRect(),br=b.getBoundingClientRect();let ax=ar.left-bounds.left+ar.width/2,ay=ar.top-bounds.top+ar.height/2,bx=br.left-bounds.left+br.width/2,by=br.top-bounds.top+br.height/2;
      const dx=bx-ax,dy=by-ay;
      if(Math.abs(dx)>Math.abs(dy)*.7) {ax+=Math.sign(dx)*ar.width/2;bx-=Math.sign(dx)*br.width/2;} else {ay+=Math.sign(dy)*ar.height/2;by-=Math.sign(dy)*br.height/2;}
      const line=document.createElementNS(NS,'path');line.setAttribute('d',`M${ax},${ay} L${bx},${by}`);line.setAttribute('class','sap-edge '+e.status);line.setAttribute('fill','none');svg.append(line);
      const angle=Math.atan2(by-ay,bx-ax),size=8,arrow=document.createElementNS(NS,'path');arrow.setAttribute('d',`M${bx},${by} L${bx-size*Math.cos(angle-.5)},${by-size*Math.sin(angle-.5)} L${bx-size*Math.cos(angle+.5)},${by-size*Math.sin(angle+.5)} Z`);arrow.setAttribute('class','sap-arrow '+e.status);svg.append(arrow);
      const label=button(e.label,'sap-edge-label status-'+e.status,()=>detail(e));label.dataset.key=e.id;label.style.left=e.x+'%';label.style.top=e.y+'%';label.setAttribute('aria-label',e.label+' · Εξήγηση και πηγές');labels.append(label);
    });
  }
  function renderNps() {
    const area=$('sap-nps');area.hidden=state.track!=='experience';area.replaceChildren();if(area.hidden)return;
    const after=state.period>=2;
    area.append(el('h3','',after?'Μία συνολική τιμή, διαφορετικές πορείες':'Η εικόνα πριν από την εφαρμογή'),el('p','',after?'Δημοσιευμένες τιμές NPS 2024 → 2025. Οι μεταβολές είναι περιγραφικές, όχι επίδραση του SAP.':'Δημοσιευμένες τιμές NPS του 2024, διαθέσιμες στην έκθεση που υπογράφηκε το 2025.'));
    const table=el('table','sap-nps-table'),head=el('thead'),tr=el('tr');['Μονάδα','2024',...(after?['2025','Διαφορά']:[])].forEach(t=>tr.append(el('th','',t)));head.append(tr);table.append(head);
    const body=el('tbody');[{unit:'Συνολικός δείκτης',nps_2024:47,nps_2025:48,change_points:1},...data.nps.clinics].forEach(d=>{
      const row=el('tr');row.append(el('th','',d.unit),el('td','',String(d.nps_2024)));if(after){row.append(el('td','',String(d.nps_2025)),el('td',d.change_points<0?'negative':'positive',(d.change_points>0?'+':'')+d.change_points));}body.append(row);
    });table.append(body);area.append(table,el('p','sap-meta',after?'84.052 αξιολογήσεις το 2024 · 80.156 το 2025. Διαφορετικά δείγματα, χωρίς έλεγχο σύνθεσης ασθενών ή στατιστικής σημαντικότητας.':'84.052 αξιολογήσεις συνολικά. Δεν γνωρίζουμε από το γράφημα το πλήθος 2024 ανά μονάδα.'));
    data.nps.source_refs.forEach(r=>{if(after||r.source==='A24')area.append(reference(r));});
  }
  function render() {
    scene=getScene(state.period,state.track,state.hypotheses);selected=null;
    $('sap-period').textContent=periods[state.period].date+' · '+tracks.find(t=>t.id===state.track).title;
    $('sap-period-note').textContent='Αναδρομική αποτύπωση: οι πηγές μπορεί να δημοσιεύθηκαν αργότερα. Οι άγνωστες λήξεις ρόλων παραμένουν άγνωστες.';
    if(state.period===3&&state.track!=='leadership')$('sap-period-note').textContent='Για αυτή τη θεματική εμφανίζονται οι τελευταίες καταγραφές του 2025. Δεν πιστοποιείται συνέχιση ρόλων ή ίδια επίδοση το 2026.';
    $('sap-summary').textContent=scene.summary;
    document.querySelectorAll('[data-track]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.track===state.track)));
    document.querySelectorAll('[data-period]').forEach(b=>{const active=Number(b.dataset.period)===state.period;b.setAttribute('aria-pressed',String(active));if(active)b.setAttribute('aria-current','step');else b.removeAttribute('aria-current');});
    $('sap-time-prev').disabled=state.period===0;$('sap-time-next').disabled=state.period===3;
    const nodes=$('sap-nodes');nodes.replaceChildren();scene.nodes.forEach(n=>{
      const b=button('','sap-node status-'+n.status,()=>detail(n));b.dataset.key=n.id;b.style.left=n.x+'%';b.style.top=n.y+'%';
      const img=el('img');img.src='assets/illustrations/'+n.icon+'.svg';img.alt='';img.width=40;img.height=34;
      const photo=portrait(n.id);if(photo){img.src=photo.src;img.alt=photo.alt;img.referrerPolicy='no-referrer';img.style.cssText='width:40px;height:40px;border-radius:50%;object-fit:cover;object-position:'+photo.objectPosition;img.addEventListener('error',()=>{img.src='assets/illustrations/'+n.icon+'.svg';img.alt='';},{once:true});}
      b.append(img,el('strong','',n.title),el('small','',n.sub));b.setAttribute('aria-label',n.title+' · '+kinds[n.status]+' · Εξήγηση και πηγές');nodes.append(b);
    });
    let list=$('sap-mobile-relations');if(!list){list=el('div','sap-mobile-relations');list.id='sap-mobile-relations';$('sap-map').after(list);}list.replaceChildren();
    scene.edges.forEach(e=>list.append(button(scene.nodes.find(n=>n.id===e.from).title+' → '+scene.nodes.find(n=>n.id===e.to).title+' · '+e.label,'sap-related',()=>detail(e))));
    drawLines();renderNps();detail(scene.nodes[0]);
  }
  tracks.forEach(t=>{const b=button(t.title,'sap-track',()=>{state.track=t.id;render();});b.dataset.track=t.id;$('sap-track-buttons').append(b);});
  periods.forEach((p,i)=>{const b=button('','sap-time',()=>{state.period=i;render();});b.dataset.period=i;b.append(el('small','',p.date),el('strong','',p.title));$('sap-time-buttons').append(b);});
  $('sap-hypotheses').addEventListener('change',e=>{state.hypotheses=e.target.checked;render();if(state.hypotheses)detail(scene.nodes[scene.nodes.length-1]);});
  $('sap-time-prev').onclick=()=>{state.period=Math.max(0,state.period-1);render();};$('sap-time-next').onclick=()=>{state.period=Math.min(3,state.period+1);render();};
  data.sources.forEach(s=>{const li=el('li');li.append(reference({source:s.id}),el('small','sap-publication',dates[s.id]||''));$('sap-source-list').append(li);});
  new ResizeObserver(drawLines).observe($('sap-map'));render();
})();
