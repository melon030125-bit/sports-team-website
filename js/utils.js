export const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);

export function safeUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? url.href : '#';
  } catch { return '#'; }
}

export function dateParts(kickoff, timeZone = 'Asia/Seoul') {
  if (!kickoff || Number.isNaN(Date.parse(kickoff))) return null;
  const parts = new Intl.DateTimeFormat('ko-KR', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  }).formatToParts(new Date(kickoff));
  return Object.fromEntries(parts.map(part => [part.type, part.value]));
}

export function formatKickoff(kickoff, timeZone = 'Asia/Seoul') {
  const parts = dateParts(kickoff, timeZone);
  return parts ? `${parts.year}.${parts.month}.${parts.day} (${parts.weekday}) ${parts.hour}:${parts.minute}` : '킥오프 시간 미정';
}

export function matchDate(match) {
  const parts = dateParts(match.kickoff);
  return parts ? `${parts.year}-${parts.month}-${parts.day}` : match.date || '';
}

export function getNextMatch(matches, asOf) {
  const now = Date.parse(asOf);
  return matches.filter(match => match.status === 'scheduled' && match.kickoff && Date.parse(match.kickoff) > now)
    .sort((a, b) => Date.parse(a.kickoff) - Date.parse(b.kickoff))[0] || null;
}

export function matchOutcome(match) {
  if (match.status !== 'finished' || match.homeScore == null || match.awayScore == null) return '';
  if (match.penalties) {
    return { win: '승리 · 승부차기', loss: '패배 · 승부차기' }[match.penaltyOutcome] || '승부차기로 결정';
  }
  const difference = match.venue === 'home' ? match.homeScore - match.awayScore : match.awayScore - match.homeScore;
  return difference > 0 ? '승리' : difference < 0 ? '패배' : '무승부';
}

export function resultClass(match) {
  const result = matchOutcome(match);
  return result.startsWith('승리') ? 'result-win' : result.startsWith('패배') ? 'result-loss' : 'result-draw';
}

export function normalize(value) {
  return String(value ?? '').normalize('NFKC').toLocaleLowerCase().replace(/[\s\-']/g, '');
}
