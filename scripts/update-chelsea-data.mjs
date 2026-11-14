import { readFile, writeFile, rename, unlink } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { collectApiFootball, normalizeApiFootball } from './providers/api-football.mjs';
import { assertReportBundle } from '../js/season-report.js';

const ROOT = fileURLToPath(new URL('../',import.meta.url));
const names = ['season-report.json','player-stats.json','injuries.json','football-feed.json'];

export function validateConfig(config) {
  for (const key of ['leagueId','teamId','season','maxPlayerPages','maxLineupFixtures']) if (!Number.isInteger(config[key]) || config[key]<1) throw new Error(`Configure a positive integer: ${key}`);
  if (config.maxPlayerPages>20 || config.maxLineupFixtures>10) throw new Error('Request limits are too large');
  for (const map of [config.playerIds,config.fixtureIds]) {
    if (!map || typeof map!=='object' || Array.isArray(map)) throw new Error('Invalid provider ID map');
    if (Object.entries(map).some(([key,value])=>!/^[a-z0-9-]+$/.test(key)||!Number.isInteger(value)||value<1) || new Set(Object.values(map)).size!==Object.values(map).length) throw new Error('Invalid or duplicate provider ID mapping');
  }
}

export async function writeBundle(root, bundle) {
  assertReportBundle(bundle.report,bundle.stats,bundle.injuries);
  const values=[bundle.report,bundle.stats,bundle.injuries,bundle.feed];
  const originals=new Map();
  const staged=[];
  const committed=[];
  try {
    for (let index=0;index<names.length;index++) {
      const target=path.join(root,'data',names[index]);
      originals.set(target,await readFile(target).catch(error=>{if(error.code==='ENOENT')return null;throw error;}));
      const temporary=target+'.update-tmp';
      staged.push({target,temporary});
      await writeFile(temporary,JSON.stringify(values[index],null,2)+'\n');
    }
    for (const {target,temporary} of staged) { await rename(temporary,target);committed.push(target); }
  } catch (error) {
    for (const target of committed) {
      const original=originals.get(target);
      if(original===null)await unlink(target).catch(()=>{});else await writeFile(target,original);
    }
    throw error;
  } finally { for(const {temporary}of staged)await unlink(temporary).catch(()=>{}); }
}

export async function runUpdate({env=process.env,root=ROOT,fetchImpl=fetch,now=new Date(),dryRun=false}={}) {
  // These guards run before any filesystem read/write or external request.
  if(env.CHELSEA_DATA_UPDATES_ENABLED!=='true')return {state:'skipped',reason:'Automatic updates are disabled.'};
  if(!env.API_FOOTBALL_KEY?.trim())return {state:'skipped',reason:'API_FOOTBALL_KEY is missing. No requests or writes performed.'};
  const config=JSON.parse(await readFile(path.join(root,'data/provider-config.json'),'utf8'));
  if(config.provider!=='api-football')throw new Error('Provider adapter is not implemented. Keep updates disabled until a normalized adapter is supplied.');
  config.leagueId=env.FOOTBALL_LEAGUE_ID?Number(env.FOOTBALL_LEAGUE_ID):config.leagueId;
  config.teamId=env.FOOTBALL_TEAM_ID?Number(env.FOOTBALL_TEAM_ID):config.teamId;
  validateConfig(config);
  const raw=await collectApiFootball(config,{key:env.API_FOOTBALL_KEY,fetchImpl,now});
  const bundle=normalizeApiFootball(raw,config,now);
  assertReportBundle(bundle.report,bundle.stats,bundle.injuries);
  if(!dryRun)await writeBundle(root,bundle);
  return {state:dryRun?'validated':'updated',snapshotId:bundle.report.snapshotId,files:names.map(name=>'data/'+name),fixtures:bundle.feed.fixtures.length,lineups:bundle.feed.lineups.length};
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  try { console.log(JSON.stringify(await runUpdate({dryRun:process.argv.includes('--dry-run')}))); }
  catch(error) { console.error(error.message);process.exitCode=1; }
}
