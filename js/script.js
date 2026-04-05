import { fetchComments, fetchPosts, publishPost } from "./api/apiService.js";
import {
  APP_STORAGE_VERSION,
  CACHE_TTL_MS,
  DRAFT_AUTOSAVE_DELAY_MS,
  FEED_INITIAL_LIMIT,
  POSTS_BATCH_SIZE,
  QUEUE_RETRY_LIMIT,
  SESSION_KEYS,
  STORAGE_KEYS,
  SYNC_STATUS,
} from "./api/config.js";
import { createModalController } from "./components/modal.js";
import { createPostCard } from "./components/post-card.js";
import { readLocalJson, readLocalValue, removeLocalValue, writeLocalJson, writeLocalValue } from "./storage/localStorage.js";
import {
  readSessionJson,
  readSessionValue,
  removeSessionValue,
  writeSessionJson,
  writeSessionValue,
} from "./storage/sessionStorage.js";
import {
  mergeRemotePosts,
  normalizeComment,
  normalizePost,
  parseApiComments,
  parseApiPosts,
  sortFeedPosts,
} from "./utils/dataParser.js";
import {
  COMMENT_LIMIT,
  DEFAULT_AUTHOR,
  POST_LIMIT,
  createComment,
  validateCommentText,
  validateImage,
  validatePostText,
} from "./utils/helpers.js";

const themeBtn = document.getElementById("themeBtn");
const connectionBadge = document.getElementById("connectionBadge");
const syncBadge = document.getElementById("syncBadge");
const feed = document.getElementById("feed");
const feedStatus = document.getElementById("feedStatus");
const feedSentinel = document.getElementById("feedSentinel");
const feedStats = document.getElementById("feedStats");
const profileName = document.getElementById("profileName");
const profileMeta = document.getElementById("profileMeta");
const totalCommentsStat = document.getElementById("totalCommentsStat");
const loadedPostsStat = document.getElementById("loadedPostsStat");
const queuedPostsStat = document.getElementById("queuedPostsStat");
const cacheInfo = document.getElementById("cacheInfo");
const postForm = document.getElementById("postForm");
const nameInput = document.getElementById("nameInput");
const textInput = document.getElementById("textInput");
const imageInput = document.getElementById("imageInput");
const textCounter = document.getElementById("textCounter");
const draftStatus = document.getElementById("draftStatus");
const formMessage = document.getElementById("formMessage");
const submitPostBtn = document.getElementById("submitPostBtn");
const openPostModalBtn = document.getElementById("openPostModalBtn");
const openPostComposerBtn = document.getElementById("openPostComposerBtn");
const closePostModalBtn = document.getElementById("closePostModalBtn");
const cancelPostBtn = document.getElementById("cancelPostBtn");

const modal = createModalController(document.getElementById("postModal"));

const state = {
  posts: [],
  queue: [],
  visiblePostIds: [],
  remoteOffset: 0,
  hasMoreRemote: true,
  isFetchingFeed: false,
  isSyncingQueue: false,
  draftTimer: 0,
  lastCacheSavedAt: null,
  theme: readLocalValue(STORAGE_KEYS.theme, "dark"),
  currentAuthor: readLocalValue(STORAGE_KEYS.currentAuthor, DEFAULT_AUTHOR) || DEFAULT_AUTHOR,
};

ensureStorageVersion();
hydrateStateFromStorage();
applyTheme(state.theme);
restoreDraft();
updateCounter();
updateConnectionBadge();
updateSyncBadge();
renderFeed();
updateProfile();
updateCacheInfo();
setupInfiniteScroll();
setupEventListeners();

void bootstrapAsyncData();

function setupEventListeners() {
  themeBtn.addEventListener("click", () => {
    state.theme = state.theme === "light" ? "dark" : "light";
    applyTheme(state.theme);
    writeLocalValue(STORAGE_KEYS.theme, state.theme);
  });

  openPostModalBtn.addEventListener("click", openComposer);
  openPostComposerBtn.addEventListener("click", openComposer);
  closePostModalBtn.addEventListener("click", () => modal.close());
  cancelPostBtn.addEventListener("click", () => modal.close());

  nameInput.addEventListener("input", () => {
    clearFormMessage();
    scheduleDraftSave();
  });

  textInput.addEventListener("input", () => {
    updateCounter();
    clearFormMessage();
    scheduleDraftSave();
  });

  imageInput.addEventListener("input", () => {
    clearFormMessage();
    updateDraftStatus("Изображение не сохраняется в черновике автоматически.");
  });

  postForm.addEventListener("submit", (event) => {
    void handleSubmit(event);
  });

  feed.addEventListener("click", (event) => {
    const likeButton = event.target.closest("[data-action='toggle-like']");
    if (likeButton) {
      toggleLike(likeButton.dataset.postId);
      return;
    }

    const commentsButton = event.target.closest("[data-action='toggle-comments']");
    if (commentsButton) {
      toggleComments(commentsButton.dataset.postId);
      return;
    }

    const retryCommentsButton = event.target.closest("[data-action='retry-comments']");
    if (retryCommentsButton) {
      const post = findPost(retryCommentsButton.dataset.postId);
      if (post) {
        void loadCommentsForPost(post, true);
      }
    }
  });

  feed.addEventListener("submit", (event) => {
    const form = event.target.closest("[data-role='comment-form']");
    if (!form) {
      return;
    }

    event.preventDefault();
    handleCommentSubmit(form);
  });

  feed.addEventListener("input", (event) => {
    const form = event.target.closest("[data-role='comment-form']");
    if (!form) {
      return;
    }

    const messageBox = form.querySelector("[data-role='comment-message']");
    setElementMessage(messageBox, `До ${COMMENT_LIMIT} символов`, "");
  });

  window.addEventListener("online", () => {
    updateConnectionBadge();
    setFeedStatus("Соединение восстановлено. Синхронизируем очередь...", "info");
    void syncQueue();

    if (!state.posts.some((post) => post.source === "remote")) {
      void fetchRemotePosts({ reset: true });
    }
  });

  window.addEventListener("offline", () => {
    updateConnectionBadge();
    setFeedStatus("Оффлайн режим: данные показываются из кэша, отправка постов в очереди.", "info");
  });
}

function ensureStorageVersion() {
  const savedVersion = readLocalValue(STORAGE_KEYS.storageVersion, "");
  if (savedVersion === APP_STORAGE_VERSION) {
    return;
  }

  removeLocalValue(STORAGE_KEYS.feedCache);
  removeLocalValue(STORAGE_KEYS.queue);
  removeLocalValue(STORAGE_KEYS.draft);

  removeSessionValue(SESSION_KEYS.visiblePostIds);
  removeSessionValue(SESSION_KEYS.draft);
  removeSessionValue(SESSION_KEYS.lastSync);

  writeLocalValue(STORAGE_KEYS.storageVersion, APP_STORAGE_VERSION);
}

async function bootstrapAsyncData() {
  if (!navigator.onLine) {
    if (!state.posts.length) {
      setFeedStatus("Нет интернета и нет кэша. Подключитесь к сети для загрузки данных.", "error");
    }
    return;
  }

  await fetchRemotePosts({ reset: true });
  await syncQueue();
}

function hydrateStateFromStorage() {
  state.queue = normalizeQueue(readLocalJson(STORAGE_KEYS.queue, []));

  const cachedFeed = readLocalJson(STORAGE_KEYS.feedCache, null);
  if (cachedFeed && Array.isArray(cachedFeed.items)) {
    state.posts = sortFeedPosts(cachedFeed.items.map(normalizePost));
    state.lastCacheSavedAt = Number(cachedFeed.savedAt) || null;

    if (Date.now() - (state.lastCacheSavedAt || 0) > CACHE_TTL_MS) {
      setFeedStatus("Показываем кэш. Обновляем данные с сервера...", "info");
    }
  }

  const queueRecoveredPosts = reconcileQueueWithPosts();
  if (queueRecoveredPosts) {
    persistFeedCache();
  }

  const savedVisibleIds = readSessionJson(SESSION_KEYS.visiblePostIds, []);
  if (Array.isArray(savedVisibleIds)) {
    state.visiblePostIds = savedVisibleIds.filter((id) => state.posts.some((post) => post.id === id));
  }

  ensureVisiblePostIds();
  state.remoteOffset = state.posts.filter((post) => post.source === "remote").length;

  const lastSyncRaw = readSessionValue(SESSION_KEYS.lastSync, "");
  if (lastSyncRaw) {
    setFeedStatus(lastSyncRaw, "success");
  } else if (!state.posts.length) {
    setFeedStatus("Загружаем данные с сервера...", "info");
  }
}

async function fetchRemotePosts({ reset = false } = {}) {
  if (state.isFetchingFeed || (!state.hasMoreRemote && !reset) || !navigator.onLine) {
    return;
  }

  state.isFetchingFeed = true;
  if (reset) {
    state.hasMoreRemote = true;
    state.remoteOffset = 0;
  }
  setFeedStatus("Загружаем посты с сервера...", "info");

  try {
    const start = reset ? 0 : state.remoteOffset;
    const response = await fetchPosts({ start, limit: FEED_INITIAL_LIMIT });
    const remotePosts = parseApiPosts(response);

    if (remotePosts.length < FEED_INITIAL_LIMIT) {
      state.hasMoreRemote = false;
    }

    state.remoteOffset = start + remotePosts.length;

    const localPosts = state.posts.filter((post) => post.source === "local");
    const mergedRemote = mergeRemotePosts(state.posts, remotePosts);
    state.posts = sortFeedPosts([...localPosts, ...mergedRemote]);

    ensureVisiblePostIds();
    persistFeedCache();
    renderFeed();
    updateProfile();
    updateCacheInfo();

    if (remotePosts.length) {
      setFeedStatus("Лента обновлена с сервера.", "success");
    } else {
      setFeedStatus("Сервер вернул пустой список постов.", "info");
    }
  } catch (error) {
    setFeedStatus(`Ошибка загрузки ленты: ${getErrorMessage(error)}`, "error");
  } finally {
    state.isFetchingFeed = false;
  }
}

async function handleSubmit(event) {
  event.preventDefault();

  const author = nameInput.value.trim() || DEFAULT_AUTHOR;
  const text = textInput.value.trim();
  const imageFile = imageInput.files?.[0];
  const validationError = validatePostText(text);
  const imageError = validateImage(imageFile);

  if (validationError) {
    showFormMessage(validationError, "error");
    return;
  }

  if (imageError) {
    showFormMessage(imageError, "error");
    return;
  }

  disableSubmit(true);

  try {
    let image = "";
    if (imageFile) {
      image = await readFileAsDataUrl(imageFile);
    }

    const post = createLocalPost({
      author,
      text,
      image,
      syncStatus: navigator.onLine ? SYNC_STATUS.SENDING : SYNC_STATUS.QUEUED,
    });

    state.posts = sortFeedPosts([post, ...state.posts]);
    state.currentAuthor = author;
    writeLocalValue(STORAGE_KEYS.currentAuthor, state.currentAuthor);
    prependVisiblePost(post.id);
    persistFeedCache();
    renderFeed();
    updateProfile();
    clearDraft();

    if (navigator.onLine) {
      const synced = await sendPostToServer(post);
      if (synced) {
        showFormMessage("Пост опубликован и синхронизирован с сервером.", "success");
      } else {
        enqueuePost(post, "Ошибка сети. Пост добавлен в очередь.");
        showFormMessage("Пост добавлен в ленту и поставлен в очередь отправки.", "success");
      }
    } else {
      enqueuePost(post, "Оффлайн режим. Пост ожидает сеть.");
      showFormMessage("Оффлайн: пост сохранен локально и поставлен в очередь.", "success");
    }

    postForm.reset();
    updateCounter();
    setTimeout(() => {
      clearFormMessage();
      modal.close();
    }, 1000);
  } catch (error) {
    showFormMessage(`Не удалось создать пост: ${getErrorMessage(error)}`, "error");
  } finally {
    disableSubmit(false);
  }
}

function handleCommentSubmit(form) {
  const postId = form.dataset.postId;
  const post = findPost(postId);
  if (!post) {
    return;
  }

  const authorInput = form.querySelector("[name='commentAuthor']");
  const textArea = form.querySelector("[name='commentText']");
  const messageBox = form.querySelector("[data-role='comment-message']");
  const author = authorInput.value.trim() || DEFAULT_AUTHOR;
  const text = textArea.value.trim();
  const validationError = validateCommentText(text);

  if (validationError) {
    setElementMessage(messageBox, validationError, "error");
    return;
  }

  post.comments.push(
    normalizeComment(
      createComment({
        author,
        text,
      }),
    ),
  );
  post.commentsLoaded = true;
  post.lastCommentAuthor = author;
  post.areCommentsOpen = true;
  state.currentAuthor = author;
  writeLocalValue(STORAGE_KEYS.currentAuthor, state.currentAuthor);

  persistFeedCache();
  renderFeed();
  updateProfile();
}

function toggleLike(postId) {
  const post = findPost(postId);
  if (!post) {
    return;
  }

  post.isLiked = !post.isLiked;
  post.likes += post.isLiked ? 1 : -1;

  persistFeedCache();
  renderFeed();
  updateProfile();
}

function toggleComments(postId) {
  const post = findPost(postId);
  if (!post) {
    return;
  }

  post.areCommentsOpen = !post.areCommentsOpen;

  if (post.areCommentsOpen && post.source === "remote" && post.serverId && !post.commentsLoaded && !post.commentsLoading) {
    void loadCommentsForPost(post);
  }

  persistFeedCache();
  renderFeed();
}

async function loadCommentsForPost(post, forceReload = false) {
  if (!post.serverId || post.commentsLoading) {
    return;
  }

  if (post.commentsLoaded && !forceReload) {
    return;
  }

  post.commentsLoading = true;
  post.commentsError = "";
  post.areCommentsOpen = true;
  renderFeed();

  try {
    const response = await fetchComments(post.serverId);
    post.comments = parseApiComments(response);
    post.commentsLoaded = true;
    post.commentsError = "";
  } catch (error) {
    post.commentsError = getErrorMessage(error);
  } finally {
    post.commentsLoading = false;
    persistFeedCache();
    renderFeed();
    updateProfile();
  }
}

async function sendPostToServer(post) {
  try {
    post.syncStatus = SYNC_STATUS.SENDING;
    renderFeed();

    const response = await publishPost({
      author: post.author,
      text: post.text,
      image: post.image,
      createdAt: post.createdAt,
    });

    const serverId = Number(response.id);
    if (Number.isFinite(serverId)) {
      post.serverId = serverId;
    }

    post.syncStatus = SYNC_STATUS.SYNCED;
    persistFeedCache();
    renderFeed();
    updateProfile();
    return true;
  } catch (error) {
    post.syncStatus = SYNC_STATUS.QUEUED;
    persistFeedCache();
    renderFeed();
    updateProfile();
    return false;
  }
}

function enqueuePost(post, reason = "") {
  const existingQueueItem = state.queue.find((item) => item.id === post.id);
  if (existingQueueItem) {
    existingQueueItem.lastError = reason || existingQueueItem.lastError;
    persistQueue();
    updateSyncBadge();
    return;
  }

  state.queue.push({
    id: post.id,
    attempts: 0,
    lastError: reason,
    payload: {
      author: post.author,
      text: post.text,
      createdAt: post.createdAt,
    },
  });

  post.syncStatus = SYNC_STATUS.QUEUED;
  persistQueue();
  persistFeedCache();
  updateSyncBadge();
  updateProfile();
}

async function syncQueue() {
  if (state.isSyncingQueue || !navigator.onLine || !state.queue.length) {
    updateSyncBadge();
    return;
  }

  state.isSyncingQueue = true;
  updateSyncBadge();

  for (const queueItem of [...state.queue]) {
    const post = findPost(queueItem.id);

    if (!post) {
      removeQueueItem(queueItem.id);
      continue;
    }

    post.syncStatus = SYNC_STATUS.SENDING;
    renderFeed();

    try {
      const response = await publishPost(queueItem.payload);
      const serverId = Number(response.id);

      if (Number.isFinite(serverId)) {
        post.serverId = serverId;
      }

      post.syncStatus = SYNC_STATUS.SYNCED;
      removeQueueItem(queueItem.id);
      writeSessionValue(SESSION_KEYS.lastSync, `Синхронизация очереди: ${formatTime(Date.now())}`);
    } catch (error) {
      queueItem.attempts = Number(queueItem.attempts || 0) + 1;
      queueItem.lastError = getErrorMessage(error);

      if (queueItem.attempts >= QUEUE_RETRY_LIMIT) {
        post.syncStatus = SYNC_STATUS.FAILED;
      } else {
        post.syncStatus = SYNC_STATUS.QUEUED;
      }

      if (!navigator.onLine) {
        break;
      }
    }

    persistQueue();
    persistFeedCache();
    renderFeed();
    updateProfile();
    updateSyncBadge();
  }

  state.isSyncingQueue = false;
  persistQueue();
  persistFeedCache();
  renderFeed();
  updateProfile();
  updateSyncBadge();

  if (!state.queue.length) {
    setFeedStatus("Очередь отправки синхронизирована.", "success");
  }
}

function renderFeed() {
  ensureVisiblePostIds();
  const visiblePosts = state.visiblePostIds
    .map((id) => findPost(id))
    .filter(Boolean);

  if (!visiblePosts.length) {
    const empty = document.createElement("div");
    empty.className = "feed-status muted";
    empty.textContent = "Нет постов для отображения.";
    feed.replaceChildren(empty);
  } else {
    feed.replaceChildren(...visiblePosts.map((post) => createPostCard(post)));
  }

  feedStats.textContent = `${state.posts.length} постов`;
  loadedPostsStat.textContent = String(visiblePosts.length);
}

function updateProfile() {
  const totalLikes = state.posts.reduce((sum, post) => sum + post.likes, 0);
  const totalComments = state.posts.reduce((sum, post) => sum + post.comments.length, 0);
  const ownPosts = state.currentAuthor ? state.posts.filter((post) => post.author === state.currentAuthor).length : 0;

  profileName.textContent = state.currentAuthor || DEFAULT_AUTHOR;
  profileMeta.textContent = `${ownPosts} постов • ${totalLikes} лайков`;
  totalCommentsStat.textContent = String(totalComments);
  queuedPostsStat.textContent = String(state.queue.length);
}

function updateCounter() {
  textCounter.textContent = `${textInput.value.length} / ${POST_LIMIT}`;
}

function showFormMessage(message, tone = "") {
  formMessage.textContent = message;
  formMessage.className = "form__message";

  if (tone === "error") {
    formMessage.classList.add("is-error");
  }

  if (tone === "success") {
    formMessage.classList.add("is-success");
  }
}

function clearFormMessage() {
  showFormMessage("");
}

function setFeedStatus(message, tone = "") {
  feedStatus.textContent = message;
  feedStatus.className = "feed-status muted";

  if (tone === "error") {
    feedStatus.classList.add("is-error");
  }

  if (tone === "info") {
    feedStatus.classList.add("is-info");
  }

  if (tone === "success") {
    feedStatus.classList.add("is-success");
  }
}

function setElementMessage(element, message, tone = "") {
  if (!element) {
    return;
  }

  element.textContent = message;
  element.className = "form__message";

  if (tone === "error") {
    element.classList.add("is-error");
  }
}

function openComposer() {
  const draft = getCurrentDraft();
  nameInput.value = draft?.author || state.currentAuthor || DEFAULT_AUTHOR;
  textInput.value = draft?.text || "";
  imageInput.value = "";
  updateCounter();
  updateDraftStatus(
    draft?.updatedAt
      ? `Черновик сохранен в ${formatTime(draft.updatedAt)} (в локальном и сессионном хранилище)`
      : "Черновик не сохранен",
  );
  clearFormMessage();
  modal.open();
  textInput.focus();
}

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
}

function updateConnectionBadge() {
  connectionBadge.textContent = navigator.onLine ? "Онлайн" : "Оффлайн";
  connectionBadge.classList.toggle("badge--success", navigator.onLine);
  connectionBadge.classList.toggle("badge--danger", !navigator.onLine);
}

function updateSyncBadge() {
  syncBadge.classList.remove("badge--success", "badge--warning", "badge--danger");

  if (state.isSyncingQueue) {
    syncBadge.textContent = `Синхронизация: ${state.queue.length}`;
    syncBadge.classList.add("badge--warning");
  } else if (state.queue.length === 0) {
    syncBadge.textContent = "Очередь: 0";
    syncBadge.classList.add("badge--success");
  } else if (state.queue.some((item) => Number(item.attempts || 0) >= QUEUE_RETRY_LIMIT)) {
    syncBadge.textContent = `Ошибки очереди: ${state.queue.length}`;
    syncBadge.classList.add("badge--danger");
  } else {
    syncBadge.textContent = `Очередь: ${state.queue.length}`;
    syncBadge.classList.add("badge--warning");
  }
}

function setupInfiniteScroll() {
  const observer = new IntersectionObserver(
    (entries) => {
      const [entry] = entries;
      if (!entry?.isIntersecting) {
        return;
      }

      void loadMorePosts();
    },
    { rootMargin: "240px 0px" },
  );

  observer.observe(feedSentinel);
}

async function loadMorePosts() {
  const hiddenPosts = state.posts.filter((post) => !state.visiblePostIds.includes(post.id));
  if (hiddenPosts.length) {
    const nextIds = hiddenPosts.slice(0, POSTS_BATCH_SIZE).map((post) => post.id);
    state.visiblePostIds.push(...nextIds);
    persistVisiblePostIds();
    renderFeed();
    updateProfile();
    return;
  }

  if (navigator.onLine && state.hasMoreRemote) {
    await fetchRemotePosts();

    const hiddenAfterFetch = state.posts.filter((post) => !state.visiblePostIds.includes(post.id));
    if (hiddenAfterFetch.length) {
      const nextIds = hiddenAfterFetch.slice(0, POSTS_BATCH_SIZE).map((post) => post.id);
      state.visiblePostIds.push(...nextIds);
      persistVisiblePostIds();
      renderFeed();
      updateProfile();
      return;
    }
  }

  if (!navigator.onLine) {
    setFeedStatus("Оффлайн: новые посты загрузятся после восстановления сети.", "info");
  } else {
    setFeedStatus("Вы просмотрели все загруженные посты.", "info");
  }
}

function scheduleDraftSave() {
  if (state.draftTimer) {
    clearTimeout(state.draftTimer);
  }

  state.draftTimer = setTimeout(() => {
    saveDraft();
  }, DRAFT_AUTOSAVE_DELAY_MS);
}

function saveDraft() {
  const draft = {
    author: nameInput.value.trim(),
    text: textInput.value.trim(),
    updatedAt: Date.now(),
  };

  if (!draft.author && !draft.text) {
    clearDraft();
    return;
  }

  writeLocalJson(STORAGE_KEYS.draft, draft);
  writeSessionJson(SESSION_KEYS.draft, draft);
  updateDraftStatus(`Черновик сохранен в ${formatTime(draft.updatedAt)} (в локальном и сессионном хранилище)`);
}

function restoreDraft() {
  const draft = getCurrentDraft();

  if (!draft) {
    nameInput.value = state.currentAuthor || DEFAULT_AUTHOR;
    updateDraftStatus("Черновик не сохранен");
    return;
  }

  nameInput.value = draft.author || state.currentAuthor || DEFAULT_AUTHOR;
  textInput.value = draft.text || "";
  updateCounter();
  updateDraftStatus(`Черновик восстановлен (${formatTime(draft.updatedAt)})`);
}

function clearDraft() {
  removeLocalValue(STORAGE_KEYS.draft);
  removeSessionValue(SESSION_KEYS.draft);
  updateDraftStatus("Черновик не сохранен");
}

function updateDraftStatus(message) {
  draftStatus.textContent = message;
}

function getCurrentDraft() {
  const sessionDraft = readSessionJson(SESSION_KEYS.draft, null);
  if (sessionDraft && (sessionDraft.author || sessionDraft.text)) {
    return sessionDraft;
  }

  const localDraft = readLocalJson(STORAGE_KEYS.draft, null);
  if (localDraft && (localDraft.author || localDraft.text)) {
    return localDraft;
  }

  return null;
}

function createLocalPost({ id, author, text, image = "", syncStatus = SYNC_STATUS.SYNCED }) {
  const postId =
    id ||
    (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `post-${Date.now()}-${Math.floor(Math.random() * 100000)}`);

  return normalizePost({
    id: postId,
    source: "local",
    serverId: null,
    author,
    text,
    image,
    createdAt: Date.now(),
    likes: 0,
    comments: [],
    commentsLoaded: true,
    commentsLoading: false,
    commentsError: "",
    isLiked: false,
    areCommentsOpen: false,
    lastCommentAuthor: author,
    syncStatus,
  });
}

function persistFeedCache() {
  state.lastCacheSavedAt = Date.now();
  writeLocalJson(STORAGE_KEYS.feedCache, {
    savedAt: state.lastCacheSavedAt,
    items: state.posts,
  });
  updateCacheInfo();
}

function persistQueue() {
  writeLocalJson(STORAGE_KEYS.queue, state.queue);
}

function persistVisiblePostIds() {
  writeSessionJson(SESSION_KEYS.visiblePostIds, state.visiblePostIds);
}

function updateCacheInfo() {
  if (!state.lastCacheSavedAt) {
    cacheInfo.textContent = "Кэш еще не создан.";
    return;
  }

  const minutesAgo = Math.max(0, Math.round((Date.now() - state.lastCacheSavedAt) / 60000));
  cacheInfo.textContent =
    minutesAgo === 0 ? "Кэш обновлен только что." : `Кэш обновлен ${minutesAgo} мин. назад (в локальном хранилище).`;
}

function ensureVisiblePostIds() {
  state.visiblePostIds = state.visiblePostIds.filter((id) => state.posts.some((post) => post.id === id));

  if (!state.visiblePostIds.length && state.posts.length) {
    state.visiblePostIds = state.posts.slice(0, POSTS_BATCH_SIZE).map((post) => post.id);
  }

  persistVisiblePostIds();
}

function prependVisiblePost(postId) {
  state.visiblePostIds = [postId, ...state.visiblePostIds.filter((id) => id !== postId)];
  persistVisiblePostIds();
}

function reconcileQueueWithPosts() {
  let recovered = false;

  for (const queueItem of state.queue) {
    const post = findPost(queueItem.id);
    if (post) {
      post.syncStatus = Number(queueItem.attempts || 0) >= QUEUE_RETRY_LIMIT ? SYNC_STATUS.FAILED : SYNC_STATUS.QUEUED;
      continue;
    }

    const payload = queueItem.payload || {};
    state.posts.unshift(
      createLocalPost({
        id: queueItem.id,
        author: payload.author || DEFAULT_AUTHOR,
        text: payload.text || "",
        syncStatus: Number(queueItem.attempts || 0) >= QUEUE_RETRY_LIMIT ? SYNC_STATUS.FAILED : SYNC_STATUS.QUEUED,
      }),
    );
    recovered = true;
  }

  return recovered;
}

function removeQueueItem(postId) {
  state.queue = state.queue.filter((item) => item.id !== postId);
}

function normalizeQueue(rawQueue) {
  if (!Array.isArray(rawQueue)) {
    return [];
  }

  return rawQueue
    .map((item) => ({
      id: String(item.id || ""),
      attempts: Number(item.attempts || 0),
      lastError: String(item.lastError || ""),
      payload: {
        author: String(item.payload?.author || DEFAULT_AUTHOR),
        text: String(item.payload?.text || ""),
        createdAt: Number(item.payload?.createdAt || Date.now()),
      },
    }))
    .filter((item) => item.id && item.payload.text);
}

function findPost(postId) {
  return state.posts.find((post) => post.id === postId);
}

function disableSubmit(disabled) {
  submitPostBtn.disabled = disabled;
  submitPostBtn.textContent = disabled ? "Отправляем..." : "Опубликовать";
}

function getErrorMessage(error) {
  if (!error) {
    return "Неизвестная ошибка";
  }

  if (typeof error === "string") {
    return error;
  }

  if (error.message) {
    return error.message;
  }

  return "Ошибка запроса";
}

function formatTime(timestamp) {
  return new Intl.DateTimeFormat("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(timestamp));
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
