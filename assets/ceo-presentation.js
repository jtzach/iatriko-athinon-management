'use strict';
(() => {
  const $ = id => document.getElementById(id);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const signed = n => (n > 0 ? '+' : n < 0 ? '−' : '') + Math.abs(n);
  const labels = {published_fact:'Δημοσιευμένο στοιχείο',company_claim:'Εταιρική ανακοίνωση',proposal:'Δική μας πρόταση προς έλεγχο',hypothesis:'Δική μας υπόθεση',context:'Ανεξάρτητη διοικητική μελέτη'};
  const badge = type => '<span class="type-badge '+esc(type)+'">'+esc(labels[type])+'</span>';
  let data, player, sources = new Map(), findingMap = new Map(), modalOpen = false, lastFrame = null, renderedIndex = -1, lastPhase = '', lastTime = '', loadAttempt = 0, opener = null;
  const limits = {
    cover:'Ακαδημαϊκή μελέτη με υποστήριξη ΤΝ. Ο ουσιαστικός έλεγχος της ομάδας εκκρεμεί.',
    decisions:'Οι προτεινόμενοι έλεγχοι δεν προϋποθέτουν ότι απουσιάζουν ήδη από την εταιρεία.',
    'nps-total':'Έξι ελληνικές μονάδες. Διαφορετικά δείγματα ανά έτος. Ο NPS δεν μετρά κλινική ποιότητα.',
    'nps-units':'Η απόκλιση χρειάζεται έλεγχο δείγματος και αιτιών. Δεν αποδεικνύει επίδραση SAP.',
    'patient-journey':'Ενδεικτική αναλυτική διαδρομή, όχι τεκμηριωμένη περιγραφή εταιρικών διαδικασιών.',
    'elliniko-dates':'Προβλέψεις ολοκλήρωσης συγκροτήματος. Η διαφορά δεν αποδεικνύει αναβολή.',
    'document-timeline':'Η σειρά των εγγράφων δεν αρκεί για να συμφιλιώσει τις δύο προβλέψεις.',
    'readiness-dependencies':'Ενδεικτικές εξαρτήσεις. Δεν πρόκειται για το οργανόγραμμα ή το εγκεκριμένο πρόγραμμα του έργου.',
    'gaia-profit':'Αποτέλεσμα έως τη μεταβίβαση το 2021, χωρίς το ξεχωριστό κέρδος πώλησης.',
    'gaia-capacity':'Δηλωμένη απελευθέρωση δυναμικότητας. Η μεταγενέστερη αξιοποίηση δεν έχει επαληθευτεί ανεξάρτητα.',
    'space-comparison':'Προτεινόμενο μέτρο σύγκρισης. Τα δημόσια στοιχεία δεν αποδεικνύουν υπεραπόδοση της νέας χρήσης.',
    'pilot-choice':'Προτάσεις ελέγχου με εγκεκριμένα δεδομένα, χωρίς προεξόφληση αποτελέσματος.'
  };

  function validate(payload) {
    if (!payload || payload.scenes?.length !== 12 || payload.findings?.length !== 3) throw Error('Invalid presentation');
    const ids = new Set(payload.sources.map(s => s.id));
    if (ids.size !== payload.sources.length) throw Error('Duplicate source');
    for (const s of payload.sources) if (new URL(s.url).protocol !== 'https:') throw Error('Invalid source URL');
    const walk = value => {
      if (!value || typeof value !== 'object') return;
      if (value.sourceIds) for (const id of value.sourceIds) if (!ids.has(id)) throw Error('Missing source');
      for (const child of Object.values(value)) if (typeof child === 'object') walk(child);
    };
    walk(payload);
    if (new Set(payload.scenes.map(s => s.id)).size !== 12) throw Error('Duplicate scene');
    for (const [i,s] of payload.scenes.entries()) {
      if (s.slide !== i + 1 || !(s.seconds > 0) || !limits[s.visual] || !Array.isArray(s.limitations)) throw Error('Invalid scene');
      if (!labels[s.classification] && s.classification !== 'mixed') throw Error('Invalid classification');
    }
    if (JSON.stringify(payload.scenes.filter(s => s.pauseAtFinding).map(s => s.slide)) !== '[4,6,9]') throw Error('Invalid stops');
    if (payload.scenes.reduce((n,s)=>n+s.seconds,0) !== 420 || payload.scenes.filter(s=>!s.pauseAtFinding).reduce((n,s)=>n+s.seconds,0) !== 300) throw Error('Invalid timing');
    return payload;
  }

  function npsRows() {
    const clinics = [...findingMap.get('nps').metrics.clinics].sort((a,b)=>b.changePoints-a.changePoints);
    return '<div class="nps-chart" aria-label="Μεταβολή NPS ανά μονάδα από το 2024 στο 2025">'+clinics.map(c=>'<button class="nps-row" data-clinic="'+esc(c.id)+'" aria-pressed="'+(c.id==='faliro')+'" aria-label="'+esc(c.label+': '+c.nps2024+' το 2024, '+c.nps2025+' το 2025, μεταβολή '+signed(c.changePoints)+' μονάδες')+'"><span class="nps-label">'+esc(c.label)+'</span><span class="bar-track" aria-hidden="true"><span class="bar '+(c.changePoints<0?'negative ':'')+(c.id==='faliro'?'highlight':'')+'" style="--delta:'+Math.abs(c.changePoints)+'"></span></span><span class="nps-value" aria-hidden="true">'+signed(c.changePoints)+'</span></button>').join('')+'<div class="chart-scale" aria-hidden="true"><span></span><div><span>−15</span><span>−10</span><span>−5</span><span>0</span><span>+5</span><span>+10</span></div></div></div><p class="clinic-detail" id="clinic-detail"><b>Παλαιό Φάληρο:</b> 62 το 2024, 49 το 2025.</p><p class="micro-hint">Επιλέξτε μονάδα για τις δύο τιμές.</p>';
  }

  function visual(scene) {
    const n = findingMap.get('nps').metrics, e = findingMap.get('elliniko').metrics, g = findingMap.get('gaia').metrics;
    switch (scene.visual) {
      case 'cover': return '<div class="opening-visual"><p>Δημόσια στοιχεία.<br>Τρία ερωτήματα<br>με διοικητική αξία.</p><img src="assets/media/marousi.png" width="312" height="246" alt="Ιατρικό Κέντρο Αθηνών στο Μαρούσι"></div>';
      case 'decisions': return '<div class="decision-rows">'+[['Εμπειρία ασθενών','Πού χρειάζεται διερεύνηση;'],['Ετοιμότητα επένδυσης','Με ποιο κοινό ορόσημο;'],['Αξία χώρου','Ποια χρήση αξίζει περισσότερο;']].map(r=>'<div class="decision-row"><strong>'+r[0]+'</strong><span>'+r[1]+'</span></div>').join('')+'</div>';
      case 'nps-total': return '<p class="subline">NPS: πρόθεση σύστασης ασθενών</p><div class="number-pair"><div class="number-block old"><strong>'+n.total.nps2024+'</strong><span>2024</span></div><div class="pair-line" aria-hidden="true"></div><div class="number-block"><strong>'+n.total.nps2025+'</strong><span>2025</span></div></div><p class="delta-callout">'+signed(n.total.changePoints)+' μονάδα NPS στο σύνολο</p>';
      case 'nps-units': return '<p class="subline">Μεταβολή NPS, 2024–2025, σε μονάδες</p>'+npsRows();
      case 'patient-journey': return '<div class="journey">'+findingMap.get('nps').proposedTest.journey.map(t=>'<div>'+esc(t)+'</div>').join('')+'</div><div class="test-trio">'+[['Δείγμα','Ποιοι απάντησαν;'],['Μήνας','Πότε αλλάζει η εικόνα;'],['Σημείο τριβής','Τι δυσκολεύει τον ασθενή;']].map(r=>'<div><strong>'+r[0]+'</strong><span>'+r[1]+'</span></div>').join('')+'</div>';
      case 'elliniko-dates': return '<p class="subline">Healthcare Park στο Ελληνικό</p><div class="dates-grid">'+e.forecasts.map(q=>'<section class="forecast"><strong>'+q.completionYear+'</strong><h3>'+esc(q.publisher)+'</h3><p>'+(q.publisher==='LAMDA'?'Δελτίο 26/5/2026':'Έκθεση 2025, υπογραφή 30/4/2026')+'</p></section>').join('')+'</div><div class="difference-line">'+e.differenceYears+' χρόνια διαφορά στις προβλέψεις</div>';
      case 'document-timeline': return '<p class="subline">Ημερομηνίες εγγράφων, 2026</p><div class="document-timeline">'+e.chronology.map((q,i)=>'<section><time datetime="'+q.date+'">'+(i===0?'30 Απριλίου':'26 Μαΐου')+'</time><p>'+esc(q.document)+'<br>'+esc(q.publisher)+'</p><strong>Πρόβλεψη: τέλος '+q.forecastYear+'</strong></section>').join('')+'</div>';
      case 'readiness-dependencies': return '<div class="dependencies"><div class="dependency-root"><h3>Κοινό ορόσημο</h3><p>Επιβεβαιωμένος ορισμός<br>και ημερομηνία</p></div><div class="dependency-branches">'+findingMap.get('elliniko').proposedTest.dependencies.map(t=>'<div>'+esc(t)+'</div>').join('')+'</div></div><p class="visual-question">Υπεύθυνος, εξάρτηση, ημερομηνία απόφασης</p>';
      case 'gaia-profit': return '<p class="subline">2021, έως τη μεταβίβαση της δραστηριότητας</p><div class="profit"><strong>€'+g.activityProfitAfterTax.value+' χιλ.</strong><p>κέρδη μετά φόρων</p><p class="exclusion">Χωρίς το ξεχωριστό κέρδος πώλησης</p></div>';
      case 'gaia-capacity': return '<p class="subline">Ανακοίνωση 17/12/2021, απελευθέρωση δυναμικότητας στο Μαρούσι</p><div class="capacity"><div><strong>'+g.announcedCapacity.beds+'</strong><span>κλίνες</span></div><div><strong>'+g.announcedCapacity.operatingRooms+'</strong><span>χειρουργικές<br>αίθουσες</span></div></div><p class="visual-question">Ποια εναλλακτική χρήση άξιζε περισσότερο;</p>';
      case 'space-comparison': return '<div class="space-comparison">'+[['ΠΡΙΝ','ΓΑΙΑ'],['ΜΕΤΑ','Νέα χρήση']].map(r=>'<section><span class="when">'+r[0]+'</span><h3>'+r[1]+'</h3><div class="fraction" aria-label="Λειτουργική συνεισφορά ανά τετραγωνικό μέτρο"><span>Λειτουργική συνεισφορά</span><span>τετραγωνικά μέτρα</span></div></section>').join('')+'</div><p class="visual-question">Κοινές περίοδοι. Κόστος μετατροπής χωριστά.</p>';
      case 'pilot-choice': return '<div class="pilot-list">'+[['nps','Εμπειρία ασθενών','NPS ανά μήνα και διαδρομή'],['elliniko','Ετοιμότητα επένδυσης','Κοινό ορόσημο και υπεύθυνος'],['gaia','Αξία χώρου','Συνεισφορά ανά τ.μ. πριν και μετά']].map(r=>'<button class="pilot-button" data-pilot="'+r[0]+'"><strong>'+r[1]+'</strong><span>'+r[2]+'</span></button>').join('')+'</div><p class="micro-hint">Επιλέξτε ένα ερώτημα για τον προτεινόμενο έλεγχο.</p>';
      default: throw Error('Unknown visual');
    }
  }

  function render() {
    const state = player.getState();
    if (state.index === renderedIndex) { controls(); return; }
    renderedIndex = state.index;
    $('intro').hidden = state.index >= 0; $('presentation').hidden = state.index < 0;
    if (state.index < 0) { controls(); return; }
    const scene = data.scenes[state.index];
    document.body.dataset.scene = scene.id;
    $('scene-number').textContent = String(state.index+1).padStart(2,'0')+' / 12';
    $('scene-chapter').textContent = state.index<2?'Η διοικητική αξία':state.index<5?'Εμπειρία ασθενών':state.index<8?'Ελληνικό':state.index<11?'ΓΑΙΑ':'Η επόμενη απόφαση';
    const badges = scene.classification === 'mixed' ? badge('published_fact')+badge('company_claim') : badge(scene.classification);
    $('scene').innerHTML = '<div class="badge-row">'+badges+'</div><h2 id="scene-title" tabindex="-1">'+esc(scene.title)+'</h2><div class="visual">'+visual(scene)+'</div><p class="scene-limit">'+esc(limits[scene.visual])+'</p>';
    const stop = data.scenes.filter(s=>s.pauseAtFinding).findIndex(s=>s.id===scene.id);
    $('freeze-banner').hidden = !scene.pauseAtFinding;
    $('freeze-label').textContent = 'Στάση ευρήματος '+(stop+1)+' / 3';
    $('freeze-question').textContent = scene.pauseQuestion || '';
    for (const [i,b] of [...$('progress').children].entries()) {
      if (i === state.index) b.setAttribute('aria-current','step'); else b.removeAttribute('aria-current');
      b.classList.toggle('complete',i < state.index);
      b.style.removeProperty('--fill');
    }
    history.replaceState(null,'','#'+scene.id);
    $('announcement').textContent = 'Σκηνή '+(state.index+1)+' από 12. '+scene.title+(scene.pauseAtFinding?'. Παύση ευρήματος. Συνεχίζετε εσείς.':'');
    imageFallbacks(); controls();
  }

  function controls() {
    if (!player) return;
    const s=player.getState(), frozen=s.phase==='frozen', ended=s.phase==='ended';
    $('previous-button').disabled=s.index<=0;
    $('pause-button').hidden=frozen||ended;
    $('pause-button').textContent=s.phase==='playing'?'Παύση':'Συνέχιση ροής';
    $('next-button').hidden=ended;
    $('next-button').textContent=frozen?'Συνέχεια':s.index===11?'Ολοκλήρωση':'Επόμενο';
    $('restart-button').hidden=!ended;
    if (s.phase!==lastPhase) {
      $('player-status').textContent=({intro:'Έτοιμο',playing:'Αυτόματη εναλλαγή',paused:'Σε παύση',frozen:'Συνεχίζετε εσείς',ended:'Η παρουσίαση ολοκληρώθηκε'})[s.phase];
      lastPhase=s.phase;
    }
    const time=s.phase==='playing'?Math.ceil(s.remainingMs/1000)+'″ μέχρι την επόμενη σκηνή':s.phase==='frozen'?'Χωρίς χρονικό όριο':s.phase==='paused'?Math.ceil(s.remainingMs/1000)+'″ απομένουν':'';
    if(time!==lastTime){$('time-remaining').textContent=time;lastTime=time;}
    if(s.index>=0){const b=$('progress').children[s.index];b.style.setProperty('--fill',(s.durationMs?Math.min(100,100*s.elapsedMs/s.durationMs):100)+'%');}
  }

  function navigate(action,index) {
    closeDialog(false); lastFrame=null;
    if(action==='jump')player.goTo(index,{autoplay:false});
    else if(action==='start')player.start();
    else if(action==='next')player.next();
    else if(action==='previous')player.previous();
    else if(action==='restart'){player.restart();delete document.body.dataset.scene;history.replaceState(null,'',location.pathname+location.search);}
    render();
    if(action==='restart')$('start-button').focus();else $('scene-title')?.focus({preventScroll:true});
    window.scrollTo({top:0,behavior:'instant'});
  }

  function frame(time) {
    if(player && !modalOpen && !document.hidden && lastFrame!==null){player.advanceBy(Math.min(time-lastFrame,1000));render();}
    lastFrame=time;requestAnimationFrame(frame);
  }
  function openDialog(title,html,kind='Η ΕΡΕΥΝΑ ΠΙΣΩ ΑΠΟ ΤΗΝ ΕΙΚΟΝΑ') {
    player?.pause();lastFrame=null;modalOpen=true;opener=document.activeElement;
    $('dialog-title').textContent=title;$('dialog-kind').textContent=kind;$('dialog-content').innerHTML=html;
    if(!$('detail-dialog').open)$('detail-dialog').showModal();
    $('detail-dialog').scrollTop=0;$('close-dialog').focus();controls();
  }
  function closeDialog(restore=true) {
    if($('detail-dialog').open)$('detail-dialog').close();modalOpen=false;lastFrame=null;
    if(restore&&opener?.isConnected)opener.focus({preventScroll:true});controls();
  }
  function allRefs(value,set=new Set()) {
    if(!value||typeof value!=='object')return set;
    if(value.sourceIds)for(const id of value.sourceIds)set.add(id);
    for(const child of Object.values(value))if(typeof child==='object')allRefs(child,set);
    return set;
  }
  function sourceMarkup(ids) {
    return '<div class="source-list">'+[...new Set(ids)].map(id=>{
      const s=sources.get(id);if(!s)throw Error('Missing source '+id);
      return '<div class="source-item"><a href="'+esc(s.url)+'" target="_blank" rel="noopener noreferrer">'+esc(s.title)+'</a><small>'+esc([s.pdfPage?'PDF σ. '+s.pdfPage:'Χωρίς σελιδαρίθμηση',s.printedPage?'έντυπη σ. '+s.printedPage:'',s.locator||''].filter(Boolean).join(' · '))+'</small></div>';
    }).join('')+'</div>';
  }
  function findingMarkup(f) {
    let html='<p><strong>Περίμετρος:</strong> '+esc(f.scope)+'</p>';
    for(const [key,type] of [['publishedFacts','published_fact'],['companyClaims','company_claim']])if(f[key].length)html+='<section class="claim-block">'+badge(type)+f[key].map(c=>'<p>'+esc(c.text)+'</p>').join('')+'</section>';
    html+='<section class="claim-block">'+badge('hypothesis')+'<p>'+esc(f.hypothesis.text)+'</p></section>';
    const t=f.proposedTest;
    html+='<h3>Πώς θα το ελέγχαμε</h3>'+badge('proposal')+'<ul>'+t.steps.map(x=>'<li>'+esc(x)+'</li>').join('')+'</ul><p><strong>Τι θα μπορούσε να το αντικρούσει:</strong> '+esc(t.couldDisconfirm)+'</p>';
    return html;
  }
  function showSources() {
    const scene=data.scenes[player.getState().index];if(!scene){showMethod();return;}
    const f=findingMap.get(scene.findingId),ids=allRefs(scene);
    if(f)allRefs(f,ids);
    let html=f?findingMarkup(f):'<p>'+esc(scene.summary)+'</p>';
    html+='<h3>Όρια ερμηνείας</h3><ul>'+scene.limitations.map(x=>'<li>'+esc(x)+'</li>').join('')+'</ul>';
    if(ids.size)html+='<h3>Πρωτογενείς πηγές και σελίδες</h3>'+sourceMarkup(ids);
    else html+='<p>Σύνθεση των τριών ευρημάτων. Οι επιμέρους πηγές βρίσκονται στις αντίστοιχες σκηνές.</p>';
    if(scene.classification==='proposal')html+='<p>Οι πηγές τεκμηριώνουν την αφετηρία της πρότασης, όχι την αποτελεσματικότητά της.</p>';
    openDialog(scene.title,html);
  }
  function showNotes() {
    const scene=data.scenes[player.getState().index];if(!scene)return;
    openDialog('Τι λέμε σε αυτή τη στάση','<p class="notes-spoken">'+esc(scene.spoken)+'</p>'+(scene.pauseQuestion?'<p class="notes-pause"><strong>Παύση και ερώτημα:</strong> '+esc(scene.pauseQuestion)+'</p>':'')+'<p>Ενδεικτικός χρόνος ομιλίας: '+scene.seconds+'″. Η αυτόματη ροή παραμένει σε παύση όσο διαβάζετε.</p>','ΣΥΝΤΟΜΕΣ ΣΗΜΕΙΩΣΕΙΣ ΟΜΙΛΗΤΗ');
  }
  function showChapters() {
    openDialog('Η διαδρομή των 12 σκηνών','<p>5 λεπτά αυτόματης ροής και τρεις στάσεις χωρίς χρονικό όριο. Περίπου 7 λεπτά με τα προτεινόμενα σχόλια.</p><div class="chapter-list">'+data.scenes.map((s,i)=>'<button data-scene-index="'+i+'"><b>'+String(i+1).padStart(2,'0')+'</b><span>'+esc(s.title)+'</span><small>'+(s.pauseAtFinding?'ΣΤΑΣΗ':s.seconds+'″')+'</small></button>').join('')+'</div><p><button class="secondary" data-action="restart">Από την αρχή</button></p>','ΕΠΙΛΟΓΗ ΣΚΗΝΗΣ');
  }
  function showMethod() {
    openDialog('Τι γνωρίζουμε και τι υποθέτουμε','<div class="method-legend"><section>'+badge('published_fact')+'<p>Αριθμοί και ημερομηνίες που εντοπίζουμε στις πηγές. Η μεταγραφή τους δεν αποτελεί ανεξάρτητη επαλήθευση εταιρικής μέτρησης.</p></section><section>'+badge('company_claim')+'<p>Εξηγήσεις, επιδιώξεις και προβλέψεις που αποδίδουμε ρητά στην εταιρεία που τις δημοσίευσε.</p></section><section>'+badge('hypothesis')+'<p>Δικές μας πιθανές εξηγήσεις. Συνοδεύονται από προτεινόμενο έλεγχο και στοιχείο που θα μπορούσε να τις αντικρούσει.</p></section></div><h3>Πραγματική χρήση ΤΝ</h3><p>Η ΤΝ υποστήριξε ουσιωδώς την έρευνα, τη διασταύρωση πηγών, την πλήρη συγγραφή, το PowerPoint και την κατασκευή και δοκιμή της ιστοσελίδας. Ο ουσιαστικός έλεγχος της ομάδας εκκρεμεί. Δεν δηλώνεται εταιρική έγκριση των συμπερασμάτων.</p><p>Η παρουσίαση χρησιμοποιεί επιμελημένα δημόσια τεκμήρια. Δεν παράγει ζωντανές απαντήσεις LLM και δεν έχει δημόσια σύνδεση στη βάση Neo4j.</p><p><a href="research.html#ai-declaration">Δήλωση χρήσης ΤΝ και πλήρης μελέτη</a></p>','ΜΕΘΟΔΟΣ & ΔΙΑΦΑΝΕΙΑ');
  }
  function showArchive() {
    const links=[['writing/CEO-Ιατρικό-Αθηνών-3-Ευρήματα.pptx','PowerPoint προς CEO','Οι ίδιες 12 διαφάνειες με σημειώσεις ομιλητή.'],['research.html#paper','Εργασία και παραδοτέα','Το πλήρες κείμενο, Word και η χωριστή ακαδημαϊκή παρουσίαση.'],['strategy.html','Ανταγωνισμός και στρατηγική','Οι αναλυτικές συγκρίσεις και οι ερευνητικές υποθέσεις.'],['organization.html','Ετήσιο οργανόγραμμα','Πρόσωπα, ρόλοι, πηγές και μετακινούμενοι κόμβοι.'],['history.html','Ιστορικός χάρτης','Ελλάδα, Ρουμανία και τεκμηριωμένες μεταβολές στον χρόνο.'],['sap.html','Πριν και μετά το SAP','Σχέσεις, τεκμήρια και όρια αιτιότητας.'],['historical-presentation.html','Προηγούμενη ιστορική παρουσίαση','Η ευρύτερη διαδρομή 15 σκηνών και επτά ευρημάτων.'],['data/ceo-presentation.json','Δεδομένα των 12 σκηνών','Δημοσιευμένα στοιχεία, υποθέσεις και πρωτογενείς πηγές.']];
    openDialog('Η έρευνα πίσω από την παρουσίαση','<div class="archive-links">'+links.map(r=>'<a href="'+esc(r[0])+'">'+esc(r[1])+'<small>'+esc(r[2])+'</small></a>').join('')+'</div>','ΑΝΑΛΥΤΙΚΟ ΑΡΧΕΙΟ');
  }
  function showPilot(id) {
    const f=findingMap.get(id);if(!f)return;
    openDialog(f.proposedTest.question,badge('proposal')+'<ul>'+f.proposedTest.steps.map(t=>'<li>'+esc(t)+'</li>').join('')+'</ul><p><strong>Τι θα μπορούσε να αντικρούσει την υπόθεση:</strong> '+esc(f.proposedTest.couldDisconfirm)+'</p><p>'+esc(f.proposedTest.note)+'</p>','ΠΡΟΤΕΙΝΟΜΕΝΟΣ ΠΙΛΟΤΙΚΟΣ ΕΛΕΓΧΟΣ');
  }
  function imageFallbacks(){for(const img of document.querySelectorAll('img'))img.onerror=()=>{const p=document.createElement('p');p.className='scene-limit';p.textContent='Η φωτογραφία δεν είναι διαθέσιμη. Η παρουσίαση λειτουργεί κανονικά.';img.replaceWith(p);};}
  function act(action) {
    if(action==='retry'){load();return;}
    if(action==='archive'){showArchive();return;}
    if(action==='method'){showMethod();return;}
    if(action==='close'){closeDialog();return;}
    if(!player)return;
    if(['start','next','previous','restart'].includes(action)){navigate(action);return;}
    if(action==='pause'){player.togglePause();lastFrame=null;controls();}
    if(action==='notes')showNotes();
    if(action==='sources')showSources();
    if(action==='chapters')showChapters();
    if(action==='fullscreen'){
      const request=document.fullscreenElement?document.exitFullscreen?.():document.documentElement.requestFullscreen?.();
      request?.catch(()=>{$('announcement').textContent='Η πλήρης οθόνη δεν είναι διαθέσιμη σε αυτόν τον περιηγητή.';});
    }
  }
  document.addEventListener('click',event=>{
    const jump=event.target.closest('[data-scene-index]');if(jump&&player){navigate('jump',Number(jump.dataset.sceneIndex));return;}
    const clinic=event.target.closest('[data-clinic]');if(clinic&&player){
      const c=findingMap.get('nps').metrics.clinics.find(c=>c.id===clinic.dataset.clinic);if(!c)return;
      for(const b of document.querySelectorAll('[data-clinic]'))b.setAttribute('aria-pressed',String(b===clinic));
      $('clinic-detail').textContent=c.label+': '+c.nps2024+' το 2024, '+c.nps2025+' το 2025. Μεταβολή '+signed(c.changePoints)+' μονάδες.';return;
    }
    const pilot=event.target.closest('[data-pilot]');if(pilot&&player){showPilot(pilot.dataset.pilot);return;}
    const button=event.target.closest('[data-action]');if(button&&!button.disabled)act(button.dataset.action);
  });
  document.addEventListener('keydown',event=>{
    if(!player||modalOpen||player.getState().index<0||/INPUT|TEXTAREA|SELECT/.test(event.target.tagName))return;
    if(event.key==='ArrowRight'){event.preventDefault();act('next');}
    if(event.key==='ArrowLeft'){event.preventDefault();act('previous');}
    if(event.code==='Space'&&!event.target.closest('button,a')){event.preventDefault();act(player.getState().phase==='frozen'?'next':'pause');}
  });
  $('detail-dialog').addEventListener('close',()=>{modalOpen=false;lastFrame=null;controls();});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)player?.pause();lastFrame=null;controls();});
  window.addEventListener('blur',()=>{player?.pause();lastFrame=null;controls();});
  window.addEventListener('hashchange',()=>{
    if(['#paper','#ai-declaration'].includes(location.hash)){location.replace('research.html'+location.hash);return;}
    if(player){const i=data.scenes.findIndex(s=>'#'+s.id===location.hash);if(i>=0&&i!==player.getState().index)navigate('jump',i);}
  });
  async function load() {
    const attempt=++loadAttempt,controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),10000);
    $('retry-button').hidden=true;$('start-button').disabled=true;$('load-status').textContent='Προετοιμασία των 12 σκηνών…';
    try{
      const response=await fetch('data/ceo-presentation.json?v=1.1.0',{signal:controller.signal,cache:'no-cache'});
      if(!response.ok)throw Error('HTTP '+response.status);
      const payload=validate(await response.json());if(attempt!==loadAttempt)return;
      data=payload;sources=new Map(data.sources.map(s=>[s.id,s]));findingMap=new Map(data.findings.map(f=>[f.id,f]));player=window.CeoPlayerCore.createPlayer(data.scenes);
      $('progress').innerHTML=data.scenes.map((s,i)=>'<button data-scene-index="'+i+'" data-stop="'+s.pauseAtFinding+'" aria-label="'+esc('Σκηνή '+(i+1)+': '+s.title+(s.pauseAtFinding?'. Στάση ευρήματος.':''))+'" title="'+esc(s.title)+'">'+String(i+1).padStart(2,'0')+(s.pauseAtFinding?'<span class="stop-mark" aria-hidden="true">Ⅱ</span>':'')+'</button>').join('');
      $('start-button').disabled=false;$('chapters-button').disabled=false;$('load-status').textContent='Στα τρία ευρήματα συνεχίζετε εσείς.';
      const initial=data.scenes.findIndex(s=>'#'+s.id===location.hash);if(initial>=0)navigate('jump',initial);
    }catch(error){if(attempt===loadAttempt){$('load-status').innerHTML='Η φόρτωση δεν ολοκληρώθηκε. Δοκιμάστε ξανά ή <a href="research.html#paper">ανοίξτε την εργασία</a>.';$('retry-button').hidden=false;}}
    finally{clearTimeout(timeout);}
  }
  imageFallbacks();
  if(['#paper','#ai-declaration'].includes(location.hash)){location.replace('research.html'+location.hash);return;}
  load();requestAnimationFrame(frame);
})();
