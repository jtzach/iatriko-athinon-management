'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');
const read=file=>JSON.parse(fs.readFileSync(path.join(root,file),'utf8'));
const data=read('data/knowledge.json'), content=read('data/executive-content.json'), paper=read('writing/paper-content.json');
const nodes=new Set(data.nodes.map(n=>n.id)), evidence=new Set(data.evidence.map(e=>e.id)), refs=new Set(paper.bibliography.map(r=>r.id));
for(const [file,key,json] of [['data/executive-content.js','EXECUTIVE_CONTENT',content],['writing/paper-content.js','PAPER_CONTENT',paper]]){
  const sandbox={window:{}};vm.runInNewContext(fs.readFileSync(path.join(root,file),'utf8'),sandbox);
  assert.deepEqual(JSON.parse(JSON.stringify(sandbox.window[key])),json,'Αντιστοιχία offline δεδομένων '+file);
}
assert.deepEqual(content.chapters.map(c=>c.id),['environment','structure','culture','leadership']);
const routeIds=new Set();
for(const c of content.chapters){
  assert.equal(c.routes.length,3);
  assert(fs.existsSync(path.join(root,'assets/illustrations',c.icon+'.svg')));
  for(const r of c.routes){
    assert(!routeIds.has(r.id));routeIds.add(r.id);
    assert(nodes.has(r.leadNodeId));
    for(const id of [...r.evidenceIds,...r.facts.map(f=>f.evidenceId)]) assert(evidence.has(id),'Τεκμήριο '+id);
    for(const id of r.relatedNodeIds){
      assert(nodes.has(id),'Κόμβος '+id);
      let frontier=[r.leadNodeId],found=false;
      for(let step=0;step<2;step++){
        frontier=[...new Set(data.edges.flatMap(e=>frontier.includes(e.source)?[e.target]:frontier.includes(e.target)?[e.source]:[]))];
        if(frontier.includes(id)){found=true;break;}
      }
      assert(found,'Διαδρομή έως δύο σχέσεων: '+r.id+' / '+id);
    }
  }
}
assert.equal(paper.sections.length,8);
const used=new Set();
for(const section of paper.sections){
  assert(section.paragraphs.length>0);
  section.evidenceIds.forEach(id=>assert(evidence.has(id),'Τεκμήριο κειμένου '+id));
  section.references.forEach(id=>{assert(refs.has(id),'Βιβλιογραφία '+id);used.add(id);});
}
assert.equal(used.size,10);
assert.equal(paper.bibliography.filter(r=>r.peerReviewed&&used.has(r.id)).length,6);
assert.equal(paper.wordCount.mainWordsNative,3500);
assert.equal(paper.wordCount.status,'verified-native-word');
// Match the Python canonical payload used for the actual Word count verification.
const payload=paper.sections.map(s=>({paragraphs:s.paragraphs,title:s.title}));
const digest=crypto.createHash('sha256').update(JSON.stringify(payload),'utf8').digest('hex');
assert.equal(digest,paper.wordCount.nativeValidatedContentSha256,'Το κύριο κείμενο παραμένει αυτό που μετρήθηκε στο Word');
assert.equal(paper.sections.reduce((sum,s)=>sum+s.wordCountNativeIncludingHeading,0),3500);
assert(paper.declaration.text.includes('Πρώτη πλήρης συγγραφή με ΤΝ'));
for(const file of ['index.html','graph.html']){
  const html=fs.readFileSync(path.join(root,file),'utf8');
  for(const [,asset] of html.matchAll(/(?:src|href)="([^"#:]+)"/g)){
    if(!asset.startsWith('http'))assert(fs.existsSync(path.join(root,asset)),'Τοπικός σύνδεσμος '+asset);
  }
}
for(const file of ['Μελέτη-Ιατρικό-Αθηνών.docx','Δήλωση-χρήσης-ΤΝ.docx']){
  const bytes=fs.readFileSync(path.join(root,'writing',file));
  assert(bytes.length>20000&&bytes.subarray(0,2).toString()==='PK','Έγκυρο πακέτο Word '+file);
}
console.log('Επιτυχής έλεγχος παρουσίασης: 4 θέματα, 12 διαδρομές, 8 ενότητες, 10 χρησιμοποιημένες πηγές / 6 άρθρα με κριτές, 3.500 λέξεις Word. Ταυτότητα κειμένου, τεκμήρια, διαδρομές και τοπικά αρχεία επιβεβαιώθηκαν.');
