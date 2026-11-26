/* On-demand, same-origin previews of the unchanged downloadable PowerPoint. */
(() => {
  'use strict';
  const sourcePath = 'writing/Παρουσίαση-Τζαχρήστας_Χρήστου_Σταματόπουλος.pptx';
  const esc = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let dialog, deck, pending, current=0, revision=0, trigger;
  const $ = selector => dialog.querySelector(selector);
  const plain = value => Array.isArray(value) ? value.join('\n') : String(value || '');
  function build() {
    dialog=document.createElement('dialog');
    dialog.id='presentation-dialog';
    dialog.setAttribute('aria-labelledby','presentation-title');
    dialog.innerHTML=`<header class="deck-header"><div><p class="eyebrow">Η ΠΑΡΟΥΣΙΑΣΗ ΤΗΣ ΕΡΓΑΣΙΑΣ</p><h2 id="presentation-title">Οι 15 διαφάνειες</h2></div><div class="deck-header-actions"><button class="secondary" id="deck-home">Αρχική</button><button id="deck-close" aria-label="Κλείσιμο παρουσίασης">×</button></div></header><div class="deck-controls"><button class="secondary" id="deck-prev" disabled>Προηγούμενη</button><label class="sr-only" for="deck-select">Διαφάνεια</label><select id="deck-select" disabled aria-label="Διαφάνεια"></select><button class="secondary" id="deck-next" disabled>Επόμενη</button><button class="secondary" id="deck-zoom" aria-pressed="false" disabled>Μεγέθυνση</button></div><div id="deck-stage" class="deck-stage" tabindex="0" aria-label="Προβολή διαφάνειας"><p role="status">Ανοίγουμε την παρουσίαση…</p></div><p id="deck-caption" class="deck-caption" aria-live="polite"></p><details id="deck-text" hidden><summary>Κείμενο διαφάνειας & σημειώσεις ομιλητή</summary><div id="deck-transcript"></div></details><footer class="deck-footer"><a class="secondary" download href="${sourcePath}?v=2.6">Λήψη PowerPoint</a><a class="secondary" download href="writing/Παρουσίαση-Τζαχρήστας_Χρήστου_Σταματόπουλος.pdf?v=2.6">Λήψη PDF</a><span>Οι ίδιες διαφάνειες με το αρχείο λήψης.</span></footer>`;
    document.body.append(dialog);
    $('#deck-close').addEventListener('click',close);
    $('#deck-home').addEventListener('click',()=>{close(false); document.querySelector('#detail-dialog[open]')?.close(); location.hash='home'; document.querySelector('.home-button')?.focus();});
    $('#deck-prev').addEventListener('click',()=>show(current-1));
    $('#deck-next').addEventListener('click',()=>show(current+1));
    $('#deck-select').addEventListener('change',event=>show(Number(event.target.value)));
    $('#deck-zoom').addEventListener('click',()=>{
      const zoomed=$('#deck-stage').classList.toggle('is-zoomed');
      $('#deck-zoom').setAttribute('aria-pressed',String(zoomed));
      $('#deck-zoom').textContent=zoomed ? 'Προσαρμογή' : 'Μεγέθυνση';
    });
    dialog.addEventListener('cancel',event=>{event.preventDefault();close();});
    dialog.addEventListener('close',()=>{if (!dialog.open) revision++;});
    dialog.addEventListener('keydown',event=>{
      if (!deck || event.altKey || event.ctrlKey || event.metaKey || ['SELECT','INPUT','TEXTAREA'].includes(event.target.tagName) || $('#deck-stage').classList.contains('is-zoomed')) return;
      const keys={ArrowLeft:current-1,ArrowRight:current+1,Home:0,End:deck.slides.length-1};
      if (Object.hasOwn(keys,event.key)) {event.preventDefault();show(keys[event.key]);}
    });
    window.addEventListener('hashchange',()=>{if(dialog.open) close(false);});
  }
  function close(restore=true) {
    revision++;
    dialog?.close();
    if (restore && trigger?.isConnected) trigger.focus({preventScroll:true});
  }
  async function load() {
    if (deck) return deck;
    if (!pending) pending=fetch('data/presentation-slides.json?v=2.6').then(response=>{
      if (!response.ok) throw new Error('manifest');
      return response.json();
    }).then(value=>{
      if (value.source.path!==sourcePath || value.slides.length!==15 || value.slides.some(s=>!/^assets\/slides\/slide-\d{2}\.(webp|png)$/.test(s.image))) throw new Error('Invalid presentation');
      deck=value; return value;
    }).catch(error=>{pending=null;throw error;});
    return pending;
  }
  async function open(button) {
    if (!dialog) build();
    trigger=button;
    const expected=++revision;
    if (!dialog.open) dialog.showModal();
    $('#deck-close').focus();
    try {
      await load();
      if (!dialog.open || revision!==expected) return;
      $('#deck-select').innerHTML=deck.slides.map((s,i)=>`<option value="${i}">${i+1}. ${esc(s.title)}</option>`).join('');
      $('#deck-select').disabled=false; $('#deck-zoom').disabled=false;
      show(current);
    } catch {
      if (!dialog.open || revision!==expected) return;
      $('#deck-stage').innerHTML='<p role="status">Δεν άνοιξε η προβολή. Μπορείς να κατεβάσεις το PowerPoint ή να δοκιμάσεις ξανά.</p><button class="secondary" id="deck-retry">Δοκίμασε ξανά</button>';
      $('#deck-retry').addEventListener('click',()=>open(trigger));
    }
  }
  function show(index) {
    if (!deck || index<0 || index>=deck.slides.length) return;
    const focused=document.activeElement;
    current=index;
    const slide=deck.slides[index], stage=$('#deck-stage');
    $('#deck-select').value=String(index);
    $('#deck-prev').disabled=index===0; $('#deck-next').disabled=index===deck.slides.length-1;
    stage.classList.remove('is-zoomed'); stage.scrollTop=0; stage.scrollLeft=0;
    $('#deck-zoom').setAttribute('aria-pressed','false'); $('#deck-zoom').textContent='Μεγέθυνση';
    const img=document.createElement('img'), status=document.createElement('p');
    img.src=slide.image + '?v=2.6'; img.alt=`Διαφάνεια ${index+1}: ${slide.title}`;
    img.width=slide.width; img.height=slide.height; img.decoding='async';
    status.setAttribute('role','status');status.textContent='Φόρτωση διαφάνειας…';
    img.addEventListener('load',()=>{if(img.isConnected) status.hidden=true;});
    img.addEventListener('error',()=>{if(img.isConnected) {status.hidden=false;status.textContent='Δεν φορτώθηκε η εικόνα. Το κείμενο και το PowerPoint παραμένουν διαθέσιμα.';}});
    stage.replaceChildren(img,status);
    $('#deck-caption').textContent=`${index+1} / ${deck.slides.length} · ${slide.title}`;
    const notes=plain(slide.notes);
    $('#deck-transcript').innerHTML=`<h3>Κείμενο διαφάνειας</h3><p>${esc(plain(slide.text))}</p>${notes ? `<h3>Σημειώσεις ομιλητή</h3><p>${esc(notes)}</p>` : ''}`;
    $('#deck-text').hidden=false;
    window.ConsoleTerms?.annotate($('#deck-transcript'));
    window.ConsoleTerms?.annotate($('#deck-caption'));
    if (index === 8) {
      const graph = document.createElement('a');
      graph.href = 'subsidiaries.html';
      graph.textContent = 'Γράφος των οκτώ θυγατρικών';
      $('#deck-caption').append(' · ', graph);
    }
    if (focused?.disabled && dialog.contains(focused)) $('#deck-select').focus({preventScroll:true});
  }
  document.addEventListener('click',event=>{const button=event.target.closest('[data-open-presentation]');if(button) open(button);});
})();
