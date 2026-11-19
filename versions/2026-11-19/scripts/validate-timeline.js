'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),sandbox={window:{}};
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
vm.runInNewContext(read('data/sap-timeline.js'),sandbox);
vm.runInNewContext(read('assets/sap-timeline.js'),sandbox);
const d=sandbox.window.SAP_TIMELINE,m=sandbox.window.SAP_GRAPH_MODEL;
assert.deepEqual(JSON.parse(JSON.stringify(d)),JSON.parse(read('data/sap-timeline.json')));
const ids=new Set(d.evidence.map(e=>e.id)),src=new Set(d.sources.map(s=>s.id));
for(const e of d.evidence)for(const r of e.sources){assert(src.has(r.source));if(r.pdf_page)assert(Number.isInteger(r.pdf_page)&&r.pdf_page>0);}
for(const track of m.tracks)for(let p=0;p<4;p++)for(const hypotheses of [false,true]){
 const scene=m.getScene(p,track.id,hypotheses),nodes=new Set(scene.nodes.map(n=>n.id));
 assert.equal(nodes.size,scene.nodes.length);
 for(const n of scene.nodes){n.refs.forEach(id=>assert(ids.has(id)));assert(n.x>0&&n.x<100&&n.y>0&&n.y<100);}
 for(const e of scene.edges){assert(nodes.has(e.from)&&nodes.has(e.to));e.refs.forEach(id=>assert(ids.has(id)));}
 assert.equal(scene.nodes.filter(n=>n.status==='hypothesis').length,hypotheses?1:0);
 if(track.id==='roles'){assert.equal(nodes.has('faliro'),p>=1);assert.equal(nodes.has('peristeri'),p>=2);assert.equal(nodes.has('sustainability'),p>=2);}
 if(track.id==='oversight')assert.equal(nodes.has('it'),p>=2);
 if(track.id==='experience'){assert.equal(nodes.has('delays'),p>=2);assert(!scene.edges.some(e=>e.from==='sap'&&e.to==='nps'),'No invented SAP-to-NPS causality');}
}
assert.equal(m.getScene(0,'leadership').nodes.find(n=>n.id==='vasilis-role').title,'Διευθύνων σύμβουλος');
assert.equal(m.getScene(3,'leadership').nodes.find(n=>n.id==='vasilis-role').title,'Πρόεδρος ΔΣ');
assert.equal(d.nps.clinics.reduce((a,x)=>a+x.responses_2025,0),80156);
for(const x of d.nps.clinics)assert.equal(x.nps_2025-x.nps_2024,x.change_points);
assert(!/[A-Z]:[\\/]|existing_overleaf_file|sha256/.test(read('data/sap-timeline.json')),'Public data must not expose local research paths');
console.log('SAP: 32 graph states, dates, references, hypotheses isolation and NPS arithmetic passed.');
if(fs.existsSync(path.join(root,'data/history-timeline.json'))){
 const h=JSON.parse(read('data/history-timeline.json')),hs=new Set(h.sources.map(s=>s.id));
 assert(h.steps.length>=8);assert.equal(h.steps[0].year,1984);assert.equal(h.steps.at(-1).year,2026);
 h.steps.forEach((s,i)=>{if(i)assert(s.year>h.steps[i-1].year);s.sourceIds.forEach(x=>assert(hs.has(x)));const places=new Set();s.locations.forEach(l=>{assert(!places.has(l.id));places.add(l.id);l.sourceIds.forEach(x=>assert(hs.has(x)));});s.management.forEach(c=>c.sourceIds.forEach(x=>assert(hs.has(x))));if(s.year<2022)assert.equal(s.management.length,0,'No invented early organization charts');});
 vm.runInNewContext(read('data/history-timeline.js'),sandbox);assert.deepEqual(JSON.parse(JSON.stringify(sandbox.window.HISTORY_TIMELINE)),h);
 console.log('History: chronology, source links, unique places and unknown early management passed.');
}
for(const page of ['index.html','sap.html','history.html']){
 if(!fs.existsSync(path.join(root,page)))continue;
 const html=read(page),domIds=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);assert.equal(new Set(domIds).size,domIds.length,'Unique DOM IDs: '+page);
 for(const [,asset]of html.matchAll(/(?:src|href)="([^"#:]+)"/g))if(!/^https?:/.test(asset))assert(fs.existsSync(path.join(root,asset)),'Missing asset: '+asset);
}
