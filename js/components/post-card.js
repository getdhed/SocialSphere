import { COMMENT_LIMIT, DEFAULT_AUTHOR, escapeHtml, formatDate, initials } from "../utils/helpers.js";

export function createPostCard(post) {
  const article = document.createElement("article");
  article.className = "post";
  article.dataset.postId = post.id;

  const imageBlock = post.image
    ? `<img class="post__image" src="${post.image}" alt="Изображение публикации ${escapeHtml(post.author)}" />`
    : "";

  const syncMeta = getSyncMeta(post.syncStatus);

  const commentsBlock = post.areCommentsOpen
    ? `
      <div class="comment-list">
        ${renderComments(post)}
      </div>
      <form class="comment-form" data-role="comment-form" data-post-id="${post.id}">
        <input class="input" type="text" name="commentAuthor" placeholder="Ваше имя" maxlength="30" value="${escapeHtml(post.lastCommentAuthor || DEFAULT_AUTHOR)}" />
        <textarea class="input" name="commentText" placeholder="Напишите комментарий" rows="3" maxlength="${COMMENT_LIMIT}" required></textarea>
        <div class="form__footer">
          <div class="muted">${COMMENT_LIMIT} символов максимум</div>
          <button class="btn btn--primary" type="submit">Отправить</button>
        </div>
        <div class="form__message" data-role="comment-message"></div>
      </form>
    `
    : "";

  article.innerHTML = `
    <div class="post__top">
      <div class="post__author">
        <div class="avatar">${escapeHtml(initials(post.author))}</div>
        <div>
          <div class="post__name">${escapeHtml(post.author)}</div>
          <div class="post__time">${formatDate(post.createdAt)}</div>
        </div>
      </div>
      <div class="post__meta">
        <span>${post.likes} лайков</span>
        <span>${post.comments.length} комментариев</span>
        <span class="post__sync post__sync--${syncMeta.tone}">${syncMeta.label}</span>
      </div>
    </div>
    ${imageBlock}
    <p class="post__text">${escapeHtml(post.text)}</p>
    <div class="post__actions">
      <button class="action-btn ${post.isLiked ? "is-active" : ""}" type="button" data-action="toggle-like" data-post-id="${post.id}" aria-label="${post.isLiked ? "Убрать лайк" : "Поставить лайк"}" title="${post.isLiked ? "Убрать лайк" : "Поставить лайк"}">
        <span class="action-btn__icon" aria-hidden="true">${post.isLiked ? "♥" : "♡"}</span>
      </button>
      <button class="action-btn" type="button" data-action="toggle-comments" data-post-id="${post.id}" aria-label="${post.areCommentsOpen ? "Скрыть комментарии" : "Открыть комментарии"}" title="${post.areCommentsOpen ? "Скрыть комментарии" : "Открыть комментарии"}">
        <span class="action-btn__icon" aria-hidden="true">💬</span>
      </button>
    </div>
    ${commentsBlock}
  `;

  return article;
}

function renderComments(post) {
  if (post.commentsLoading) {
    return `<div class="comment comment--state"><div class="muted">Загружаем комментарии...</div></div>`;
  }

  if (post.commentsError) {
    return `
      <div class="comment comment--state">
        <div class="form__message is-error">${escapeHtml(post.commentsError)}</div>
        <button class="btn" type="button" data-action="retry-comments" data-post-id="${post.id}">Повторить</button>
      </div>
    `;
  }

  if (!post.comments.length) {
    return `<div class="comment comment--state"><div class="muted">Пока нет комментариев. Станьте первым.</div></div>`;
  }

  return post.comments
    .map(
      (comment) => `
        <div class="comment">
          <div class="comment__top">
            <span class="comment__author">${escapeHtml(comment.author)}</span>
            <span class="post__time">${formatDate(comment.createdAt)}</span>
          </div>
          <p class="comment__text">${escapeHtml(comment.text)}</p>
        </div>
      `,
    )
    .join("");
}

function getSyncMeta(status) {
  if (status === "queued") {
    return { tone: "queued", label: "В очереди" };
  }

  if (status === "sending") {
    return { tone: "sending", label: "Отправка..." };
  }

  if (status === "failed") {
    return { tone: "failed", label: "Ошибка синхр." };
  }

  return { tone: "synced", label: "Синхронизирован" };
}
