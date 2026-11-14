import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir, mkdtemp, readdir, unlink, rmdir } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { summarizeLeague, findLeaders, assertReportBundle, renderSeasonReport } from './season-report.js';
import { runUpdate, validateConfig, writeBundle } from '../scripts/update-chelsea-data.mjs';
import { normalizeApiFootball } from '../scripts/providers/api-football.mjs';

const read = name=>readFile(new URL(`../data/${name}.json`,import.meta.url),'utf8').then(JSON.parse);
const [site,report,stats,injuries]=await Promise.all(['site','season-report','player-stats','injuries'].map(read));
assertReportBundle(report,stats,injuries);
const summary=summarizeLeague(site.matches,site.season.asOf);
assert.equal(summary.summary.wins+summary.summary.draws+summary.summary.losses,summary.summary.played);
assert.equal(summary.summary.points,3*summary.summary.wins+summary.summary.draws);
assert.equal(summary.summary.goalDifference,summary.summary.goalsFor-summary.summary.goalsAgainst);
assert.ok(summary.form.length<=5);
assert.equal(summarizeLeague([],site.season.asOf).summary,null);
assert.deepEqual(summarizeLeague([{competition:'PL',status:'unknown',kickoff:'2026-01-01'}],site.season.asOf).form,[]);
assert.deepEqual(findLeaders({complete:false,players:[{goals:9}]},'goals').players,[]);
assert.equal(findLeaders({complete:true,players:[{goals:0}]},'goals').state,'zero');
assert.equal(findLeaders({complete:true,players:[{goals:1},{goals:null}]},'goals').state,'unverified');
assert.equal(findLeaders({complete:true,players:[{goals:2},{goals:2}]},'goals').players.length,2);
assert.equal(findLeaders({complete:true,players:[{appearances:1,rating:9,ratingSource:null}]},'rating').state,'unverified');
assert.throws(()=>assertReportBundle(report,{...stats,snapshotId:'mismatch'},injuries));
const helpers={photo:()=>'',heading:(_en,title)=>`<h2>${title}</h2>`};
const initial=renderSeasonReport(site,report,stats,injuries,helpers);
assert.ok(initial.includes('SEASON REPORT')&&initial.includes('EPL 전체 순위표'));
if(report.standings.status!=='verified')assert.ok(initial.includes('공식 EPL 전체 순위 데이터 미확인'));

let networkCalls=0;
const forbidden=()=>{networkCalls++;throw new Error('Unexpected network');};
assert.equal((await runUpdate({env:{},root:'missing-folder',fetchImpl:forbidden})).state,'skipped');
assert.equal((await runUpdate({env:{CHELSEA_DATA_UPDATES_ENABLED:'true'},root:'missing-folder',fetchImpl:forbidden})).state,'skipped');
assert.equal(networkCalls,0);
assert.throws(()=>validateConfig({leagueId:null}));

// Fictional provider fixtures are confined to temporary test storage; no API calls.
const config={provider:'api-football',leagueId:100,teamId:1,season:2026,playerIds:{'cole-palmer':11,'morgan-rogers':12},fixtureIds:{'pl-09':200},maxPlayerPages:3,maxLineupFixtures:3};
const league={id:100,season:2026};
const table=Array.from({length:20},(_,index)=>({team:{id:index+1,name:`TEST TEAM ${index+1}`},rank:index+1,all:{played:2,win:1,draw:0,lose:1,goals:{for:2,against:2}},points:3,goalsDiff:0}));
const fixture=(id,status,date)=>({fixture:{id,status:{short:status},date,venue:{name:'TEST STADIUM'}},league,teams:{home:{id:2,name:'TEST OPPONENT'},away:{id:1,name:'TEST CHELSEA'}},goals:{home:status==='FT'?1:null,away:status==='FT'?2:null}});
const players=[11,12].map((id,index)=>({player:{id,name:`TEST PLAYER ${id}`,photo:null},statistics:[{team:{id:1},league,games:{appearences:1,number:null,rating:index?'9.1':'8.4'},goals:{total:index?0:2,assists:index?2:1},cards:{yellow:index?0:1,red:0}}]}));
const raw={standings:[{league:{...league,standings:[table]}}],fixtures:[fixture(200,'FT','2026-11-01T14:00:00Z'),fixture(201,'NS','2026-12-01T14:00:00Z')],players,injuries:[{team:{id:1},player:{id:11,name:'TEST PLAYER',reason:'Test absence'},fixture:{date:'2026-10-01T00:00:00Z'}}],seasonStats:{team:{id:1},league,cards:{yellow:{a:{total:0},b:{total:1}},red:{a:{total:0}}},clean_sheet:{total:0}},lineups:[]};
const now=new Date('2026-11-14T00:00:00Z');
const bundle=normalizeApiFootball(raw,config,now);
assertReportBundle(bundle.report,bundle.stats,bundle.injuries);
assert.equal(bundle.injuries.status,'unverified');
assert.equal(bundle.injuries.current.length,0);
assert.equal(bundle.report.teamMetrics.fouls,null);
assert.equal(bundle.report.teamMetrics.cleanSheets,0);
assert.equal(bundle.report.teamMetrics.redCards,0);
assert.equal(bundle.feed.fixtures[0].matchId,'pl-09');
assert.equal(bundle.report.form[0].result,'W');
assert.equal(findLeaders(bundle.stats,'rating').players[0].playerId,'morgan-rogers');
const html=renderSeasonReport(site,bundle.report,bundle.stats,bundle.injuries,helpers);
assert.equal((html.match(/<tr class=/g)||[]).length,20);
assert.equal((html.match(/class="chelsea-standing"/g)||[]).length,1);
assert.ok(html.includes('平')===false&&html.includes('최고 평점'));
assert.throws(()=>assertReportBundle({...bundle.report,standings:{...bundle.report.standings,rows:table.slice(0,19)}},bundle.stats,bundle.injuries));
assert.throws(()=>normalizeApiFootball({...raw,players:[]},config,now));

const temp=await mkdtemp(path.join(os.tmpdir(),'chelsea-season-test-'));
const endpoints=[];
const fakeFetch=async(url,options)=>{
  assert.equal(options.headers['x-apisports-key'],'TEST-KEY-NOT-A-SECRET');
  const route=new URL(url).pathname;
  endpoints.push(route);
  const body=route==='/standings'?raw.standings:route==='/fixtures'?raw.fixtures:route==='/players'?raw.players:route==='/injuries'?raw.injuries:route==='/teams/statistics'?raw.seasonStats:[];
  return {ok:true,status:200,json:async()=>({response:body,errors:[],paging:{current:1,total:1}})};
};
try {
  await mkdir(path.join(temp,'data'));
  await writeFile(path.join(temp,'data/provider-config.json'),JSON.stringify(config));
  const enabled={CHELSEA_DATA_UPDATES_ENABLED:'true',API_FOOTBALL_KEY:'TEST-KEY-NOT-A-SECRET'};
  const dry=await runUpdate({env:enabled,root:temp,fetchImpl:fakeFetch,now,dryRun:true});
  assert.equal(dry.state,'validated');
  assert.deepEqual(await readdir(path.join(temp,'data')),['provider-config.json']);
  const result=await runUpdate({env:enabled,root:temp,fetchImpl:fakeFetch,now});
  assert.equal(result.state,'updated');
  for(const route of ['/standings','/fixtures','/players','/injuries','/teams/statistics','/fixtures/lineups'])assert.ok(endpoints.includes(route),route);
  const outputFile=path.join(temp,'data/season-report.json');
  const preserved=await readFile(outputFile,'utf8');
  await assert.rejects(runUpdate({env:enabled,root:temp,fetchImpl:async()=>({ok:false,status:429}),now}));
  assert.equal(await readFile(outputFile,'utf8'),preserved);
  const incomplete={...bundle,report:{...bundle.report,standings:{...bundle.report.standings,rows:[]}}};
  await assert.rejects(writeBundle(temp,incomplete));
  assert.equal(await readFile(outputFile,'utf8'),preserved);
  const outputText=(await Promise.all(result.files.map(file=>readFile(path.join(temp,file),'utf8')))).join('');
  assert.ok(!outputText.includes('TEST-KEY-NOT-A-SECRET'));
  assert.ok(!(await readdir(path.join(temp,'data'))).some(name=>name.includes('update-tmp')));
} finally {
  // Remove only files in this freshly created, verified temporary directory.
  assert.ok(path.resolve(temp).startsWith(path.resolve(os.tmpdir())+path.sep));
  for(const name of await readdir(path.join(temp,'data')))await unlink(path.join(temp,'data',name));
  await rmdir(path.join(temp,'data'));
  await rmdir(temp);
}
const workflow=await readFile(new URL('../.github/workflows/update-chelsea-data.yml',import.meta.url),'utf8');
assert.ok(workflow.includes("cron: '0 21 * * *'"));
assert.ok(workflow.includes("needs.configuration.outputs.ready == 'true'"));
assert.ok(workflow.includes('secrets.API_FOOTBALL_KEY')&&!workflow.includes('RESEND'));
console.log('PASS: PL scope/form, unknown values, leader ties/coverage, 20-team table, injury history, keyless no-call/no-write guard, six mocked API resources, dry run, validation and failure preservation');
