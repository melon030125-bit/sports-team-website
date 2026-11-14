import { escapeHtml as e, safeUrl, formatKickoff, matchDate } from './utils.js';
import { commentsView, mountComments } from './comments.js';

const eventNames = { goal: '⚽ 골', assist: 'ASSIST · 도움', substitution: 'IN / OUT · 교체', yellow: '경고', red: '퇴장' };
const statNames = { possession: '점유율', shots: '슈팅', shotsOnTarget: '유효슈팅', corners: '코너킥', fouls: '파울', offsides: '오프사이드' };
const known = value => value !== null && value !== undefined;
const valueText = value => known(value) ? e(value) : '–';
const minuteText = value => value === 'HT' ? '하프타임' : known(value) && value !== '' ? `${e(value)}′` : '시간 미확인';
export const hasRating = entry => typeof entry.rating === 'number' && Number.isFinite(entry.rating) && entry.rating >= 0 && entry.rating <= 10 && typeof entry.ratingSource === 'string' && !!entry.ratingSource.trim();
export function sortPerformances(items, order = 'lineup') {
  return [...items].sort((a, b) => order === 'rating' ? (hasRating(b) ? b.rating : -1) - (hasRating(a) ? a.rating : -1) : Number(b.starter) - Number(a.starter));
}
export function highestRated(items) {
  const rated = items.filter(hasRating);
  const best = Math.max(...rated.map(item => item.rating));
  return rated.filter(item => item.rating === best);
}
export function formationRows(match) {
  const formation = match.formation;
  if (!formation || !/^[1-9](?:-[1-9]){1,4}$/.test(formation.name)) return null;
  const sizes = [1, ...formation.name.split('-').map(Number)];
  const rows = formation.rows;
  if (!Array.isArray(rows) || rows.length !== sizes.length || rows.some((row, index) => !Array.isArray(row) || row.length !== sizes[index])) return null;
  const players = rows.flat();
  if (players.length !== 11 || new Set(players).size !== 11 || match.startingXI?.length !== 11 || players.some(id => !match.startingXI.includes(id))) return null;
  return rows;
}

function person(id, data) { return data.players.find(player => player.id === id); }
function personLink(id, data, fallback = '정보 미확인') {
  const player = person(id, data);
  return player ? `<a href="player.html?id=${encodeURIComponent(player.id)}">${e(player.ko)}</a>` : e(fallback);
}
function performance(match, playerId) { return match.playerPerformances?.find(item => item.playerId === playerId); }
function rating(entry) { return entry && hasRating(entry) ? entry.rating.toFixed(1) : '–'; }
function contributions(entry = {}) {
  return `<span class="contribution-goals">⚽ ${valueText(entry.goals)}</span><span>도움 ${valueText(entry.assists)}</span><span class="booking"><i class="card-symbol yellow-card" aria-hidden="true"></i>경고 ${valueText(entry.yellowCards)}</span><span class="booking"><i class="card-symbol red-card" aria-hidden="true"></i>퇴장 ${valueText(entry.redCards)}</span>`;
}
function substitutionInfo(entry, data) {
  if (!entry) return '';
  return `${entry.substitutedIn ? `<span class="sub-in">IN ${minuteText(entry.substitutedIn.minute)} · OUT ${personLink(entry.substitutedIn.playerId, data)}</span>` : ''}${entry.substitutedOut ? `<span class="sub-out">OUT ${minuteText(entry.substitutedOut.minute)} · IN ${personLink(entry.substitutedOut.playerId, data)}</span>` : ''}`;
}
function lineupPlayer(id, match, data, photo) {
  const player = person(id, data);
  if (!player) return '<li class="lineup-player">선수 정보 미확인</li>';
  const entry = performance(match, id);
  return `<li class="lineup-player" id="lineup-${e(id)}"><a class="lineup-portrait" href="player.html?id=${encodeURIComponent(id)}"><span aria-hidden="true">CFC</span>${photo(player.image, player.imageAlt)}</a><div class="lineup-identity"><span class="lineup-number">${valueText(entry?.shirtNumber ?? player.number)}</span><h3>${personLink(id, data)}</h3><p lang="en">${e(player.en)}</p><small>${e(entry?.position || player.position)}</small></div><div class="lineup-performance">${match.status === 'finished' ? `<span class="lineup-appearance">${entry ? entry.starter ? '선발 출전' : '교체 출전' : match.unusedSubstitutes?.includes(id) ? '미출전 후보' : '출전 여부 미확인'}</span>${substitutionInfo(entry, data)}<span class="lineup-rating">평점 ${rating(entry)}</span><div class="contributions">${contributions(entry)}</div>` : ''}</div></li>`;
}
function pitchView(match, data, photo) {
  const rows = formationRows(match);
  if (!rows) return `<div class="pitch pitch-empty"><div class="pitch-centre" aria-hidden="true"></div><p>${match.status === 'scheduled' ? '포메이션 발표 전' : '포메이션 정보 미확인'}</p><small>확인된 대형과 선발 11명이 있을 때 표시합니다.</small></div>`;
  const bestIds = highestRated(match.playerPerformances || []).map(item => item.playerId);
  return `<div class="pitch" aria-label="첼시 ${e(match.formation.name)} 포메이션"><div class="pitch-markings" aria-hidden="true"><span class="penalty-box-top"></span><span class="penalty-box-bottom"></span></div><div class="pitch-centre" aria-hidden="true"></div><div class="pitch-lines">${[...rows].reverse().map(row => `<div class="pitch-line" style="--players:${row.length}">${row.map(id => {
    const player = person(id, data);
    const entry = performance(match, id);
    if (!player) return '<span>정보 미확인</span>';
    return `<a class="pitch-player${bestIds.includes(id) ? ' top-rated' : ''}" href="#${match.status === 'finished' && entry ? 'performance' : 'lineup'}-${e(id)}" aria-label="${e(player.ko)} 경기 정보 보기"><span class="pitch-portrait"><b>${valueText(entry?.shirtNumber ?? player.number)}</b>${photo(player.image, player.imageAlt)}</span><strong>${e(player.ko)}</strong><small>${e(entry?.position || player.position)}</small>${match.status === 'finished' ? `<span class="pitch-rating">평점 ${rating(entry)}</span><span class="pitch-contributions">${known(entry?.goals) ? `⚽ ${entry.goals}` : ''}${known(entry?.assists) ? ` · 도움 ${entry.assists}` : ''}${entry?.yellowCards ? '<i class="card-symbol yellow-card" aria-label="경고"></i>' : ''}${entry?.redCards ? '<i class="card-symbol red-card" aria-label="퇴장"></i>' : ''}</span>` : ''}</a>`;
  }).join('')}</div>`).join('')}</div></div>`;
}
function ratingsCards(match, data, photo, order = 'lineup') {
  const bestIds = highestRated(match.playerPerformances || []).map(entry => entry.playerId);
  return sortPerformances(match.playerPerformances || [], order).map(entry => {
    const player = person(entry.playerId, data);
    if (!player) return '';
    return `<article class="performance-card${hasRating(entry) ? ' has-rating' : ''}${bestIds.includes(player.id) ? ' top-rated' : ''}" id="performance-${e(player.id)}" tabindex="-1"><div class="performance-player"><a class="lineup-portrait" href="player.html?id=${encodeURIComponent(player.id)}"><span aria-hidden="true">CFC</span>${photo(player.image, player.imageAlt)}</a><div><small>${entry.starter ? '선발' : '교체 출전'} · #${valueText(entry.shirtNumber)}</small><h3>${personLink(player.id, data)}</h3><p lang="en">${e(player.en)}</p><small>${e(entry.position || '포지션 미확인')}</small></div><strong class="performance-rating" aria-label="평점 ${rating(entry)}">${rating(entry)}</strong></div><dl class="performance-stats"><div><dt>출전 시간</dt><dd>${known(entry.minutesPlayed) ? `${valueText(entry.minutesPlayed)}분` : '–'}</dd></div><div><dt>⚽ 득점</dt><dd>${valueText(entry.goals)}</dd></div><div><dt>ASSIST · 도움</dt><dd>${valueText(entry.assists)}</dd></div><div><dt><i class="card-symbol yellow-card" aria-hidden="true"></i> 경고</dt><dd>${valueText(entry.yellowCards)}</dd></div><div><dt><i class="card-symbol red-card" aria-hidden="true"></i> 퇴장</dt><dd>${valueText(entry.redCards)}</dd></div></dl><div class="performance-substitutions">${substitutionInfo(entry, data) || '<span>교체 정보 미확인</span>'}</div></article>`;
  }).join('');
}
function ratingsView(match, data, photo) {
  const entries = match.playerPerformances || [];
  const best = highestRated(entries);
  const sources = [...new Set(entries.filter(hasRating).map(entry => entry.ratingSource))];
  return `<section class="section match-ratings" id="player-ratings"><div class="section-head"><div><p class="eyebrow">PLAYER RATINGS</p><h2>선수 평점과 퍼포먼스</h2></div><label class="rating-sort">정렬<select id="rating-sort"><option value="lineup">선발 · 교체순</option><option value="rating">평점 높은 순</option></select></label></div><p class="notice">등번호·기본 포지션은 저장된 시즌 공식 프로필 기준입니다. – 표시는 0이 아닌 정보 미확인입니다. 출전 시간은 교체 시각만으로 계산하지 않습니다.</p>${!sources.length ? '<p class="rating-unconfirmed">선수 평점 정보 미확인 · 확인된 평점 출처가 없습니다.</p>' : ''}<section class="player-of-match"><p class="eyebrow">PLAYER OF THE MATCH</p><h3>${best.length ? '최고 평점 선수' : '최고 평점 선수 정보 미확인'}</h3>${best.length ? `<p>${best.map(entry => `${personLink(entry.playerId, data)} <strong>${rating(entry)}</strong>`).join(' · ')}</p><small>확인된 평점 중 최고점입니다. 공식 MOM 수상과는 다르며 동점은 함께 표시합니다.</small>` : '<p>평점 데이터가 확인되면 표시합니다. 공식 MOM을 임의로 지정하지 않습니다.</p>'}</section><div class="performance-grid" id="performance-results">${entries.length ? ratingsCards(match, data, photo) : '<p class="notice">출전 선수의 상세 퍼포먼스 정보 미확인</p>'}</div>${sources.length ? `<p class="rating-sources">평점 출처: ${sources.map(e).join(' · ')}</p>` : ''}</section>`;
}
function eventsView(match, data) {
  const events = match.events || [];
  return events.length ? `<p class="lede">공식 보고서에서 확인한 주요 이벤트입니다. 전체 경기 타임라인이 아니며 도움 기록은 별도로 확인된 경우에만 표시합니다.</p><ol class="event-timeline">${events.map(event => `<li class="match-event event-${e(event.type)}"><span class="event-minute">${minuteText(event.minute)}</span><div><span class="event-label">${event.type === 'yellow' ? '<i class="card-symbol yellow-card" aria-hidden="true"></i>' : event.type === 'red' ? '<i class="card-symbol red-card" aria-hidden="true"></i>' : ''}${e(eventNames[event.type] || '경기 이벤트')} · ${event.team === 'chelsea' ? '첼시' : e(match.opponent)}</span><p>${event.type === 'substitution' ? `<b>IN</b> ${personLink(event.playerId, data, event.playerName)} <span> / OUT </span>${personLink(event.relatedPlayerId, data, event.relatedPlayerName)}` : personLink(event.playerId, data, event.playerName)}${event.type === 'goal' ? `<small>ASSIST · ${event.assistId ? personLink(event.assistId, data) : '정보 미확인'}</small>` : ''}</p>${event.note ? `<small>${e(event.note)}</small>` : ''}</div></li>`).join('')}</ol>` : `<p class="notice">${match.status === 'scheduled' ? '경기 시작 전입니다. 확인된 경기 이벤트가 없습니다.' : '경기 이벤트 정보 미확인'}</p>`;
}
function statsView(match) {
  return `<div class="match-stat-table"><div class="match-stat-head"><strong>${match.venue === 'home' ? '첼시' : e(match.opponent)}</strong><span>경기 통계</span><strong>${match.venue === 'home' ? e(match.opponent) : '첼시'}</strong></div>${Object.entries(statNames).map(([key, label]) => {
    const stat = match.stats?.[key];
    const display = value => known(value) ? `${e(value)}${key === 'possession' ? '%' : ''}` : '정보 없음';
    return `<div class="match-stat-row"><span>${display(stat?.home)}</span><strong>${label}</strong><span>${display(stat?.away)}</span></div>`;
  }).join('')}</div><p class="source-note">홈팀 · 원정팀 순서입니다. 확인되지 않은 통계를 0으로 표시하지 않습니다.</p>`;
}

export function renderMatch(match, data, helpers) {
  const { photo, venueBadge, scoreline, outcomeBadge, source, heading, newsCard } = helpers;
  const finished = match.status === 'finished';
  const related = data.articles.filter(article => article.matchIds?.includes(match.id));
  const image = related.find(article => article.source === match.source && article.image) || data.media.hero;
  const status = { scheduled: '경기 예정', finished: '경기 종료', unknown: '결과 확인 중', postponed: '경기 연기' }[match.status] || '경기 상태 미확인';
  const teams = match.venue === 'home' ? ['첼시', match.opponent] : [match.opponent, '첼시'];
  return `<div class="container match-detail"><a class="detail-back" href="matches.html">← 경기 일정과 결과</a>
    <header class="match-detail-hero photo-hero">${photo(image.image, image.imageAlt || image.alt, true)}<div class="hero-copy"><p class="eyebrow">MATCH CENTRE · 2026/27</p><div class="match-detail-badges">${venueBadge(match)}<span>${e(match.competition)} · ${status}${match.tentative ? ' · 잠정 편성' : ''}</span></div><h1>${e(teams[0])} <span>vs</span> ${e(teams[1])}</h1>${finished ? `<div class="match-detail-score">${scoreline(match)}${outcomeBadge(match)}</div>${match.penalties ? `<p class="match-penalties">${e(match.penalties)} · 본 경기 점수와 별도</p>` : ''}` : '<p class="match-final-pending">최종 점수 · 정보 없음</p>'}<p class="match-detail-kickoff">${match.kickoff ? `${e(formatKickoff(match.kickoff))} KST` : `${e(match.date || '날짜 미정')} · ${match.dateBasis === 'Europe/London' ? '영국 현지 날짜 · 한국 날짜·시간 미정' : 'KST 시간 미정'}`}</p></div></header>
    <dl class="match-facts"><div><dt>대회</dt><dd>${e(match.competition)}</dd></div><div><dt>날짜 · KST</dt><dd>${match.kickoff ? e(matchDate(match)) : '정보 없음'}</dd></div><div><dt>한국시간</dt><dd>${match.kickoff ? `${e(formatKickoff(match.kickoff))} KST` : '시간 미정'}</dd></div><div><dt>영국시간</dt><dd>${match.kickoff ? e(formatKickoff(match.kickoff, 'Europe/London')) : '시간 미정'}</dd></div><div><dt>경기장</dt><dd>${e(match.stadium || (match.venue === 'home' ? 'Stamford Bridge' : '정보 미확인'))}</dd></div><div><dt>경기 상태</dt><dd>${status}</dd></div></dl>${source(match)}
    <nav class="match-section-nav filter-buttons" aria-label="경기 상세 목차"><a class="filter-button" href="#formation">포메이션</a><a class="filter-button" href="#starting-xi">선발</a><a class="filter-button" href="#bench">벤치</a>${finished ? '<a class="filter-button" href="#player-ratings">선수 평점</a>' : ''}<a class="filter-button" href="#match-events">이벤트</a><a class="filter-button" href="#match-stats">통계</a><a class="filter-button" href="#fan-comments">댓글</a></nav>
    <section class="section match-formation" id="formation">${heading('THE SHAPE', `첼시 포메이션${match.formation ? ` · ${e(match.formation.name)}` : ''}`)}<p class="lede">확인된 선발 대형의 도식입니다. 좌우 위치나 경기 중 실제 움직임을 뜻하지 않습니다. 선수를 누르면 아래 경기 퍼포먼스로 이동합니다.</p>${pitchView(match, data, photo)}</section>
    ${finished ? ratingsView(match, data, photo) : ''}
    <section class="section match-lineups" id="starting-xi">${heading('STARTING XI', '첼시 선발 명단')}<p class="lede">등번호·기본 포지션은 저장된 시즌 공식 프로필 기준입니다.</p>${match.startingXI?.length ? `<ul class="lineup-grid">${match.startingXI.map(id => lineupPlayer(id, match, data, photo)).join('')}</ul>` : `<p class="notice">${match.status === 'scheduled' ? '선발 발표 전 · 현재 저장된 자료에서 확인된 선발 명단이 없습니다.' : '선발 명단 정보 미확인'}</p>`}</section>
    <section class="section match-bench" id="bench">${heading('ON THE BENCH', '첼시 벤치 엔트리')}${match.bench?.length ? `<p class="lede">교체 투입 선수와 미출전 후보를 함께 표시합니다.</p><ul class="lineup-grid">${match.bench.map(id => lineupPlayer(id, match, data, photo)).join('')}</ul>` : '<p class="notice">엔트리 미확인</p>'}${match.lineupSource ? `<p class="source-note"><a href="${e(safeUrl(match.lineupSource))}" target="_blank" rel="noopener noreferrer">선발·벤치·이벤트 공식 보고서 ↗</a> · 확인 ${e(match.detailsCheckedAt)}</p>` : ''}</section>
    <section class="section match-events" id="match-events">${heading('AS IT HAPPENED', '경기 이벤트')}${eventsView(match, data)}</section>
    <section class="section match-stats" id="match-stats">${heading('THE NUMBERS', '경기 통계')}${statsView(match)}</section>
    ${related.length ? `<section class="section">${heading('MATCH STORIES', '함께 읽을 이야기')}<div class="news-grid">${related.map(newsCard).join('')}</div></section>` : ''}
    ${commentsView()}</div>`;
}

export function mountMatch(match, data, helpers) {
  document.querySelector('#rating-sort')?.addEventListener('change', event => {
    document.querySelector('#performance-results').innerHTML = ratingsCards(match, data, helpers.photo, event.target.value) || '<p class="notice">출전 선수의 상세 퍼포먼스 정보 미확인</p>';
  });
  mountComments(match.id);
}
