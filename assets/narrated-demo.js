(() => {
  'use strict';
  const dialog = document.querySelector('#narrated-demo');
  const template = document.querySelector('#narrated-demo-content');
  let video, chapter, status, opener;
  let starts = [];
  let pendingSeek = null;

  function mount() {
    dialog.append(template.content.cloneNode(true));
    video = dialog.querySelector('video');
    chapter = dialog.querySelector('select');
    status = dialog.querySelector('[role="status"]');
    starts = Array.from(chapter.options, option => Number(option.value));
    const seekToChapter = () => {
      if (pendingSeek === null || video.readyState === 0) return;
      video.currentTime = pendingSeek;
      pendingSeek = null;
    };
    chapter.addEventListener('change', () => {
      pendingSeek = Number(chapter.value);
      if (video.readyState === 0) video.load();
      else seekToChapter();
    });
    video.addEventListener('loadedmetadata', seekToChapter);
    video.addEventListener('timeupdate', () => {
      if (pendingSeek !== null) return;
      let index = starts.length - 1;
      while (index > 0 && video.currentTime < starts[index]) index--;
      chapter.selectedIndex = index;
    });
    video.addEventListener('playing', () => { status.textContent = ''; });
    video.addEventListener('error', () => {
      status.textContent = 'Το βίντεο δεν φορτώθηκε. Δοκίμασε τη λήψη του αρχείου ή άνοιξε το κείμενο της αφήγησης.';
    });
    dialog.querySelector('[data-close-demo]').addEventListener('click', () => dialog.close());
    dialog.addEventListener('close', () => {
      if (dialog.open) return;
      video.pause();
      if (opener?.isConnected) opener.focus({preventScroll:true});
    });
    window.addEventListener('pagehide', () => video.pause());
    window.addEventListener('hashchange', () => { if (dialog.open) dialog.close(); });
  }

  function open(button, play) {
    if (!video) mount();
    opener = button;
    if (!dialog.open) dialog.showModal();
    if (play) {
      if (video.ended) video.currentTime = 0;
      video.play().catch(err => {
        if (err.name === 'NotAllowedError' && dialog.open)
          status.textContent = 'Πάτησε αναπαραγωγή στο βίντεο για να ακούσεις την αφήγηση.';
      });
    }
  }

  document.addEventListener('click', event => {
    const button = event.target.closest('[data-open-demo]');
    if (button) open(button, true);
  });
  if (new URLSearchParams(location.search).get('demo') === '1')
    open(document.querySelector('[data-open-demo]'), false);
})();
