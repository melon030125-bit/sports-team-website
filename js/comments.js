import { escapeHtml as e } from './utils.js';
import { createLocalCommentStore } from './comment-store.js';

export function commentsView() {
  return `<section class="section fan-comments" id="fan-comments" aria-labelledby="comments-heading">
    <p class="eyebrow">FAN COMMENTS</p><h2 id="comments-heading">함께 보는 90분</h2>
    <p class="lede">이 브라우저에만 저장되는 임시 댓글입니다. 다른 기기·팬과 공유되지 않으며 최신 100개를 보관합니다.</p>
    <form id="comment-form" class="comment-form">
      <label class="field" for="comment-nickname">닉네임<input id="comment-nickname" name="nickname" maxlength="30" required autocomplete="nickname" placeholder="1~30자"></label>
      <label class="field" for="comment-body">경기 이야기<textarea id="comment-body" name="body" rows="4" maxlength="2000" required placeholder="서로를 존중하며 경기 이야기를 남겨 주세요. (최대 2,000자)"></textarea></label>
      <button class="button" type="submit">댓글 등록</button>
    </form><p id="comment-status" role="status" aria-live="polite"></p>
    <ol class="comment-list" id="comment-list" aria-label="경기 댓글"></ol>
  </section>`;
}

export function mountComments(matchId, repository = createLocalCommentStore()) {
  const form = document.querySelector('#comment-form');
  const list = document.querySelector('#comment-list');
  const status = document.querySelector('#comment-status');
  const render = async () => {
    const comments = await repository.list(matchId);
    list.innerHTML = comments.length ? comments.map(comment => `<li class="fan-comment"><div><strong>${e(comment.nickname)}</strong><time datetime="${e(comment.createdAt)}">${e(new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Seoul' }).format(new Date(comment.createdAt)))} KST</time></div><p>${e(comment.body)}</p></li>`).join('') : '<li class="comments-empty">아직 댓글이 없습니다. 첫 경기 이야기를 남겨 주세요.</li>';
  };
  render().catch(error => { status.textContent = error.message; });
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const button = form.querySelector('button');
    button.disabled = true;
    status.textContent = '댓글을 저장하고 있습니다.';
    try {
      await repository.add(matchId, { nickname: form.elements.nickname.value, body: form.elements.body.value });
      await render();
      form.elements.body.value = '';
      status.textContent = '댓글을 이 브라우저에 저장했습니다.';
    } catch (error) { status.textContent = error.message; }
    finally { button.disabled = false; }
  });
  const sync = event => {
    if (event.key === repository.storageKey?.(matchId) || event.key === null) render().catch(error => { status.textContent = error.message; });
  };
  window.addEventListener('storage', sync);
  window.addEventListener('pagehide', () => window.removeEventListener('storage', sync), { once: true });
}
