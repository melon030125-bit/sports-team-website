const menuToggle = document.querySelector('.menu-toggle');
const navigation = document.querySelector('#navigation');
document.querySelectorAll('.crest-image').forEach(image => {
  const useFallback = () => {
    image.hidden = true;
    image.parentElement.classList.add('image-unavailable');
  };
  image.addEventListener('error', useFallback);
  if (image.complete && !image.naturalWidth) useFallback();
});
function closeMenu(restoreFocus = false) {
  if (!menuToggle || !navigation) return;
  navigation.classList.remove('open');
  menuToggle.setAttribute('aria-expanded', 'false');
  menuToggle.setAttribute('aria-label', '메뉴 열기');
  if (restoreFocus) menuToggle.focus();
}
menuToggle?.addEventListener('click', () => {
  const expanded = menuToggle.getAttribute('aria-expanded') !== 'true';
  menuToggle.setAttribute('aria-expanded', String(expanded));
  menuToggle.setAttribute('aria-label', expanded ? '메뉴 닫기' : '메뉴 열기');
  navigation.classList.toggle('open', expanded);
});
navigation?.querySelectorAll('a').forEach(link => link.addEventListener('click', () => closeMenu()));
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && menuToggle?.getAttribute('aria-expanded') === 'true') closeMenu(true);
});
document.addEventListener('click', event => {
  if (!event.target.closest('.site-header')) closeMenu();
});
window.matchMedia('(min-width: 1050px)').addEventListener('change', event => {
  if (event.matches) closeMenu();
});
document.querySelectorAll('[data-year]').forEach(element => { element.textContent = new Date().getFullYear(); });
