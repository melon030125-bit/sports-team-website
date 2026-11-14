import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { formationRows, highestRated, sortPerformances, hasRating, renderMatch } from './match.js';
import { createLocalCommentStore, validateComment } from './comment-store.js';

const data = JSON.parse(await readFile(new URL('../data/site.json', import.meta.url), 'utf8'));
const playerIds = new Set(data.players.map(player => player.id));
const fields = ['starter', 'position', 'shirtNumber', 'minutesPlayed', 'goals', 'assists', 'yellowCards', 'redCards', 'rating', 'ratingSource', 'substitutedIn', 'substitutedOut'];
for (const match of data.matches) {
  assert.ok(Array.isArray(match.startingXI) && Array.isArray(match.bench) && Array.isArray(match.events));
  const squad = [...match.startingXI, ...match.bench];
  assert.equal(new Set(squad).size, squad.length, `${match.id}: duplicate squad member`);
  assert.ok(squad.every(id => playerIds.has(id)));
  if (match.startingXI.length) {
    assert.equal(match.startingXI.length, 11);
    assert.equal(match.bench.length, 9);
    assert.ok(match.lineupSource?.startsWith('https://www.chelseafc.com/') && match.detailsCheckedAt);
  }
  if (match.formation) assert.ok(formationRows(match), match.id);
  const appeared = new Set(match.playerPerformances.map(entry => entry.playerId));
  if (match.lineupStatus === 'confirmed') assert.ok(match.bench.every(id=>appeared.has(id)||match.unusedSubstitutes.includes(id)));
  for (const entry of match.playerPerformances) {
    assert.ok(fields.every(field => Object.hasOwn(entry, field)));
    assert.ok(squad.includes(entry.playerId));
    assert.equal(entry.starter, match.startingXI.includes(entry.playerId));
    for (const key of ['minutesPlayed', 'goals', 'assists', 'yellowCards', 'redCards']) assert.ok(entry[key] === null || (Number.isInteger(entry[key]) && entry[key] >= 0));
    if (entry.rating !== null) assert.ok(hasRating(entry));
    if (entry.substitutedIn) {
      assert.ok(!entry.starter && match.bench.includes(entry.playerId));
      const outgoing = match.playerPerformances.find(item=>item.playerId===entry.substitutedIn.playerId);
      assert.equal(outgoing.substitutedOut.playerId, entry.playerId);
      assert.equal(outgoing.substitutedOut.minute, entry.substitutedIn.minute);
    }
  }
  assert.ok(match.startingXI.every(id=>appeared.has(id)));
  for (const event of match.events) {
    if (event.team !== 'chelsea') continue;
    assert.ok(appeared.has(event.playerId));
    if (event.type === 'goal') assert.ok(match.playerPerformances.find(item=>item.playerId===event.playerId).goals >= 1);
    if (event.type === 'yellow') assert.ok(match.playerPerformances.find(item=>item.playerId===event.playerId).yellowCards >= 1);
    if (event.type === 'substitution') assert.ok(appeared.has(event.relatedPlayerId));
  }
  assert.ok(['possession', 'shots', 'shotsOnTarget', 'corners', 'fouls', 'offsides'].every(key=>Object.hasOwn(match.stats,key)));
}
// Synthetic ratings and shape exercise supported states without publishing invented real data.
const ratings = [
  { playerId: 'a', starter: true, rating: null, ratingSource: null },
  { playerId: 'b', starter: false, rating: 8.4, ratingSource: 'TEST FIXTURE' },
  { playerId: 'c', starter: true, rating: 9.1, ratingSource: 'TEST FIXTURE' },
  { playerId: 'd', starter: true, rating: 9.1, ratingSource: 'TEST FIXTURE' },
  { playerId: 'e', starter: true, rating: 9.9, ratingSource: null },
];
assert.deepEqual(sortPerformances(ratings, 'rating').map(item=>item.playerId), ['c', 'd', 'b', 'a', 'e']);
assert.deepEqual(highestRated(ratings).map(item=>item.playerId), ['c', 'd']);
assert.deepEqual(highestRated([]), []);
assert.equal(hasRating({rating: 10.1, ratingSource:'TEST'}), false);
assert.equal(hasRating({rating: '8.4', ratingSource:'TEST'}), false);
const ids = Array.from({length:11}, (_,index)=>`test-${index}`);
const shape = {startingXI:ids,formation:{name:'4-2-3-1',rows:[ids.slice(0,1),ids.slice(1,5),ids.slice(5,7),ids.slice(7,10),ids.slice(10)]}};
assert.equal(formationRows(shape).flat().length, 11);
assert.equal(formationRows({...shape,startingXI:ids.slice(1)}), null);
assert.equal(formationRows({...shape,formation:{...shape.formation,name:'4-4-2'}}), null);
const original = data.matches.find(match=>match.id==='pl-10');
const helpers = {photo:()=>'',venueBadge:()=>'',scoreline:()=>'',outcomeBadge:()=>'',source:()=>'',heading:(_en,title)=>`<h2>${title}</h2>`,newsCard:()=>''};
const rendered = renderMatch(original, data, helpers);
assert.ok(rendered.includes('선수 평점 정보 미확인') && !rendered.includes('NaN'));
assert.equal((rendered.match(/class="pitch-player/g)||[]).length, 11);
assert.ok(rendered.includes('엔트리 미확인') === false);
const upcoming = renderMatch(data.matches.find(match=>match.id==='pl-11'), data, helpers);
assert.ok(upcoming.includes('선발 발표 전') && upcoming.includes('엔트리 미확인'));
assert.ok(!upcoming.includes('id="player-ratings"'));

const memory = new Map();
const storage = {getItem:key=>memory.get(key) ?? null,setItem:(key,value)=>memory.set(key,value)};
const repository = createLocalCommentStore(()=>storage);
assert.deepEqual(await repository.list('pl-10'), []);
const content = {nickname:'<b>fan</b>', body:'<script>alert(1)</script>\nA match comment'};
await repository.add('pl-10', content);
assert.equal((await repository.list('pl-10'))[0].body, content.body);
assert.deepEqual(await repository.list('pl-11'), []);
assert.throws(()=>validateComment({nickname:' ',body:'text'}));
assert.throws(()=>validateComment({nickname:'fan',body:' '.repeat(10)}));
assert.throws(()=>validateComment({nickname:'fan',body:'x'.repeat(2001)}));
memory.set(repository.storageKey('pl-10'), '{invalid');
await assert.rejects(repository.add('pl-10', content));
assert.equal(memory.get(repository.storageKey('pl-10')), '{invalid');
const denied = createLocalCommentStore(()=>{throw new Error('denied');});
await assert.rejects(denied.list('pl-10'));
const quota = createLocalCommentStore(()=>({getItem:()=>null,setItem:()=>{throw new Error('quota');}}));
await assert.rejects(quota.add('pl-10', content));
console.log('PASS: 41 match schemas, verified squads, formations, substitution links, missing values, rating ties/order/provenance, comment validation/isolation/storage failures');
