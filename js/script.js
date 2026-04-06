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
import { createBootstrapFeature } from "./features/bootstrap/index.js";
import { createComposerFeature } from "./features/composer/index.js";
import { createFeedFeature } from "./features/feed/index.js";
import { createStateFeature } from "./features/state/index.js";
import { createSyncFeature } from "./features/sync/index.js";
import { createUiFeature } from "./features/ui/index.js";
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
import { mergeRemotePosts, normalizeComment, normalizePost, parseApiComments, parseApiPosts, sortFeedPosts } from "./utils/dataParser.js";
import {
  COMMENT_LIMIT,
  DEFAULT_AUTHOR,
  POST_LIMIT,
  createComment,
  validateCommentText,
  validateImage,
  validatePostText,
} from "./utils/helpers.js";

const dom = {
  themeBtn: document.getElementById("themeBtn"),
  connectionBadge: document.getElementById("connectionBadge"),
  syncBadge: document.getElementById("syncBadge"),
  feed: document.getElementById("feed"),
  feedStatus: document.getElementById("feedStatus"),
  feedSentinel: document.getElementById("feedSentinel"),
  feedStats: document.getElementById("feedStats"),
  profileName: document.getElementById("profileName"),
  profileMeta: document.getElementById("profileMeta"),
  totalCommentsStat: document.getElementById("totalCommentsStat"),
  loadedPostsStat: document.getElementById("loadedPostsStat"),
  queuedPostsStat: document.getElementById("queuedPostsStat"),
  cacheInfo: document.getElementById("cacheInfo"),
  postForm: document.getElementById("postForm"),
  nameInput: document.getElementById("nameInput"),
  textInput: document.getElementById("textInput"),
  imageInput: document.getElementById("imageInput"),
  textCounter: document.getElementById("textCounter"),
  draftStatus: document.getElementById("draftStatus"),
  formMessage: document.getElementById("formMessage"),
  submitPostBtn: document.getElementById("submitPostBtn"),
  openPostModalBtn: document.getElementById("openPostModalBtn"),
  openPostComposerBtn: document.getElementById("openPostComposerBtn"),
  closePostModalBtn: document.getElementById("closePostModalBtn"),
  cancelPostBtn: document.getElementById("cancelPostBtn"),
  modal: createModalController(document.getElementById("postModal")),
};

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

const ctx = {
  state,
  dom,
  api: {
    fetchPosts,
    fetchComments,
    publishPost,
  },
  storage: {
    readLocalJson,
    readLocalValue,
    removeLocalValue,
    writeLocalJson,
    writeLocalValue,
    readSessionJson,
    readSessionValue,
    removeSessionValue,
    writeSessionJson,
    writeSessionValue,
  },
  parsers: {
    mergeRemotePosts,
    normalizeComment,
    normalizePost,
    parseApiComments,
    parseApiPosts,
    sortFeedPosts,
  },
  helpers: {
    COMMENT_LIMIT,
    DEFAULT_AUTHOR,
    POST_LIMIT,
    createComment,
    validateCommentText,
    validateImage,
    validatePostText,
  },
  config: {
    APP_STORAGE_VERSION,
    CACHE_TTL_MS,
    DRAFT_AUTOSAVE_DELAY_MS,
    FEED_INITIAL_LIMIT,
    POSTS_BATCH_SIZE,
    QUEUE_RETRY_LIMIT,
    SESSION_KEYS,
    STORAGE_KEYS,
    SYNC_STATUS,
  },
  components: {
    createPostCard,
  },
  ui: null,
  stateFeature: null,
  sync: null,
  feed: null,
  composer: null,
  bootstrap: null,
};

ctx.stateFeature = createStateFeature(ctx);
ctx.ui = createUiFeature(ctx);
ctx.sync = createSyncFeature(ctx);
ctx.feed = createFeedFeature(ctx);
ctx.composer = createComposerFeature(ctx);
ctx.bootstrap = createBootstrapFeature(ctx);

ctx.bootstrap.ensureStorageVersion();
ctx.bootstrap.hydrateStateFromStorage();
applyTheme(state.theme);
ctx.composer.restoreDraft();
ctx.ui.updateCounter();
ctx.ui.updateConnectionBadge();
ctx.ui.updateSyncBadge();
ctx.ui.renderFeed();
ctx.ui.updateProfile();
ctx.ui.updateCacheInfo();
setupInfiniteScroll();
setupEventListeners();

void ctx.bootstrap.bootstrapAsyncData();

function setupEventListeners() {
  dom.themeBtn.addEventListener("click", () => {
    state.theme = state.theme === "light" ? "dark" : "light";
    applyTheme(state.theme);
    writeLocalValue(STORAGE_KEYS.theme, state.theme);
  });

  dom.openPostModalBtn.addEventListener("click", ctx.composer.openComposer);
  dom.openPostComposerBtn.addEventListener("click", ctx.composer.openComposer);
  dom.closePostModalBtn.addEventListener("click", () => dom.modal.close());
  dom.cancelPostBtn.addEventListener("click", () => dom.modal.close());

  dom.nameInput.addEventListener("input", () => {
    ctx.ui.clearFormMessage();
    ctx.composer.scheduleDraftSave();
  });

  dom.textInput.addEventListener("input", () => {
    ctx.ui.updateCounter();
    ctx.ui.clearFormMessage();
    ctx.composer.scheduleDraftSave();
  });

  dom.imageInput.addEventListener("input", () => {
    ctx.ui.clearFormMessage();
    ctx.composer.updateDraftStatus("Изображение не сохраняется в черновике автоматически.");
  });

  dom.postForm.addEventListener("submit", (event) => {
    void ctx.composer.handleSubmit(event);
  });

  dom.feed.addEventListener("click", (event) => {
    const likeButton = event.target.closest("[data-action='toggle-like']");
    if (likeButton) {
      ctx.feed.toggleLike(likeButton.dataset.postId);
      return;
    }

    const commentsButton = event.target.closest("[data-action='toggle-comments']");
    if (commentsButton) {
      ctx.feed.toggleComments(commentsButton.dataset.postId);
      return;
    }

    const retryCommentsButton = event.target.closest("[data-action='retry-comments']");
    if (retryCommentsButton) {
      const post = ctx.stateFeature.findPost(retryCommentsButton.dataset.postId);
      if (post) {
        void ctx.feed.loadCommentsForPost(post, true);
      }
    }
  });

  dom.feed.addEventListener("submit", (event) => {
    const form = event.target.closest("[data-role='comment-form']");
    if (!form) {
      return;
    }

    event.preventDefault();
    ctx.feed.handleCommentSubmit(form);
  });

  dom.feed.addEventListener("input", (event) => {
    const form = event.target.closest("[data-role='comment-form']");
    if (!form) {
      return;
    }

    const messageBox = form.querySelector("[data-role='comment-message']");
    ctx.ui.setElementMessage(messageBox, `До ${COMMENT_LIMIT} символов`, "");
  });

  window.addEventListener("online", () => {
    ctx.ui.updateConnectionBadge();
    ctx.ui.setFeedStatus("Соединение восстановлено. Синхронизируем очередь...", "info");
    void ctx.sync.syncQueue();

    if (!state.posts.some((post) => post.source === "remote")) {
      void ctx.feed.fetchRemotePosts({ reset: true });
    }
  });

  window.addEventListener("offline", () => {
    ctx.ui.updateConnectionBadge();
    ctx.ui.setFeedStatus("Оффлайн режим: данные показываются из кэша, отправка постов в очереди.", "info");
  });
}

function setupInfiniteScroll() {
  const observer = new IntersectionObserver(
    (entries) => {
      const [entry] = entries;
      if (!entry?.isIntersecting) {
        return;
      }

      void ctx.feed.loadMorePosts();
    },
    { rootMargin: "240px 0px" },
  );

  observer.observe(dom.feedSentinel);
}

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
}
