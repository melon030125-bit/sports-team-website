# Chelsea data updates

The browser reads `data/season-report.json`, `data/player-stats.json`, and
`data/injuries.json`. It never receives an API key. `js/season-report.js` renders
the provider-independent schema. Unknown values are `null`, never invented zeros.
All three files share a `snapshotId`; mismatched snapshots show the retry state.

The initial report uses only saved PL results in `data/site.json`, with its dated
coverage label. Rank and the 20-team table remain unverified until supplied by a
validated provider response. A points calculation is not an official standing or
proof that there have been no deductions. Partial match/player data does not
establish a season leader. Old injury announcements are not current injuries.

## Enable API-Football

1. Confirm the account plan covers EPL 2026/27, player statistics and injuries.
2. Add repository **Secret** `API_FOOTBALL_KEY` (API-Sports direct key).
3. Set repository **Variables** `FOOTBALL_LEAGUE_ID` and `FOOTBALL_TEAM_ID` using
   IDs returned by the provider. IDs are deliberately not guessed in this repo.
4. Review `data/provider-config.json`: season start year `2026`, page limit,
   lineup request limit, and optional player/fixture ID maps. Map local IDs to
   provider numeric IDs to retain Korean profiles and links. Do not match names
   automatically. No key belongs in this file.
5. Set repository **Variable** `CHELSEA_DATA_UPDATES_ENABLED=true`.
6. Enable Actions and allow the new workflow's `contents: write` permission;
   branch protection must allow its data commit, or replace that commit step
   with your repository's PR process. No Git settings are changed by this task.
7. Run the new workflow manually, inspect the JSON diff, and then keep the daily
   schedule. The schedule is `0 21 * * *` UTC, or 06:00 KST the next day. GitHub
   scheduling can be delayed; the UI shows the actual successful snapshot time.

Local PowerShell equivalents (key stays in the process environment):

```powershell
$env:CHELSEA_DATA_UPDATES_ENABLED = 'true'
$env:FOOTBALL_LEAGUE_ID = '<verified numeric ID>'
$env:FOOTBALL_TEAM_ID = '<verified numeric ID>'
# Set API_FOOTBALL_KEY securely in your environment; never commit it.
node scripts/update-chelsea-data.mjs --dry-run
node scripts/update-chelsea-data.mjs
```

With the switch off OR a missing key, the script returns `skipped` before reads,
writes, or external API calls. The Actions configuration job checks the switch,
key and numeric IDs before allowing the update job. No real provider requests
were used to implement or test this task. Tests use in-memory HTTP fixtures.

## Provider boundary

`scripts/providers/api-football.mjs` collects standings, all Chelsea league
fixtures, paginated player statistics, fixture-linked injuries, team season
statistics, and lineups for up to three recent/next fixtures. HTTP/API errors,
pagination overflow, wrong team/season or incomplete standings stop publication.
Provider error bodies and keys are not logged. Valid output is staged, then
renamed into place with rollback on a write error. Actions prevents concurrent
updates and commits only the four refreshed JSON files.

`football-feed.json` retains fixtures and lineup responses plus their mapped
local IDs. It is a **staging feed**, not a silent replacement of the manually
verified `site.json` fixture/detail data. Before wiring that feed into match
pages, review all fixture/player ID mappings and add the provider's event and
per-match performance endpoints. This avoids erasing verified manual events,
comment match IDs, lineup records, or photos when a mapping is missing. Report
form and season totals already consume the normalized provider snapshot.

API-Football `/injuries` describes absences associated with fixtures. It does
not prove a current medical state or return date. Its records populate history;
current injury count and long-term absence stay unverified until an explicit,
dated and complete current-status source is supplied. Team fouls stay null
because the team-statistics endpoint does not provide a verified foul total in
this mapping. Missing card totals also remain null.

For Sportmonks, implement a new collector/normalizer producing the same bundle
`{ report, stats, injuries, feed }`, then register it in the updater. The current
adapter intentionally rejects unimplemented providers instead of making guessed
requests. No Sportmonks token is required for the current API-Football adapter.

Official references:
- https://www.api-football.com/documentation_v3
- https://docs.sportmonks.com/v3/welcome/getting-started
- https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule

## Checks

```text
node js/verify-season.mjs
node js/verify-match.mjs
node js/verify.mjs --browser
```

No email workflow is edited. The new workflow neither sends mail nor calls any
mail service. Data commits use the normal GitHub token and respect repo policies.
