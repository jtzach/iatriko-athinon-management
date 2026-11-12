'use strict';
(() => {
  const $ = (id) => document.getElementById(id);
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const num = (n, digits=0) => new Intl.NumberFormat('el-GR',{minimumFractionDigits:digits,maximumFractionDigits:digits}).format(n);
  const H = window.HISTORY_TIMELINE, M = window.MEDIA_CATALOG, C = window.CONTEXT_TIMELINE;
  let evidence, additional, sourceMap = new Map(), lastStep = -1, lastTick = null, sceneDetails='';
  const state = {index:-1, phase:'intro', elapsedMs:0, sourcesOpen:false};
  const slides = [
    {id:'company', title:'Ποιον οργανισμό μελετάμε;', chapter:'Η αφετηρία / τρεις διαφορετικές κλίμακες', duration:25000, refs:['am25-finance','A25_NETWORK']},
    {id:'growth', title:'Από ένα σημείο σε ένα δίκτυο.', chapter:'Το δίκτυο στον χρόνο / Ελλάδα & Ρουμανία', duration:60000, refs:['history-official','history-origin-2007','medsana-history']},
    {id:'pandemic', title:'Όταν αλλάζει το εξωτερικό περιβάλλον.', chapter:'2020 / η πανδημία αλλάζει τις συνθήκες', duration:35000, refs:['am20-covid','am20-patients','CTX_COVID2020']},
    {id:'gaia', title:'Μια πώληση που ελευθερώνει χώρο.', chapter:'Εύρημα 01 / ανακατανομή πόρων', duration:0, finding:'gaia'},
    {id:'roles', title:'Η τεχνολογία και οι ρόλοι κινούνται παράλληλα.', chapter:'2024—2026 / δομή & ηγεσία', duration:55000, refs:['A24_REGIONAL','am24-sap','A25_REGIONAL','A25_QUALITY','A25_CFO','BOARD26','BOARD22']},
    {id:'role-concentration', title:'Ένα στέλεχος, τρεις ρόλοι.', chapter:'Εύρημα 02 / η κατανομή ευθύνης', duration:0, finding:'role-concentration'},
    {id:'nps', title:'Ο συνολικός δείκτης δεν λέει όλη την ιστορία.', chapter:'Εύρημα 03 / η εμπειρία ανά μονάδα', duration:0, finding:'nps'},
    {id:'margins', title:'Η πίεση είχε αρχίσει πριν από το SAP.', chapter:'Εύρημα 04 / ελέγχουμε την αρχική μας εξήγηση', duration:0, finding:'margins'},
    {id:'cashflow', title:'Κέρδος και μετρητά ακολουθούν άλλη πορεία.', chapter:'Εύρημα 05 / από την υπηρεσία στην είσπραξη', duration:0, finding:'cashflow'},
    {id:'journey', title:'Η ευθύνη ανάμεσα στα τμήματα.', chapter:'Το αόρατο οργανόγραμμα / η δική μας υπόθεση', duration:45000, refs:['am25-nps-method','am25-nps-units','A25_ORG']},
    {id:'culture', title:'Η αλλαγή περνά από τους ανθρώπους.', chapter:'Οργανωσιακή κουλτούρα / επτά φακοί', duration:45000, refs:['A25_VALUES','A25_SAFETY','am25-nps-units']},
    {id:'actions', title:'Τέσσερις προτάσεις προς τη διοίκηση.', chapter:'Από την παρατήρηση στην πράξη', duration:40000, refs:['am25-nps-units','am26h1-cash','A25_ORG','BOARD26']},
    {id:'closing', title:'Η συμβολή της μελέτης.', chapter:'Το συμπέρασμα / τεκμήρια, εξηγήσεις, υποθέσεις', duration:25000, refs:[]}
  ];
  const pdf25='https://www.iatriko.gr/wp-content/uploads/2026/06/oikonomika_apotelesmata_2025_pdf.pdf';
  const extraSources=[
    {id:'A25_ORG',title:'Ετήσια έκθεση 2025 — οργανωτική δομή',url:pdf25+'#page=91',pdfPage:91,printedPage:92},
    {id:'A25_VALUES',title:'Ετήσια έκθεση 2025 — εταιρικές αξίες',url:pdf25+'#page=66',pdfPage:66,printedPage:66,locator:'Ενότητα αξιών, σελ.66–67 PDF. Δηλωμένες αρχές, όχι μέτρηση της βιωμένης κουλτούρας.'},
    {id:'A25_SAFETY',title:'Ετήσια έκθεση 2025 — διαχείριση επαγγελματικού κινδύνου',url:pdf25+'#page=119',pdfPage:119,locator:'Ανάλυση κινδύνων και περιστατικών, διορθωτικές ενέργειες.'}
  ];
  const culture=[
    ['Καινοτομία & ανάληψη κινδύνων','Πώς μαθαίνεται μια νέα διαδικασία;','Προς έλεγχο: εκπαίδευση και υποστήριξη χρηστών SAP.'],
    ['Προσοχή στη λεπτομέρεια','Πώς εντοπίζονται τα σφάλματα;','Τεκμήριο: δημοσιευμένοι μηχανισμοί ποιότητας. Ανοικτό: καθημερινή εφαρμογή.'],
    ['Προσανατολισμός στα αποτελέσματα','Ποιοι δείκτες καθοδηγούν τις αποφάσεις;','Τεκμήριο: NPS και οικονομικοί δείκτες. Ανοικτό: χρήση τους ανά ομάδα.'],
    ['Προσανατολισμός στον άνθρωπο','Μπορεί ο εργαζόμενος να μιλήσει;','Δηλωμένος σεβασμός. Δεν διαθέτουμε ανεξάρτητη έρευνα εργαζομένων.'],
    ['Προσανατολισμός στην ομάδα','Ποιος λύνει ένα κοινό πρόβλημα;','Προς έλεγχο: συνεργασία γραμματείας, κλινικής, λογιστηρίου και IT.'],
    ['Ανταγωνιστικότητα','Ποια συμπεριφορά επιβραβεύεται;','Δεν διαθέτουμε στοιχεία κινήτρων ή εσωτερικού ανταγωνισμού.'],
    ['Σταθερότητα','Τι διατηρείται όταν αλλάζουν οι ρόλοι;','Προς έλεγχο: ισορροπία σταθερών διαδικασιών και αλλαγής. Οι αλλαγές τίτλων δεν μετρούν αυτή τη διάσταση.']
  ];
  function badge(type,label){return '<span class="evidence-badge '+(type==='company_claim'?'claim':type==='hypothesis'?'hypothesis':'')+'">'+esc(label || ({fact:'Δημοσιευμένο στοιχείο',company_claim:'Εταιρική εξήγηση',hypothesis:'Δική μας υπόθεση'}[type]))+'</span>';}
  function finding(id){return evidence.findings.find(f=>f.id===id)||additional.findings.find(f=>f.id===id);}
  function photo(id,cls=''){const p=M.photos.find(p=>p.id===id);return p?'<img class="'+cls+'" src="'+esc(p.src)+'" alt="'+esc(p.alt)+'" style="object-position:'+esc(p.objectPosition||'50% 50%')+'" loading="eager">':'';}
  function copy(era,title,lead,tail='',findingNo=0){const order=slides.filter(s=>s.finding).findIndex(s=>s.id===slides[state.index]?.id)+1;return '<div class="scene-copy">'+(findingNo?'<span class="finding-label"><b>Ⅱ</b> ΣΤΑΣΗ '+String(order).padStart(2,'0')+' / 05</span>':'<div class="era">'+era+'</div>')+'<h2 id="scene-title" tabindex="-1">'+title+'</h2><p class="lead">'+lead+'</p>'+tail+'</div>';}
  function statement(text,type='fact',label){return '<div class="statement '+(type==='hypothesis'?'hypothesis':'')+'"><strong>'+esc(label || (type==='hypothesis'?'ΥΠΟΘΕΣΗ ΠΡΟΣ ΕΛΕΓΧΟ':'ΤΟ ΔΙΟΙΚΗΤΙΚΟ ΕΡΩΤΗΜΑ'))+'</strong>'+text+'</div>';}
  const note=(text)=>'<p class="scene-note">'+text+'</p>';
  const sourceLink=(text='Πώς τεκμηριώνεται;')=>'<button class="tiny-source" data-action="sources">'+text+' ↗</button>';
  function company(){
    return copy('1984—2026','Ποιον οργανισμό<br><em>μελετάμε;</em>','Το Ιατρικό Αθηνών μέσα σε ένα ευρύτερο δίκτυο υπηρεσιών υγείας.',statement('Κάθε αριθμός έχει τη δική του περίμετρο.','fact','ΕΤΑΙΡΕΙΑ · ΟΜΙΛΟΣ · ΜΟΝΑΔΑ')+sourceLink())+
    '<div class="scene-visual scope-stack"><div class="scope-box"><span>01 / ΝΟΜΙΚΗ ΟΝΤΟΤΗΤΑ</span><h3>Η εταιρεία</h3><p>ΙΑΤΡΙΚΟ ΑΘΗΝΩΝ Ε.Α.Ε.<br>ΓΕΜΗ 356301000</p></div><div class="scope-box"><span>02 / ΕΝΟΠΟΙΗΣΗ</span><h3>Ο Όμιλος</h3><p>Η μητρική μαζί με τις θυγατρικές.<br>Εδώ αναφέρονται τα οικονομικά μας στοιχεία.</p></div><div class="scope-box"><span>03 / ΚΑΘΗΜΕΡΙΝΗ ΛΕΙΤΟΥΡΓΙΑ</span><h3>Η μονάδα</h3><p>Μια συγκεκριμένη κλινική ή υπηρεσία.<br>Εδώ εξετάζουμε την εμπειρία ασθενών.</p></div></div>';
  }
  const growthSteps=[
    {year:1984,title:'Η αφετηρία στο Μαρούσι.',text:'Το πρώτο σημείο της σημερινής εταιρικής ιστορίας.',places:['attica'],photo:'unit-marousi',caption:'Ιατρικό Κέντρο Αθηνών',limit:'Η έκθεση2007 αναφέρει1983. Η χρονολογική απόκλιση παραμένει ανοικτή.',context:'Η αφετηρία ενός οργανισμού υγείας'},
    {year:1991,title:'Το δίκτυο απλώνεται στην Αττική.',text:'Η εταιρική ιστορία καταγράφει την έναρξη στο Παλαιό Φάληρο.',places:['attica'],photo:'unit-faliro',caption:'Ιατρικό Παλαιού Φαλήρου',context:'Περισσότερες μονάδες, μεγαλύτερη ανάγκη συντονισμού'},
    {year:1997,title:'Ψυχικό και παρουσία στη Ρουμανία.',text:'Η δραστηριότητα αποκτά και διασυνοριακή διάσταση.',places:['attica','bucharest'],photo:'unit-psychiko',caption:'Ιατρικό Ψυχικού',limit:'Η Medsana αναφέρει1996 για το Cotroceni· η μητρική1997. Δεν συμφιλιώνουμε αυθαίρετα τις δύο χρονολογήσεις.',context:'Μία διοίκηση, διαφορετικά τοπικά περιβάλλοντα'},
    {year:2000,title:'Ένα νέο κέντρο στη Θεσσαλονίκη.',text:'Εγκαινιάζεται το Ιατρικό Διαβαλκανικό.',places:['attica','bucharest','thessaloniki'],photo:'unit-thessaloniki',caption:'Ιατρικό Διαβαλκανικό',context:'Δεύτερος μεγάλος πόλος στην Ελλάδα'},
    {year:2005,title:'Δεύτερο κέντρο στο Βουκουρέστι.',text:'Η Medsana προσθέτει το Primăverii.',places:['attica','bucharest','thessaloniki'],photo:'unit-bucharest',caption:'Medsana Primăverii',context:'Δύο κέντρα στην ίδια πόλη, μία ένδειξη στον χάρτη'},
    {year:2008,title:'Επέκταση στο Πλοϊέστι.',text:'Η επίσημη ιστορία της Medsana τοποθετεί εδώ τον επόμενο σταθμό.',places:['attica','bucharest','thessaloniki','ploiesti'],photo:'unit-bucharest',caption:'Medsana · φωτογραφία Primăverii',context:'Η γεωγραφία δημιουργεί νέες απαιτήσεις συντονισμού'}
  ];
  function mapSvg(places){
    const project=([x,y])=>[(x-18)*35+40,(49-y)*30+10];
    const ring=(coords)=>coords.map((p,i)=>{const q=project(p);return(i?'L':'M')+q.map(v=>v.toFixed(1)).join(',');}).join('')+'Z';
    let shapes=window.MAP_GEOGRAPHY.features.filter(f=>['Greece','Romania','Bulgaria','Albania','North Macedonia','Republic of Serbia'].includes(f.properties.ADMIN)).map(f=>{
      const polys=f.geometry.type==='Polygon'?[f.geometry.coordinates]:f.geometry.coordinates;
      return '<path class="country '+(['Greece','Romania'].includes(f.properties.ADMIN)?'focus':'')+'" d="'+polys.map(poly=>poly.map(ring).join('')).join('')+'"/>';
    }).join('');
    const locs={attica:[23.8,38.04,'Αττική',16,4],thessaloniki:[22.99,40.55,'Θεσσαλονίκη',-113,-13],bucharest:[26.11,44.43,'Βουκουρέστι',17,15],ploiesti:[26.02,44.95,'Πλοϊέστι',17,-13]};
    if(places.includes('bucharest')){const a=project(locs.attica),b=project(locs.bucharest);shapes+='<path class="map-route" d="M'+a.join(',')+'Q'+(a[0]+150)+','+(b[1]+100)+' '+b.join(',')+'"/>';}
    shapes+='<text class="map-label" x="168" y="335">ΕΛΛΑΔΑ</text><text class="map-label" x="275" y="90">ΡΟΥΜΑΝΙΑ</text>';
    places.forEach(id=>{const p=locs[id],q=project(p);shapes+='<circle class="map-marker" cx="'+q[0]+'" cy="'+q[1]+'" r="6"/><text class="marker-label" x="'+(q[0]+p[3])+'" y="'+(q[1]+p[4])+'">'+p[2]+'</text>';});
    return '<svg class="map-svg" viewBox="0 0 580 485" role="img" aria-label="Πραγματικός χάρτης Ελλάδας και Ρουμανίας. Σημειωμένες περιοχές: '+places.map(x=>locs[x][2]).join(', ')+'.">'+shapes+'</svg>';
  }
  function growth(step){
    const s=growthSteps[step];return copy(String(s.year),s.title,s.text,'<div class="history-track" aria-label="Σταθμός '+(step+1)+' από 6">'+growthSteps.map((_,i)=>'<span class="'+(i<=step?'active':'')+'"></span>').join('')+'</div>'+statement(s.context,'hypothesis','ΔΙΟΙΚΗΤΙΚΗ ΑΝΑΓΝΩΣΗ')+sourceLink()+note(s.limit || 'Επιλεγμένοι σταθμοί· οι φωτογραφίες δεν χρονολογούνται κατ’ ανάγκη στο έτος που εμφανίζεται.'))+'<div class="scene-visual map-panel">'+mapSvg(s.places)+'<figure class="map-photo">'+photo(s.photo)+'<figcaption>'+esc(s.caption)+'</figcaption></figure><div class="map-legend">Περιοχές ιστορικής παρουσίας<br>Σταθερό σύγχρονο υπόβαθρο<br>Natural Earth · GeoNames</div></div>';
  }
  function pandemic(){
    const p=evidence.historyFacts.find(x=>x.id==='covid-2020').metrics.inpatients;
    return copy('2020','Η πανδημία αλλάζει<br><em>τη ροή των ασθενών.</em>','Το εξωτερικό περιβάλλον φτάνει μέσα στην καθημερινή λειτουργία.', '<div class="headline"><span>11 ΜΑΡΤΙΟΥ 2020 · ΠΑΓΚΟΣΜΙΟΣ ΟΡΓΑΝΙΣΜΟΣ ΥΓΕΙΑΣ</span><p>Η COVID-19 χαρακτηρίζεται πανδημία.</p></div><div class="context-list" aria-label="Οι έξι φακοί PESTEL"><span>Πολιτικό · μέτρα</span><span>Οικονομικό · κόστος</span><span>Κοινωνικό · ζήτηση</span><span>Τεχνολογικό · συστήματα</span><span>Περιβαλλοντικό · πόροι</span><span>Νομικό · συμμόρφωση</span></div><p class="scene-note">PESTEL: έξι φακοί διερεύνησης. Η εταιρική επίδραση ελέγχεται ανά περίπτωση.</p>'+sourceLink())+
    '<div class="scene-visual visual-panel"><div class="panel-label">ΕΣΩΤΕΡΙΚΟΙ ΑΣΘΕΝΕΙΣ / ΚΛΙΝΙΚΕΣ ΟΜΙΛΟΥ</div><div class="covid-chart" style="grid-template-columns:1fr 1fr">'+p.values.map((r,i)=>'<div class="covid-bar"><strong>'+num(r.value)+'</strong><div class="bar" style="height:'+(r.value/100000*120)+'px;background:'+(i?'#d6a568':'var(--teal)')+'"></div><small>'+r.year+'</small></div>').join('')+'</div><p class="baseline-label"><b>−7,9%</b> εσωτερικοί ασθενείς · 2019→2020</p>'+badge('company_claim')+'<p style="font-size:13px;margin:12px 0 0">Η έκθεση αναφέρει περίπου δύο μήνες αναστολής τακτικών χειρουργείων στο πρώτο κύμα.</p>'+note('Η εταιρική ερμηνεία δεν απομονώνει αιτιωδώς όλες τις μεταβολές. Οι εσωτερικοί ασθενείς δεν είναι αριθμός χειρουργείων.')+'</div>';
  }
  function gaia(){
    const m=finding('gaia').metrics;
    return copy('','Πωλείται η ΓΑΙΑ.<br><em>Ελευθερώνεται χώρος.</em>','2021 · Μια κερδοφόρα μαιευτική δραστηριότητα μεταβιβάζεται από το Ιατρικό Αθηνών στο ΙΑΣΩ.',statement('Η αφαίρεση μιας δραστηριότητας μπορεί να υπηρετεί την ανάπτυξη άλλων.','hypothesis','ΔΙΚΗ ΜΑΣ ΕΡΜΗΝΕΙΑ')+note('Η διοίκηση επικαλείται πλήρη δυναμικότητα και περιορισμό χώρου. Η απόδοση της νέας χρήσης δεν έχει επαληθευτεί.')+sourceLink(),1)+
    '<div class="scene-visual"><div class="gaia-visual"><div class="gaia-building">'+photo('unit-marousi','building-photo')+'<div class="building-body"><small>ΜΑΡΟΥΣΙ / ΙΑΤΡΙΚΟ ΑΘΗΝΩΝ</small><h3>Ίδιος χώρος.<br>Νέες χρήσεις.</h3><div class="building-floor">Γενική κλινική</div><div class="building-floor gaia-floor">ΓΑΙΑ · μεταβίβαση δραστηριότητας</div></div></div><div class="transfer-arrow" aria-hidden="true">→</div><div class="gaia-receiving"><div class="hospital-icon" aria-hidden="true">✚</div><h3>ΙΑΣΩ</h3><p>Απόκτηση δραστηριότητας<br><strong>16.12.2021</strong></p>'+badge('fact','Επιβεβαίωση αγοραστή')+'</div></div><div class="gaia-profit"><strong>€'+num(m.activityProfitAfterTax.value)+' χιλ.</strong><span>Κέρδη ΓΑΙΑ μετά φόρων<br>έως τη μεταβίβαση το2021,<br>χωρίς το κέρδος πώλησης</span></div><div class="gaia-kpis"><div><strong>100</strong><span>κλίνες γενικής κλινικής</span></div><div><strong>4</strong><span>χειρουργικές αίθουσες</span></div><div>'+badge('company_claim','Εταιρική ανακοίνωση')+'<p style="font-size:10px;margin:8px 0 0">Δηλωμένη απελευθέρωση δυναμικότητας.</p></div></div></div>';
  }
  function roles(step){
    const content=[
      {year:'2024',title:'Η περιφερειακή ευθύνη<br><em>πριν από την έναρξη SAP.</em>',lead:'Ο Θεόδωρος Τάλαρης αναλαμβάνει Περιφερειακός Διευθυντής τον Σεπτέμβριο2024.',detail:'<h3>Ένας ρόλος συντονισμού.</h3><div class="role-pills"><span>Σεπτέμβριος2024<br><b>Περιφερειακή διεύθυνση</b></span><span>1 Ιανουαρίου2025<br><b>Έναρξη ERP SAP</b></span></div>'+note('Ο ρόλος προηγείται της παραγωγικής έναρξης. Δεν γνωρίζουμε αν συνδέεται με την προετοιμασία του SAP.')},
      {year:'2025',title:'Πρόσθετοι ρόλοι.<br><em>Κοινή ψηφιακή μετάβαση.</em>',lead:'Ο ίδιος περιφερειακός διευθυντής αναλαμβάνει επιπλέον δύο γενικές διευθύνσεις, σε διαφορετικούς μήνες.',detail:'<h3>Θεόδωρος Τάλαρης</h3><div class="role-pills"><span>Ιανουάριος2025<br><b>ΓΔ Παλαιού Φαλήρου</b></span><span>Ιούλιος2025<br><b>ΓΔ Περιστερίου</b></span></div>'+note('Πιθανό όφελος: κοινός συντονισμός. Προς έλεγχο: φόρτος και εύρος ευθύνης. Πρόκειται για δική μας αξιολόγηση, όχι μέτρηση απόδοσης.')},
      {year:'2026',title:'Η ηγεσία αλλάζει.<br><em>Η συνέχεια διατηρείται.</em>',lead:'Στις2 Ιανουαρίου2026 ανακατανέμονται οι ανώτατοι ρόλοι της οικογενειακής διοίκησης.',detail:'<div class="person-row">'+[['george-apostolopoulos','Γεώργιος','Εκτελεστικό μέλος'],['vasilis-apostolopoulos','Βασίλειος','Πρόεδρος ΔΣ'],['christos-apostolopoulos','Χρήστος','Διευθύνων Σύμβουλος']].map(p=>'<div class="person">'+photo(p[0])+'<strong>'+p[1]+' Αποστολόπουλος</strong><span>'+p[2]+'</span></div>').join('')+'</div>'+note('Η διαδοχή είναι τεκμηριωμένη. Συμμετοχική και μετασχηματιστική ηγεσία: θεωρητικοί φακοί για έλεγχο συμπεριφορών, όχι χαρακτηρισμοί που προκύπτουν από τίτλους ή επώνυμα.')}
    ][step];
    return copy(content.year,content.title,content.lead,badge('fact','Δημοσιευμένοι ρόλοι')+statement('Κοινό σύστημα και αλλαγές ρόλων συνυπάρχουν. Η σχέση αιτίας παραμένει ανοικτή.','hypothesis','ΤΟ ΟΡΙΟ ΤΗΣ ΕΡΜΗΝΕΙΑΣ')+sourceLink())+
    '<div class="scene-visual"><div class="roles-track">'+[['2024','Περιφερειακή ευθύνη'],['2025','SAP & πρόσθετοι ρόλοι'],['2026','Διαδοχή ηγεσίας']].map((s,i)=>'<div class="role-era '+(step===i?'active':'')+'"><b>'+s[0]+'</b><p>'+s[1]+'</p></div>').join('')+'</div><div class="role-detail">'+content.detail+'</div>'+note('Δημόσια καταγεγραμμένοι ρόλοι. Δεν πρόκειται για πλήρη απογραφή στελεχών ή για σχέσεις διοικητικής υπαγωγής. Φωτογραφίες από επίσημες δημόσιες πηγές.')+'</div>';
  }
  function nps(){
    const m=finding('nps').metrics, order=['faliro','peristeri','thessaloniki','marousi','psychiko','pediatric'];
    return copy('','Πίσω από τον δείκτη,<br><em>έξι διαφορετικές πορείες.</em>','2024→2025 · Ο συνολικός NPS βελτιώνεται ελαφρά. Οι μονάδες ακολουθούν διαφορετικές διαδρομές.',statement('Πού χρειάζεται να εστιάσει η διοίκηση όταν η συνολική εικόνα φαίνεται σταθερή;')+note('NPS: προθυμία σύστασης, όχι κλινική ποιότητα. Τέσσερις μονάδες βελτιώνονται, δύο υποχωρούν. Αφορά τις δημοσιευμένες ελληνικές μονάδες.')+sourceLink(),2)+
    '<div class="scene-visual"><div class="nps-summary"><div>ΣΥΝΟΛΙΚΟΣ NPS<small>2024 → 2025</small></div><strong>'+m.total.nps2024+' <span style="font-weight:300">→</span> '+m.total.nps2025+'</strong><div>+1 μονάδα<small>'+num(m.total.responses2025)+' αξιολογήσεις / 2025</small></div></div><div class="nps-grid">'+order.map(id=>{const r=m.clinics.find(c=>c.id===id);return '<article class="nps-card '+(r.changePoints<0?'negative':'')+'"><h3>'+esc(r.label)+'</h3><div class="nps-values">'+r.nps2024+' <span class="arrow" aria-hidden="true">'+(r.changePoints>0?'↗':'↘')+'</span> '+r.nps2025+'</div><div class="nps-years">2024 → 2025</div><div class="nps-delta">'+(r.changePoints>0?'+':'−')+Math.abs(r.changePoints)+' μονάδες NPS</div><div class="nps-sample">n='+num(r.responses2025)+' · 2025</div></article>';}).join('')+'</div>'+note('Διαφορετικά ετήσια δείγματα. Δεν τεκμηριώνεται επίδραση SAP ή αξιολόγηση συγκεκριμένου στελέχους. Ο συνολικός NPS δεν είναι απλός μέσος των έξι τιμών.')+'</div>';
  }
  function margins(){
    const m=finding('margins').metrics,a=m.annual,x=[60,285,510], y=v=>40+(110-v)*4.5;
    const revenue=a.map(r=>r.revenue/a[0].revenue*100),ebitda=a.map(r=>r.ebitda/a[0].ebitda*100);
    const line=(vals,color)=>'<polyline points="'+vals.map((v,i)=>x[i]+','+y(v)).join(' ')+'" fill="none" stroke="'+color+'" stroke-width="4"/>'+vals.map((v,i)=>'<circle cx="'+x[i]+'" cy="'+y(v)+'" r="6" fill="'+color+'" stroke="white" stroke-width="3"/>').join('');
    const svg='<svg class="financial-svg" viewBox="0 0 580 295" role="img" aria-label="Με βάση2023 ίσον100, τα έσοδα αυξάνονται σε106,7 ενώ το EBITDA μειώνεται σε72,3 το2025.">'+[70,85,100,110].map(v=>'<line x1="45" y1="'+y(v)+'" x2="530" y2="'+y(v)+'" stroke="#d9dfd8" stroke-dasharray="3 5"/><text x="7" y="'+(y(v)+5)+'">'+v+'</text>').join('')+'<line x1="405" y1="15" x2="405" y2="240" stroke="#8f739f" stroke-dasharray="5 5"/><text class="sap-label" x="398" y="20" text-anchor="end">1/1/2025</text><text class="sap-label" x="398" y="39" text-anchor="end">Έναρξη SAP</text>'+line(revenue,'#007b73')+line(ebitda,'#b74340')+a.map((r,i)=>'<text x="'+x[i]+'" y="280" text-anchor="middle">'+r.year+'</text>').join('')+'<text class="value-label" x="517" y="'+(y(revenue[2])-12)+'" text-anchor="end">106,7</text><text class="value-label" x="517" y="'+(y(ebitda[2])+30)+'" text-anchor="end">72,3</text><text class="start-label" x="63" y="68">2023 = 100</text></svg>';
    return copy('','Περισσότερα έσοδα.<br><em>Μικρότερο περιθώριο.</em>','2023–2025 · Η τάση ξεκινά πριν από την έναρξη του SAP.',statement('Η έναρξη του SAP δεν επαρκεί ως εξήγηση ολόκληρης της τάσης.','fact','ΑΝΤΕΝΔΕΙΞΗ ΣΤΗΝ ΑΡΧΙΚΗ ΥΠΟΘΕΣΗ')+note('Ενοποιημένος Όμιλος. Οι δείκτες μεταβολής έχουν κοινή βάση2023=100· τα περιθώρια παρακάτω είναι ποσοστά επί των εσόδων.')+sourceLink(),3)+
    '<div class="scene-visual visual-panel"><div class="metric-key"><span>Έσοδα</span><span>EBITDA</span></div>'+svg+'<div class="margin-cards">'+a.map(r=>'<div><span>'+r.year+' / ΠΕΡΙΘΩΡΙΟ EBITDA</span><strong>'+num(r.ebitdaMarginPercent,2)+'%</strong></div>').join('')+'</div><div class="recovery"><strong>Κρατάμε και το αντίθετο στοιχείο.</strong><br>Α΄ εξάμηνο2026: EBITDA περίπου <b>+17,1%</b> έναντι α΄ εξαμήνου2025. Οι λειτουργικές ταμειακές ροές, όμως, υποχωρούν.</div>'+note('EBITDA: αποτέλεσμα πριν από τόκους, φόρους και αποσβέσεις. Δεν ταυτίζεται με καθαρό κέρδος ή μετρητά. Τα εξάμηνα συγκρίνονται χωριστά.')+'</div>';
  }
  function journey(){
    return copy('Η υπόθεση','Ποιος κρατά<br><em>το νήμα της εμπειρίας;</em>','Η διαδρομή ενός ασθενή περνά από πολλές υπηρεσίες. Εξετάζουμε τον συντονισμό ανάμεσά τους.',badge('hypothesis')+statement('Ο συντονισμός μεταξύ τμημάτων μπορεί να επηρεάζει το πώς αποδίδει μια κοινή τεχνολογία.','hypothesis')+sourceLink())+
    '<div class="scene-visual"><div class="journey-flow">'+[['↳','Υποδοχή','Στοιχεία & εισαγωγή'],['✚','Φροντίδα','Κλινικές υπηρεσίες'],['≡','Χρέωση','Έλεγχος & εξιτήριο'],['✓','Εκκαθάριση','Πληρωμή & είσπραξη']].map(r=>'<div class="journey-node"><div class="journey-icon" aria-hidden="true">'+r[0]+'</div><h3>'+r[1]+'</h3><p>'+r[2]+'</p></div>').join('')+'</div><div class="journey-bridge">Κοινός συντονισμός · δεδομένα · υποστήριξη IT<small>Ενδεικτική διαδρομή προς διερεύνηση· δεν είναι επαληθευμένη εσωτερική ροή ή επίσημο οργανόγραμμα.</small></div><div class="complaint-note">'+badge('company_claim')+'<p>Η έκθεση2025 εντοπίζει τα συχνότερα γραπτά παράπονα σε διοικητικές διαδικασίες, αναμονή και συντονισμό.</p></div>'+note('Δεν έχουμε κατανομή των παραπόνων ανά αιτία SAP. Χρειάζονται μηνιαία δεδομένα διαδικασιών, φόρτου, εκπαίδευσης και στελέχωσης.')+'</div>';
  }
  function cultureScene(){
    return copy('7 φακοί','Η αλλαγή περνά<br><em>από τους ανθρώπους.</em>','Οι δημοσιευμένες αξίες δίνουν κατεύθυνση. Η καθημερινή κουλτούρα χρειάζεται δικό της έλεγχο.',statement('Μπορούν οι ομάδες να αναφέρουν ένα πρόβλημα, να συνεργαστούν και να μάθουν από αυτό;','hypothesis','ΤΟ ΕΡΩΤΗΜΑ ΤΗΣ ΑΛΛΑΓΗΣ')+'<button class="tiny-source" data-action="culture">Οι επτά διαστάσεις και τι γνωρίζουμε ↗</button>'+note('Δεν βαθμολογούμε την κουλτούρα από τον NPS και δεν αποδίδουμε στυλ ηγεσίας χωρίς στοιχεία συμπεριφοράς.'))+
    '<div class="scene-visual culture-grid">'+culture.map((r,i)=>'<article class="culture-item"><b>'+String(i+1).padStart(2,'0')+'</b><div><h3>'+r[0]+'</h3><p>'+r[1]+'</p></div></article>').join('')+'</div>';
  }
  function actions(){
    return copy('Η πρόταση','Η παρατήρηση<br><em>γίνεται απόφαση.</em>','Τέσσερις διοικητικές προτάσεις, με συγκεκριμένο τρόπο ελέγχου.',badge('hypothesis','Προτάσεις της ομάδας')+note('Εργαλεία διοικητικής βελτίωσης προς αξιολόγηση. Δεν παρουσιάζονται ως εγκριμένες εταιρικές ενέργειες.')+sourceLink())+
    '<div class="scene-visual actions-grid">'+[
      ['01 / ΠΕΡΙΒΑΛΛΟΝ','Έγκαιρα σενάρια','Παρακολούθηση κανονιστικών, οικονομικών και τεχνολογικών πιέσεων με PESTEL.','Έλεγχος: τριμηνιαία αναθεώρηση κινδύνων'],
      ['02 / ΔΟΜΗ','Καθαρή ευθύνη διαδικασίας','Ορισμός υπευθύνου για τη διαδρομή εισαγωγή–εξιτήριο–τιμολόγηση.','Έλεγχος: χρόνος επίλυσης ανά διατμηματικό ζήτημα'],
      ['03 / ΚΟΥΛΤΟΥΡΑ','Μάθηση ανά μονάδα','Μικρές ομάδες βελτίωσης με ανατροφοδότηση εργαζομένων και κοινή μάθηση.','Έλεγχος: εκπαίδευση, επαναλαμβανόμενα λάθη'],
      ['04 / ΗΓΕΣΙΑ','Στήριξη στην πράξη','Συμμετοχική καθοδήγηση και σαφής διαδρομή κλιμάκωσης των προβλημάτων.','Έλεγχος: χρόνος από αναφορά σε διορθωτική ενέργεια']
    ].map(r=>'<article class="action-card"><span class="action-id">'+r[0]+'</span><h3>'+r[1]+'</h3><p>'+r[2]+'</p><small>'+r[3]+'</small></article>').join('')+'</div>';
  }
  function closing(){
    return copy('Η συμβολή','Συνδέουμε στοιχεία.<br><em>Ελέγχουμε εξηγήσεις.</em>','Το Ιατρικό Αθηνών προσφέρει μια περίπτωση όπου η γεωγραφία, η κατανομή πόρων και η ψηφιακή μετάβαση μπορούν να μελετηθούν μαζί.','<div class="closing-actions"><button data-action="archive">Δείτε την έρευνα ↗</button><button data-action="restart">Από την αρχή ↺</button></div>'+note('Έρευνα και κατασκευή με υποστήριξη ΤΝ. Ο ουσιαστικός έλεγχος της ομάδας εκκρεμεί. Δεν ισχυριζόμαστε ότι η σύνθεση δεν έχει δημοσιευθεί ποτέ αλλού.'))+
    '<div class="scene-visual closing-visual"><h3>Το «αόρατο» βρίσκεται<br><em>στις συνδέσεις.</em></h3><div class="closing-row"><b>01</b><span>Δραστηριότητες → κατανομή πόρων</span></div><div class="closing-row"><b>02</b><span>Κοινό σύστημα → διαφορετικές εμπειρίες</span></div><div class="closing-row"><b>03</b><span>Χρονική ακολουθία → έλεγχος της εξήγησης</span></div><p style="font-size:11px;color:#bfd5d0;margin:24px 0 0">Δημοσιευμένα στοιχεία · εταιρικές εξηγήσεις · δικές μας υποθέσεις</p></div>';
  }
  function cashflow(){
    const f=finding('cashflow'),metrics=['ebitda','operating-cash-flow'].map(id=>f.metrics.find(m=>m.id===id)),zero=255,scale=8;
    let bars='';metrics.forEach((m,i)=>[m.before,m.after].forEach((p,j)=>{const v=p.value/1000,x=90+i*290+j*100,y=zero-v*scale;bars+='<rect x="'+x+'" y="'+Math.min(zero,y)+'" width="66" height="'+Math.abs(v*scale)+'" rx="4" fill="'+(v<0?'#b74340':j?'#007b73':'#a8ccc0')+'"/><text class="cash-value" x="'+(x+33)+'" y="'+(v<0?y+25:y-13)+'" text-anchor="middle">'+num(v,2)+'</text><text x="'+(x+33)+'" y="378" text-anchor="middle">'+(j?'2026':'2025')+'</text>';}));
    const chart='<svg class="cash-svg" viewBox="0 0 620 410" role="img" aria-label="Α΄ εξάμηνα2025 και2026, Όμιλος, εκατομμύρια ευρώ. EBITDA17,105 και20,038. Λειτουργικές ταμειακές ροές0,717 και μείον7,557.">'+[20,10,0,-10].map(v=>'<line x1="55" x2="580" y1="'+(zero-v*scale)+'" y2="'+(zero-v*scale)+'" stroke="'+(v===0?'#809b96':'#dce3dc')+'" stroke-dasharray="'+(v===0?'0':'3 5')+'"/><text x="35" y="'+(zero-v*scale+4)+'" text-anchor="end">'+v+'</text>').join('')+bars+'<text class="cash-label" x="173" y="30" text-anchor="middle">EBITDA</text><text class="cash-label" x="463" y="30" text-anchor="middle">Λειτουργικές ροές</text></svg>';
    return copy('','Ανάκαμψη κερδοφορίας.<br><em>Εκροή μετρητών.</em>','Α΄ εξάμηνο2025→2026 · ενοποιημένος Όμιλος',statement('Ποιος συντονίζει τη διαδρομή μέχρι την είσπραξη;','hypothesis'),5)+'<div class="scene-visual visual-panel"><div class="panel-label">ΟΜΙΛΟΣ · Α΄ ΕΞΑΜΗΝΟ · € ΕΚΑΤ.</div>'+chart+'<div class="cash-summary"><span>EBITDA <b>≈ +17,1%</b></span><span>Λειτουργικές ροές <b>−€7,56 εκατ.</b></span></div><p class="essential-caption">Δεν αποδεικνύει αφερεγγυότητα ή επίδραση SAP.</p></div>';
  }
  function roleConcentration(){
    return copy('','Ένα στέλεχος.<br><em>Τρεις ρόλοι.</em>','Θεόδωρος Τάλαρης · καταγραφές2024–2025',statement('Κοινός συντονισμός ή εξάρτηση από ένα πρόσωπο;','hypothesis'),2)+'<div class="scene-visual"><div class="role-network"><div class="role-person"><span aria-hidden="true">ΘΤ</span><h3>Θεόδωρος Τάλαρης</h3></div><div class="role-branches" aria-label="Τρεις δημοσιευμένοι ρόλοι του ίδιου προσώπου">'+[['09 /2024','Περιφερειακός διευθυντής','Όμιλος'],['01 /2025','Γενικός διευθυντής','Παλαιό Φάληρο'],['07 /2025','Γενικός διευθυντής','Περιστέρι']].map(r=>'<div><time>'+r[0]+'</time><h4>'+r[1]+'</h4><p>'+r[2]+'</p></div>').join('')+'</div></div><p class="essential-caption">Τίτλοι ρόλων· δεν μετρούν φόρτο ή απόδοση.</p><a class="graph-link" href="organization.html#2025">Εξερευνήστε το οργανόγραμμα <span>↗</span></a></div>';
  }
  const renderers={company,growth,pandemic,gaia,roles,'role-concentration':roleConcentration,nps,margins,cashflow,journey,culture:cultureScene,actions,closing};
  const sceneBrief={
    company:['Εταιρεία · Όμιλος · μονάδα','Διαφορετική κλίμακα. Διαφορετικοί αριθμοί.',''],
    growth:['Επιλεγμένοι ιστορικοί σταθμοί','Η επέκταση αυξάνει την ανάγκη συντονισμού.','Υπόθεση'],
    pandemic:['2019→2020 · κλινικές Ομίλου','Το περιβάλλον αλλάζει τη λειτουργία.',''],
    gaia:['2021 · μεταβίβαση μαιευτικής δραστηριότητας','Μικρότερο εύρος, περισσότερος διαθέσιμος χώρος.','Εταιρική εξήγηση'],
    roles:['Δημοσιευμένες μεταβολές ·2024–2026','Παράλληλες αλλαγές δεν αποδεικνύουν αιτιότητα.',''],
    'role-concentration':['Θεόδωρος Τάλαρης ·2024–2025','Κοινός συντονισμός ή εξάρτηση από ένα πρόσωπο;','Ερώτημα'],
    nps:['2024→2025 · ελληνικές μονάδες','Η συνολική εικόνα κρύβει τοπικές αποκλίσεις.',''],
    margins:['2023–2025 · ενοποιημένος Όμιλος','Η πτώση προηγείται της παραγωγικής έναρξης SAP.',''],
    cashflow:['Α΄ εξάμηνα2025–2026 · Όμιλος','Από την υπηρεσία στην είσπραξη: ποιος συντονίζει;','Ερώτημα'],
    journey:['Ενδεικτική διαδρομή ασθενούς','Η ευθύνη βρίσκεται και ανάμεσα στα τμήματα.','Υπόθεση'],
    culture:['Επτά διαστάσεις προς διερεύνηση','Οι δηλωμένες αξίες χρειάζονται έλεγχο στην πράξη.',''],
    actions:['Προτάσεις της ομάδας','Κάθε πρόταση χρειάζεται μετρήσιμο έλεγχο.',''],
    closing:['Συνδέσεις που γεννούν ερωτήματα','Δημόσια στοιχεία. Ελέγξιμες υποθέσεις.','']
  };
  function compressScene(id){
    const scene=$('scene'),brief=sceneBrief[id];sceneDetails='';
    const preserve=el=>{sceneDetails+=el.outerHTML;el.remove();};
    const lead=scene.querySelector('.scene-copy>.lead');if(lead&&brief){sceneDetails+=lead.outerHTML;lead.textContent=brief[0];}
    scene.querySelectorAll('.scene-copy>.statement,.scene-copy>.scene-note,.scene-copy>.headline,.scene-copy>.evidence-badge').forEach(preserve);
    scene.querySelectorAll('.scene-copy>.tiny-source').forEach(el=>el.dataset.action==='sources'?el.remove():preserve(el));
    scene.querySelectorAll('.scene-visual>.scene-note,.role-detail>.scene-note,.recovery,.complaint-note,.culture-item p,.action-card p').forEach(preserve);
    if(brief){const takeaway=document.createElement('div');takeaway.className='one-thought';takeaway.innerHTML=(brief[2]?'<span>'+esc(brief[2])+'</span>':'')+esc(brief[1]);scene.querySelector('.scene-copy').appendChild(takeaway);}
    if(id==='company'){scene.querySelectorAll('.scope-box p').forEach(preserve);}
    if(id==='growth'){
      const current=growthSteps[stepFor(slides[state.index])];scene.querySelector('.lead').textContent=current.caption;
      scene.querySelector('.map-legend').innerHTML='Περιοχές παρουσίας<br>Natural Earth · GeoNames';
      if(current.limit){const limit=document.createElement('p');limit.className='essential-caption';limit.textContent=stepFor(slides[state.index])===0?'Αφετηρία:1983 /1984 στις πηγές.':'Ρουμανία:1996 /1997 στις πηγές.';scene.querySelector('.scene-copy').appendChild(limit);}
    }
    if(id==='pandemic'){
      scene.querySelectorAll('.context-list span').forEach(el=>{sceneDetails+='<p>'+esc(el.textContent)+'</p>';el.textContent=el.textContent.split(' · ')[0];});
      scene.querySelectorAll('.scene-visual>p:not(.baseline-label),.scene-visual>.evidence-badge').forEach(preserve);
    }
    if(id==='nps')scene.querySelectorAll('.nps-card').forEach(card=>{sceneDetails+='<p>'+esc(card.querySelector('h3').textContent)+' · '+esc(card.querySelector('.nps-sample').textContent)+'</p>';card.querySelectorAll('.nps-years,.nps-sample').forEach(el=>el.remove());card.querySelector('.nps-delta').textContent=card.querySelector('.nps-delta').textContent.replace(' μονάδες NPS','');});
    const captions={nps:'NPS: πρόθεση σύστασης, όχι κλινική ποιότητα. Διαφορετικά δείγματα.',margins:'2023=100 · περιθώριο: EBITDA / έσοδα. Η τάση δεν αποδίδεται αιτιωδώς στο SAP.',journey:'Υπόθεση διαδικασίας· όχι επίσημο οργανόγραμμα.',roles:'Διαθέσιμες καταγραφές· όχι πλήρης απογραφή.'};
    if(captions[id]){const p=document.createElement('p');p.className='essential-caption';p.textContent=captions[id];scene.querySelector('.scene-visual').appendChild(p);}
    if(id==='journey'){scene.querySelectorAll('.journey-bridge small').forEach(preserve);}
    if(id==='roles'){const a=document.createElement('a');a.className='graph-link';a.href='organization.html#'+[2024,2025,2026][stepFor(slides[state.index])];a.innerHTML='Μετακινήστε πρόσωπα & ρόλους <span>↗</span>';scene.querySelector('.scene-visual').appendChild(a);}
    if(id==='actions')scene.querySelectorAll('.action-card small').forEach(el=>el.textContent=el.textContent.replace('Έλεγχος: ',''));
  }
  function stepFor(slide){return slide.id==='growth'?Math.min(5,Math.floor(state.elapsedMs/10000)):slide.id==='roles'?Math.min(2,Math.floor(state.elapsedMs/20000)):0;}
  function normalizeTypography(html){return html.replace(/([Α-Ωα-ωΆ-ώ])(\d)/g,'$1 $2').replace(/(\d)([Α-Ωα-ωΆ-ώ])/g,'$1 $2');}
  function renderScene(animate=true){
    const s=slides[state.index];if(!s)return;
    const step=stepFor(s);lastStep=step;
    $('scene').innerHTML=normalizeTypography(renderers[s.id](step));
    compressScene(s.id);
    $('scene').classList.toggle('scene-enter',animate);
    document.body.dataset.scene=s.id;
    $('scene-number').textContent=String(state.index+1).padStart(2,'0')+' / '+slides.length;
    $('scene-chapter').textContent=s.chapter;
    $('announcement').textContent=s.title+(s.finding?' Στάση ευρήματος. Πατήστε Συνέχεια όταν είστε έτοιμοι.':'');
    attachImageFallbacks();
  }
  function attachImageFallbacks(){
    document.querySelectorAll('img').forEach(img=>{
      if(img.dataset.fallbackReady)return;img.dataset.fallbackReady='true';
      img.addEventListener('error',()=>{img.style.visibility='hidden';img.parentElement.classList.add('image-unavailable');img.parentElement.setAttribute('data-image-status','Η φωτογραφία δεν είναι διαθέσιμη');});
    });
  }
  function updateControls(){
    const s=slides[state.index];if(!s)return;
    const frozen=state.phase==='frozen',running=state.phase==='playing';
    $('previous-button').disabled=state.index===0;
    $('pause-button').disabled=frozen || state.phase==='ended';
    $('pause-button').textContent=running?'Ⅱ Παύση':'▶ Αναπαραγωγή';
    $('continue-button').innerHTML=(state.index===slides.length-1?'Από την αρχή':frozen?'Συνέχεια':'Επόμενο')+' <span aria-hidden="true">'+(state.index===slides.length-1?'↺':'→')+'</span>';
    $('continue-button').classList.toggle('hold',frozen);
    $('player-status').textContent=frozen?'Στάση για σχολιασμό':state.phase==='ended'?'Η διαδρομή ολοκληρώθηκε':running?'Αυτόματη ροή':'Σε παύση';
    $('status-dot').classList.toggle('frozen',frozen);
    $('time-remaining').textContent=frozen?'Συνεχίζετε εσείς':state.phase==='ended'?'':Math.ceil(Math.max(0,s.duration-state.elapsedMs)/1000)+'″ έως την επόμενη σκηνή';
    document.querySelectorAll('#progress button').forEach((b,i)=>{
      b.setAttribute('aria-current',i===state.index?'step':'false');
      b.style.setProperty('--fill',(i<state.index?100:i>state.index?0:s.finding?100:Math.min(100,state.elapsedMs/s.duration*100))+'%');
    });
    document.body.classList.toggle('is-frozen',frozen);
  }
  function goTo(index,autoplay=true){
    if(!evidence)return;
    if(index<0){restart();return;}
    state.index=Math.min(slides.length-1,index);state.elapsedMs=0;
    const s=slides[state.index];state.phase=s.finding?'frozen':autoplay?'playing':'paused';
    $('intro').hidden=true;$('presentation').hidden=false;
    lastTick=null;renderScene();updateControls();
    if(!new URLSearchParams(location.search).has('qa'))history.replaceState(null,'','#'+s.id);
    window.scrollTo({top:0,behavior:'instant'});
  }
  function restart(){
    closeModal();state.index=-1;state.phase='intro';state.elapsedMs=0;lastTick=null;
    $('intro').hidden=false;$('presentation').hidden=true;delete document.body.dataset.scene;
    if(!new URLSearchParams(location.search).has('qa'))history.replaceState(null,'',location.pathname+location.search);
    $('start-button').focus();window.scrollTo({top:0,behavior:'instant'});
  }
  function pause(){if(state.phase==='playing'){state.phase='paused';updateControls();}}
  function advanceBy(ms){
    if(state.phase!=='playing'||state.sourcesOpen||!(ms>0))return;
    let remaining=ms;
    while(remaining>0 && state.phase==='playing'){
      const s=slides[state.index], step=Math.min(remaining,s.duration-state.elapsedMs);
      state.elapsedMs+=step;remaining-=step;
      const inner=stepFor(s);if(inner!==lastStep)renderScene(false);
      if(state.elapsedMs>=s.duration){
        if(state.index===slides.length-1){state.phase='ended';break;}
        goTo(state.index+1,true);
      }
    }
    updateControls();
  }
  function frame(time){
    if(lastTick!==null)advanceBy(Math.min(time-lastTick,1000));
    lastTick=time;requestAnimationFrame(frame);
  }
  function allSourceIds(s){
    return [...new Set(s.finding?finding(s.finding).sourceIds:s.refs)].filter(id=>sourceMap.has(id));
  }
  function sourceMarkup(ids){
    return ids.map(id=>{
      const s=sourceMap.get(id);if(!s)return '';
      const page=s.pdfPage || Number((s.url.match(/#page=(\d+)/)||[])[1]) || null;
      const url=page&&!s.url.includes('#')?s.url+'#page='+page:s.url;
      return '<div class="source-entry"><a href="'+esc(url)+'" target="_blank" rel="noopener noreferrer">'+esc(s.title)+' ↗</a><small>'+esc([page?'PDF σ.'+page:'Πηγή χωρίς σελιδαρίθμηση',s.printedPage?'έντυπη σ.'+s.printedPage:'',s.locator||''].filter(Boolean).join(' · '))+'</small></div>';
    }).join('');
  }
  function showModal(title,html,eyebrow='ΤΟ ΣΤΟΙΧΕΙΟ & Η ΠΗΓΗ'){
    pause();state.sourcesOpen=true;
    $('modal-title').textContent=title;$('modal-eyebrow').textContent=eyebrow;
    $('modal-content').innerHTML=normalizeTypography(html);
    if(!$('presentation-dialog').open)$('presentation-dialog').showModal();
    $('presentation-dialog').scrollTop=0;$('close-modal').focus();updateControls();
  }
  function closeModal(){if($('presentation-dialog').open)$('presentation-dialog').close();state.sourcesOpen=false;lastTick=null;updateControls();}
  function showSources(){
    if(state.index<0){showMethod();return;}
    const s=slides[state.index], f=s.finding?finding(s.finding):null;
    let content=f?'<p><b>Περίμετρος:</b> '+esc(f.scope)+'</p><div class="modal-claims">'+f.claims.map(c=>'<div class="modal-claim">'+badge(c.type)+'<p>'+esc(c.text)+'</p>'+sourceMarkup(c.sourceIds||[])+'</div>').join('')+'</div><h3>Τι παραμένει ανοικτό</h3><ul>'+f.limitations.map(t=>'<li>'+esc(t)+'</li>').join('')+'</ul>':'';
    if(s.id==='growth'){
      content+='<p>Επιλεγμένοι ιστορικοί σταθμοί από τις εταιρικές ιστορίες. Οι ενδείξεις είναι περιοχές παρουσίας, όχι πλήθος ενεργών κλινικών. Το υπόβαθρο και οι θέσεις αναφοράς παραμένουν σταθερά.</p><p>Διαφορές πηγών:1983/1984 για την αφετηρία και1996/1997 για τη Ρουμανία. Διατηρούνται ορατές και δεν ερμηνεύονται αυθαίρετα.</p>';
    }
    if(s.id==='roles')content+='<p>Οι καταγεγραμμένοι ρόλοι και οι ημερομηνίες δεν τεκμηριώνουν αιτιώδη επίδραση SAP. Η περιφερειακή εποπτεία προηγείται της έναρξης του συστήματος. Δεν συνάγουμε το στυλ ηγεσίας από τη συγγένεια ή τον τίτλο.</p>';
    if(s.id==='journey'||s.id==='actions')content+='<p>Το σχήμα διαδικασίας και οι προτάσεις αποτελούν δική μας σύνθεση. Η έκθεση περιγράφει διοικητικές τριβές, αλλά δεν τεκμηριώνει την έλλειψη συγκεκριμένου υπευθύνου ή την αποτελεσματικότητα των προτάσεων.</p>';
    if(sceneDetails)content+='<details><summary>Αναλυτική εξήγηση της σκηνής</summary>'+sceneDetails+'</details>';
    content+='<h3>Πρωτογενείς πηγές</h3>'+sourceMarkup(allSourceIds(s));
    if(s.id==='growth'||s.id==='roles'||s.id==='gaia')content+='<details><summary>Φωτογραφίες και χαρτογραφικό υπόβαθρο</summary>'+M.photos.filter(p=>s.id==='roles'?p.kind==='person':p.kind==='unit').map(p=>'<div class="source-entry"><a href="'+esc(p.sourceUrl)+'" target="_blank" rel="noopener noreferrer">'+esc(p.caption||p.alt)+' ↗</a><small>'+esc(p.credit)+' '+esc(p.usageNote||'Οι φωτογραφίες δεν τεκμηριώνουν την εμφάνιση σε κάθε ιστορικό έτος.')+'</small></div>').join('')+'<p>Natural Earth v5.1.2, δημόσια χρήση· GeoNames, CC BY4.0. <a href="history.html#atlas-method">Αναλυτικά γεωγραφικά στοιχεία</a>.</p></details>';
    if(!allSourceIds(s).length)content+='<p>Σύνθεση των προηγούμενων σκηνών. Οι πηγές βρίσκονται στις στάσεις ευρημάτων.</p>';
    showModal(f?f.headline:s.title,content);
  }
  function showMethod(){
    showModal('Πώς χτίστηκε η μελέτη.','<p>Συνδυάζουμε πρωτογενείς εταιρικές εκθέσεις, χρηματιστηριακές ανακοινώσεις και διασταυρώσεις από άλλους εμπλεκόμενους οργανισμούς. Κάθε εύρημα διακρίνει:</p><div class="modal-claims"><div class="modal-claim">'+badge('fact')+'<p>Αριθμοί, ημερομηνίες και δημόσια καταγεγραμμένοι ρόλοι.</p></div><div class="modal-claim">'+badge('company_claim')+'<p>Ερμηνείες ή επιδιώξεις που αποδίδονται στην ίδια την εταιρεία.</p></div><div class="modal-claim">'+badge('hypothesis')+'<p>Δικές μας προτάσεις σύνδεσης των στοιχείων, με ανάγκη περαιτέρω ελέγχου.</p></div></div><h3>Πραγματική χρήση ΤΝ</h3><p>Η ΤΝ χρησιμοποιήθηκε στην αναζήτηση και σύγκριση πηγών, στην οργάνωση δεδομένων και γράφου, στην πρώτη πλήρη συγγραφή της αρχικής μελέτης και στην κατασκευή/δοκιμή της ιστοσελίδας. Ο ουσιαστικός έλεγχος από τα μέλη της ομάδας εκκρεμεί.</p><p>Η ιστοσελίδα παρουσιάζει επιμελημένα ευρήματα και εξαγωγή πραγματικής βάσης Neo4j. Οι κόμβοι μετακινούνται στον περιηγητή, χωρίς δημόσια σύνδεση στη βάση. Δεν παράγει ζωντανές απαντήσεις από LLM. Η χρονολογική συνύπαρξη δεν αποδεικνύει αιτιότητα.</p><p><a href="research.html#ai-declaration">Δήλωση χρήσης ΤΝ και αρχική μελέτη ↗</a></p>','ΜΕΘΟΔΟΣ & ΔΙΑΦΑΝΕΙΑ');
  }
  function showArchive(){
    showModal('Η έρευνα πίσω από την παρουσίαση.','<div class="archive-links"><a href="organization.html">Ετήσιο οργανόγραμμα ↗<small>Neo4j: πρόσωπα, ρόλοι, αρμοδιότητες και μετακινούμενοι κόμβοι.</small></a><a href="history.html">Άνθρωποι & τόποι ↗<small>Ο αναλυτικός χάρτης, τα πρόσωπα και οι τεκμηριωμένοι ρόλοι.</small></a><a href="sap.html">Ο γράφος πριν / μετά το SAP ↗<small>Τεκμήρια, μεταβολές και χωριστές ερευνητικές υποθέσεις.</small></a><a href="research.html#paper">Πλήρες κείμενο & Word ↗<small>Η αρχική μελέτη3500λέξεων με βιβλιογραφία.</small></a><a href="data/presentation-evidence.json" download>Νέα ευρήματα & πηγές ↓<small>Δομημένο αρχείο τεκμηρίων της παρούσας παρουσίασης.</small></a></div><p class="modal-warning">Η παρουσίαση περιλαμβάνει νεότερα ευρήματα που δεν έχουν ακόμη ενσωματωθεί στο αρχικό Word. Τα αρχεία εργασίας παραμένουν προς έλεγχο της ομάδας.</p><p><button class="tiny-source" data-action="method">Μέθοδος και δήλωση χρήσης ΤΝ ↗</button></p>','ΤΟ ΑΝΑΛΥΤΙΚΟ ΑΡΧΕΙΟ');
  }
  function showChapters(){
    showModal('Η διαδρομή της παρουσίασης.','<p>5½ λεπτά αυτόματης ροής + πέντε στάσεις. Συνεχίζετε εσείς.</p><div class="chapter-list">'+slides.map((s,i)=>'<button data-scene-index="'+i+'"><b>'+String(i+1).padStart(2,'0')+'</b><span>'+esc(s.title)+'</span><small>'+(s.finding?'Ⅱ ΣΤΑΣΗ':s.duration/1000+'″')+'</small></button>').join('')+'</div><p><button class="secondary-button" data-action="restart">Από την αρχή ↺</button></p>','ΕΠΙΛΕΞΤΕ ΕΝΑ ΣΗΜΕΙΟ');
  }
  function showCulture(){
    showModal('Επτά διαστάσεις, με σαφή όρια.','<p>Πλαίσιο ανάγνωσης σύμφωνα με τα ζητούμενα της εργασίας. Οι δημόσιες αναφορές δεν αρκούν για απογραφή της βιωμένης κουλτούρας.</p><table class="culture-table"><thead><tr><th>Διάσταση</th><th>Τι γνωρίζουμε / τι χρειάζεται</th></tr></thead><tbody>'+culture.map(r=>'<tr><td>'+r[0]+'</td><td>'+r[2]+'</td></tr>').join('')+'</tbody></table><h3>Δομή και ηγεσία</h3><p>Εξετάζουμε πώς η κατανομή ευθύνης, το εύρος διοίκησης και οι διαδικασίες αποφάσεων διευκολύνουν τη μάθηση. Η συμμετοχική/μετασχηματιστική ηγεσία αποτελεί προτεινόμενο θεωρητικό φακό, όχι αποδεδειγμένο χαρακτηρισμό της εταιρείας.</p>'+sourceMarkup(['A25_VALUES','A25_SAFETY','am25-nps-units'])+'<p><a href="research.html#paper">Αναλυτική συζήτηση και ακαδημαϊκή βιβλιογραφία ↗</a></p>','ΚΟΥΛΤΟΥΡΑ & ΘΕΩΡΗΤΙΚΗ ΑΝΑΓΝΩΣΗ');
  }
  function act(action){
    if(action==='start'){goTo(0,true);$('scene-title').focus({preventScroll:true});}
    if(action==='next'){closeModal();state.index===slides.length-1?restart():goTo(state.index+1,true);}
    if(action==='previous')goTo(state.index-1,false);
    if(action==='pause' && !['intro','frozen','ended'].includes(state.phase)){state.phase=state.phase==='playing'?'paused':'playing';lastTick=null;updateControls();}
    if(action==='restart')restart();
    if(action==='sources')showSources();
    if(action==='close')closeModal();
    if(action==='chapters')showChapters();
    if(action==='archive')showArchive();
    if(action==='method')showMethod();
    if(action==='culture')showCulture();
    if(action==='fullscreen'){
      const promise=document.fullscreenElement?document.exitFullscreen?.():document.documentElement.requestFullscreen?.();
      if(promise?.catch)promise.catch(()=>{$('announcement').textContent='Η πλήρης οθόνη δεν είναι διαθέσιμη σε αυτόν τον περιηγητή.';});
    }
  }
  document.addEventListener('click',e=>{
    const jump=e.target.closest('[data-scene-index]');
    if(jump){closeModal();goTo(Number(jump.dataset.sceneIndex),false);return;}
    const button=e.target.closest('[data-action]');if(button&&!button.disabled)act(button.dataset.action);
  });
  document.addEventListener('keydown',e=>{
    if(state.sourcesOpen || state.index<0 || /INPUT|TEXTAREA|SELECT/.test(e.target.tagName))return;
    if(e.key==='ArrowRight'){e.preventDefault();act('next');}
    if(e.key==='ArrowLeft'){e.preventDefault();if(state.index>0)act('previous');}
    if(e.code==='Space'&&!e.target.closest('button,a')){e.preventDefault();if(state.phase==='frozen')act('next');else act('pause');}
  });
  $('presentation-dialog').addEventListener('close',()=>{state.sourcesOpen=false;lastTick=null;updateControls();});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();lastTick=null;});
  window.addEventListener('blur',()=>{pause();});
  $('progress').innerHTML=slides.map((s,i)=>'<button data-scene-index="'+i+'" class="'+(s.finding?'is-finding':'')+'" aria-label="'+esc((i+1)+'. '+s.title+(s.finding?' — στάση ευρήματος':''))+'" title="'+esc(s.title)+'"></button>').join('');
  attachImageFallbacks();
  Promise.all(['data/presentation-evidence.json','data/additional-findings.json'].map(url=>fetch(url).then(r=>{if(!r.ok)throw new Error('HTTP '+r.status);return r.json();}))).then(([data,extra])=>{
    evidence=data;
    additional=extra;
    extra.findings.forEach(f=>{f.sourceIds=f.sources.map(s=>s.id);f.claims=[...f.documented,{type:'hypothesis',text:f.hypothesis,sourceIds:[]},f.counterevidence];f.limitations=[f.limit,...f.limitations];});
    [...H.sources,...(C?.sources||[]),...extraSources,...data.sources,...extra.findings.flatMap(f=>f.sources)].forEach(s=>sourceMap.set(s.id,s));
    $('start-button').disabled=false;$('load-status').textContent='Στις στάσεις συνεχίζετε εσείς.';
    if(new URLSearchParams(location.search).has('qa')){
      window.PresentationDebug={
        getState:()=>({index:state.index,id:slides[state.index]?.id||'intro',phase:state.phase,running:state.phase==='playing',frozen:state.phase==='frozen',elapsedMs:state.elapsedMs,durationMs:slides[state.index]?.duration||0,total:slides.length,sourcesOpen:state.sourcesOpen}),
        goTo,advanceBy,slides:slides.map(s=>({id:s.id,durationMs:s.duration,frozen:!!s.finding})),totalTimedMs:slides.reduce((a,s)=>a+s.duration,0)
      };
    }
    const initial=slides.findIndex(s=>'#'+s.id===location.hash);
    if(initial>=0)goTo(initial,false);
    if(location.hash==='#paper'||location.hash==='#ai-declaration'){location.replace('research.html'+location.hash);return;}
    requestAnimationFrame(frame);
  }).catch(()=>{
    $('load-status').innerHTML='Τα τεκμήρια δεν φορτώθηκαν. <button class="tiny-source" onclick="location.reload()">Δοκιμάστε ξανά</button> ή <a href="research.html">δείτε τη μελέτη</a>.';
  });
})();
