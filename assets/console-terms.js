/* Inline explanations of the study's abbreviations. No network or generated definitions. */
(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.ConsoleTerms = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const definitions = [
    ['nps', 'NPS', [], 'Net Promoter Score / δείκτης πρόθεσης σύστασης: ποσοστό απαντήσεων 9–10 μείον ποσοστό 0–6, σε κλίμακα −100 έως +100'],
    ['ebitda', 'EBITDA', [], 'κέρδη πριν από τόκους, φόρους και αποσβέσεις'],
    ['ebit', 'EBIT', [], 'κέρδη πριν από τόκους και φόρους'],
    ['sap', 'SAP', [], 'Systems, Applications and Products in Data Processing / λογισμικό διαχείρισης επιχειρησιακών λειτουργιών'],
    ['erp', 'ERP', [], 'Enterprise Resource Planning / σύστημα ενοποίησης επιχειρησιακών πόρων και διαδικασιών'],
    ['pestel', 'PESTEL', [], 'ανάλυση πολιτικών, οικονομικών, κοινωνικών, τεχνολογικών, περιβαλλοντικών και νομικών παραγόντων'],
    ['pest-dg', 'PEST-DG', ['PEST DG'], 'εναλλακτικό πλαίσιο ανάλυσης εξωτερικού περιβάλλοντος', 'Η επίσημη διαφάνεια 2-5 κατονομάζει το PEST-DG και το δημογραφικό περιβάλλον, αλλά δεν αναπτύσσει το G. Δεν αποδίδουμε αυθαίρετη πλήρη ονομασία.'],
    ['pest', 'PEST', [], 'ανάλυση πολιτικών, οικονομικών, κοινωνικών και τεχνολογικών παραγόντων'],
    ['gemi', 'ΓΕΜΗ', ['Γ.Ε.ΜΗ.', 'Γ.Ε.ΜΗ', 'Γ.Ε.Μ.Η.', 'Γ.Ε.Μ.Η'], 'Γενικό Εμπορικό Μητρώο'],
    ['eae', 'Ε.Α.Ε.', ['Ε.Α.Ε', 'ΕΑΕ'], 'Εμπορική Ανώνυμος Εταιρεία'],
    ['mae', 'Μ.Α.Ε.', ['Μ.Α.Ε', 'ΜΑΕ'], 'Μονοπρόσωπη Ανώνυμη Εταιρεία'],
    ['ae', 'Α.Ε.', ['Α.Ε'], 'Ανώνυμη Εταιρεία'],
    ['board', 'ΔΣ', ['Δ.Σ.', 'Δ.Σ', 'Δ. Σ.'], 'Διοικητικό Συμβούλιο'],
    ['kpi', 'KPI', [], 'Key Performance Indicator / βασικός δείκτης απόδοσης'],
    ['kpis', 'KPIs', [], 'Key Performance Indicators / βασικοί δείκτες απόδοσης'],
    ['llm', 'LLM', [], 'Large Language Model / μεγάλο γλωσσικό μοντέλο'],
    ['llms', 'LLMs', [], 'Large Language Models / μεγάλα γλωσσικά μοντέλα'],
    ['graphrag', 'GraphRAG', ['Graph RAG'], 'ανάκτηση από γράφο γνώσης για υποστήριξη παραγωγής απαντήσεων'],
    ['rag', 'RAG', [], 'Retrieval-Augmented Generation / παραγωγή απαντήσεων με ανάκτηση τεκμηρίων'],
    ['tn', 'ΤΝ', ['Τ.Ν.', 'Τ.Ν'], 'Τεχνητή Νοημοσύνη'],
    ['ai', 'AI', [], 'Artificial Intelligence / τεχνητή νοημοσύνη'],
    ['mba4', 'MBA-4', ['MBA 4'], 'Master of Business Administration / μεταπτυχιακό στη διοίκηση επιχειρήσεων, τμήμα 4'],
    ['mba', 'MBA', [], 'Master of Business Administration / μεταπτυχιακό στη διοίκηση επιχειρήσεων'],
    ['ceo', 'CEO', [], 'Chief Executive Officer / διευθύνων σύμβουλος'],
    ['roi', 'ROI', [], 'Return on Investment / απόδοση επένδυσης'],
    ['hhg', 'HHG', [], 'Hellenic Healthcare Group / όμιλος ιδιωτικών υπηρεσιών υγείας'],
    ['oecd', 'OECD', ['ΟΟΣΑ', 'Ο.Ο.Σ.Α.'], 'Οργανισμός Οικονομικής Συνεργασίας και Ανάπτυξης'],
    ['eopyy', 'ΕΟΠΥΥ', ['Ε.Ο.Π.Υ.Υ.'], 'Εθνικός Οργανισμός Παροχής Υπηρεσιών Υγείας'],
    ['evea', 'ΕΒΕΑ', ['Ε.Β.Ε.Α.'], 'Εμπορικό και Βιομηχανικό Επιμελητήριο Αθηνών'],
    ['eu', 'ΕΕ', ['Ε.Ε.', 'EU'], 'Ευρωπαϊκή Ένωση'],
    ['xa', 'ΧΑ', ['Χ.Α.'], 'Χρηματιστήριο Αθηνών'],
    ['am', 'ΑΜ', ['Α.Μ.'], 'Αριθμός Μητρώου'],
    ['yd', 'ΥΔ', ['Υ.Δ.'], 'Υπεύθυνη Δήλωση'],
    ['ekpa', 'ΕΚΠΑ', ['Ε.Κ.Π.Α.', 'NKUA'], 'Εθνικό και Καποδιστριακό Πανεπιστήμιο Αθηνών'],
    ['pdf', 'PDF', [], 'Portable Document Format / μορφότυπος εγγράφων σταθερής διάταξης'],
    ['html', 'HTML', [], 'HyperText Markup Language / γλώσσα δομής ιστοσελίδων'],
    ['bmj', 'BMJ', [], 'British Medical Journal / ιατρική εκδοτική επωνυμία'],
    ['pmc', 'PMC', [], 'PubMed Central / ανοικτό αποθετήριο βιοϊατρικών άρθρων'],
    ['pjsc', 'PJSC', [], 'Public Joint Stock Company / ανώνυμη εταιρεία με μετοχές διαθέσιμες στο κοινό']
  ];

  const glossary = Object.freeze(definitions.map(([id, term, aliases, explanation, note]) =>
    Object.freeze({ id, term, aliases: Object.freeze([term, ...aliases]), explanation, ...(note ? { note } : {}) })
  ));

  function normalize(value) {
    return String(value ?? '').normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase('el-GR')
      .replace(/ς/g, 'σ').replace(/[–—]/g, '-').replace(/[.\s-]/g, '');
  }

  const aliasMap = new Map();
  const aliases = [];
  glossary.forEach(entry => entry.aliases.forEach(alias => {
    const key = normalize(alias);
    if (aliasMap.has(key) && aliasMap.get(key).id !== entry.id) throw new Error('Ambiguous term: ' + alias);
    aliasMap.set(key, entry);
    aliases.push(alias);
  }));
  const escapePattern = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = [...new Set(aliases)].sort((a, b) => b.length - a.length)
    .map(alias => escapePattern(alias).replace(/-/g, '\\s*[-–—]\\s*').replace(/ /g, '\\s+')).join('|');
  const wordCharacter = /[\p{L}\p{N}_]/u;

  // Visible links remain readable; literal URLs, paths and filenames remain verbatim.
  function protectedRanges(text) {
    const ranges = [];
    const patterns = [
      /(?:https?:\/\/|www\.)[^\s<>"'`]+/giu,
      /(?:\.{1,2}[\\/]|[a-z]:[\\/]|\b(?:writing|downloads|assets|data|versions)[\\/])[^\s<>"'`]+/giu,
      /[\p{L}\p{N}_.-]+\.(?:pdf|docx?|pptx?|xlsx?|json|html?|js|css|zip|png|jpe?g|svg)(?:[?#][^\s<>"'`]*)?/giu,
      /[\p{L}\p{N}._%+-]+@[\p{L}\p{N}.-]+\.[a-z]{2,}/giu
    ];
    patterns.forEach(regex => { for (const match of text.matchAll(regex)) ranges.push([match.index, match.index + match[0].length]); });
    return ranges;
  }

  function findTerms(value) {
    const text = String(value ?? '');
    if (!text) return [];
    const protectedText = protectedRanges(text);
    const matches = [];
    const regex = new RegExp(pattern, 'giu');
    for (const match of text.matchAll(regex)) {
      const start = match.index;
      const end = start + match[0].length;
      const before = text.slice(0, start).match(/.$/u)?.[0] || '';
      const after = text.slice(end).match(/^./u)?.[0] || '';
      if (wordCharacter.test(before) || wordCharacter.test(after)) continue;
      if (protectedText.some(([from, to]) => start < to && end > from)) continue;
      const entry = aliasMap.get(normalize(match[0]));
      if (entry) matches.push({ start, end, token: match[0], entry });
    }
    return matches;
  }

  function explanationsFor(text) {
    const seen = new Set();
    return findTerms(text).filter(({ entry }) => {
      if (seen.has(entry.id)) return false;
      seen.add(entry.id);
      return true;
    }).map(({ entry }) => ({ id: entry.id, term: entry.term, explanation: entry.explanation, ...(entry.note ? { note: entry.note } : {}) }));
  }

  const excluded = 'head,script,style,noscript,input,textarea,select,option,code,pre,kbd,samp,svg,math,[contenteditable]:not([contenteditable="false"]),[data-terms-skip],[data-term-annotated],.term-token,.term-expansion';
  function isExcluded(node) {
    for (let element = node.parentElement; element; element = element.parentElement) {
      if (element.matches(excluded)) return true;
    }
    return false;
  }

  function annotate(root) {
    if (!root) return 0;
    const doc = root.nodeType === 9 ? root : root.ownerDocument;
    if (!doc || !doc.createTreeWalker || !doc.createElement) return 0;
    if (root.nodeType === 1 && root.matches(excluded)) return 0;
    const nodes = [];
    if (root.nodeType === 3) nodes.push(root);
    else {
      const walker = doc.createTreeWalker(root, 4); // SHOW_TEXT, independent of a global window.
      for (let node = walker.nextNode(); node; node = walker.nextNode()) nodes.push(node);
    }
    let count = 0;
    nodes.forEach(node => {
      if (!node.parentNode || isExcluded(node)) return;
      const text = node.nodeValue;
      const matches = findTerms(text);
      if (!matches.length) return;
      const fragment = doc.createDocumentFragment();
      let cursor = 0;
      matches.forEach(({ start, end, token, entry }) => {
        if (start > cursor) fragment.appendChild(doc.createTextNode(text.slice(cursor, start)));
        const wrapper = doc.createElement('span');
        wrapper.className = 'term-definition';
        wrapper.setAttribute('data-term-annotated', '');
        wrapper.setAttribute('data-term', entry.id);
        const label = doc.createElement('span');
        label.className = 'term-token';
        label.textContent = token;
        const expansion = doc.createElement('span');
        expansion.className = 'term-expansion';
        expansion.textContent = ' (' + entry.explanation + ')';
        wrapper.appendChild(label);
        wrapper.appendChild(expansion);
        fragment.appendChild(wrapper);
        cursor = end;
        count += 1;
      });
      if (cursor < text.length) fragment.appendChild(doc.createTextNode(text.slice(cursor)));
      node.parentNode.replaceChild(fragment, node);
    });
    return count;
  }

  return Object.freeze({ glossary, normalize, findTerms, explanationsFor, annotate });
});
