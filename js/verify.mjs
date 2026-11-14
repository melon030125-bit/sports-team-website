import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { dateParts, formatKickoff, getNextMatch, safeUrl, escapeHtml, matchOutcome, resultClass } from './utils.js';

const data = JSON.parse(await readFile(new URL('../data/site.json', import.meta.url), 'utf8'));
assert.equal(data.players.length, 30);
assert.equal(data.matches.filter(match => match.competition === 'PL').length, 38);
for (const collection of [data.players, data.matches, data.articles]) {
  assert.equal(new Set(collection.map(item => item.id)).size, collection.length);
  assert.ok(collection.every(item => item.source.startsWith('https://') && item.checkedAt));
}
for (const article of data.articles) {
  assert.ok(article.playerIds.every(id => data.players.some(player => player.id === id)));
  assert.ok(article.matchIds.every(id => data.matches.some(match => match.id === id)));
  assert.ok(article.keyPoints.length >= 3 && article.keyPoints.length <= 6);
  assert.ok(article.body.length >= 3 && article.background.length && article.fanPoints.length);
}
for (const [venue, homeScore, awayScore, expected] of [
  ['home', 4, 3, 'result-win'], ['away', 2, 3, 'result-win'],
  ['home', 0, 2, 'result-loss'], ['away', 1, 0, 'result-loss'],
  ['home', 2, 2, 'result-draw'], ['away', 0, 0, 'result-draw'],
]) assert.equal(resultClass({ status: 'finished', venue, homeScore, awayScore }), expected);
assert.equal(resultClass(data.matches.find(match => match.id === 'carabao-liverpool')), 'result-loss');
for (const item of [...data.players, ...data.articles]) {
  assert.ok(item.imageAlt && !item.imageAlt.includes('?'), `Invalid alt: ${item.id}`);
  await readFile(new URL(`../${item.image}`, import.meta.url));
}
assert.equal(formatKickoff('2026-11-21T15:00:00Z'), '2026.11.22 (일) 00:00');
assert.equal(dateParts('2027-04-10T14:00:00Z', 'Europe/London').hour, '15');
assert.equal(dateParts('2026-12-05T12:30:00Z', 'Europe/London').hour, '12');
assert.equal(dateParts(null), null);
assert.equal(getNextMatch(data.matches, data.season.asOf)?.opponent, '리즈 유나이티드');
assert.equal(getNextMatch(data.matches, '2030-01-01T00:00:00Z'), null);
assert.equal(safeUrl('javascript:alert(1)'), '#');
assert.equal(escapeHtml('<script>'), '&lt;script&gt;');
assert.equal(matchOutcome({ status: 'finished', venue: 'away', homeScore: 1, awayScore: 0 }), '패배');
for (const match of data.matches) {
  if (match.kickoff) {
    const parts = dateParts(match.kickoff);
    assert.equal(match.date, `${parts.year}-${parts.month}-${parts.day}`);
  }
  if (match.status === 'finished') assert.ok(Number.isInteger(match.homeScore) && Number.isInteger(match.awayScore));
}
const files = ['index', 'squad', 'matches', 'news', 'club', 'korean-guide', 'player', 'article', 'match', 'season-report'];
for (const file of files) {
  const html = await readFile(new URL(`../${file}.html`, import.meta.url), 'utf8');
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
  assert.equal(ids.length, new Set(ids).size, `${file}: duplicate IDs`);
  assert.ok(html.includes('lang="ko"') && html.includes('비공식'));
  assert.ok(html.includes('data-nav="season-report" href="season-report.html"'), `${file}: season report navigation`);
}
console.log('PASS: data, KST/BST/GMT, scores, IDs, URLs, HTML');
if (!process.argv.includes('--browser')) process.exit(0);

const base = 'http://127.0.0.1:8000';
const target = await (await fetch('http://127.0.0.1:9227/json/new?about:blank', { method: 'PUT' })).json();
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => { ws.addEventListener('open', resolve, { once: true }); ws.addEventListener('error', reject, { once: true }); });
let serial = 0;
const pending = new Map();
const runtimeErrors = [];
ws.addEventListener('message', event => {
  const message = JSON.parse(event.data);
  if (message.id && pending.has(message.id)) {
    const { resolve, reject, timer } = pending.get(message.id);
    clearTimeout(timer);
    pending.delete(message.id);
    if (message.error) reject(new Error(JSON.stringify(message.error))); else resolve(message.result);
  }
  if (message.method === 'Runtime.exceptionThrown') runtimeErrors.push(message.params.exceptionDetails.text);
});
function cdp(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++serial;
    const timer = setTimeout(() => { pending.delete(id); reject(new Error(`CDP timeout ${method}`)); }, 12000);
    pending.set(id, { resolve, reject, timer });
    ws.send(JSON.stringify({ id, method, params }));
  });
}
async function evaluate(expression) {
  const result = await cdp('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
  return result.result.value;
}
async function waitFor(expression) {
  for (let index = 0; index < 70; index++) {
    if (await evaluate(expression)) return;
    await new Promise(resolve => setTimeout(resolve, 80));
  }
  throw new Error(`DOM wait timeout: ${expression}`);
}
async function navigate(file) {
  await cdp('Page.navigate', { url: `${base}/${file}` });
  await waitFor(`location.pathname.endsWith('${file.split('?')[0]}') && document.readyState === 'complete' && document.querySelector('#main')?.getAttribute('aria-busy') !== 'true'`);
}
async function screenshot(name) {
  await evaluate(`document.querySelectorAll('img').forEach(image => { image.loading = 'eager'; })`);
  await evaluate('Promise.all([...document.images].map(image => image.decode().catch(() => {})))');
  await evaluate('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))');
  const result = await cdp('Page.captureScreenshot', { format: 'png' });
  const output = path.join(os.tmpdir(), `chelsea-${name}.png`);
  await writeFile(output, Buffer.from(result.data, 'base64'));
  console.log(`Screenshot: ${output}`);
}
try {
  await cdp('Page.enable');
  await cdp('Runtime.enable');
  const urls = ['index.html', 'squad.html', 'matches.html', 'news.html', 'club.html', 'korean-guide.html', 'player.html?id=cole-palmer', `article.html?id=${data.articles[0].id}`, 'article.html?id=sunderland-review', 'player.html?id=missing', 'article.html?id=missing', 'match.html?id=pl-10', 'match.html?id=pl-09', 'match.html?id=pl-11', 'match.html?id=pl-01', 'match.html?id=carabao-liverpool', 'match.html?id=missing', 'season-report.html'];
  for (const width of [1440, 701, 700, 699, 390, 320]) {
    await cdp('Emulation.setDeviceMetricsOverride', { width, height: width < 701 ? 844 : 1000, deviceScaleFactor: 1, mobile: false });
    for (const url of urls) {
      await navigate(url);
      assert.equal(await evaluate('document.documentElement.scrollWidth > innerWidth'), false, `${width}px overflow: ${url}`);
      assert.equal(await evaluate('document.querySelectorAll("main h1").length'), 1, url);
      await evaluate(`document.querySelectorAll('img').forEach(image => { image.loading = 'eager'; })`);
      await waitFor('[...document.images].every(image => image.complete)');
      assert.ok(await evaluate('[...document.images].every(image => image.naturalWidth > 0)'), `${width}px broken image: ${url}`);
      assert.ok(await evaluate('!!document.querySelector(".brand[href=\\"index.html\\"] .crest-image")'));
      assert.equal(await evaluate('new Set([...document.querySelectorAll("[id]")].map(element=>element.id)).size === document.querySelectorAll("[id]").length'), true, url);
      if (['squad.html', 'matches.html', 'news.html', 'club.html', 'korean-guide.html'].includes(url)) {
        assert.ok(await evaluate('!!document.querySelector(".page-intro.photo-hero img")'), url);
      }
      if ((width === 1440 || width === 390) && ['matches.html', 'player.html?id=cole-palmer', 'article.html?id=sunderland-review', 'squad.html'].includes(url)) await screenshot(`${url.split('.')[0]}-${width}`);
      if ((width === 1440 || width === 390) && url === 'matches.html') {
        await evaluate(`document.querySelector('#matches-form').scrollIntoView({behavior:'instant'})`);
        await screenshot(`matches-list-${width}`);
      }
      if ((width === 1440 || width === 390) && url === 'match.html?id=pl-10') {
        await screenshot(`match-detail-${width}`);
        await evaluate(`document.querySelector('#formation').scrollIntoView({behavior:'instant'})`);
        await screenshot(`match-pitch-${width}`);
        await evaluate(`document.querySelector('#player-ratings').scrollIntoView({behavior:'instant'})`);
        await screenshot(`match-performance-${width}`);
      }
      if ((width === 1440 || width === 390) && url === 'season-report.html') await screenshot(`season-report-${width}`);
    }
    await navigate('index.html');
    console.log(`PASS: ${width}px · ${urls.length} routes · no overflow or broken images`);
    if (width === 1440 || width === 390) {
      console.log(`Home geometry ${width}:`, await evaluate(`JSON.stringify(Object.fromEntries(['.next-match','.result-card','.season-card','.quick-players','.headline-bar'].map(selector=>[selector,Math.round(document.querySelector(selector).getBoundingClientRect().bottom)])))`));
      await screenshot(`home-${width}`);
    }
  }
  await cdp('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: false });
  await navigate('squad.html');
  assert.equal(await evaluate('document.querySelectorAll("#squad-results .player-card").length'), 30);
  await evaluate(`document.querySelector('[name=query]').value='palmer';document.querySelector('[name=query]').dispatchEvent(new Event('input',{bubbles:true}))`);
  assert.equal(await evaluate('document.querySelectorAll("#squad-results .player-card").length'), 1);
  await evaluate(`document.querySelector('[name=query]').value='존재하지않는선수';document.querySelector('[name=query]').dispatchEvent(new Event('input',{bubbles:true}))`);
  assert.ok(await evaluate('!!document.querySelector("#squad-results .empty-state")'));
  await evaluate(`document.querySelector('#squad-form').reset()`);
  await waitFor('document.querySelectorAll("#squad-results .player-card").length===30');
  await evaluate(`document.querySelector('[name=group]').value='GK';document.querySelector('[name=group]').dispatchEvent(new Event('input',{bubbles:true}))`);
  assert.equal(await evaluate('document.querySelectorAll("#squad-results .player-card").length'), 4);
  await evaluate(`document.querySelector('.menu-toggle').click()`);
  assert.equal(await evaluate('document.querySelector(".menu-toggle").getAttribute("aria-expanded")'), 'true');
  await cdp('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
  assert.equal(await evaluate('document.querySelector(".menu-toggle").getAttribute("aria-expanded")'), 'false');
  assert.ok(await evaluate('document.activeElement===document.querySelector(".menu-toggle")'));
  await navigate('matches.html');
  const resultPresentation = await evaluate(`JSON.stringify([...document.querySelectorAll('.fixture-row')].map(row => ({
    id: row.dataset.matchId,
    venue: row.querySelector('.venue-badge').classList.contains('venue-home') ? 'home' : 'away',
    badgeColor: getComputedStyle(row.querySelector('.venue-badge')).backgroundColor,
    chelsea: row.querySelector('.chelsea-score')?.textContent,
    chelseaColor: row.querySelector('.chelsea-score') ? getComputedStyle(row.querySelector('.chelsea-score')).color : null,
    opponentColor: row.querySelector('.opponent-score') ? getComputedStyle(row.querySelector('.opponent-score')).color : null,
    outcome: row.querySelector('.match-outcome')?.textContent,
    outcomeClass: row.querySelector('.match-outcome')?.className,
    outcomeColor: row.querySelector('.match-outcome') ? getComputedStyle(row.querySelector('.match-outcome')).color : null
  })))`);
  const rows = JSON.parse(resultPresentation);
  for (const row of rows) {
    const match = data.matches.find(item => item.id === row.id);
    assert.equal(row.venue, match.venue);
    if (match.status !== 'finished') continue;
    assert.equal(row.chelsea, String(match.venue === 'home' ? match.homeScore : match.awayScore));
    assert.notEqual(row.chelseaColor, row.opponentColor);
    assert.equal(row.chelseaColor, 'rgb(3, 70, 148)');
    assert.ok(row.outcomeClass.includes(resultClass(match)));
  }
  assert.notEqual(rows.find(row=>row.venue==='home').badgeColor, rows.find(row=>row.venue==='away').badgeColor);
  const resultColors = ['result-win', 'result-loss', 'result-draw'].map(name=>rows.find(row=>row.outcomeClass?.includes(name)).outcomeColor);
  assert.equal(new Set(resultColors).size, 3);
  console.log('PASS: Home/Away badges, Chelsea score on both sides, win/loss/draw colors, penalty loss');
  assert.ok(await evaluate(`[...document.querySelectorAll('#match-results .fixture-row')].every(row => row.querySelector('.fixture-detail-link').getAttribute('href') === 'match.html?id=' + encodeURIComponent(row.dataset.matchId))`));
  assert.equal(await evaluate('document.querySelectorAll("#match-results .fixture-row").length'), data.matches.length);
  await evaluate(`document.querySelector('[name=status]').value='finished';document.querySelector('[name=status]').dispatchEvent(new Event('change',{bubbles:true}))`);
  assert.equal(await evaluate('document.querySelectorAll("#match-results .fixture-row").length'), data.matches.filter(match => match.status === 'finished').length);
  await evaluate(`document.querySelector('[name=venue]').value='away';document.querySelector('[name=venue]').dispatchEvent(new Event('change',{bubbles:true}))`);
  assert.equal(await evaluate('document.querySelectorAll("#match-results .fixture-row").length'), data.matches.filter(match => match.status === 'finished' && match.venue === 'away').length);
  await evaluate(`document.querySelector('#matches-form').reset()`);
  await waitFor(`document.querySelectorAll('#match-results .fixture-row').length===${data.matches.length}`);
  await evaluate(`document.querySelector('[name=month]').value='unknown-date';document.querySelector('[name=month]').dispatchEvent(new Event('change',{bubbles:true}))`);
  assert.equal(await evaluate('document.querySelectorAll("#match-results .fixture-row").length'), 1);
  assert.ok(await evaluate('document.querySelector("#match-results").innerText.includes("한국 날짜·시간 미정")'));
  await navigate('news.html');
  await evaluate(`document.querySelector('[name=category]').value=${JSON.stringify(data.articles[0].category)};document.querySelector('[name=category]').dispatchEvent(new Event('input',{bubbles:true}))`);
  assert.equal(await evaluate('document.querySelectorAll("#news-results .news-card").length'), data.articles.filter(article=>article.category===data.articles[0].category).length);
  await evaluate(`document.querySelector('#news-form').reset()`);
  await waitFor(`document.querySelectorAll('#news-results .news-card').length===${data.articles.length}`);
  await evaluate(`document.querySelector('[name=query]').value='펜더르스';document.querySelector('[name=query]').dispatchEvent(new Event('input',{bubbles:true}))`);
  assert.ok(await evaluate('document.querySelectorAll("#news-results .news-card").length>0'));
  await evaluate(`document.querySelector('[name=query]').value='없는뉴스문자열';document.querySelector('[name=query]').dispatchEvent(new Event('input',{bubbles:true}))`);
  assert.ok(await evaluate('!!document.querySelector("#news-results .empty-state")'));
  for (const article of data.articles) {
    await navigate(`article.html?id=${article.id}`);
    assert.equal(await evaluate('document.querySelectorAll(".story-takeaways li").length'), article.keyPoints.length);
    assert.equal(await evaluate('document.querySelectorAll(".related-matches .fixture-row").length'), article.matchIds.length);
    assert.ok(await evaluate('!!document.querySelector(".fan-points") && !!document.querySelector(".story-background")'));
  }
  await navigate('squad.html');
  await evaluate(`document.querySelector('.player-visual img').dispatchEvent(new Event('error'))`);
  assert.ok(await evaluate(`document.querySelector('.player-visual img').hidden && document.querySelector('.player-visual').classList.contains('image-unavailable')`));
  await evaluate(`document.querySelector('.crest-image').dispatchEvent(new Event('error'))`);
  assert.ok(await evaluate(`document.querySelector('.crest-image').hidden && getComputedStyle(document.querySelector('.crest-fallback')).visibility === 'visible'`));
  console.log('PASS: seven expanded stories, related matches, photo and crest fallbacks');
  for (const width of [1440, 390]) {
    await cdp('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: false });
    for (const match of data.matches) {
      await navigate(`match.html?id=${match.id}`);
      assert.ok(await evaluate('!!document.querySelector(".match-detail")'), match.id);
      assert.equal(await evaluate('document.documentElement.scrollWidth > innerWidth'), false, `${width}: ${match.id}`);
      assert.equal(await evaluate('document.querySelectorAll("#starting-xi .lineup-player").length'), match.startingXI.length);
      assert.equal(await evaluate('document.querySelectorAll("#bench .lineup-player").length'), match.bench.length);
      assert.equal(await evaluate('document.querySelectorAll(".pitch-player").length'), match.formation ? 11 : 0);
      assert.equal(await evaluate('document.querySelectorAll(".performance-card").length'), match.playerPerformances.length);
      assert.equal(await evaluate('document.querySelectorAll(".match-stat-row").length'), 6);
      assert.ok(await evaluate('!!document.querySelector("#comment-form")'));
      if (match.status === 'finished') {
        assert.equal(await evaluate('document.querySelector(".match-detail-score .chelsea-score").textContent'), String(match.venue === 'home' ? match.homeScore : match.awayScore));
      }
    }
    console.log(`PASS: all 41 match details at ${width}px, XI/bench/pitch/performance/stat states`);
  }
  await navigate('match.html?id=pl-10');
  await evaluate(`document.querySelector('.pitch-player').click()`);
  assert.ok(await evaluate('location.hash.startsWith("#performance-")'));
  const commentKey = 'chelsea:match-comments:v1:pl-10';
  const previousComments = await evaluate(`localStorage.getItem(${JSON.stringify(commentKey)})`);
  try {
    await evaluate(`localStorage.removeItem(${JSON.stringify(commentKey)})`);
    await navigate('match.html?id=pl-10');
    await evaluate(`document.querySelector('#comment-nickname').value='<b>팬</b>';document.querySelector('#comment-body').value=${JSON.stringify('<script>window.__commentXss=1</script>\n경기 후기')};document.querySelector('#comment-form').requestSubmit()`);
    await waitFor('document.querySelectorAll(".fan-comment").length === 1');
    assert.ok(await evaluate(`document.querySelector('.fan-comment p').textContent.includes('<script>') && !document.querySelector('.fan-comment script') && !window.__commentXss`));
    await navigate('match.html?id=pl-10');
    await waitFor('document.querySelectorAll(".fan-comment").length === 1');
    await navigate('match.html?id=pl-11');
    assert.ok(await evaluate(`![...document.querySelectorAll('.fan-comment p')].some(item=>item.textContent.includes('경기 후기'))`));
    await navigate('match.html?id=pl-10');
    await evaluate(`window.__originalSetItem=Storage.prototype.setItem;Storage.prototype.setItem=()=>{throw new DOMException('quota','QuotaExceededError')};document.querySelector('#comment-body').value='저장 실패 확인';document.querySelector('#comment-nickname').value='팬';document.querySelector('#comment-form').requestSubmit()`);
    await waitFor(`document.querySelector('#comment-status').textContent.includes('저장하지 못했습니다')`);
    assert.equal(await evaluate('document.querySelector("#comment-body").value'), '저장 실패 확인');
    assert.equal(await evaluate('document.querySelectorAll(".fan-comment").length'), 1);
    await evaluate('Storage.prototype.setItem=window.__originalSetItem');
  } finally {
    await evaluate(`if(window.__originalSetItem) Storage.prototype.setItem=window.__originalSetItem;${previousComments === null ? `localStorage.removeItem(${JSON.stringify(commentKey)})` : `localStorage.setItem(${JSON.stringify(commentKey)},${JSON.stringify(previousComments)})`}`);
  }
  console.log('PASS: pitch-to-performance links, safe comments, persistence, match isolation and write failure');
  // Ratings are synthetic test fixtures in this tab only; source files stay unmodified.
  await navigate('match.html?id=pl-10');
  await evaluate(`(async()=>{
    const module=await import('./js/match.js');
    const snapshot=await(await fetch('./data/site.json')).json();
    const match=structuredClone(snapshot.matches.find(item=>item.id==='pl-10'));
    match.id='qa-ratings';
    match.playerPerformances[0].rating=8.4;match.playerPerformances[0].ratingSource='TEST FIXTURE';
    match.playerPerformances[1].rating=9.1;match.playerPerformances[1].ratingSource='TEST FIXTURE';
    match.playerPerformances[2].rating=9.1;match.playerPerformances[2].ratingSource='TEST FIXTURE';
    Object.assign(match.playerPerformances[1],{minutesPlayed:70,goals:1,assists:1,yellowCards:1,redCards:1});
    match.stats.possession={home:0,away:100};
    const helpers={photo:()=>'',venueBadge:()=>'',scoreline:()=>'',outcomeBadge:()=>'',source:()=>'',heading:(_en,title)=>'<h2>'+title+'</h2>',newsCard:()=>''};
    document.querySelector('#main').innerHTML=module.renderMatch(match,snapshot,helpers);module.mountMatch(match,snapshot,helpers);
  })()`);
  assert.equal(await evaluate('document.querySelectorAll(".pitch-player.top-rated").length'), 2);
  assert.equal(await evaluate('document.querySelectorAll(".performance-card.top-rated").length'), 2);
  assert.ok(await evaluate(`document.querySelector('.pitch-player.top-rated .pitch-contributions').textContent.includes('도움 1') && !!document.querySelector('.pitch-player.top-rated .red-card')`));
  assert.ok(await evaluate(`document.querySelector('.match-stat-row').textContent.includes('0%')`));
  assert.ok(await evaluate(`document.querySelector('.player-of-match h3').textContent==='최고 평점 선수' && document.querySelector('.rating-sources').textContent.includes('TEST FIXTURE')`));
  await evaluate(`document.querySelector('#rating-sort').value='rating';document.querySelector('#rating-sort').dispatchEvent(new Event('change'))`);
  assert.equal(await evaluate('document.querySelector(".performance-card").id'), 'performance-marco-palestra');
  assert.equal(await evaluate('document.documentElement.scrollWidth > innerWidth'), false);
  await navigate('match.html?id=pl-10');
  assert.ok(await evaluate('!document.querySelector(".rating-sources") && !!document.querySelector(".rating-unconfirmed")'));
  console.log('PASS: synthetic rating sort/ties/provenance and unmodified real match ratings');
  for (const width of [1050, 1100]) {
    await cdp('Emulation.setDeviceMetricsOverride', {width,height:1000,deviceScaleFactor:1,mobile:false});
    await navigate('season-report.html');
    assert.equal(await evaluate('document.documentElement.scrollWidth > innerWidth'),false,`season report nav at ${width}`);
  }
  await cdp('Emulation.setDeviceMetricsOverride', {width:390,height:844,deviceScaleFactor:1,mobile:false});
  await navigate('season-report.html');
  assert.equal(await evaluate('document.querySelectorAll(".season-metric").length'),10);
  assert.equal(await evaluate('document.querySelectorAll(".form-match").length'),5);
  assert.ok(await evaluate('!!document.querySelector(".standings-empty") && document.querySelector(".season-injuries").textContent.includes("현재 부상 현황 미확인")'));
  await evaluate(`(async()=>{
    const module=await import('./js/season-report.js');
    const site=await(await fetch('./data/site.json')).json();
    const meta={schemaVersion:1,snapshotId:'TEST-FIXTURE',season:'2026/27',updatedAt:'2026-11-14T00:00:00Z'};
    const rows=Array.from({length:20},(_,i)=>({teamId:i+1,name:'TEST TEAM '+(i+1),rank:i+1,played:1,wins:1,draws:0,losses:0,goalsFor:1,goalsAgainst:0,goalDifference:1,points:3,isChelsea:i===4}));
    const report={...meta,updateState:'connected',standings:{status:'verified',rows},teamMetrics:{cleanSheets:0,fouls:null,yellowCards:0,redCards:0},form:[{result:'D',opponent:'TEST TEAM',date:'2026-11-13'}]};
    const stats={...meta,complete:true,ratingSource:'TEST FIXTURE',players:['cole-palmer','morgan-rogers'].map((playerId,i)=>({playerId,goals:2,assists:1,appearances:1,rating:8.4,ratingSource:'TEST FIXTURE',yellowCards:0,redCards:0}))};
    const injuries={...meta,status:'verified',complete:true,current:[{playerId:'reece-james',reason:'TEST FIXTURE ONLY',longTerm:true}],history:[]};
    const helpers={photo:(url,alt)=>url?'<img class="editorial-image" src="'+url+'" alt="test fixture photo" loading="eager">':'',heading:(_en,title)=>'<h2>'+title+'</h2>'};
    document.querySelector('#main').innerHTML=module.renderSeasonReport(site,report,stats,injuries,helpers);
  })()`);
  assert.equal(await evaluate('document.querySelectorAll(".standings-table tbody tr").length'),20);
  assert.equal(await evaluate('getComputedStyle(document.querySelector(".chelsea-standing")).backgroundColor'),'rgb(3, 70, 148)');
  assert.equal(await evaluate('document.querySelectorAll("[data-leader=goals] .season-leader-card").length'),2);
  assert.ok(await evaluate('document.querySelector(".season-injuries").textContent.includes("TEST FIXTURE ONLY")'));
  assert.equal(await evaluate('document.documentElement.scrollWidth > innerWidth'),false);
  await screenshot('season-report-verified-fixture-390');
  await navigate('season-report.html');
  assert.ok(await evaluate('!!document.querySelector(".standings-empty")'));
  console.log('PASS: season report navigation, snapshot scope, unknown injuries/leaders, 20-team synthetic table, Chelsea highlight, ties, photos and 390px layout');
  assert.deepEqual(runtimeErrors, []);
  console.log('PASS: search, position filters, combined match filters, reset, unknown date, mobile menu, Escape focus, missing IDs, browser exceptions');
} finally {
  await cdp('Page.close').catch(() => {});
  ws.close();
}
