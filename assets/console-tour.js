/* Guided exploration of the same public controls. No automatic downloads. */
(function () {
  'use strict';
  function positionPanel(rect, panel, viewport) {
    const gap = 18, edge = 14;
    const clamp = (n,a,b) => Math.max(a,Math.min(n,b));
    const maxX = Math.max(edge,viewport.width-panel.width-edge);
    const maxY = Math.max(edge,viewport.height-panel.height-edge);
    const centered = clamp(rect.left+(rect.width-panel.width)/2,edge,maxX);
    const candidates = [
      {x:centered,y:rect.bottom+gap}, {x:centered,y:rect.top-panel.height-gap},
      {x:rect.right+gap,y:clamp(rect.top,edge,maxY)}, {x:rect.left-panel.width-gap,y:clamp(rect.top,edge,maxY)},
      {x:maxX,y:maxY}, {x:edge,y:maxY}, {x:maxX,y:edge}, {x:edge,y:edge}
    ].map(p=>({x:clamp(p.x,edge,maxX),y:clamp(p.y,edge,maxY)}));
    const overlap = p => Math.max(0,Math.min(p.x+panel.width,rect.right+8)-Math.max(p.x,rect.left-8))*Math.max(0,Math.min(p.y+panel.height,rect.bottom+8)-Math.max(p.y,rect.top-8));
    return candidates.sort((a,b)=>overlap(a)-overlap(b))[0];
  }
  if (typeof module === 'object' && module.exports) module.exports = {positionPanel};
  if (typeof document === 'undefined') return;
  const steps = [
    ['home','#home-title','Η μελέτη, βήμα βήμα.','Ο φωτεινός δείκτης δείχνει τη λειτουργία που εξηγούμε. Προχώρησε με «Επόμενο» ή ενεργοποίησε την αυτόματη περιήγηση.'],
    ['map','.map-card.cyan','Ο χάρτης σου.','Τέσσερις διαδρομές: ευρήματα, εταιρεία, εργασία και τεκμήρια. Επιλέγεις αυτό που χρειάζεσαι, χωρίς να διαβάζεις τα πάντα.'],
    ['theme','.theme-controls','Διάλεξε φως ή σκοτάδι.','Τα Dark και Light αλλάζουν όλη την εμφάνιση. Η επιλογή σου αποθηκεύεται στον browser και διατηρείται στην επόμενη επίσκεψη.'],
    ['photos','#home-photos','Πραγματικές μονάδες.','Οι φωτογραφίες δείχνουν Μαρούσι, Παλαιό Φάληρο και Διαβαλκανικό. Κάθε εικόνα συνοδεύεται από σύνδεσμο στην επίσημη πηγή.'],
    ['downloads','.home-downloads','Κατέβασε τα αρχεία.','Εδώ βρίσκεις Word, PowerPoint και επίσημη εκφώνηση. Στην περιήγηση τα δείχνουμε· δεν ξεκινά αυτόματη λήψη.'],
    ['findings','[aria-label="Επίλεξε εύρημα"]','Διάλεξε ένα από τα τρία ευρήματα.','Οι καρτέλες αλλάζουν την οπτικοποίηση: εμπειρία ασθενών, Ελληνικό, ΓΑΙΑ. Οι ετικέτες ξεχωρίζουν στοιχεία, προβλέψεις και ερμηνείες.'],
    ['nps','[data-clinic="faliro"]','Οι μπάρες είναι διαδραστικές.','Η κάθε γραμμή είναι μία μονάδα. Πατώντας τη βλέπεις τις δύο τιμές και τις διαθέσιμες απαντήσεις του δείγματος. Ροζ: πτώση. Κυανό: άνοδος.'],
    ['value','#dialog-title','Από την παρατήρηση στην απόφαση.','Η «Διοικητική αξία» ανοίγει την υπόθεσή μας, τον προτεινόμενο έλεγχο και τι θα μπορούσε να την αντικρούσει.'],
    ['limits','#dialog-body .limits .type-label','Δες και τα όρια.','Το «Τι δεν γνωρίζουμε» εξηγεί ποια συμπεράσματα δεν δικαιολογούν οι δημόσιες πηγές. Η αβεβαιότητα παραμένει ορατή.'],
    ['trace','.trace-source','Ακολούθησε τη διαδρομή των στοιχείων.','Ο μικρός κινούμενος γράφος συνδέει ερώτημα, παρατήρηση και πηγές. Πατώντας το τελευταίο πλαίσιο ανοίγεις τα έγγραφα και τις σελίδες.'],
    ['sources','.source-card','Έλεγξε την ακριβή παραπομπή.','Οι σύνδεσμοι οδηγούν στην πηγή, συχνά απευθείας στη σελίδα του εγγράφου. Ανοίγουν σε νέα καρτέλα, ώστε να μη χάσεις τη μελέτη.'],
    ['elliniko','.big-comparison','Σύγκρινε τα δύο χρονοδιαγράμματα.','Κάθε μεγάλη χρονολογία ανοίγει τη δική της πηγή. Πρόκειται για προβλέψεις· η διαφορά δεν αποδεικνύει από μόνη της καθυστέρηση.'],
    ['gaia','.profit-visual','Διάβασε σωστά το ποσό.','Το ποσό αφορά τη δραστηριότητα ΓΑΙΑ έως τη μεταβίβαση. Το κέρδος πώλησης είναι διαφορετικό μέγεθος. Οι διευκρινίσεις βρίσκονται κάτω από τον αριθμό.'],
    ['company','.scope-switch','Εταιρεία, Όμιλος ή κλινική;','Αυτά τα κουμπιά αλλάζουν επίπεδο ανάλυσης. Οι αριθμοί της νομικής εταιρείας δεν ταυτίζονται με εκείνους του ενοποιημένου Ομίλου.'],
    ['company-metrics','.metric-row > div','Τα βασικά μεγέθη, συγκεντρωμένα.','Κάθε αριθμός έχει περιγραφή και έτος. Το «Ακριβή μεγέθη & πηγές» δίνει τις πλήρεις τιμές και την τεκμηρίωσή τους.'],
    ['structure','.structure-branches','Πώς οργανώνεται η διοίκηση;','Το σχήμα συνοψίζει τα δημοσιευμένα επίπεδα εποπτείας και λειτουργίας. Ο λεπτομερής παλιός γράφος διατηρείται στην αρχειοθετημένη έκδοση.'],
    ['competition','.data-table','Σύγκρινε με κοινή χρονική βάση.','Ο πίνακας συγκρίνει τις τροχιές Ιατρικού και ΙΑΣΩ. Τα όρια εξηγούν γιατί αυτό δεν είναι μερίδιο αγοράς ή κατάταξη διοικήσεων.'],
    ['pestel','.term-notes p','Η ορολογία εξηγείται δίπλα της.','Οι συντομογραφίες συνοδεύονται από παρενθέσεις. Στις αυτούσιες εκφωνήσεις, οι εξηγήσεις μπαίνουν αμέσως από κάτω.'],
    ['assignment','.requirement-topic .question-button','Κάθε ζητούμενο έχει τη θέση του.','Τα τρία θέματα χωρίζονται στα έξι επίσημα υποερωτήματα. Πατάς οποιοδήποτε ερώτημα για να δεις πώς απαντάται.'],
    ['prompt','.question-quote','Εκφώνηση και απάντηση ξεχωριστά.','Το γκρι πλαίσιο περιέχει το επίσημο ζητούμενο. Ακολουθούν η δική μας σύνοψη και τα όρια της τεκμηρίωσης.'],
    ['full-answer','#full-answer h3','Άνοιξε το πλήρες κείμενο.','Το «Διάβασε την πλήρη απάντηση» φέρνει ολόκληρη τη σχετική ενότητα. Στο τέλος της υπάρχει πρόσβαση στη βιβλιογραφία.'],
    ['files','#dialog-body .modal-links a','Βρες όλα τα παραδοτέα.','Εδώ υπάρχουν επίσης η έκδοση με γκρι εκφωνήσεις, η δήλωση χρήσης τεχνητής νοημοσύνης και ο πίνακας συνεισφοράς προς συμπλήρωση.'],
    ['ask','.ask-form','Ρώτησε με δικά σου λόγια.','Γράψε μια ερώτηση στα ελληνικά ή πάτησε ένα παράδειγμα. Η αναζήτηση βρίσκει σχετικές, ήδη ελεγμένες κάρτες της συλλογής.'],
    ['retrieval','.answer-panel h2','Απάντηση, κατηγορία και πηγή.','Διάλεξε αποτέλεσμα από τη λίστα. Βλέπεις σύντομη εξήγηση, παραπομπές και σύνδεση με την εργασία. Αν δεν υπάρχει σχετικό τεκμήριο, το εργαλείο το δηλώνει.'],
    ['method','#dialog-body .legend-list .type-label','Η μέθοδος είναι ορατή.','Στο «Πηγές & χρήση τεχνητής νοημοσύνης» εξηγούμε τις ετικέτες, τη συνδρομή των εργαλείων και τους ελέγχους που εκκρεμούν από την ομάδα.'],
    ['archive','.site-footer a','Η προηγούμενη έκδοση παραμένει.','Η έκδοση 19 Nov 2026 περιέχει την παλιά παρουσίαση, τους χάρτες και τον αναλυτικό γράφο. Πάτησε το link για να επισκεφθείς το αρχείο.'],
    ['end','.home-button','Τώρα εξερεύνησε εσύ.','Το «Αρχική» σε επιστρέφει στον χάρτη. Το «?» δίνει σύντομη βοήθεια. Μπορείς να ξαναρχίσεις την περιήγηση οποιαδήποτε στιγμή.']
  ].map(([mode,target,title,description])=>({mode,target,title,description}));
  let root, panel, outline, cursor, active = false, busy = false, current = 0, timer, automatic = false, lastFocus, target, frame, operation = 0;
  const $ = selector => root.querySelector(selector);
  const tick = () => new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
  const escape = text => text.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function build() {
    root = document.createElement('div');
    root.id = 'guided-tour';
    root.setAttribute('popover','manual');
    root.setAttribute('data-terms-skip','');
    root.innerHTML = `<div class="tour-blocker"></div><div class="tour-outline" aria-hidden="true"></div><svg class="tour-cursor" viewBox="0 0 40 48" aria-hidden="true"><path d="M4 2 L4 37 L14 28 L22 45 L29 41 L21 25 L35 25 Z"/></svg><section class="tour-panel" role="dialog" aria-modal="true" aria-labelledby="tour-title" aria-describedby="tour-description"><div class="tour-panel-top"><span id="tour-count"></span><button id="tour-close" aria-label="Κλείσιμο περιήγησης">×</button></div><h2 id="tour-title"></h2><p id="tour-description"></p><div class="tour-progress" aria-hidden="true"><i></i></div><div class="tour-navigation"><button id="tour-previous">Πίσω</button><button id="tour-auto" aria-pressed="false">Αυτόματα</button><button id="tour-next">Επόμενο</button></div><label class="tour-jump">Πήγαινε σε στάση<select id="tour-jump" aria-label="Επιλογή στάσης">${steps.map((s,i)=>`<option value="${i}">${i+1}. ${escape(s.title)}</option>`).join('')}</select></label></section>`;
    document.body.append(root);
    panel = $('.tour-panel'); outline = $('.tour-outline'); cursor = $('.tour-cursor');
    $('#tour-close').addEventListener('click',stop);
    $('#tour-previous').addEventListener('click',()=>show(current-1));
    $('#tour-next').addEventListener('click',()=>current === steps.length-1 ? stop() : show(current+1));
    $('#tour-auto').addEventListener('click',()=>{ automatic = !automatic; setAuto(); schedule(); });
    $('#tour-jump').addEventListener('change',event=>show(Number(event.target.value)));
    root.addEventListener('keydown', event => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); stop(); }
      if (event.target.tagName === 'SELECT') return;
      if (event.key === 'ArrowRight') { event.preventDefault(); if (!busy && current < steps.length-1) show(current+1); }
      if (event.key === 'ArrowLeft') { event.preventDefault(); if (!busy && current > 0) show(current-1); }
      if (event.key === 'Tab') {
        const focusable = [...panel.querySelectorAll('button:not(:disabled),select')];
        if (event.shiftKey && document.activeElement === focusable[0]) { event.preventDefault(); focusable.at(-1).focus(); }
        else if (!event.shiftKey && document.activeElement === focusable.at(-1)) { event.preventDefault(); focusable[0].focus(); }
      }
    });
    window.addEventListener('resize',requestPosition);
    document.addEventListener('scroll',requestPosition,true);
    document.addEventListener('visibilitychange',()=>{ if (document.hidden && active) { automatic = false; setAuto(); clearTimeout(timer); } });
  }
  function setAuto() { $('#tour-auto').textContent = automatic ? 'Παύση' : 'Αυτόματα'; $('#tour-auto').setAttribute('aria-pressed',String(automatic)); }
  function schedule() { clearTimeout(timer); if (active && automatic && !busy && current < steps.length-1) timer = setTimeout(()=>show(current+1),12000); }
  function controls(loading) {
    $('#tour-previous').disabled = loading || current === 0;
    $('#tour-next').disabled = loading;
    $('#tour-auto').disabled = loading;
    $('#tour-jump').disabled = loading;
  }
  function requestPosition() { if (!active || busy) return; cancelAnimationFrame(frame); frame = requestAnimationFrame(position); }
  function position() {
    if (!target?.isConnected) return;
    const raw = target.getBoundingClientRect();
    const viewport = {width:document.documentElement.clientWidth,height:window.innerHeight};
    const rect = {left:Math.max(8,raw.left-5),top:Math.max(8,raw.top-5),right:Math.min(viewport.width-8,raw.right+5),bottom:Math.min(viewport.height-8,raw.bottom+5)};
    rect.width = Math.max(4,rect.right-rect.left); rect.height = Math.max(4,rect.bottom-rect.top);
    Object.assign(outline.style,{left:rect.left+'px',top:rect.top+'px',width:rect.width+'px',height:rect.height+'px'});
    const dimensions = panel.getBoundingClientRect();
    const place = positionPanel(rect,dimensions,viewport);
    Object.assign(panel.style,{left:place.x+'px',top:place.y+'px'});
    // Tip points to the highlighted control; it never follows or replaces the user's mouse.
    let x = Math.min(viewport.width-42,rect.left+Math.min(rect.width*.75,rect.width-16));
    let y = Math.max(12,Math.min(viewport.height-52,rect.top+Math.min(24,rect.height/2)));
    if (x >= place.x-40 && x <= place.x+dimensions.width && y >= place.y-48 && y <= place.y+dimensions.height) { x = Math.max(10,rect.left+8); y = Math.max(10,rect.top+8); }
    Object.assign(cursor.style,{left:x+'px',top:y+'px'});
  }
  async function show(index) {
    if (busy || !active || index < 0 || index >= steps.length) return;
    busy = true; clearTimeout(timer); current = index;
    const expectedOperation = ++operation;
    controls(true);
    root.classList.add('is-preparing');
    if (root.matches(':popover-open')) root.hidePopover();
    document.body.append(root);
    const step = steps[current];
    $('#tour-count').textContent = `ΠΕΡΙΗΓΗΣΗ ${current+1} / ${steps.length}`;
    $('#tour-title').textContent = step.title;
    $('#tour-description').textContent = step.description;
    $('#tour-jump').value = String(current);
    $('#tour-next').textContent = current === steps.length-1 ? 'Ολοκλήρωση' : 'Επόμενο';
    $('.tour-progress i').style.width = `${(current+1)/steps.length*100}%`;
    try {
      const preparation = window.ConsoleApp.prepareTour(step.mode);
      const loadingModal = document.querySelector('#detail-dialog[open]');
      (loadingModal || document.body).append(root);
      root.showPopover();
      target = loadingModal?.querySelector('#dialog-title') || document.querySelector('.home-button');
      position();
      $('#tour-close').focus({preventScroll:true});
      await preparation;
      await tick();
      if (!active || expectedOperation !== operation) return;
      target = document.querySelector(step.target);
      if (!target || target.getBoundingClientRect().height === 0) throw new Error('Unavailable target');
      const modal = document.querySelector('#detail-dialog[open]');
      (modal || document.body).append(root);
      target.scrollIntoView({behavior:'instant',block:'start'});
      if (modal) modal.scrollTop = Math.max(0,modal.scrollTop-95);
      else window.scrollBy({top:-(document.querySelector('.topbar').getBoundingClientRect().height+22),behavior:'instant'});
      if (!root.matches(':popover-open')) root.showPopover();
      await tick();
      root.classList.remove('is-preparing'); busy = false; controls(false);
      position(); $('#tour-next').focus({preventScroll:true}); schedule();
    } catch {
      if (!active || expectedOperation !== operation) return;
      const modal = document.querySelector('#detail-dialog[open]');
      (modal || document.body).append(root); if (!root.matches(':popover-open')) root.showPopover(); root.classList.remove('is-preparing'); controls(false);
      $('#tour-description').textContent = 'Αυτή η περιοχή δεν είναι διαθέσιμη αυτή τη στιγμή. Μπορείς να προχωρήσεις στην επόμενη στάση ή να κλείσεις την περιήγηση.';
      target = modal?.querySelector('#dialog-title') || document.querySelector('.home-button'); busy = false; position(); $('#tour-next').focus({preventScroll:true}); schedule();
    }
  }
  async function start() {
    if (active) return;
    const trigger = document.activeElement;
    if (!window.ConsoleApp?.isReady()) {
      document.querySelector('#announcer').textContent = 'Περίμενε λίγο να φορτωθεί η μελέτη και πάτησε ξανά την περιήγηση.';
      return;
    }
    if (!root) build();
    lastFocus = trigger; active = true; automatic = false; setAuto();
    document.body.classList.add('tour-active');
    await show(0);
  }
  function stop() {
    if (!root) return;
    operation++;
    active = false; busy = false; automatic = false; clearTimeout(timer); cancelAnimationFrame(frame);
    if (root?.matches(':popover-open')) root.hidePopover();
    document.body.classList.remove('tour-active');
    document.body.append(root);
    // Keep the current section open so the visitor can try it immediately.
    const modal = document.querySelector('#detail-dialog[open]');
    const focus = modal?.querySelector('#close-dialog') || (lastFocus?.isConnected && lastFocus.getBoundingClientRect().height ? lastFocus : document.querySelector('.home-button'));
    focus?.focus({preventScroll:true});
  }
  document.addEventListener('click',event=>{ if (event.target.closest('[data-start-tour]')) start(); });
  window.ConsoleTour = Object.freeze({start,stop});
})();
