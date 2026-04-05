import { DEFAULT_AUTHOR, STORAGE_KEYS } from "./helpers.js";

export function loadState() {
  return {
    posts: readJson(STORAGE_KEYS.posts, []).map(normalizePost),
    theme: localStorage.getItem(STORAGE_KEYS.theme) || "dark",
    currentAuthor: localStorage.getItem(STORAGE_KEYS.currentAuthor) || DEFAULT_AUTHOR,
    visiblePostIds: readJson(STORAGE_KEYS.visiblePostIds, []),
  };
}

export function saveState(state) {
  localStorage.setItem(STORAGE_KEYS.posts, JSON.stringify(state.posts));
  localStorage.setItem(STORAGE_KEYS.theme, state.theme);
  localStorage.setItem(STORAGE_KEYS.currentAuthor, state.currentAuthor || DEFAULT_AUTHOR);
  localStorage.setItem(STORAGE_KEYS.visiblePostIds, JSON.stringify(state.visiblePostIds));
}

function readJson(key, fallbackValue) {
  try {
    const rawValue = localStorage.getItem(key);
    return rawValue ? JSON.parse(rawValue) : fallbackValue;
  } catch (error) {
    console.error(`Не удалось прочитать данные из локального хранилища по ключу ${key}`, error);
    return fallbackValue;
  }
}

function normalizePost(post) {
  return {
    id: post.id,
    author: post.author || DEFAULT_AUTHOR,
    text: post.text || "",
    image: post.image || "",
    createdAt: post.createdAt || Date.now(),
    likes: Number(post.likes) || 0,
    comments: Array.isArray(post.comments) ? post.comments : [],
    isLiked: Boolean(post.isLiked),
    areCommentsOpen: Boolean(post.areCommentsOpen),
    lastCommentAuthor: post.lastCommentAuthor || post.author || DEFAULT_AUTHOR,
  };
}
