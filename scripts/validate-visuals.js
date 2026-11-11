'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),read=f=>fs.readFileSync(path.join(root,f),'utf8');
const data=JSON.parse(read('data/knowledge.json')),stories=JSON.parse(read('data/visual-stories.json'));
const context={window:{}};vm.runInNewContext(read('data/visual-stories.js'),context);
assert.deepEqual(JSON.parse(JSON.stringify(context.window.VISUAL_STORIES)),stories,'Ίδιο περιεχόμενο JSON/JS');
const nodes=new Map(data.nodes.map(n=>[n.id,n])),edges=new Map(data.edges.map(e=>[e.id,e])),evidence=new Map(data.evidence.map(e=>[e.id,e]));
assert.deepEqual(stories.stories.map(s=>s.id),['people','governance','digital']);
for(const s of stories.stories){
  assert.deepEqual(s.paragraphs.map(p=>p.kind),['fact','interpretation','limitation']);
  s.nodeIds.forEach(id=>assert(nodes.has(id),'Κόμβος '+id));
  s.edgeIds.forEach(id=>{const edge=edges.get(id);assert(edge,'Σχέση '+id);assert(s.nodeIds.includes(edge.source)&&s.nodeIds.includes(edge.target),'Άκρα σχέσης '+id);});
  for(const p of s.paragraphs){assert(p.text&&p.evidenceIds.length);p.evidenceIds.forEach(id=>assert(s.evidenceIds.includes(id),'Παραπομπή παραγράφου '+id));}
  s.evidenceIds.forEach(id=>{assert(evidence.has(id));assert(evidence.get(id).refs.length);});
  for(const ext of ['svg','png'])assert(fs.statSync(path.join(root,'assets/figures',s.id+'.'+ext)).size>1000,'Εξαγωγή '+s.id+'.'+ext);
}
assert.equal(edges.get('r066').kind,'context','Η συνύπαρξη δεικτών δεν γίνεται αιτιώδης σχέση');
assert.equal(edges.get('r071').kind,'context','Η σύνδεση SAP/παρακολούθησης παραμένει θεματική');
assert(!/fetch\s*\(|XMLHttpRequest|\/api\/ask/.test(read('assets/atlas.js')),'Οι ιστορίες λειτουργούν ως στατική παρουσίαση');
const html=read('index.html');assert(!html.includes('id="ask-form"'),'Δεν εμφανίζεται υποσχόμενη ζωντανή συνομιλία');
for(const [,asset] of html.matchAll(/(?:src|href)="([^"#:]+)"/g)){if(!asset.startsWith('http'))assert(fs.existsSync(path.join(root,asset)),'Τοπικό αρχείο '+asset);}
console.log('Επιτυχής έλεγχος: 3 οπτικές ιστορίες, 9 επιμελημένες παράγραφοι, πραγματικοί κόμβοι/σχέσεις/παραπομπές, 6 εξαγώγιμα σχήματα, στατική λειτουργία χωρίς API.');
