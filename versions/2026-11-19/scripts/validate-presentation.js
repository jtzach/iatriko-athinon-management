'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const read=n=>fs.readFileSync(path.join(root,n),'utf8');
const d=JSON.parse(read('data/presentation-evidence.json'));
const sourceIds=new Set(d.sources.map(s=>s.id));
assert.equal(sourceIds.size,d.sources.length,'Μοναδικές πηγές');
const find=id=>d.findings.find(f=>f.id===id);
assert.deepEqual(d.findings.map(f=>f.id),['gaia','nps','margins']);
function walk(value){
  if(!value||typeof value!=='object')return;
  if(value.sourceIds)for(const id of value.sourceIds)assert(sourceIds.has(id),'Πηγή '+id);
  for(const [key,v] of Object.entries(value)){
    if(key==='type'&&['fact','company_claim','hypothesis'].includes(v))assert(v);
    if(typeof v==='object')walk(v);
  }
}
walk(d);
for(const s of d.sources){assert.equal(new URL(s.url).protocol,'https:');if(s.pdfPage!==null)assert(Number.isInteger(s.pdfPage)&&s.pdfPage>0);}
const g=find('gaia').metrics;
assert.equal(g.activityProfitAfterTax.value,930);
assert.equal(g.activityProfitAfterTax.scope,'ΓΑΙΑ, χωρίς το κέρδος πώλησης');
assert.equal(g.announcedCapacity.type,'company_claim');
assert.equal(g.announcedCapacity.beds,100);
assert.equal(g.announcedCapacity.operatingRooms,4);
const n=find('nps').metrics;
assert.equal(n.clinics.length,6);
assert.equal(n.clinics.reduce((a,c)=>a+c.responses2025,0),n.total.responses2025);
for(const c of n.clinics){assert.equal(c.nps2025-c.nps2024,c.changePoints);assert(c.responses2024===null);}
assert.equal(n.clinics.filter(c=>c.changePoints>0).length,4);
assert.equal(n.clinics.find(c=>c.id==='pediatric').locationId,'marousi');
const m=find('margins').metrics;
for(const r of m.annual)assert(Math.abs(r.ebitda/r.revenue*100-r.ebitdaMarginPercent)<.0001);
assert(m.annual[1].revenue>m.annual[0].revenue&&m.annual[1].ebitda<m.annual[0].ebitda);
assert(m.halfYear[1].ebitda>m.halfYear[0].ebitda,'Αντενδείξεις διατηρούνται');
assert(m.halfYear[1].operatingCashFlow<m.halfYear[0].operatingCashFlow);
for(const file of ['index.html','research.html','history.html','sap.html','graph.html']){
  for(const [,link] of read(file).matchAll(/(?:src|href)="([^"]+)"/g)){
    if(/^(https?:|data:|#)/.test(link))continue;
    assert(fs.existsSync(path.join(root,decodeURIComponent(link.split('#')[0].split('?')[0]))),'Αρχείο '+file+': '+link);
  }
}
for(const s of [read('index.html'),read('data/presentation-evidence.json')]){
  assert(!/[A-Z]:\\|ghp_[A-Za-z0-9]|github_pat_/.test(s),'Δεν δημοσιεύονται τοπικές διαδρομές/διαπιστευτήρια');
}
console.log('Επιβεβαιώθηκαν πηγές, περίμετροι, 6 σειρές NPS, ετήσια/εξαμηνιαία μεγέθη, διάκριση ΓΑΙΑ και τοπικοί σύνδεσμοι.');
