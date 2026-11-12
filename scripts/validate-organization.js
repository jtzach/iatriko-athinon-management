'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),read=n=>fs.readFileSync(path.join(root,n)),json=n=>JSON.parse(read(n));
const source=json('data/organization-timeline.json'),graph=json('data/organization-graph.json'),report=json('neo4j/verification.json');
const ids=new Set(graph.nodes.map(n=>n.id)),refs=new Set(graph.sources.map(s=>s.id));
assert.equal(ids.size,graph.nodes.length);assert.equal(refs.size,graph.sources.length);
assert.equal(new Set(graph.observations.map(e=>e.id)).size,graph.observations.length);
const allowed=new Set(['HOLDS_ROLE','MEMBER_OF','REPORTS_TO','RESPONSIBLE_FOR']);
for(const e of graph.observations){
  assert(ids.has(e.source)&&ids.has(e.target),'Both endpoints exist: '+e.id);
  assert(allowed.has(e.type));assert(e.sourceIds.length>0,'Every observation has evidence');
  for(const id of e.sourceIds)assert(refs.has(id),'Known source '+id);
  assert(Number.isInteger(e.year)&&e.year>=1984&&e.year<=2026);
  if(e.type==='REPORTS_TO')assert(e.evidenceStatus==='explicit'&&e.reportingMode,'Explicit qualified reporting relation');
}
assert.deepEqual(graph.years.map(y=>y.year),Array.from({length:43},(_,i)=>1984+i));
for(const y of graph.years){
  assert.deepEqual([...y.observationIds].sort(),graph.observations.filter(e=>e.year===y.year).map(e=>e.id).sort());
  assert.equal(y.coverage==='none',y.observationIds.length===0,'Unknown years stay empty');
}
assert.equal(graph.years.find(y=>y.year===1985).observationIds.length,0);
assert.equal(graph.years.find(y=>y.year===2021).observationIds.length,0);
assert(!graph.observations.some(e=>e.year===2026&&e.source==='theodoros-talaris'),'No unverified carry-forward');
const p=graph.provenance;
assert.equal(p.exportMode,'actual-neo4j-query-export');assert(p.roundTripVerified&&p.authenticationVerified&&!p.liveConnection&&report.passed);
assert.equal(p.datasetSHA256,crypto.createHash('sha256').update(read('data/organization-timeline.json')).digest('hex'));
assert.equal(report.outputSHA256,crypto.createHash('sha256').update(read('data/organization-graph.json')).digest('hex'));
for(const key of ['nodes','observations','sources'])assert.deepEqual([...graph[key]].sort((a,b)=>a.id.localeCompare(b.id)),[...source[key]].sort((a,b)=>a.id.localeCompare(b.id)),'Neo4j preserves '+key);
const extra=json('data/additional-findings.json');
for(const f of extra.findings){const sf=new Set(f.sources.map(s=>s.id));for(const m of f.metrics){for(const id of m.sourceIds)assert(sf.has(id));if(m.before&&m.after)assert.equal(m.change,m.after.value-m.before.value);}assert(f.hypothesis&&f.limit&&f.counterevidence);for(const s of f.sources)assert(s.pdfPage>0&&s.url.startsWith('https://'));}
const cash=extra.findings.find(f=>f.id==='cashflow');
assert(cash.metrics.find(m=>m.id==='ebitda').change>0&&cash.metrics.find(m=>m.id==='operating-cash-flow').after.value<0);
for(const name of ['index.html','organization.html'])for(const [,url] of read(name).toString().matchAll(/(?:src|href)="([^"]+)"/g))if(!/^(https?:|#|data:)/.test(url))assert(fs.existsSync(path.join(root,decodeURIComponent(url.split(/[?#]/)[0]))),url);
for(const name of ['data/organization-graph.json','data/additional-findings.json','assets/organization.js'])assert(!/ghp_[A-Za-z0-9]{20}|github_pat_|[A-Z]:\\Users\\/.test(read(name).toString()));
console.log(`Validated ${ids.size} nodes, ${graph.observations.length} sourced observations, 43 year partitions, Neo4j round-trip hashes and two additional findings.`);
