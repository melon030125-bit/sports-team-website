const menuToggle = document.querySelector('.menu-toggle');
const navigation = document.querySelector('#navigation');

function closeMenu() {
  navigation.classList.remove('open');
  menuToggle.setAttribute('aria-expanded', 'false');
  menuToggle.setAttribute('aria-label', '메뉴 열기');
}

menuToggle.addEventListener('click', () => {
  const expanded = menuToggle.getAttribute('aria-expanded') !== 'true';
  menuToggle.setAttribute('aria-expanded', String(expanded));
  menuToggle.setAttribute('aria-label', expanded ? '메뉴 닫기' : '메뉴 열기');
  navigation.classList.toggle('open', expanded);
});
navigation.querySelectorAll('a').forEach(link => link.addEventListener('click', closeMenu));
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && navigation.classList.contains('open')) {
    closeMenu();
    menuToggle.focus();
  }
});
window.matchMedia('(min-width: 701px)').addEventListener('change', event => {
  if (event.matches) closeMenu();
});

document.querySelectorAll('[data-filter]').forEach(button => {
  button.addEventListener('click', () => {
    document.querySelectorAll('[data-filter]').forEach(filter => {
      const active = filter === button;
      filter.classList.toggle('active', active);
      filter.setAttribute('aria-pressed', String(active));
    });
    document.querySelectorAll('.fixture').forEach(fixture => {
      fixture.hidden = button.dataset.filter !== 'all' && fixture.dataset.venue !== button.dataset.filter;
    });
  });
});

const stories = [
  { title: '홈에서 이어갈 승리의 흐름', body: '서울 블랙 FC가 부산 웨이브와의 홈 경기를 준비합니다. 선수단은 빠른 공수 전환과 조직적인 압박을 중심으로 호흡을 맞추고 있습니다.\n\n선수들에게 홈은 특별한 공간입니다. 관중석의 응원을 에너지로 삼아, 첫 휘슬부터 마지막 순간까지 집중력 있는 경기를 선보이겠습니다.\n\n11월 21일 토요일 오후 7시, 서울 블랙 스타디움에서 만나요.' },
  { title: '90분을 위한 매일의 노력', body: '좋은 경기는 매일의 작은 반복에서 시작됩니다. 이번 훈련은 짧은 패스와 공간 움직임, 그리고 마무리 슈팅에 초점을 맞췄습니다.\n\n선수들은 포지션별 훈련 후 미니 게임을 통해 실전 감각을 점검했습니다. 서로의 움직임을 이해하고 한발 더 뛰는 것이 훈련의 목표입니다.\n\n보이지 않는 곳에서 쌓아 올린 노력을 그라운드에서 보여드리겠습니다.' },
  { title: '우리의 목소리가 만드는 홈', body: '같은 색을 입고, 같은 이름을 외치는 순간. 서울 블랙의 홈은 팬들의 목소리로 완성됩니다.\n\n경기장을 처음 찾는 팬도, 매번 같은 자리에서 응원하는 팬도 모두 우리 팀의 일부입니다. 서로를 존중하며 함께 응원하는 문화를 만들어 갑니다.\n\n다가오는 홈 경기에도 여러분의 목소리를 더해주세요. 서울과 함께, 끝까지.' }
];
const dialog = document.querySelector('#news-dialog');
document.querySelectorAll('[data-news]').forEach(button => {
  button.addEventListener('click', () => {
    const story = stories[Number(button.dataset.news)];
    document.querySelector('#dialog-title').textContent = story.title;
    document.querySelector('#dialog-body').textContent = story.body;
    dialog.showModal();
  });
});
document.querySelector('#close-dialog').addEventListener('click', () => dialog.close());
dialog.addEventListener('click', event => {
  if (event.target !== dialog) return;
  const bounds = dialog.getBoundingClientRect();
  if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.close();
});
document.querySelector('#year').textContent = new Date().getFullYear();
