(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.EvidenceGraph = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const stop = new Set(['για','και','την','του','των','στο','στη','στην','στον','που','απο','από','ειναι','είναι','ποια','ποιες','ποιοι','ποιο','πως','τι','με','τα','το','τη','της','να','οι','σε','γνωριζουμε','γνωρίζουμε'].map(normalize));
  function normalize(value) { return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('el').replace(/ς/g, 'σ'); }
  function tokenize(value) { return [...new Set(normalize(value).split(/[^\p{L}\p{N}]+/u).filter(t => t.length > 1 && !stop.has(t)))]; }
  function termsMatch(text, terms) { const haystack = normalize(text); return terms.reduce((n, term) => n + (haystack.includes(term) ? 1 : 0), 0); }
  function evidenceText(e) { return [e.id, e.title, e.finding, e.limitation, e.period].join(' '); }
  function filterGraph(data, state) {
    const evidenceMap = new Map(data.evidence.map(e => [e.id, e]));
    const terms = tokenize(state.search);
    const nodes = data.nodes.filter(n => {
      if (state.topic && state.topic !== 'all' && !n.topics.includes(state.topic)) return false;
      if (state.scope && state.scope !== 'all' && !n.scopes.includes(state.scope)) return false;
      if (state.period && state.period !== 'all' && !n.periods.map(String).includes(state.period)) return false;
      if (!terms.length) return true;
      const text = [n.label, n.summary, ...n.evidenceIds.map(id => evidenceText(evidenceMap.get(id) || {}))].join(' ');
      return termsMatch(text, terms) > 0;
    });
    const ids = new Set(nodes.map(n => n.id));
    const edges = data.edges.filter(e => ids.has(e.source) && ids.has(e.target) && (state.context !== false || e.kind === 'reported'));
    return {nodes, edges};
  }
  function retrieve(data, query, limit = 6) {
    const terms = tokenize(query);
    if (!terms.length) return [];
    const evidenceMap = new Map(data.evidence.map(e => [e.id, e]));
    const scores = new Map();
    const reasons = new Map();
    function add(id, amount, reason) {
      if (!evidenceMap.has(id)) return;
      scores.set(id, (scores.get(id) || 0) + amount);
      if (!reasons.has(id)) reasons.set(id, new Set());
      reasons.get(id).add(reason);
    }
    data.evidence.forEach(e => {
      const direct = termsMatch(e.finding, terms) * 3 + termsMatch(e.title, terms) * 4;
      if (direct) add(e.id, direct, 'Λεκτική αντιστοίχιση στο τεκμήριο');
    });
    const seeds = data.nodes.map(n => ({node:n, score:termsMatch(n.label,terms)*4+termsMatch(n.summary,terms)})).filter(x => x.score > 0).sort((a,b)=>b.score-a.score).slice(0,5);
    seeds.forEach(({node, score}) => {
      node.evidenceIds.forEach(id => add(id, Math.min(score,8), 'Κόμβος: ' + node.label));
      data.edges.filter(e => e.source === node.id || e.target === node.id).forEach(edge => {
        edge.evidenceIds.forEach(id => add(id, 1, 'Σύνδεση: ' + edge.label));
      });
    });
    return [...scores].sort((a,b)=>b[1]-a[1] || a[0].localeCompare(b[0],'el')).slice(0,limit).map(([id,score])=>({evidence:evidenceMap.get(id),score,reasons:[...reasons.get(id)]}));
  }
  function validate(data) {
    const issues=[];
    for (const field of ['sources','evidence','nodes','edges']) if (!Array.isArray(data[field])) issues.push('Λείπει πίνακας: '+field);
    if (issues.length) return issues;
    const ids={};
    for (const field of ['sources','evidence','nodes','edges']) {
      ids[field]=new Set();
      data[field].forEach(item=>{ if (!item.id || ids[field].has(item.id)) issues.push('Άκυρο/διπλό id '+field+': '+item.id); ids[field].add(item.id); });
    }
    data.sources.forEach(s=>{try { if(new URL(s.url).protocol !== 'https:') issues.push('Πηγή χωρίς HTTPS: '+s.id); } catch { issues.push('Άκυρο URL: '+s.id); }});
    data.evidence.forEach(e=>{
      if(!e.finding || !e.refs.length) issues.push('Ελλιπές τεκμήριο '+e.id);
      e.refs.forEach(r=>{
        if(!ids.sources.has(r.sourceId)) issues.push('Άγνωστη πηγή '+e.id+': '+r.sourceId);
        if(!Array.isArray(r.pdfPages) || r.pdfPages.some(p=>!Number.isInteger(p)||p<1)) issues.push('Άκυρη σελίδα '+e.id);
      });
    });
    [...data.nodes,...data.edges].forEach(n=>{
      if(!n.evidenceIds.length) issues.push('Χωρίς τεκμήρια '+n.id);
      n.evidenceIds.forEach(id=>{if(!ids.evidence.has(id)) issues.push('Άγνωστο τεκμήριο '+n.id+': '+id);});
    });
    data.edges.forEach(e=>{if(!ids.nodes.has(e.source)||!ids.nodes.has(e.target)) issues.push('Άγνωστο άκρο '+e.id);});
    return issues;
  }
  return {normalize,tokenize,filterGraph,retrieve,validate};
});
