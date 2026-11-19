/* Static evidence explorer. No generated answers, remote models or credentials. */
(() => {
  'use strict';
  const $ = (selector) => document.querySelector(selector);
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const href = (value) => /^(https:\/\/|(?:\.\/)?writing\/|(?:\.\/)?downloads\/)/.test(value || '') ? esc(value) : '#';
  const labels = {fact:'Δημοσιευμένο στοιχείο',claim:'Εταιρική δήλωση / πρόβλεψη',interpretation:'Δική μας ερμηνεία',proposal:'Δική μας πρόταση',unknown:'Δεν γνωρίζουμε'};
  const badge = (type, label) => `<span class="type-label ${esc(type)}">${esc(label || labels[type])}</span>`;
  const routes = {
    findings: ['01 / ΑΝΑΚΑΛΥΨΕ','Τα 3 ευρήματα','Τρεις παρατηρήσεις. Τρία ερωτήματα για τη διοίκηση.','#64e4ff'],
    company: ['02 / ΚΑΤΑΛΑΒΕ','Η εταιρεία','Πρώτα το πλαίσιο. Μετά οι ερμηνείες.','#c6aeff'],
    assignment: ['03 / ΜΕΛΕΤΗΣΕ','Η εργασία','3 θέματα · 6 ερωτήματα · κάθε απάντηση στη θέση της.','#c6ff75'],
    ask: ['04 / ΡΩΤΗΣΕ','Βρες την εξήγηση.','Γράψε μια ερώτηση. Δες τι γνωρίζουμε και από πού.','#ffc86b']
  };
  let data, knowledge, index, paper, sourceMap = new Map(), activeFinding = 'nps', selectedScope = 'company';
  let lastQuery = '', results = [], selectedResult = '', ready = false;
  let dialogTrigger, dialogRevision = 0;
  let media = [];
  const view = $('#view-content');
  const dialog = $('#detail-dialog');
  const card = id => knowledge.cards.find(item => item.id === id);
  const finding = () => data.findings.find(item => item.id === activeFinding);
  const allSourceIds = f => [...new Set([...(f.publishedFacts || []), ...(f.companyClaims || []), f.hypothesis].flatMap(x => x?.sourceIds || []))];
  function termNotes(text) {
    const terms = window.ConsoleTerms?.explanationsFor(text) || [];
    return terms.length ? `<aside class="term-notes" data-terms-skip><strong>Με απλά λόγια</strong>${terms.map(t => `<p>${esc(t.term)} (${esc(t.explanation)}).${t.note ? ` <small>${esc(t.note)}</small>` : ''}</p>`).join('')}</aside>` : '';
  }
  function renderPhotos() {
    $('#home-photos').innerHTML = media.map(p => `<figure class="photo-card"><img src="${esc(p.src)}" alt="${esc(p.alt)}" width="112" height="78" loading="lazy" style="object-position:center 20%"><figcaption><strong>${esc(p.caption || p.title)}</strong><a href="${href(p.sourceUrl)}" target="_blank" rel="noopener">Πραγματική μονάδα · πηγή</a></figcaption></figure>`).join('');
  }
  const sourceList = ids => [...new Set(ids)].map(id => {
    const s = sourceMap.get(id);
    if (!s) return '';
    const locator = s.pageLabel || s.locator || (s.pdfPage ? `PDF σ. ${s.pdfPage}` : 'Δημόσια πηγή');
    return `<article class="source-card"><a href="${href(s.url)}" target="_blank" rel="noopener">${esc(s.title)} ↗</a><p>${esc(locator)}${s.printedPage && s.printedPage !== s.pdfPage ? ` · Έντυπη σ. ${esc(s.printedPage)}` : ''}</p>${s.note ? `<small>${esc(s.note)}</small>` : ''}</article>`;
  }).join('');
  function openDialog(title, html, eyebrow = 'ΜΙΑ ΠΙΟ ΚΟΝΤΙΝΗ ΜΑΤΙΑ') {
    dialogRevision++;
    dialogTrigger = document.activeElement;
    $('#dialog-title').textContent = title;
    $('#dialog-eyebrow').textContent = eyebrow;
    $('#dialog-body').innerHTML = html;
    window.ConsoleTerms?.annotate(dialog);
    if (!dialog.open) dialog.showModal();
    dialog.scrollTop = 0;
    $('#close-dialog').focus();
  }
  function closeDialog() {
    dialogRevision++;
    dialog.close();
    if (dialogTrigger?.isConnected) dialogTrigger.focus();
  }
  function traceHTML(question, observation, ids) {
    return `<div class="trace-graph animate" aria-label="Διαδρομή από ερώτημα σε πηγές"><div class="trace-node"><small>ΕΡΩΤΗΜΑ</small><strong>${esc(question)}</strong></div><div class="trace-edge"><span>οδηγεί σε</span><i></i></div><div class="trace-node"><small>ΤΕΚΜΗΡΙΟ</small><strong>${esc(observation)}</strong></div><div class="trace-edge"><span>ελέγχεται σε</span><i></i></div><button class="trace-node trace-source" data-sources="${esc(ids.join(','))}"><small>ΠΗΓΕΣ</small><strong>${ids.length} ${ids.length === 1 ? 'παραπομπή' : 'παραπομπές'} ↗</strong><span>Έγγραφο & σελίδα</span></button></div>`;
  }
  function renderRoute() {
    const [requested, sub] = location.hash.slice(1).split('/');
    const route = routes[requested] ? requested : 'home';
    $('#home').hidden = route !== 'home';
    $('#workspace').hidden = route === 'home';
    if (dialog.open) closeDialog();
    if (route === 'home') { document.title = 'Ιατρικό Αθηνών / Η μεγάλη εικόνα'; return; }
    const [kicker, title, description, color] = routes[route];
    $('#workspace').style.setProperty('--accent', color);
    $('#view-kicker').textContent = kicker;
    $('#view-title').textContent = title;
    $('#view-description').textContent = description;
    $('#breadcrumb-current').textContent = title;
    $('#view-number').textContent = kicker.slice(0,2);
    document.title = `${title} / Ιατρικό Αθηνών`;
    if (!ready) { view.innerHTML = '<p class="status">Ανοίγουμε τη μελέτη…</p>'; return; }
    if (route === 'findings') {
      if (['nps','elliniko','gaia'].includes(sub)) activeFinding = sub;
      renderFinding();
    }
    if (route === 'company') renderCompany();
    if (route === 'assignment') {
      renderAssignment();
      if (data.requirements.some(r => r.id === sub)) openRequirement(sub);
    }
    if (route === 'ask') renderAsk();
    $('#view-title').focus({preventScroll:true});
    window.scrollTo(0,0);
  }
  function renderFinding() {
    const f = finding();
    const config = {
      nps: {title:'Μια άνοδος. Μια κρυμμένη πτώση.', scope:'Ελληνικές μονάδες · 2024 → 2025', question:'Πού χρειάζεται προσοχή η εμπειρία ασθενών;', takeaway:'Ο συνολικός δείκτης δεν δείχνει την ίδια εικόνα σε κάθε μονάδα.', tag:'fact', req:['q1a','q3a','q3b']},
      elliniko: {title:'Ένα έργο. Δύο χρονοδιαγράμματα.', scope:'Healthcare Park · δημόσια έγγραφα 2026', question:'Με ποιο ορόσημο προετοιμάζεται η λειτουργία;', takeaway:'Πρώτα διευκρίνιση της ημερομηνίας. Μετά εξοπλισμός και στελέχωση.', tag:'claim', req:['q1b','q2a','q2b']},
      gaia: {title:'Κερδοφόρα. Κι όμως μεταβιβάστηκε.', scope:'Δραστηριότητα ΓΑΙΑ · Μαρούσι · 2021', question:'Τι αξίζει περισσότερο στον ίδιο χώρο;', takeaway:'Η κερδοφορία μιας δραστηριότητας δεν αρκεί για να κρίνουμε τη βέλτιστη χρήση χώρου.', tag:'fact', req:['q2b','q3b']}
    }[activeFinding];
    let visual;
    if (activeFinding === 'nps') {
      visual = `<div class="chart-context"><span>Συνολικός NPS</span><strong>47 <span aria-hidden="true">→</span> 48</strong><button class="link-button" data-card="nps-explained">Τι σημαίνει NPS;</button></div><p class="chart-caption">Μεταβολή ανά μονάδα · πάτησε μία γραμμή</p><div class="nps-chart" aria-label="Μεταβολή NPS 2024 προς 2025">${f.metrics.clinics.map(c => `<button class="nps-row" data-clinic="${esc(c.id)}" aria-label="${esc(c.label)}: ${c.nps2024} προς ${c.nps2025}, μεταβολή ${c.changePoints} μονάδες"><span>${esc(c.label)}</span><span class="nps-track" aria-hidden="true"><i class="nps-bar ${c.changePoints < 0 ? 'negative' : 'positive'}" style="--delta:${Math.abs(c.changePoints)*4}%"></i></span><strong>${c.changePoints > 0 ? '+' : '−'}${Math.abs(c.changePoints)}</strong></button>`).join('')}</div><div class="chart-detail" id="clinic-detail" aria-live="polite"><strong>Παλαιό Φάληρο: 62 → 49</strong><span>−13 μονάδες NPS. Η αιτία δεν τεκμηριώνεται.</span></div>`;
    } else if (activeFinding === 'elliniko') {
      visual = `<div class="big-comparison">${f.metrics.forecasts.map(x => `<button data-sources="${x.sourceIds.join(',')}"><span>${esc(x.publisher)}</span><strong>${x.completionYear}</strong><small>τέλος έτους · έγγραφο ${x.documentDate === '2026-05-26' ? '26/05/2026' : '30/04/2026'}</small></button>`).join('')}</div><p class="chart-detail">Προβλέψεις ολοκλήρωσης κτηρίου.<br><strong>Η διαφορά δεν αποδεικνύει καθυστέρηση.</strong></p>`;
    } else {
      visual = `<div class="profit-visual"><span>Κέρδη δραστηριότητας μετά φόρων</span><strong>€930 <small>χιλ.</small></strong><span>2021 έως τη μεταβίβαση · χωρίς κέρδος πώλησης</span></div><div class="capacity-row"><span><strong>100</strong> κλίνες</span><span><strong>4</strong> χειρουργεία</span></div><p class="chart-caption">Δηλωμένη απελευθέρωση χώρου από την εταιρεία.</p>`;
    }
    view.innerHTML = `<div class="tabs" aria-label="Επίλεξε εύρημα">${[['nps','01 / Εμπειρία'],['elliniko','02 / Ελληνικό'],['gaia','03 / ΓΑΙΑ']].map(([id,title]) => `<button class="tab" data-finding="${id}" aria-pressed="${id === activeFinding}">${title}</button>`).join('')}</div><article class="finding-stage"><div class="finding-top">${badge(config.tag)}<span>${config.scope}</span></div><div class="finding-main"><div class="finding-visual">${visual}</div><div class="finding-message"><h2>${config.title}</h2>${badge('interpretation')}<p>${config.takeaway}</p><button class="primary" data-action="finding-value">Η διοικητική αξία <span aria-hidden="true">↗</span></button></div></div><div class="finding-controls"><button class="secondary" data-sources="${allSourceIds(f).join(',')}">Πηγές & σελίδες</button><button class="secondary" data-action="finding-limits">Τι δεν γνωρίζουμε</button><button class="secondary" data-action="trace" aria-expanded="false" aria-controls="finding-trace">Δες τη διαδρομή των στοιχείων</button></div><section class="evidence-trace" id="finding-trace" hidden><p class="trace-heading">ΔΙΑΔΡΑΣΤΙΚΟΣ ΓΡΑΦΟΣ ΤΕΚΜΗΡΙΩΣΗΣ</p>${traceHTML(config.question, config.title, allSourceIds(f))}<p class="chart-caption">Σύνδεση ερωτήματος με πηγές · δεν αποδεικνύει αιτία.</p></section></article><div class="study-links"><span>Συνδέεται με την εργασία:</span>${config.req.map(id => `<button class="link-button" data-requirement="${id}">${esc(data.requirements.find(r => r.id === id).label)}</button>`).join('')}</div>`;
  }
  function renderCompany() {
    const scopes = {
      company: {label:'Νομική εταιρεία',name:'Ιατρικό Αθηνών Ε.Α.Ε.',description:'Νοσηλεία, χειρουργική και διαγνωστικές υπηρεσίες. ΓΕΜΗ 356301000.',metrics:[['€271,7 εκ.','Έσοδα 2025'],['3.273','Εργαζόμενοι 2025'],['−€10,2 εκ.','Καθαρό αποτέλεσμα 2025']]},
      group: {label:'Ενοποιημένος Όμιλος',name:'Εταιρεία + θυγατρικές',description:'Ο ενοποιημένος Όμιλος έχει διαφορετική περίμετρο από τη νομική εταιρεία.',metrics:[['€275,8 εκ.','Έσοδα 2025'],['3.499','Εργαζόμενοι 2025'],['Διακριτά','Στοιχεία ενοποίησης']]},
      clinics: {label:'Κλινικές',name:'Η μονάδα έχει τη δική της εικόνα.',description:'Οι μετρήσεις εμπειρίας ασθενών αφορούν συγκεκριμένες κλινικές. Δεν αποτελούν ξεχωριστά εταιρικά οικονομικά.',metrics:[['6','Ελληνικές μονάδες στον NPS'],['2024–25','Σύγκριση μετρήσεων'],['−13 έως +7','Μεταβολή σε μονάδες NPS']]}
    };
    const s = scopes[selectedScope];
    view.innerHTML = `<div class="scope-switch tabs" aria-label="Επίπεδο ανάλυσης">${Object.entries(scopes).map(([id,x]) => `<button class="tab" data-scope="${id}" aria-pressed="${id === selectedScope}">${x.label}</button>`).join('')}</div><div class="company-overview"><div class="scope-summary">${badge('fact')}<h2>${s.name}</h2><p>${s.description}</p><button class="link-button" data-card="company-figures">Ακριβή μεγέθη & πηγές ↗</button></div><figure class="company-photo"><img src="assets/media/marousi.png" alt="Το Ιατρικό Κέντρο Αθηνών στο Μαρούσι" width="650" height="420"><figcaption>Μαρούσι · <button class="link-button" data-sources="am-official-marousi-photo">Επίσημη φωτογραφία ↗</button></figcaption></figure></div><div class="metric-row">${s.metrics.map(([a,b]) => `<div><strong>${a}</strong><span>${b}</span></div>`).join('')}</div><div class="company-menu"><button class="secondary" data-action="structure">Πώς διοικείται; <span>Δομή & αρμοδιότητες ↗</span></button><button class="secondary" data-action="competition">Πώς συγκρίνεται; <span>Ιατρικό & ΙΑΣΩ ↗</span></button><button class="secondary" data-requirement="q1b">Τι το επηρεάζει; <span>Οι 6 δυνάμεις PESTEL ↗</span></button></div>`;
  }
  function renderAssignment() {
    const topics = [
      ['01','Εταιρεία & περιβάλλον',['q1a','q1b']],
      ['02','Δομή & προσαρμογή',['q2a','q2b']],
      ['03','Κουλτούρα & ηγεσία',['q3a','q3b']]
    ];
    view.innerHTML = `<div class="requirements-list">${topics.map(([n,title,ids]) => `<article class="requirement-topic"><span class="topic-number">${n}</span><h2>${title}</h2>${ids.map(id => { const q = data.requirements.find(r => r.id === id); return `<button class="question-button" data-requirement="${id}"><span>${q.shortLabel}</span><strong>${esc(q.label.split(' · ')[1])}</strong><span aria-hidden="true">↗</span></button>`; }).join('')}</article>`).join('')}</div><div class="study-links"><a class="secondary" download href="writing/Μελέτη-με-εκφωνήσεις-Τζαχρήστας_Χρήστου_Σταματόπουλος.docx">Word με γκρι εκφωνήσεις ↧</a><button class="secondary" data-action="deliverables">Όλα τα αρχεία & η δήλωση ΤΝ</button></div><p class="retrieval-note">Κάθε ερώτημα ανοίγει την επίσημη εκφώνηση, τη σύνοψη και την πλήρη απάντηση. Ο τελικός έλεγχος των μελών εκκρεμεί.</p>`;
  }
  function openRequirement(id) {
    const q = data.requirements.find(r => r.id === id);
    if (!q) return;
    openDialog(q.label, `<blockquote class="question-quote" data-terms-skip><small>ΕΠΙΣΗΜΗ ΕΚΦΩΝΗΣΗ · ΣΕΛΙΔΑ ${q.page}</small><p>${esc(q.prompt)}</p></blockquote>${termNotes(q.prompt)}<div class="modal-answer"><h3>Η απάντησή μας, συνοπτικά</h3><p>${esc(q.answer)}</p></div><div class="limits">${badge('unknown','Όριο της τεκμηρίωσης')}<p>${esc(q.limit)}</p></div><button class="primary" data-full-answer="${id}">Διάβασε την πλήρη απάντηση ↓</button><div id="full-answer"></div>${id === 'q2a' ? '<div class="modal-links"><a href="versions/2026-11-19/organization.html">Αναλυτικός γράφος · έκδοση 19/11 ↗</a></div>' : ''}<div class="modal-links"><a href="downloads/Εκφώνηση-Μάνατζμεντ-2026-2027.pdf#page=${q.page}" target="_blank" rel="noopener">Επίσημο PDF ↗</a><a download href="writing/Τζαχρήστας_Χρήστου_Σταματόπουλος.docx">Πλήρες Word ↧</a></div>`, 'ΕΡΓΑΣΙΑ / ΕΚΦΩΝΗΣΗ → ΑΠΑΝΤΗΣΗ');
  }
  function renderAsk() {
    view.innerHTML = `<form class="ask-form" id="ask-form"><label class="sr-only" for="query">Η ερώτησή σου</label><span aria-hidden="true">&gt;_</span><input id="query" name="query" type="search" maxlength="300" placeholder="π.χ. Τι σημαίνει EBITDA;" value="${esc(lastQuery)}" autocomplete="off"><button class="primary" type="submit">Αναζήτηση ↵</button></form><div class="query-examples">${['NPS στο Παλαιό Φάληρο','Τι προβλέπεται για το Ελληνικό;','Τι σημαίνει EBITDA;'].map(x => `<button class="secondary" data-query="${esc(x)}">${esc(x)}</button>`).join('')}</div><p class="retrieval-note">25 σύντομες εξηγήσεις με πηγές. Επιμελημένη αναζήτηση, χωρίς παραγωγή νέων απαντήσεων.</p><div id="search-results"></div>`;
    if (lastQuery) renderResults();
  }
  function search(query) {
    lastQuery = query.trim().slice(0,300);
    results = index.search(lastQuery, 5);
    selectedResult = results[0]?.card.id || '';
    renderResults();
    $('#announcer').textContent = results.length ? `${results.length} σχετικά τεκμήρια.` : 'Δεν βρέθηκε σχετικό τεκμήριο στη συλλογή.';
  }
  function renderResults() {
    const target = $('#search-results');
    if (!lastQuery) { target.innerHTML = ''; return; }
    if (!results.length) { target.innerHTML = '<div class="empty-results"><h2>Δεν βρέθηκε σχετικό τεκμήριο.</h2><p>Η συλλογή μας είναι συγκεκριμένη. Δοκίμασε NPS, Ελληνικό ή ΓΑΙΑ.</p></div>'; return; }
    const selected = results.find(x => x.card.id === selectedResult)?.card || results[0].card;
    target.innerHTML = `<div class="results-layout"><div class="result-list" aria-label="Σχετικές εξηγήσεις"><p class="eyebrow">${results.length} ΣΧΕΤΙΚΑ ΤΕΚΜΗΡΙΑ</p>${results.map(({card:c}) => `<button class="result-option" data-result="${c.id}" aria-pressed="${c.id === selected.id}">${esc(c.title)}<span aria-hidden="true">↗</span></button>`).join('')}</div><article class="answer-panel">${badge(selected.classification)}<h2>${esc(selected.title)}</h2><p class="answer-text">${esc(selected.answer)}</p><div class="answer-sources">${selected.sourceIds.length ? `<button class="secondary" data-sources="${selected.sourceIds.join(',')}">Πηγές & σελίδες (${selected.sourceIds.length})</button>` : ''}${selected.requirementIds.map(id => `<button class="link-button" data-requirement="${id}">Εργασία ${esc(id.slice(1).replace('a','α').replace('b','β'))} ↗</button>`).join('')}</div>${selected.sourceIds.length ? traceHTML(lastQuery, selected.title, selected.sourceIds) : '<p class="retrieval-note">Περιγραφή της λειτουργίας αυτού του εργαλείου.</p>'}</article></div>`;
  }
  function openCard(id) {
    const c = card(id);
    if (!c) return;
    openDialog(c.title, `${badge(c.classification)}<p class="modal-answer">${esc(c.answer)}</p>${sourceList(c.sourceIds)}${c.requirementIds.map(q => `<button class="secondary" data-requirement="${q}">Σύνδεση με το θέμα ${esc(q.slice(1).replace('a','α').replace('b','β'))} ↗</button>`).join('')}`, 'ΜΕ ΑΠΛΑ ΛΟΓΙΑ');
  }
  async function loadPaper() {
    if (!paper) { const response = await fetch('writing/paper-content.json?v=2.0'); if (!response.ok) throw new Error('paper'); paper = await response.json(); }
    return paper;
  }
  async function fullAnswer(id, button) {
    const expectedRevision = dialogRevision;
    const target = $('#full-answer');
    button.disabled = true; button.textContent = 'Ανοίγει η πλήρης απάντηση…';
    try {
      const p = await loadPaper();
      const q = data.requirements.find(r => r.id === id);
      const s = p.sections.find(s => s.id === q.sectionId);
      if (expectedRevision !== dialogRevision || !target?.isConnected || !dialog.open) return;
      target.innerHTML = `<section class="prose"><h3>${esc(s.title)}</h3>${s.paragraphs.map(x => `<p>${esc(x)}</p>`).join('')}<button class="link-button" data-action="bibliography">Βιβλιογραφία & παραπομπές ↗</button></section>`;
      button.hidden = true;
    } catch { if (expectedRevision === dialogRevision && button.isConnected) { button.disabled = false; button.textContent = 'Δεν άνοιξε — δοκίμασε ξανά'; } }
  }
  function deliverables() {
    openDialog('Η πλήρης εργασία, μαζί σου.', `<div class="modal-links"><a download href="writing/Τζαχρήστας_Χρήστου_Σταματόπουλος.docx">Εργασία · Word</a><a download href="writing/Μελέτη-με-εκφωνήσεις-Τζαχρήστας_Χρήστου_Σταματόπουλος.docx">Έκδοση μελέτης · γκρι εκφωνήσεις</a><a download href="writing/Παρουσίαση-Τζαχρήστας_Χρήστου_Σταματόπουλος.pptx">Παρουσίαση · 15 διαφάνειες</a><a download href="writing/ΥΔ_Τζαχρήστας_Χρήστου_Σταματόπουλος.docx">Δήλωση χρήσης ΤΝ · Word</a><a download href="downloads/Εκφώνηση-Μάνατζμεντ-2026-2027.pdf">Επίσημη εκφώνηση · PDF</a><a download href="writing/Πίνακας-συνεισφοράς-Τζαχρήστας_Χρήστου_Σταματόπουλος.xlsx">Πίνακας συνεισφοράς · προς συμπλήρωση</a></div><p class="limits">Τα αρχεία είναι υλικό της ομάδας προς τελικό έλεγχο. Αριθμοί μητρώου, υπεύθυνος επικοινωνίας και υπογραφές παραμένουν για συμπλήρωση.</p>`, 'ΑΡΧΕΙΑ / ΛΗΨΗ');
  }
  async function action(name, trigger) {
    if (name === 'dialog-home') { closeDialog(); if (location.hash === '#home') renderRoute(); else location.hash = 'home'; return; }
    if (name === 'help') {
      openDialog('Πού θέλεις να πας;', '<div class="prose"><p><strong>Τα 3 ευρήματα:</strong> δες τις παρατηρήσεις που γεννούν διοικητικά ερωτήματα.</p><p><strong>Η εταιρεία:</strong> κατανόησε μέγεθος, δομή και ανταγωνισμό.</p><p><strong>Η εργασία:</strong> άνοιξε κάθε εκφώνηση μαζί με την απάντησή μας.</p><p><strong>Τα τεκμήρια:</strong> γράψε μια ερώτηση ή διάλεξε παράδειγμα.</p><p>Το «Αρχική» σε φέρνει πάντα πίσω. Οι πηγές ανοίγουν σε νέα καρτέλα.</p></div>', 'Ο ΧΑΡΤΗΣ ΣΕ 20 ΔΕΥΤΕΡΟΛΕΠΤΑ'); return;
    }
    if (!ready) return;
    if (name === 'method') {
      openDialog('Πώς διαβάζεται αυτή η μελέτη;', `<div class="prose"><p>${esc(data.classificationNote)}</p><p>${esc(knowledge.scopeNote)}</p><div class="legend-list">${Object.keys(labels).map(type => badge(type)).join(' ')}</div><h3>Χρήση ΤΝ</h3><p>${esc(data.aiDeclaration)}</p><p>Στην έκδοση αυτή η ΤΝ υποστήριξε επίσης την αρχειοθέτηση, τον ανασχεδιασμό και τον προγραμματισμό της ιστοσελίδας, τη σύνθεση των 25 καρτών και τους ελέγχους λειτουργίας. Η αναζήτηση ανακτά έτοιμες κάρτες· δεν εκτελεί LLM ή ζωντανό GraphRAG.</p><p>Η ενημέρωση της 20ής Νοεμβρίου 2026 πρόσθεσε επιλογή θέματος, επεξηγήσεις ακρωνυμίων, επίσημες φωτογραφίες και καθοδηγούμενη περιήγηση με συνδρομή ΤΝ. Στιγμιότυπο περιεχομένου μελέτης: 19 Νοεμβρίου 2026. Οι πηγές έχουν τις δικές τους ημερομηνίες· δεν πρόκειται για ζωντανή ενημέρωση.</p><button class="secondary" data-action="deliverables">Δήλωση ΤΝ & αρχεία</button><button class="secondary" data-action="bibliography">Βιβλιογραφία</button></div>`, 'ΜΕΘΟΔΟΣ / ΔΙΑΦΑΝΕΙΑ');
    }
    if (name === 'deliverables') deliverables();
    if (name === 'trace') { const el = $('#finding-trace'); el.hidden = !el.hidden; trigger.setAttribute('aria-expanded', String(!el.hidden)); if (!el.hidden) el.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',block:'nearest'}); }
    if (name === 'finding-limits') openDialog('Τι δεν προκύπτει από τις πηγές;', `<div class="limits">${badge('unknown')}${finding().limitations.map(x => `<p>${esc(x)}</p>`).join('')}</div>${sourceList(allSourceIds(finding()))}`, 'ΟΡΙΑ ΤΟΥ ΕΥΡΗΜΑΤΟΣ');
    if (name === 'finding-value') {
      const f = finding();
      openDialog(f.proposedTest.question, `${badge('interpretation','Υπόθεση προς έλεγχο')}<p class="modal-answer">${esc(f.hypothesis.text)}</p>${badge('proposal')}<ol class="prose">${f.proposedTest.steps.map(x => `<li>${esc(x)}</li>`).join('')}</ol><div class="limits"><h3>Τι θα μπορούσε να την αντικρούσει;</h3><p>${esc(f.proposedTest.couldDisconfirm)}</p></div><p class="chart-caption">${esc(f.proposedTest.note)}</p>`, 'ΑΠΟ ΤΟ ΕΥΡΗΜΑ ΣΤΗΝ ΑΠΟΦΑΣΗ');
    }
    if (name === 'structure') {
      openDialog('Κεντρικός συντονισμός. Τοπική λειτουργία.', `${badge('fact','Σύνοψη δημοσιευμένης δομής Ομίλου')}<div class="structure-diagram"><div>ΔΣ & επιτροπές <small>Εποπτεία</small></div><span aria-hidden="true">↓</span><div>Εκτελεστική διοίκηση <small>Διοίκηση και εφαρμογή αποφάσεων</small></div><span aria-hidden="true">↓</span><div>Γενικός Διευθυντής Ομίλου <small>Συντονισμός</small></div><div class="structure-branches"><div>Λειτουργικές διευθύνσεις <small>Εξειδικευμένες λειτουργίες</small></div><div>Διοικήσεις κλινικών <small>Λειτουργία μονάδων</small></div></div></div><p class="limits">Απλοποιημένη ομαδοποίηση ρόλων, όχι πλήρες εσωτερικό οργανόγραμμα. Οι σύντομες περιγραφές συνοψίζουν το επίπεδο ευθύνης· δεν αποτελούν τεκμηρίωση ατομικών εξουσιοδοτήσεων ή πραγματικού εύρους διοίκησης.</p>${sourceList(['AC-STRUCTURE'])}<button class="secondary" data-requirement="q2a">Πλήρης απάντηση 2α ↗</button>`, 'ΠΩΣ ΔΙΟΙΚΕΙΤΑΙ');
    }
    if (name === 'competition') {
      openDialog('Τα έσοδα δεν λένε όλη την ιστορία.', `${badge('fact')}<p>Εξέλιξη Ομίλων, 2023 → 2024</p><table class="data-table"><caption>Μεταβολή δημοσιευμένων μεγεθών</caption><thead><tr><th>Όμιλος</th><th>Έσοδα</th><th>EBITDA</th></tr></thead><tbody><tr><th>Ιατρικό</th><td>+4,4%</td><td>−15,9%</td></tr><tr><th>ΙΑΣΩ</th><td>+5,8%</td><td>+8,5%</td></tr></tbody></table>${badge('interpretation')}<p>Η αύξηση εσόδων συνυπάρχει με διαφορετική εξέλιξη λειτουργικής κερδοφορίας. Αξίζει έλεγχος κόστους και μίγματος υπηρεσιών.</p><p class="limits">Διαφορετικές περίμετροι και ορισμοί EBITDA. Δεν είναι μερίδια αγοράς ή κατάταξη διοικητικής ποιότητας.</p>${sourceList(['AC-COMPARE-I','AC-COMPARE-J'])}<button class="secondary" data-card="ebitda-explained">Τι είναι το EBITDA;</button>`, 'ΣΥΓΚΡΙΣΗ / ΚΟΙΝΗ ΔΙΕΤΙΑ');
    }
    if (name === 'bibliography') {
      openDialog('Βιβλιογραφία της εργασίας', '<p role="status">Ανοίγουμε τη βιβλιογραφία…</p>', 'ΕΡΓΑΣΙΑ / ΑΝΑΦΟΡΕΣ');
      const expectedRevision = dialogRevision;
      try {
        const p = await loadPaper();
        if (!dialog.open || dialogRevision !== expectedRevision) return;
        $('#dialog-body').innerHTML = `<div class="prose" data-terms-skip>${p.bibliography.map(x => `<p>${esc(typeof x === 'string' ? x : x.harvard)}${x.url ? ` <a href="${href(x.url)}" target="_blank" rel="noopener">Πηγή ↗</a>` : ''}</p>`).join('')}</div>${termNotes(p.bibliography.map(x => x.harvard || x).join(' '))}`;
      } catch { if (dialogRevision === expectedRevision) $('#dialog-body').innerHTML = '<p>Δεν άνοιξε το αρχείο. Η βιβλιογραφία περιλαμβάνεται στο Word της αρχικής.</p>'; }
    }
  }
  document.addEventListener('click', event => {
    const button = event.target.closest('button');
    if (!button) return;
    if (button.id === 'close-dialog') return closeDialog();
    if (button.dataset.action) { action(button.dataset.action, button); return; }
    if (!ready) return;
    if (button.dataset.finding) { activeFinding = button.dataset.finding; history.replaceState(null,'',`#findings/${activeFinding}`); renderFinding(); $(`[data-finding="${activeFinding}"]`).focus({preventScroll:true}); }
    if (button.dataset.scope) { selectedScope = button.dataset.scope; renderCompany(); $(`[data-scope="${selectedScope}"]`).focus({preventScroll:true}); }
    if (button.dataset.sources) openDialog('Έλεγξε το στοιχείο στην πηγή.', sourceList(button.dataset.sources.split(',')), 'ΠΗΓΕΣ / ΑΚΡΙΒΕΙΣ ΠΑΡΑΠΟΜΠΕΣ');
    if (button.dataset.card) openCard(button.dataset.card);
    if (button.dataset.requirement) openRequirement(button.dataset.requirement);
    if (button.dataset.fullAnswer) fullAnswer(button.dataset.fullAnswer, button);
    if (button.dataset.query) { $('#query').value = button.dataset.query; search(button.dataset.query); }
    if (button.dataset.result) { selectedResult = button.dataset.result; renderResults(); $(`[data-result="${selectedResult}"]`).focus({preventScroll:true}); }
    if (button.dataset.clinic) {
      const c = finding().metrics.clinics.find(x => x.id === button.dataset.clinic);
      $('#clinic-detail').innerHTML = `<strong>${esc(c.label)}: ${c.nps2024} → ${c.nps2025}</strong><span>${c.changePoints > 0 ? '+' : '−'}${Math.abs(c.changePoints)} μονάδες NPS · ${c.responses2025.toLocaleString('el-GR')} απαντήσεις το 2025.</span>`;
    }
  });
  document.addEventListener('submit', event => { if (event.target.id === 'ask-form') { event.preventDefault(); search($('#query').value); } });
  dialog.addEventListener('click', event => { if (event.target === dialog && (event.clientX < dialog.getBoundingClientRect().left || event.clientX > dialog.getBoundingClientRect().right || event.clientY < dialog.getBoundingClientRect().top || event.clientY > dialog.getBoundingClientRect().bottom)) closeDialog(); });
  window.addEventListener('hashchange', renderRoute);
  async function load() {
    $('#retry').hidden = true;
    $('#load-status').textContent = '';
    try {
      [data, knowledge] = await Promise.all(['data/ceo-presentation.json?v=2.0','data/console-knowledge.json?v=2.0'].map(async url => { const r = await fetch(url); if (!r.ok) throw new Error('load'); return r.json(); }));
      sourceMap = new Map([...data.sources, ...knowledge.sources].map(s => [s.id,s]));
      index = ConsoleRetrieval.createIndex(knowledge.cards);
      ready = true;
      renderRoute();
    } catch {
      $('#load-status').textContent = 'Δεν φορτώθηκαν οι διαδραστικές εξηγήσεις. Τα αρχεία της αρχικής παραμένουν διαθέσιμα.';
      $('#retry').hidden = false;
    }
  }
  $('#retry').addEventListener('click', load);
  // The guide reuses the very same controls and content as ordinary navigation.
  window.ConsoleApp = Object.freeze({
    isReady: () => ready,
    async prepareTour(mode) {
      const route = r => { history.replaceState(null,'',`#${r}`); renderRoute(); };
      if (['home','map','theme','photos','downloads','archive','end'].includes(mode)) route('home');
      if (['findings','nps','value','limits','trace','sources'].includes(mode)) { activeFinding = 'nps'; route('findings/nps'); }
      if (mode === 'value') await action('finding-value');
      if (mode === 'limits') await action('finding-limits');
      if (mode === 'trace') { $('#finding-trace').hidden = false; $('[data-action="trace"]').setAttribute('aria-expanded','true'); }
      if (mode === 'sources') openDialog('Έλεγξε το στοιχείο στην πηγή.', sourceList(allSourceIds(finding())), 'ΠΗΓΕΣ / ΑΚΡΙΒΕΙΣ ΠΑΡΑΠΟΜΠΕΣ');
      if (['elliniko','gaia'].includes(mode)) { activeFinding = mode; route(`findings/${mode}`); }
      if (['company','company-metrics','structure','competition','pestel'].includes(mode)) { selectedScope = 'company'; route('company'); }
      if (['structure','competition'].includes(mode)) await action(mode);
      if (mode === 'pestel') openRequirement('q1b');
      if (['assignment','prompt','full-answer','files'].includes(mode)) route('assignment');
      if (mode === 'prompt' || mode === 'full-answer') openRequirement('q2a');
      if (mode === 'full-answer') await fullAnswer('q2a',$('[data-full-answer="q2a"]'));
      if (mode === 'files') deliverables();
      if (['ask','retrieval'].includes(mode)) { route('ask'); if (mode === 'retrieval') { $('#query').value = 'Γιατί 2028 και 2031 στο Ελληνικό;'; search($('#query').value); } }
      if (mode === 'method') { route('home'); await action('method'); }
      window.ConsoleTerms?.annotate(document.body);
    }
  });
  // Expand fresh content after route changes and modal/search rendering, without
  // changing source records, user input, URLs or official quotations.
  if (window.ConsoleTerms) {
    const annotate = () => window.ConsoleTerms.annotate(document.body);
    annotate();
    new MutationObserver(records => {
      if (records.some(record => record.addedNodes.length)) annotate();
    }).observe(document.body,{childList:true,subtree:true});
  }
  fetch('data/console-media.json?v=2.1').then(r => { if (!r.ok) throw new Error('media'); return r.json(); }).then(value => { media = value.photos; renderPhotos(); }).catch(() => { $('#home-photos').hidden = true; });
  renderRoute();
  load();
})();
