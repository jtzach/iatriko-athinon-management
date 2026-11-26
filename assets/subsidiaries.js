(() => {
  const links = [...document.querySelectorAll('.node')];
  const cards = [...document.querySelectorAll('.entity')];
  function select(moveFocus) {
    const card = cards.find(item => '#' + item.id === location.hash) || cards[0];
    for (const item of cards) item.hidden = item !== card;
    for (const link of links) {
      if (link.hash === '#' + card.id) link.setAttribute('aria-current', 'true');
      else link.removeAttribute('aria-current');
    }
    if (moveFocus) card.focus({preventScroll: !matchMedia('(max-width:800px)').matches});
  }
  select(false);
  window.addEventListener('hashchange', () => select(true));
  for (const link of links) link.addEventListener('click', () => {
    if (location.hash === link.hash) select(true);
  });
})();
