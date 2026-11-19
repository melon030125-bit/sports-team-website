import { escapeHtml as e, safeUrl, dateParts, formatKickoff, matchDate, getNextMatch, matchOutcome, resultClass, normalize } from './utils.js';
import { renderMatch, mountMatch } from './match.js';
import { renderSeasonReport, summarizeLeague } from './season-report.js';

const main = document.querySelector('#main');
const page = document.body.dataset.page;
const groupNames = { GK: '골키퍼', DF: '수비수', MF: '미드필더', FW: '공격수' };
let data;
const link = (url, label) => `<a href="${e(safeUrl(url))}" target="_blank" rel="noopener noreferrer">${e(label)} ↗</a>`;
const source = item => `<p class="source-note">${link(item.source, '공식 출처')} <span>확인 ${e(item.checkedAt || data.season.checkedAt)} · KST</span></p>`;
const intro = (en, title, description) => `<header class="page-intro${data?.media?.pages?.[page] ? ' photo-hero' : ''}">${pagePhoto(page)}<div class="hero-copy"><p class="eyebrow">2026/27 · ${en}</p><h1 class="page-title">${title}</h1><p class="lede">${description}</p></div></header>`;
const heading = (en, title, href, label = '전체 보기') => `<div class="section-head"><div><p class="eyebrow">${en}</p><h2>${title}</h2></div>${href ? `<a class="text-link" href="${href}">${label} ↗</a>` : ''}</div>`;
const empty = text => `<div class="empty-state"><h2>아직 표시할 정보가 없어요.</h2><p>${text}</p></div>`;
const playerUrl = player => `player.html?id=${encodeURIComponent(player.id)}`;
const articleUrl = article => `article.html?id=${encodeURIComponent(article.id)}`;
const matchUrl = match => `match.html?id=${encodeURIComponent(match.id)}`;

// A failed or absent image leaves the branded fallback visible, including after filtering.
const imageUrl = url => /^data\/images\/[a-z0-9-]+\.(webp|png)$/.test(url) ? url : safeUrl(url);
function photo(url, alt, eager = false) {
  return url ? `<img class="editorial-image" src="${e(imageUrl(url))}" alt="${e(alt || '')}" loading="${eager ? 'eager' : 'lazy'}" ${eager ? 'fetchpriority="high"' : ''} decoding="async">` : '';
}
const storyPhoto = article => article.image || data.media?.hero.image;
function pageMedia(key) {
  const media = data?.media?.pages?.[key];
  return media?.articleId ? data.articles.find(article => article.id === media.articleId) : media;
}
function pagePhoto(key) {
  const media = pageMedia(key);
  return media ? photo(media.image, media.alt || media.imageAlt, true) : '';
}
const venueBadge = match => `<span class="badge venue-badge venue-${match.venue === 'home' ? 'home' : 'away'}">${match.venue === 'home' ? '홈 <span lang="en">HOME</span>' : '원정 <span lang="en">AWAY</span>'}</span>`;
function scoreline(match) {
  const home = match.venue === 'home';
  const label = `${home ? '첼시' : match.opponent} ${match.homeScore}, ${home ? match.opponent : '첼시'} ${match.awayScore}`;
  return `<span class="scoreline" role="img" aria-label="${e(label)}"><span class="${home ? 'chelsea-score' : 'opponent-score'}" aria-hidden="true">${match.homeScore}</span><span class="score-divider" aria-hidden="true">–</span><span class="${home ? 'opponent-score' : 'chelsea-score'}" aria-hidden="true">${match.awayScore}</span></span>`;
}
const outcomeBadge = match => `<span class="match-outcome ${resultClass(match)}">${e(matchOutcome(match))}</span>`;
main.addEventListener('error', event => {
  if (event.target.matches('img.editorial-image')) {
    event.target.hidden = true;
    event.target.parentElement.classList.add('image-unavailable');
  }
}, true);

function playerCard(player) {
  return `<a class="player-card" href="${playerUrl(player)}"><div class="player-visual">${photo(player.image, player.imageAlt)}<span class="portrait-fallback" aria-hidden="true">CFC</span><span class="player-number" aria-hidden="true">${e(String(player.number).padStart(2, '0'))}</span></div><div class="player-info"><span class="eyebrow">${e(groupNames[player.group])}</span><h3 lang="en">${e(player.en)}</h3><p>${e(player.ko)}</p><small>${e(player.position)}</small></div></a>`;
}

function newsCard(article, index = 0) {
  return `<article class="news-card"><a href="${articleUrl(article)}"><div class="news-art news-art-${index % 3}"><span class="news-fallback" aria-hidden="true">THE BLUES</span>${photo(storyPhoto(article), article.imageAlt || data.media?.hero.alt)}</div><div class="news-card-body"><p class="news-meta"><span>${e(article.category)}</span><time datetime="${e(article.date)}">${e(article.date)}</time></p><h3>${e(article.title)}</h3><p>${e(article.summary)}</p></div></a></article>`;
}

function matchRow(match) {
  const parts = dateParts(match.kickoff);
  const localDateOnly = !parts && match.dateBasis === 'Europe/London';
  const home = match.venue === 'home';
  const finished = match.status === 'finished';
  const status = { scheduled: '경기 예정', finished: matchOutcome(match), unknown: '결과 확인 중', postponed: '연기' }[match.status] || '확인 중';
  return `<article class="fixture-row venue-${home ? 'home' : 'away'}" id="${e(match.id)}" data-match-id="${e(match.id)}"><div class="fixture-day"><small class="matchday-label">MATCHDAY</small><strong>${e(parts?.day || match.date?.slice(-2) || '—')}</strong><span>${e(matchDate(match).slice(0, 7))}${parts ? ` · ${e(parts.weekday)}` : localDateOnly ? ' · 영국 현지' : ''}</span></div><div class="fixture-teams"><p class="fixture-meta">${venueBadge(match)} <span class="competition-name">${e(match.competition)}</span>${match.tentative ? ' · 잠정 편성' : ''}</p><h3><a class="fixture-detail-link" href="${matchUrl(match)}">${home ? '첼시' : e(match.opponent)} <span>vs</span> ${home ? e(match.opponent) : '첼시'}</a></h3><a class="match-detail-link" href="${matchUrl(match)}">경기 상세 · 선발 · 기록 ↗</a><p>${home ? 'Stamford Bridge' : `${e(match.opponent)} 원정`}</p></div><div class="fixture-time">${finished ? `<div class="fixture-result">${scoreline(match)}</div>${outcomeBadge(match)}` : `<strong>${parts ? `${parts.hour}:${parts.minute}` : '시간 미정'}</strong><span>${localDateOnly ? '한국 날짜·시간 미정' : `KST · ${e(status)}`}</span>`}${match.penalties ? `<small class="penalty-note">${e(match.penalties)} · 본 경기 점수와 별도</small>` : ''}${parts ? `<small>${finished ? `KST ${parts.hour}:${parts.minute} · ` : ''}영국 ${e(formatKickoff(match.kickoff, 'Europe/London'))}</small>` : ''}${source(match)}</div></article>`;
}

function nextCard(match) {
  if (!match) return `<section class="next-match">${empty('확인된 다음 경기가 없습니다. 공식 일정에서 확인해 주세요.')}</section>`;
  const parts = dateParts(match.kickoff);
  return `<section class="next-match venue-${match.venue}" aria-labelledby="next-heading"><div class="match-label"><span class="eyebrow" id="next-heading"><span class="editorial-index" aria-hidden="true">01</span> NEXT MATCH · 다음 경기</span>${venueBadge(match)}<span>${e(match.competition)}${match.tentative ? ' · 잠정' : ''}</span></div><div class="match-teams"><div><img class="match-crest" src="data/images/chelsea-crest.png" width="46" height="46" alt=""><strong>첼시<small lang="en">CHELSEA</small></strong></div><span>VS</span><div><strong>${e(match.opponent)}</strong></div></div><p class="match-kickoff"><time datetime="${e(match.kickoff)}"><span>${parts.month}.${parts.day} (${parts.weekday})</span><strong>${parts.hour}:${parts.minute}</strong></time> <small>KST</small></p><p class="match-sub">${parts.hour === '00' && parts.minute === '00' ? '전날 밤에서 넘어가는 자정 · ' : ''}${e(match.stadium || (match.venue === 'home' ? 'Stamford Bridge' : '경기장 정보 미확인'))}<br>영국 ${e(formatKickoff(match.kickoff, 'Europe/London'))}</p><div class="match-actions"><a class="button button-light" href="${matchUrl(match)}">MATCH CENTRE ↗</a>${link(match.source, '공식 경기 안내')}</div></section>`;
}

function seasonFacts() {
  return `<dl class="season-facts"><div><dt>감독</dt><dd>${e(data.season.manager)}</dd></div><div><dt>구단 주장</dt><dd>${e(data.season.captain)}</dd></div></dl><div class="season-competitions">${data.season.competitions.map(item => `<p><span>${e(item.name)}</span><strong>${e(item.status)}</strong></p>`).join('')}</div>`;
}

function home() {
  const next = getNextMatch(data.matches, data.season.asOf);
  const recent = data.matches.filter(match => match.status === 'finished').sort((a, b) => (b.kickoff || b.date).localeCompare(a.kickoff || a.date))[0];
  const featureOrder = ['cole-palmer', 'morgan-rogers', 'joao-pedro', 'moises-caicedo', 'reece-james', 'levi-colwill', 'estevao-willian', 'mike-penders'];
  const featured = data.players.filter(player => player.featured).sort((a, b) => featureOrder.indexOf(a.id) - featureOrder.indexOf(b.id));
  const { summary, form } = summarizeLeague(data.matches, data.season.asOf);
  const recentForm = form.map(({ result }) => {
    const label = { W: '승리', D: '무승부', L: '패배' }[result];
    return `<abbr title="${label}" aria-label="${label}" class="form-${result}">${result}</abbr>`;
  }).join('');
  const upcoming = data.matches.filter(match =>
    match.status === 'scheduled' && match.kickoff && Date.parse(match.kickoff) > Date.parse(data.season.asOf)
  ).sort((a, b) => a.kickoff.localeCompare(b.kickoff)).slice(0, 3);
  main.innerHTML = `<div class="container">
    <div class="home-stage">
      ${photo(data.media?.hero.image, data.media?.hero.alt, true)}
      <header class="home-heading">
        <p class="hero-edition"><span>LONDON / SEOUL</span><span>CHELSEA FC / 2026—27</span></p>
        <h1>우리의 밤은,<br><span>첼시 블루.</span></h1>
        <p class="hero-translation" lang="en">OUR NIGHT<br>IS CHELSEA BLUE.</p>
      </header>
    </div>
    ${nextCard(next)}
    <div class="home-summary"><div class="dashboard-side">
      <section class="result-card venue-${recent?.venue || 'home'}">
        <p class="eyebrow">LAST MATCH · 최근 결과</p>
        ${recent ? `<h2>${recent.venue === 'home' ? '첼시' : e(recent.opponent)} <span class="result-score">${scoreline(recent)}</span> ${recent.venue === 'home' ? e(recent.opponent) : '첼시'}</h2>
        <p>${venueBadge(recent)} ${e(matchDate(recent))} · ${e(recent.competition)} · ${outcomeBadge(recent)}</p>
        <a class="text-link" href="${matchUrl(recent)}">경기 결과 보기 ↗</a>` : '<p>확인된 결과가 없습니다.</p>'}
      </section>
      <section class="season-card home-season">
        ${heading('02 / PREMIER LEAGUE', '시즌 스냅샷', 'season-report.html', '시즌 리포트')}
        <dl class="snapshot-metrics">
          <div><dt>득점</dt><dd>${summary?.goalsFor ?? '–'}</dd></div>
          <div><dt>실점</dt><dd>${summary?.goalsAgainst ?? '–'}</dd></div>
          <div><dt>최근 폼</dt><dd class="snapshot-form">${recentForm || '–'}</dd></div>
        </dl>
        ${seasonFacts()}
      </section>
    </div></div>
    <p class="verification-note">${e(data.season.checkedAt)} KST 확인 자료 · 자동 갱신되지 않습니다. 일정은 변경될 수 있습니다.</p>
    <section class="section">
      ${heading('03 / LATEST STORIES', '블루스의 지금', 'news.html', '모든 뉴스')}
      <div class="news-grid">${data.articles.slice(0, 3).map(newsCard).join('')}</div>
    </section>
    <section class="section">
      ${heading('04 / SQUAD', '이번 시즌, 기억할 이름', 'squad.html', '전체 선수단')}
      <p class="lede">처음 보는 팬을 위한 8명의 이야기. 공식 순위나 베스트 11이 아닌 편집 추천입니다.</p>
      <div class="players-grid">${featured.map(playerCard).join('')}</div>
    </section>
    <section class="section">
      ${heading('ON THE HORIZON', '다가오는 90분', 'matches.html', '시즌 전체 일정')}
      <div class="fixture-list">${upcoming.map(matchRow).join('')}</div>
    </section>
    <section class="guide-banner">
      <p class="eyebrow">05 / FROM THE BRIDGE</p><h2>처음이어도, 같은 블루.</h2>
      <p>경기 보는 법부터 브리지에 가는 길까지.<br>한국 팬의 시선으로 차근차근 안내합니다.</p>
      <a class="button button-light" href="korean-guide.html">한국 팬 가이드 ↗</a>
      <a class="text-link" href="club.html">1905년부터 이어진 이야기 ↗</a>
    </section>
  </div>`;
}


function squad() {
  main.innerHTML = `<div class="container">${intro('THE SQUAD', '블루를 입은 이름들', '남자 선수 공식 프로필 기준 30명. 등록 명단이나 당일 출전 가능 명단과는 다릅니다.')}<form class="toolbar" id="squad-form" role="search"><label class="field">선수 검색<input name="query" type="search" placeholder="한글·영문 이름 또는 등번호" autocomplete="off"></label><label class="field">포지션<select name="group"><option value="all">전체 포지션</option>${Object.entries(groupNames).map(([key, name]) => `<option value="${key}">${name}</option>`).join('')}</select></label><button class="button button-outline" type="reset">초기화</button></form><p class="results-count" id="squad-count" role="status"></p><div class="players-grid" id="squad-results"></div><section class="section">${heading('LEADERSHIP', '팀을 이끄는 사람들')}<div class="info-card">${seasonFacts()}<p>구단 주장과 개별 경기에서 완장을 차는 선수는 다를 수 있습니다. 주장 대행을 고정 서열로 표시하지 않습니다.</p>${source(data.season)}</div></section></div>`;
  const form = document.querySelector('#squad-form');
  const update = () => {
    const query = normalize(form.elements.query.value);
    const group = form.elements.group.value;
    const players = data.players.filter(player => (group === 'all' || player.group === group) && [player.en, player.ko, player.number, ...(player.aliases || [])].some(value => normalize(value).includes(query)));
    document.querySelector('#squad-count').textContent = `${players.length}명의 선수`;
    document.querySelector('#squad-results').innerHTML = players.length ? players.map(playerCard).join('') : empty('검색어 또는 포지션을 바꿔보세요.');
  };
  form.addEventListener('submit', event => event.preventDefault());
  form.addEventListener('input', update);
  form.addEventListener('reset', () => requestAnimationFrame(update));
  update();
}

function matches() {
  const months = [...new Set(data.matches.filter(match => match.dateBasis !== 'Europe/London').map(match => matchDate(match).slice(0, 7)).filter(Boolean))].sort();
  main.innerHTML = `<div class="container">${intro('MATCH CENTRE', '우리 시간으로, 킥오프', '모든 날짜와 시간은 한국시간(KST) 기준입니다. 영국시간은 보조로 함께 제공합니다.')}<div class="dashboard">${nextCard(getNextMatch(data.matches, data.season.asOf))}<aside class="season-card"><p class="eyebrow">2026/27 COMPETITIONS</p>${seasonFacts()}<p class="source-note">FA컵 상대·개별 경기일은 발표 후 반영합니다.</p></aside></div><section class="section">${heading('FIXTURES & RESULTS', '시즌 일정과 결과')}<form class="toolbar" id="matches-form"><label class="field">경기 상태<select name="status"><option value="all">전체 경기</option><option value="scheduled">예정</option><option value="finished">종료</option><option value="unknown">결과 확인 중</option></select></label><label class="field">월 · KST<select name="month"><option value="all">모든 월</option>${months.map(month => `<option>${month}</option>`).join('')}</select></label><label class="field">대회<select name="competition"><option value="all">전체 대회</option>${[...new Set(data.matches.map(match => match.competition))].map(value => `<option>${e(value)}</option>`).join('')}</select></label><label class="field">홈·원정<select name="venue"><option value="all">전체</option><option value="home">홈</option><option value="away">원정</option></select></label><button type="reset" class="button button-outline">초기화</button></form><p class="results-count" id="match-count" role="status"></p><div class="fixture-list" id="match-results"></div><p class="notice">잠정 편성은 방송·대회 운영에 따라 변경될 수 있습니다. 시간 미정에는 임의의 킥오프 시간을 표시하지 않습니다. 지난 경기의 확인되지 않은 스코어는 ‘결과 확인 중’으로 남깁니다.</p></section></div>`;
  const form = document.querySelector('#matches-form');
  const requested = new URLSearchParams(location.search).get('status');
  if (['scheduled', 'finished', 'unknown'].includes(requested)) form.elements.status.value = requested;
  const update = () => {
    const filtered = data.matches.filter(match => ['status', 'competition', 'venue'].every(key => form.elements[key].value === 'all' || match[key] === form.elements[key].value) && (form.elements.month.value === 'all' || (form.elements.month.value === 'unknown-date' ? match.dateBasis === 'Europe/London' : match.dateBasis !== 'Europe/London' && matchDate(match).startsWith(form.elements.month.value)))).sort((a, b) => matchDate(a).localeCompare(matchDate(b)));
    document.querySelector('#match-count').textContent = `${filtered.length}경기 · KST 기준`;
    document.querySelector('#match-results').innerHTML = filtered.length ? filtered.map(matchRow).join('') : empty('다른 월이나 대회, 홈·원정을 선택해 보세요.');
  };
  form.elements.month.add(new Option('한국 날짜 미정', 'unknown-date'));
  form.addEventListener('change', update);
  form.addEventListener('reset', () => requestAnimationFrame(update));
  form.addEventListener('submit', event => event.preventDefault());
  update();
}

function news() {
  const categories = [...new Set(data.articles.map(article => article.category))];
  main.innerHTML = `<div class="container">${intro('INSIDE CHELSEA', '블루스의 이야기', '공식 발표를 한국어로 짧고 정확하게. 원문과 확인일을 함께 제공합니다.')}<form class="toolbar" id="news-form" role="search"><label class="field">뉴스 검색<input name="query" type="search" placeholder="제목 또는 내용 검색"></label><label class="field">카테고리<select name="category"><option value="all">전체 뉴스</option>${categories.map(category => `<option>${e(category)}</option>`).join('')}</select></label><button type="reset" class="button button-outline">초기화</button></form><p class="results-count" id="news-count" role="status"></p><div class="news-grid" id="news-results"></div><p class="notice">이 페이지는 공식 기사의 한국어 편집 요약입니다. 부상·이적 관련 소식은 발표 당시의 정보이므로 후속 공지를 함께 확인하세요.</p></div>`;
  const form = document.querySelector('#news-form');
  const update = () => {
    const query = normalize(form.elements.query.value);
    const articles = data.articles.filter(article => (form.elements.category.value === 'all' || article.category === form.elements.category.value) && normalize(`${article.title} ${article.summary} ${[...article.body, ...(article.keyPoints || []), ...(article.background || []), ...(article.fanPoints || [])].join(' ')}`).includes(query));
    document.querySelector('#news-count').textContent = `${articles.length}개의 이야기`;
    document.querySelector('#news-results').innerHTML = articles.length ? articles.map(newsCard).join('') : empty('다른 검색어나 카테고리를 선택해 보세요.');
  };
  form.addEventListener('submit', event => event.preventDefault());
  form.addEventListener('input', update);
  form.addEventListener('reset', () => requestAnimationFrame(update));
  update();
}

function playerDetail() {
  const player = data.players.find(item => item.id === new URLSearchParams(location.search).get('id'));
  if (!player) { main.innerHTML = `<div class="container">${intro('PLAYER', '선수를 찾을 수 없어요', '주소가 올바른지 확인하거나 선수단에서 다시 선택해 주세요.')}<a class="button" href="squad.html">선수단으로 돌아가기 ↗</a></div>`; return; }
  document.title = `${player.ko} · ${player.en} | Chelsea 2026/27`;
  const related = data.articles.filter(article => article.playerIds.includes(player.id));
  main.innerHTML = `<div class="container"><a class="detail-back" href="squad.html">← 전체 선수단</a><header class="detail-hero"><div class="detail-portrait player-visual">${photo(player.image, player.imageAlt, true)}<span class="portrait-fallback" aria-hidden="true">CFC</span></div><span class="detail-number" aria-hidden="true">${e(player.number)}</span><div class="detail-content"><p class="eyebrow">${e(groupNames[player.group])} · 2026/27</p><h1>${e(player.ko)}</h1><p lang="en">${e(player.en)}</p><span class="badge">등번호 ${e(player.number)}</span> <span class="badge">${e(player.position)}</span></div></header><section class="section detail-layout"><div class="prose"><h2>이 선수를 알아보세요</h2><p>${e(player.summary)}</p><p>포지션은 구단 공식 프로필 분류를 기준으로 하며 경기에서 맡는 역할은 달라질 수 있습니다. 출전·득점 통계와 부상 복귀일은 검증된 자료가 확보되면 추가합니다.</p>${source(player)}</div><aside class="info-card"><p class="eyebrow">PLAYER PROFILE</p><h2>공식 프로필에서 더 자세히</h2><p>최신 소속·선수 정보와 구단의 소개를 확인하세요.</p>${link(player.source, `${player.en} 공식 프로필`)}</aside></section><section class="section">${heading('RELATED STORIES', '함께 읽을 이야기')}<div class="news-grid">${related.length ? related.map(newsCard).join('') : '<p class="notice">등록된 관련 기사가 없습니다. 새로운 공식 소식이 확인되면 연결합니다.</p>'}</div></section></div>`;
}

function matchDetail() {
  const match = data.matches.find(item => item.id === new URLSearchParams(location.search).get('id'));
  if (!match) {
    main.innerHTML = `<div class="container">${intro('MATCH', '경기를 찾을 수 없어요', '경기 주소를 확인하거나 전체 일정에서 다시 선택해 주세요.')}<a class="button" href="matches.html">경기 목록으로 ↗</a></div>`;
    return;
  }
  document.title = `첼시 vs ${match.opponent} · ${matchDate(match)} | Chelsea 2026/27`;
  const helpers = { photo, venueBadge, scoreline, outcomeBadge, source, heading, newsCard };
  main.innerHTML = renderMatch(match, data, helpers);
  mountMatch(match, data, helpers);
}

function articleDetail() {
  const article = data.articles.find(item => item.id === new URLSearchParams(location.search).get('id'));
  if (!article) { main.innerHTML = `<div class="container">${intro('STORY', '기사를 찾을 수 없어요', '뉴스 목록에서 읽고 싶은 이야기를 다시 선택해 주세요.')}<a class="button" href="news.html">뉴스 목록 ↗</a></div>`; return; }
  document.title = `${article.title} | Chelsea 2026/27`;
  const players = data.players.filter(player => article.playerIds.includes(player.id));
  const relatedMatches = data.matches.filter(match => (article.matchIds || []).includes(match.id));
  main.innerHTML = `<div class="container"><a class="detail-back" href="news.html">← 전체 뉴스</a><article>
    <header class="article-header photo-hero">${photo(storyPhoto(article), article.imageAlt || data.media?.hero.alt, true)}<div class="hero-copy"><p class="eyebrow">${e(article.category)} · 공식 기사 요약</p><h1>${e(article.title)}</h1><p class="lede">${e(article.summary)}</p><p class="news-meta">원문 게시 <time datetime="${e(article.date)}">${e(article.date)}</time> · 요약·확인 ${e(article.checkedAt)}</p><small class="photo-credit">사진 · Chelsea FC / 공식 기사</small></div></header>
    <div class="story-layout"><div class="article-body prose"><h2>무슨 이야기인가요?</h2>${article.body.map(paragraph => `<p>${e(paragraph)}</p>`).join('')}
    ${article.background?.length ? `<section class="story-background"><h2>경기와 선수의 배경</h2>${article.background.map(text => `<p>${e(text)}</p>`).join('')}</section>` : ''}
    ${article.fanPoints?.length ? `<section class="fan-points"><p class="eyebrow">FROM A KOREAN PERSPECTIVE</p><h2>한국 팬이 알아둘 포인트</h2>${article.fanPoints.map(text => `<p>${e(text)}</p>`).join('')}</section>` : ''}
    <p class="notice">공식 원문을 바탕으로 구성한 비공식 한국 팬사이트의 독자적인 요약·해설입니다. 전체 번역이 아니며, 발표 이후 정보는 달라질 수 있습니다.</p>${source(article)}<a class="button" href="${e(safeUrl(article.source))}" target="_blank" rel="noopener noreferrer">공식 원문 읽기 ↗</a></div>
    <aside class="story-takeaways"><p class="eyebrow">THE KEY POINTS</p><h2>핵심 내용</h2><ol>${(article.keyPoints || []).map(text => `<li>${e(text)}</li>`).join('')}</ol><a class="text-link" href="${e(safeUrl(article.source))}" target="_blank" rel="noopener noreferrer">Chelsea FC 공식 출처 ↗</a></aside></div></article>
    <section class="section related-matches">${heading('MATCH CONTEXT', '관련 경기')}<p class="lede">${e(article.matchContext || '기사에 직접 언급된 경기입니다. 일정과 결과는 저장된 확인 자료를 기준으로 표시합니다.')}</p>${relatedMatches.length ? `<div class="fixture-list">${relatedMatches.map(matchRow).join('')}</div>` : '<p class="notice">이 공지는 특정 경기의 출전 여부를 확정하지 않습니다. <a href="matches.html">전체 경기 일정 확인 ↗</a></p>'}</section>
    ${players.length ? `<section class="section related-players">${heading('IN THIS STORY', '기사 속 선수')}<div class="players-grid">${players.map(playerCard).join('')}</div></section>` : ''}</div>`;
}

async function start() {
  try {
    const response = await fetch('./data/site.json');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    data = await response.json();
    if (!data.season || !Array.isArray(data.players) || !Array.isArray(data.matches) || !Array.isArray(data.articles)) throw new Error('Invalid data');
    if (data.media?.crest?.image) {
      document.querySelectorAll('.crest-image').forEach(image => {
        image.src = imageUrl(data.media.crest.image);
        image.alt = data.media.crest.alt;
      });
    }
    data.articles.sort((a, b) => b.date.localeCompare(a.date));
    const renderers = { home, squad, matches, news, player: playerDetail, article: articleDetail, match: matchDetail };
    if (page === 'season-report') {
      const results = await Promise.all(['season-report', 'player-stats', 'injuries'].map(async name => {
        const response = await fetch(`./data/${name}.json`, { cache: 'no-store' });
        if (!response.ok) throw new Error(`Report HTTP ${response.status}`);
        return response.json();
      }));
      main.innerHTML = renderSeasonReport(data, ...results, { photo, heading });
    } else if (renderers[page]) renderers[page]();
    if (['club', 'guide'].includes(page)) {
      const header = main.querySelector('.page-intro');
      header.classList.add('photo-hero');
      const copy = document.createElement('div');
      copy.className = 'hero-copy';
      while (header.firstChild) copy.append(header.firstChild);
      header.append(copy);
      header.insertAdjacentHTML('afterbegin', pagePhoto(page));
    }
    document.querySelectorAll('[data-checked]').forEach(element => { element.textContent = `${data.season.checkedAt} KST`; });
    main.removeAttribute('aria-busy');
  } catch (error) {
    main.removeAttribute('aria-busy');
    if (['home', 'squad', 'matches', 'news', 'player', 'article', 'match', 'season-report'].includes(page)) main.innerHTML = `<div class="container">${intro('PLEASE TRY AGAIN', '정보를 불러오지 못했어요', '연결 상태를 확인하고 다시 시도해 주세요.')}<p class="notice" role="alert">페이지 데이터를 읽을 수 없습니다. 파일을 직접 열었다면 로컬 HTTP 서버로 접속해 주세요.</p><button class="button" id="retry">다시 시도</button> ${link('https://www.chelseafc.com/en', '첼시 공식 사이트')}</div>`;
    document.querySelector('#retry')?.addEventListener('click', () => location.reload());
    console.error('Chelsea page data:', error);
  }
}
start();
