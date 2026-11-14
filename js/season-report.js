import { escapeHtml as e, safeUrl, formatKickoff } from './utils.js';

const metricNames = { goals: '득점 1위', assists: '도움 1위', appearances: '최다 출전', rating: '최고 평점', yellowCards: '최다 옐로카드', redCards: '최다 레드카드' };
const isNumber = value => typeof value === 'number' && Number.isFinite(value);
const shown = value => isNumber(value) ? e(value) : '정보 미확인';

export function summarizeLeague(matches, asOf) {
  const cutoff = Date.parse(asOf);
  const completed = matches.filter(match => match.competition === 'PL' && match.status === 'finished' && Number.isInteger(match.homeScore) && Number.isInteger(match.awayScore) && Date.parse(match.kickoff || match.date) <= cutoff).sort((a, b) => Date.parse(a.kickoff || a.date) - Date.parse(b.kickoff || b.date));
  const summary = { played: completed.length, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, cleanSheets: 0, points: 0, goalDifference: 0 };
  const form = completed.map(match => {
    const home = match.venue === 'home';
    const own = home ? match.homeScore : match.awayScore;
    const opponent = home ? match.awayScore : match.homeScore;
    const result = own > opponent ? 'W' : own < opponent ? 'L' : 'D';
    summary[result === 'W' ? 'wins' : result === 'D' ? 'draws' : 'losses']++;
    summary.goalsFor += own;
    summary.goalsAgainst += opponent;
    if (opponent === 0) summary.cleanSheets++;
    return { matchId: match.id, opponent: match.opponent, date: match.date, result, homeScore: match.homeScore, awayScore: match.awayScore, venue: match.venue };
  });
  summary.points = summary.wins * 3 + summary.draws;
  summary.goalDifference = summary.goalsFor - summary.goalsAgainst;
  // An empty source is unknown, not a season with zero games.
  return { summary: completed.length ? summary : null, form: form.slice(-5) };
}

export function findLeaders(stats, key) {
  if (!stats.complete) return { state: 'unverified', players: [] };
  const entries = stats.players.filter(player => key !== 'rating' || (isNumber(player.appearances) && player.appearances > 0));
  if (!entries.length || entries.some(player => !isNumber(player[key]) || (key === 'rating' && !player.ratingSource))) return { state: 'unverified', players: [] };
  const highest = Math.max(...entries.map(player => player[key]));
  if (highest === 0) return { state: 'zero', players: [], value: 0 };
  return { state: 'verified', players: entries.filter(player => player[key] === highest), value: highest };
}

export function assertReportBundle(report, stats, injuries) {
  if ([report, stats, injuries].some(item => item.schemaVersion !== 1 || item.season !== report.season || item.snapshotId !== report.snapshotId)) throw new Error('Season report snapshot mismatch');
  if (!Array.isArray(report.standings?.rows) || !Array.isArray(stats.players) || !Array.isArray(injuries.current) || !Array.isArray(injuries.history)) throw new Error('Invalid report data');
  if (!/^\d{4}\/\d{2}$/.test(report.season) || typeof stats.complete !== 'boolean' || typeof injuries.complete !== 'boolean') throw new Error('Invalid report metadata');
  for (const value of Object.values(report.teamMetrics || {})) if (value !== null && (!Number.isInteger(value) || value < 0)) throw new Error('Invalid team metric');
  for (const item of report.form || []) if (!['W','D','L'].includes(item.result)) throw new Error('Invalid recent form');
  for (const player of stats.players) {
    for (const key of ['goals','assists','appearances','yellowCards','redCards']) if (player[key] != null && (!Number.isInteger(player[key]) || player[key] < 0)) throw new Error('Invalid player total');
    if (player.rating != null && (!isNumber(player.rating) || player.rating < 0 || player.rating > 10)) throw new Error('Invalid player rating');
  }
  if (injuries.status === 'verified' && (!injuries.complete || !injuries.updatedAt || Number.isNaN(Date.parse(injuries.updatedAt)))) throw new Error('Current injury status needs a dated complete source');
  if (report.standings.status === 'verified') {
    const rows = report.standings.rows;
    if (rows.length !== 20 || new Set(rows.map(row=>row.teamId)).size !== 20 || new Set(rows.map(row=>row.rank)).size !== 20 || rows.filter(row=>row.isChelsea).length !== 1) throw new Error('Incomplete EPL standings');
    for (const row of rows) {
      if (![row.rank, row.played, row.wins, row.draws, row.losses, row.points, row.goalsFor, row.goalsAgainst, row.goalDifference].every(isNumber) || row.rank < 1 || row.rank > 20 || row.played !== row.wins + row.draws + row.losses || row.goalDifference !== row.goalsFor - row.goalsAgainst) throw new Error('Inconsistent standings');
    }
  }
  return true;
}

function identity(entry, site) {
  const profile = site.players.find(player=>player.id === entry.playerId);
  return { id: profile?.id, image: profile?.image || entry.image, imageAlt: profile?.imageAlt || `${entry.en || '선수'} 프로필 사진`, number: profile?.number ?? entry.number, ko: profile?.ko || entry.ko || '한글명 미등록', en: profile?.en || entry.en || 'PLAYER' };
}
function leaderCard(entry, value, label, site, photo) {
  const player = identity(entry, site);
  const content = `<div class="season-leader-photo"><span class="portrait-fallback" aria-hidden="true">CFC</span>${photo(player.image, player.imageAlt)}<b>${player.number == null ? '–' : e(player.number)}</b></div><div class="season-leader-copy"><p class="eyebrow">${e(label)}</p><h3>${e(player.ko)}</h3><p lang="en">${e(player.en)}</p><strong>${e(value)}</strong></div>`;
  return player.id ? `<a class="season-leader-card" href="player.html?id=${encodeURIComponent(player.id)}">${content}</a>` : `<article class="season-leader-card">${content}</article>`;
}
function unknownLeader(label, state = 'unverified') {
  return `<article class="season-leader-card unverified-leader"><div class="season-leader-photo"><span class="portrait-fallback" aria-hidden="true">CFC</span><b>–</b></div><div class="season-leader-copy"><p class="eyebrow">${e(label)}</p><h3>${state === 'zero' ? '해당 기록 없음' : '선수 정보 미확인'}</h3><p lang="en">${state === 'zero' ? 'NO RECORDED TOTAL' : 'AWAITING VERIFIED DATA'}</p><strong>${state === 'zero' ? '0' : '–'}</strong></div></article>`;
}

export function renderSeasonReport(site, report, stats, injuries, { photo, heading }) {
  assertReportBundle(report, stats, injuries);
  const snapshot = summarizeLeague(site.matches, site.season.asOf);
  const official = report.standings.status === 'verified';
  const chelsea = official ? report.standings.rows.find(row=>row.isChelsea) : null;
  const summary = chelsea || snapshot.summary;
  const form = report.form?.length ? report.form : snapshot.form;
  const updated = report.updatedAt ? formatKickoff(report.updatedAt) + ' KST' : '자동 갱신 이력 없음';
  const injuryCount = injuries.status === 'verified' && injuries.complete ? injuries.current.length : null;
  const items = [['EPL 순위', chelsea?.rank, '공식 전체 순위 기준'], ['승점', summary?.points, official ? '공식 승점' : '저장된 결과로 계산 · 징계 조정 미반영'], ['승 / 무 / 패', summary ? `${summary.wins} / ${summary.draws} / ${summary.losses}` : null, `${summary?.played ?? '–'}경기 기준`], ['득점 / 실점', summary ? `${summary.goalsFor} / ${summary.goalsAgainst}` : null, 'PL 경기만 집계'], ['득실차', summary ? `${summary.goalDifference > 0 ? '+' : ''}${summary.goalDifference}` : null, '득점 – 실점'], ['클린시트', report.teamMetrics?.cleanSheets ?? (!official ? summary?.cleanSheets : null), '상대에게 실점하지 않은 경기'], ['팀 파울', report.teamMetrics?.fouls, '확인된 시즌 누계만 표시'], ['옐로카드', report.teamMetrics?.yellowCards, '확인된 시즌 누계만 표시'], ['레드카드', report.teamMetrics?.redCards, '확인된 시즌 누계만 표시'], ['현재 부상자', injuryCount, '현재 상태가 확인된 경우에만 집계']];
  return `<div class="container season-report"><header class="photo-hero season-report-hero">${photo(site.media.hero.image, site.media.hero.alt, true)}<div class="hero-copy"><p class="eyebrow">SEASON REPORT · ${e(report.season)}</p><h1>숫자로 읽는,<br>첼시의 시즌.</h1><p class="lede">경기에서 시즌으로. 순위와 최근 흐름, 선수 기록을 한곳에서 확인합니다.</p></div></header>
    <div class="report-status"><span class="report-status-dot" aria-hidden="true"></span><div><strong>${official ? '공급자 데이터 스냅샷' : '저장된 경기 결과 기반 리포트'}</strong><p>${official ? `데이터 갱신 ${e(updated)}` : `${e(site.season.checkedAt)} KST 자료 · PL 종료 ${snapshot.summary?.played ?? 0}경기 집계`}</p></div><span>${report.updateState === 'connected' ? 'API 연결됨 · 실시간 아님' : '자동 갱신 미연결'}</span></div>
    ${!official ? '<p class="notice">현재 EPL 순위와 전체 순위표는 공식 데이터 미확인입니다. 아래 경기 집계는 저장된 자료의 범위이며, 현재 리그 전체 통계나 실시간 순위를 뜻하지 않습니다.</p>' : ''}
    <section class="section season-summary">${heading('THE SEASON AT A GLANCE', '블루스의 시즌 지표')}<div class="season-metric-grid">${items.map(([label,value,note])=>`<article class="season-metric"><h3>${label}</h3><strong>${value === null || value === undefined ? '–' : e(value)}</strong><p>${value === null || value === undefined ? '정보 미확인' : e(note)}</p></article>`).join('')}</div></section>
    <section class="section season-form">${heading('LAST FIVE · OLDEST TO NEWEST', '최근 5경기 폼')}<p>PL 종료 경기 · 왼쪽부터 오래된 경기 → 최근 경기</p><div class="season-form-grid">${form.length ? form.slice(-5).map(item=>{
      const name = {W:'승리',D:'무승부',L:'패배'}[item.result];
      const content=`<span class="form-badge form-${e(item.result)}" aria-label="${name}">${e(item.result)}</span><strong>${e(item.opponent)}</strong><small>${e(item.date || '')}</small>`;
      return item.matchId ? `<a class="form-match" href="match.html?id=${encodeURIComponent(item.matchId)}">${content}</a>` : `<article class="form-match">${content}</article>`;
    }).join('') : '<p class="notice">최근 경기 정보 미확인</p>'}</div></section>
    <section class="section season-leaders">${heading('THE STANDARD SETTERS', '선수 시즌 리더보드')}<p class="lede">PL 기준 · ${stats.updatedAt ? `${e(formatKickoff(stats.updatedAt))} KST 확인` : '시즌 전체 선수 통계 미확인'}. 일부 경기 기록만으로 시즌 1위를 지정하지 않습니다.</p><div class="season-leader-grid">${Object.entries(metricNames).map(([key,label])=>{
      const leaders=findLeaders(stats,key);
      return `<section class="leader-category" data-leader="${key}"><h3>${label}${leaders.players.length>1 ? ` · 공동 ${leaders.players.length}명` : ''}</h3>${leaders.players.length ? leaders.players.map(player=>leaderCard(player,key==='rating'?leaders.value.toFixed(2):leaders.value,label,site,photo)).join('') : unknownLeader(label,leaders.state)}</section>`;
    }).join('')}</div><p class="source-note">최고 평점은 공급자가 제공한 시즌 평점 기준입니다. 공식 수상과 다릅니다.${stats.ratingSource ? ` 평점 출처: ${e(stats.ratingSource)}` : ''}</p></section>
    <section class="section season-injuries">${heading('SQUAD AVAILABILITY', '선수 가용 현황')}<div class="injury-columns"><section><h3>현재 부상 선수 <span>${shown(injuryCount)}</span></h3>${injuryCount === null ? '<p class="notice">현재 부상 현황 미확인. 과거 공지를 현재 상태로 간주하지 않습니다.</p>' : injuryCount===0 ? '<p class="notice">확인된 현재 부상 선수가 없습니다.</p>' : injuries.current.map(item=>leaderCard(item,item.reason || '부상 확인','현재 부상',site,photo)).join('')}</section><section><h3>장기 결장 선수</h3>${injuryCount === null || injuries.current.some(item=>item.longTerm == null) ? '<p class="notice">장기 결장 정보 미확인. 부상명이나 과거 경과만으로 결장 기간을 추정하지 않습니다.</p>' : injuries.current.filter(item=>item.longTerm === true).length ? injuries.current.filter(item=>item.longTerm === true).map(item=>leaderCard(item,item.returnDate || '복귀일 미정','장기 결장 확인',site,photo)).join('') : '<p class="notice">확인된 장기 결장 선수가 없습니다.</p>'}</section></div>${injuries.history.length ? `<details class="injury-history"><summary>과거 부상 공지 · 현재 상태와 별개</summary>${injuries.history.slice(0,8).map(item=>`<p>${e(identity(item,site).ko)} · ${e(item.reportedAt || '')} · ${e(item.reason || '')} ${item.source ? `<a href="${e(safeUrl(item.source))}" target="_blank" rel="noopener noreferrer">출처 ↗</a>` : ''}</p>`).join('')}</details>` : ''}</section>
    <section class="section season-standings" id="standings">${heading('PREMIER LEAGUE', 'EPL 전체 순위표')}<p class="lede">${official ? `${e(updated)} 스냅샷 · 승점은 공급자 공식 집계` : '전체 20팀의 순위가 확인되면 표시합니다. 팀 이름이나 순위를 임의로 채우지 않습니다.'}</p><div class="standings-scroll" tabindex="0" role="region" aria-label="EPL 순위표 · 작은 화면에서 좌우로 이동"><table class="standings-table"><caption>2026/27 Premier League · ${official ? '전체 순위' : '전체 순위 정보 미확인'}</caption><thead><tr><th scope="col">순위</th><th scope="col">팀</th><th scope="col">경기</th><th scope="col">승</th><th scope="col">무</th><th scope="col">패</th><th scope="col">득점</th><th scope="col">실점</th><th scope="col">득실차</th><th scope="col">승점</th></tr></thead><tbody>${official ? [...report.standings.rows].sort((a,b)=>a.rank-b.rank).map(row=>`<tr class="${row.isChelsea?'chelsea-standing':''}" ${row.isChelsea?'aria-label="Chelsea FC"':''}><th scope="row">${row.rank}</th><td>${e(row.name)}${row.isChelsea?'<small>CHELSEA FC</small>':''}</td><td>${row.played}</td><td>${row.wins}</td><td>${row.draws}</td><td>${row.losses}</td><td>${row.goalsFor}</td><td>${row.goalsAgainst}</td><td>${row.goalDifference>0?'+':''}${row.goalDifference}</td><td><strong>${row.points}</strong></td></tr>`).join('') : '<tr><td colspan="10" class="standings-empty">공식 EPL 전체 순위 데이터 미확인</td></tr>'}</tbody></table></div>${report.standings.source ? `<p class="source-note"><a href="${e(safeUrl(report.standings.source))}" target="_blank" rel="noopener noreferrer">순위 데이터 출처 ↗</a></p>` : ''}</section>
    <section class="report-data-note"><p class="eyebrow">DATA, WITH CONTEXT</p><h2>수치에는 기준일이 있습니다.</h2><p>경기 집계·공식 순위·선수 시즌 기록·현재 부상 상태는 서로 다른 자료입니다. 미확인은 0이 아닙니다. 자동 갱신이 연결되면 검증을 통과한 JSON 스냅샷으로 교체되며, 실패한 갱신은 기존 자료를 유지합니다.</p><small>최근 성공 갱신: ${e(updated)}</small></section></div>`;
}
