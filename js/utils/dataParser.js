import { SYNC_STATUS } from "../api/config.js";
import { DEFAULT_AUTHOR } from "./helpers.js";

const API_TIME_BASE = Date.UTC(2026, 0, 1, 8, 0, 0);
const POST_TEXT_TEMPLATES = [
  "Обсудили обновление ленты и запланировали следующие улучшения интерфейса.",
  "Проверили синхронизацию данных и подтвердили корректную работу хранилища.",
  "Собрали отзывы по приложению и подготовили список задач на доработку.",
  "Добавили новые элементы в профиль и обновили отображение активности.",
  "Протестировали публикацию постов и обработку ошибок при нестабильной сети.",
  "Подготовили материалы для отчета и сверили результаты с требованиями лабораторной.",
];

const COMMENT_TEXT_TEMPLATES = [
  "Отличная идея, давайте внедрять.",
  "Проверил у себя, всё работает корректно.",
  "Согласен, это стоит добавить в следующем обновлении.",
  "Хорошо выглядит и на мобильном экране.",
  "Можно вынести это в отдельную задачу для команды.",
];

export function parseApiPosts(apiPosts) {
  if (!Array.isArray(apiPosts)) {
    return [];
  }

  return apiPosts.map((post, index) =>
    normalizePost({
      id: `api-${Number(post.id) || index + 1}`,
      serverId: Number(post.id) || null,
      source: "remote",
      author: post.userId ? `Пользователь ${post.userId}` : DEFAULT_AUTHOR,
      text: buildRussianPostText(post, index),
      createdAt: API_TIME_BASE + (Number(post.id) || index + 1) * 1000 * 60 * 45,
      likes: Math.max(0, ((Number(post.id) || index + 1) * 3) % 29),
      comments: [],
      commentsLoaded: false,
      commentsLoading: false,
      commentsError: "",
      isLiked: false,
      areCommentsOpen: false,
      syncStatus: SYNC_STATUS.SYNCED,
      lastCommentAuthor: DEFAULT_AUTHOR,
    }),
  );
}

export function parseApiComments(apiComments) {
  if (!Array.isArray(apiComments)) {
    return [];
  }

  return apiComments.map((comment, index) =>
    normalizeComment({
      id: `api-comment-${comment.id || index + 1}`,
      author: normalizeApiCommentAuthor(comment, index),
      text: buildRussianCommentText(comment, index),
      createdAt: API_TIME_BASE + (Number(comment.id) || index + 1) * 1000 * 60 * 7,
    }),
  );
}

export function normalizePost(post) {
  const comments = Array.isArray(post.comments) ? post.comments.map(normalizeComment) : [];

  return {
    id: String(post.id || createLocalId("post")),
    serverId: toNumberOrNull(post.serverId),
    source: post.source === "remote" ? "remote" : "local",
    author: String(post.author || DEFAULT_AUTHOR),
    text: String(post.text || ""),
    image: String(post.image || ""),
    createdAt: Number(post.createdAt) || Date.now(),
    likes: Number(post.likes) || 0,
    comments,
    commentsLoaded: Boolean(post.commentsLoaded || comments.length),
    commentsLoading: Boolean(post.commentsLoading),
    commentsError: String(post.commentsError || ""),
    isLiked: Boolean(post.isLiked),
    areCommentsOpen: Boolean(post.areCommentsOpen),
    lastCommentAuthor: String(post.lastCommentAuthor || post.author || DEFAULT_AUTHOR),
    syncStatus: normalizeSyncStatus(post.syncStatus),
  };
}

export function mergeRemotePosts(existingPosts, nextRemotePosts) {
  const remoteIndex = new Map();

  existingPosts.forEach((post) => {
    if (post.source === "remote" && Number.isFinite(post.serverId)) {
      remoteIndex.set(post.serverId, normalizePost(post));
    }
  });

  nextRemotePosts.forEach((remotePost) => {
    if (!Number.isFinite(remotePost.serverId)) {
      return;
    }

    const previous = remoteIndex.get(remotePost.serverId);
    if (!previous) {
      remoteIndex.set(remotePost.serverId, normalizePost(remotePost));
      return;
    }

    remoteIndex.set(
      remotePost.serverId,
      normalizePost({
        ...remotePost,
        id: previous.id || remotePost.id,
        likes: previous.likes,
        isLiked: previous.isLiked,
        comments: previous.commentsLoaded ? previous.comments : remotePost.comments,
        commentsLoaded: previous.commentsLoaded,
        commentsLoading: false,
        commentsError: "",
        areCommentsOpen: previous.areCommentsOpen,
        lastCommentAuthor: previous.lastCommentAuthor,
        createdAt: previous.createdAt || remotePost.createdAt,
      }),
    );
  });

  return sortFeedPosts(Array.from(remoteIndex.values()));
}

export function sortFeedPosts(posts) {
  return [...posts].sort((left, right) => right.createdAt - left.createdAt);
}

export function normalizeComment(comment) {
  return {
    id: String(comment.id || createLocalId("comment")),
    author: String(comment.author || DEFAULT_AUTHOR),
    text: String(comment.text || ""),
    createdAt: Number(comment.createdAt) || Date.now(),
  };
}

function normalizeApiCommentAuthor(comment, index) {
  const fallbackNumber = Number(comment.id) || index + 1;
  return `Участник ${fallbackNumber}`;
}

function normalizeSyncStatus(value) {
  if (value === SYNC_STATUS.QUEUED) {
    return SYNC_STATUS.QUEUED;
  }

  if (value === SYNC_STATUS.SENDING) {
    return SYNC_STATUS.SENDING;
  }

  if (value === SYNC_STATUS.FAILED) {
    return SYNC_STATUS.FAILED;
  }

  return SYNC_STATUS.SYNCED;
}

function toNumberOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function createLocalId(prefix) {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
}

function buildRussianPostText(post, index) {
  const template = POST_TEXT_TEMPLATES[index % POST_TEXT_TEMPLATES.length];
  const wordCount = String(post.body || "").trim().split(/\s+/).filter(Boolean).length;
  const postNumber = Number(post.id) || index + 1;

  return `${template} (Публикация №${postNumber}, слов в исходном тексте: ${wordCount}).`;
}

function buildRussianCommentText(comment, index) {
  const template = COMMENT_TEXT_TEMPLATES[index % COMMENT_TEXT_TEMPLATES.length];
  const commentNumber = Number(comment.id) || index + 1;
  return `${template} Комментарий №${commentNumber}.`;
}
