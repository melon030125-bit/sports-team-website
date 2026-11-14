const BASE = 'https://v3.football.api-sports.io/';
export const PROVIDER_SOURCE = 'https://www.api-football.com/documentation-v3';
const numeric = value => value === null || value === undefined || value === '' ? null : Number.isFinite(Number(value)) ? Number(value) : null;
const localId = (map, providerId) => Object.keys(map).find(id=>String(map[id]) === String(providerId)) || null;

export async function collectApiFootball(config, { key, fetchImpl = fetch, now = new Date() }) {
  const request = async (endpoint, parameters) => {
    const url = new URL(endpoint, BASE);
    Object.entries(parameters).forEach(([name,value])=>url.searchParams.set(name,String(value)));
    let response;
    try { response = await fetchImpl(url, { headers: { 'x-apisports-key': key }, signal: AbortSignal.timeout(20000) }); }
    catch { throw new Error(`Provider request failed: ${endpoint}`); }
    if (!response.ok) throw new Error(`Provider HTTP ${response.status}: ${endpoint}`);
    const body = await response.json();
    if (!body || (body.errors && Object.keys(body.errors).length) || !Object.hasOwn(body,'response')) throw new Error(`Provider returned invalid data: ${endpoint}`);
    return body;
  };
  const paged = async endpoint => {
    let results = [];
    for (let page = 1; page <= config.maxPlayerPages; page++) {
      const body = await request(endpoint,{league:config.leagueId,season:config.season,team:config.teamId,page});
      if (!Array.isArray(body.response)) throw new Error(`Invalid ${endpoint} page`);
      results.push(...body.response);
      const total = Number(body.paging?.total || 1);
      if (page >= total) return results;
    }
    throw new Error(`Pagination limit exceeded: ${endpoint}`);
  };
  const [standings, fixtures, players, injuries, seasonStats] = await Promise.all([
    request('standings',{league:config.leagueId,season:config.season}),
    request('fixtures',{league:config.leagueId,season:config.season,team:config.teamId}),
    paged('players'),
    request('injuries',{league:config.leagueId,season:config.season,team:config.teamId}),
    request('teams/statistics',{league:config.leagueId,season:config.season,team:config.teamId}),
  ]);
  if (!Array.isArray(fixtures.response) || !fixtures.response.length || !Array.isArray(injuries.response)) throw new Error('Missing fixture/injury response');
  const completed = fixtures.response.filter(row=>['FT','AET','PEN'].includes(row.fixture?.status?.short)).sort((a,b)=>Date.parse(b.fixture.date)-Date.parse(a.fixture.date));
  const next = fixtures.response.filter(row=>row.fixture?.status?.short==='NS' && Date.parse(row.fixture.date)>now.getTime()).sort((a,b)=>Date.parse(a.fixture.date)-Date.parse(b.fixture.date))[0];
  const selected = [...(next?[next]:[]), ...completed].slice(0,config.maxLineupFixtures);
  const lineups = await Promise.all(selected.map(async row=>{
    const body=await request('fixtures/lineups',{fixture:row.fixture.id,team:config.teamId});
    if(!Array.isArray(body.response))throw new Error('Invalid lineups response');
    return {fixtureId:row.fixture.id,rows:body.response};
  }));
  return {standings:standings.response,fixtures:fixtures.response,players,injuries:injuries.response,seasonStats:seasonStats.response,lineups};
}

export function normalizeApiFootball(raw, config, now = new Date()) {
  const updatedAt = now.toISOString();
  const snapshotId = `api-football-${updatedAt}`;
  const season = `${config.season}/${String(config.season+1).slice(-2)}`;
  const meta = {schemaVersion:1,snapshotId,season,updatedAt};
  const league = raw.standings?.find(item=>Number(item.league?.id)===config.leagueId)?.league;
  if (!league || Number(league.season)!==config.season || league.standings?.length!==1) throw new Error('Unexpected league/season standings');
  const rows = league.standings[0].map(row=>({teamId:row.team.id,name:row.team.name,rank:row.rank,played:row.all.played,wins:row.all.win,draws:row.all.draw,losses:row.all.lose,points:row.points,goalsFor:row.all.goals.for,goalsAgainst:row.all.goals.against,goalDifference:row.goalsDiff,isChelsea:Number(row.team.id)===config.teamId}));
  if (rows.filter(row=>row.isChelsea).length!==1) throw new Error('Chelsea missing from league table');
  const fixtures = raw.fixtures.map(row=>{
    if (Number(row.league?.id)!==config.leagueId || Number(row.league?.season)!==config.season || ![Number(row.teams.home.id),Number(row.teams.away.id)].includes(config.teamId)) throw new Error('Fixture outside selected scope');
    const home = Number(row.teams.home.id)===config.teamId;
    return {providerId:row.fixture.id,matchId:localId(config.fixtureIds,row.fixture.id),opponent:home?row.teams.away.name:row.teams.home.name,venue:home?'home':'away',competition:'PL',kickoff:['TBD','PST','CANC'].includes(row.fixture.status.short)?null:row.fixture.date,date:row.fixture.date?.slice(0,10),stadium:row.fixture.venue?.name||null,status:['FT','AET','PEN'].includes(row.fixture.status.short)?'finished':row.fixture.status.short==='NS'?'scheduled':row.fixture.status.short==='PST'?'postponed':'unknown',homeScore:numeric(row.goals?.home),awayScore:numeric(row.goals?.away),source:PROVIDER_SOURCE};
  });
  const form = fixtures.filter(row=>row.status==='finished'&&row.homeScore!==null&&row.awayScore!==null&&Date.parse(row.kickoff)<=now.getTime()).sort((a,b)=>Date.parse(a.kickoff)-Date.parse(b.kickoff)).slice(-5).map(row=>{
    const own=row.venue==='home'?row.homeScore:row.awayScore;
    const other=row.venue==='home'?row.awayScore:row.homeScore;
    return {...row,result:own>other?'W':own<other?'L':'D',date:new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(row.kickoff))};
  });
  const playerStats = raw.players.map(row=>{
    const stat=row.statistics?.find(item=>Number(item.team?.id)===config.teamId&&Number(item.league?.id)===config.leagueId&&Number(item.league?.season)===config.season);
    if (!stat) throw new Error('Player statistics outside selected scope');
    return {playerId:localId(config.playerIds,row.player.id),providerId:row.player.id,en:row.player.name,ko:null,number:numeric(stat.games?.number),image:row.player.photo||null,appearances:numeric(stat.games?.appearences),goals:numeric(stat.goals?.total),assists:numeric(stat.goals?.assists),rating:numeric(stat.games?.rating),ratingSource:PROVIDER_SOURCE,yellowCards:numeric(stat.cards?.yellow),redCards:numeric(stat.cards?.red),source:PROVIDER_SOURCE};
  });
  if (!playerStats.length || new Set(playerStats.map(item=>item.providerId)).size!==playerStats.length) throw new Error('Incomplete/duplicate player statistics');
  const cardsTotal = cards => {
    const values = cards ? Object.values(cards).map(item=>numeric(item?.total)) : [];
    return values.length && values.every(value=>value!==null) ? values.reduce((sum,value)=>sum+value,0) : null;
  };
  const teamStats=raw.seasonStats;
  if (Number(teamStats?.team?.id)!==config.teamId || Number(teamStats?.league?.id)!==config.leagueId || Number(teamStats?.league?.season)!==config.season) throw new Error('Team statistics outside selected scope');
  return {
    report:{...meta,updateState:'connected',standings:{status:'verified',rows,source:PROVIDER_SOURCE},teamMetrics:{fouls:null,yellowCards:cardsTotal(teamStats.cards?.yellow),redCards:cardsTotal(teamStats.cards?.red),cleanSheets:numeric(teamStats.clean_sheet?.total)},form},
    stats:{...meta,complete:true,competition:'PL',ratingSource:PROVIDER_SOURCE,source:PROVIDER_SOURCE,players:playerStats},
    // /injuries is fixture-linked absence history, not proof of current medical status.
    injuries:{...meta,status:'unverified',complete:false,current:[],history:raw.injuries.filter(row=>Number(row.team?.id)===config.teamId).map(row=>({playerId:localId(config.playerIds,row.player.id),en:row.player.name,reportedAt:row.fixture?.date?.slice(0,10)||null,reason:row.player.reason||'Fixture absence',longTerm:null,returnDate:null,source:PROVIDER_SOURCE}))},
    feed:{...meta,provider:'api-football',fixtures,lineups:raw.lineups.map(item=>{
      const team=item.rows.find(row=>Number(row.team?.id)===config.teamId);
      const member=entry=>({playerId:localId(config.playerIds,entry.player.id),providerId:entry.player.id,en:entry.player.name,shirtNumber:numeric(entry.player.number),position:entry.player.pos||null,grid:entry.player.grid||null});
      return {providerFixtureId:item.fixtureId,matchId:localId(config.fixtureIds,item.fixtureId),status:team?.startXI?.length===11?'confirmed':'unverified',formation:team?.formation||null,startingXI:(team?.startXI||[]).map(member),bench:(team?.substitutes||[]).map(member),source:PROVIDER_SOURCE};
    }),source:PROVIDER_SOURCE},
  };
}
