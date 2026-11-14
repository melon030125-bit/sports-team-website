const PREFIX = 'chelsea:match-comments:v1:';
const MAX_COMMENTS = 100;

export function validateComment(input) {
  const nickname = String(input.nickname || '').trim();
  const body = String(input.body || '').trim();
  if (!nickname || nickname.length > 30) throw new Error('닉네임은 1~30자로 입력해 주세요.');
  if (!body || body.length > 2000) throw new Error('댓글은 1~2,000자로 입력해 주세요.');
  return { nickname, body };
}

// Replace this repository with a Supabase implementation of list/add; the UI stays the same.
export function createLocalCommentStore(getStorage = () => globalThis.localStorage) {
  const key = matchId => {
    if (!/^[a-z0-9-]{1,80}$/.test(matchId)) throw new Error('경기 주소를 확인해 주세요.');
    return PREFIX + matchId;
  };
  const read = matchId => {
    let raw;
    try { raw = getStorage().getItem(key(matchId)); }
    catch { throw new Error('브라우저 저장소에 접근할 수 없습니다. 저장소 설정을 확인해 주세요.'); }
    if (raw === null) return [];
    try {
      const items = JSON.parse(raw);
      if (!Array.isArray(items) || !items.every(item => item && typeof item.id === 'string' && typeof item.nickname === 'string' && typeof item.body === 'string' && item.nickname.trim() && item.nickname.length <= 30 && item.body.trim() && item.body.length <= 2000 && !Number.isNaN(Date.parse(item.createdAt)))) throw new Error();
      return items;
    } catch { throw new Error('저장된 댓글을 읽지 못했습니다. 기존 데이터는 덮어쓰지 않습니다.'); }
  };
  return {
    async list(matchId) { return read(matchId).slice(-MAX_COMMENTS).reverse(); },
    async add(matchId, input) {
      const content = validateComment(input);
      const items = read(matchId);
      const comment = { id: globalThis.crypto.randomUUID(), ...content, createdAt: new Date().toISOString() };
      try { getStorage().setItem(key(matchId), JSON.stringify([...items, comment].slice(-MAX_COMMENTS))); }
      catch { throw new Error('댓글을 저장하지 못했습니다. 저장 공간이나 브라우저 설정을 확인해 주세요.'); }
      return comment;
    },
    storageKey: key,
  };
}
