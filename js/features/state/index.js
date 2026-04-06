export function createStateFeature(ctx) {
  const { state, config, storage } = ctx;

  function findPost(postId) {
    return state.posts.find((post) => post.id === postId);
  }

  function persistFeedCache() {
    state.lastCacheSavedAt = Date.now();
    storage.writeLocalJson(config.STORAGE_KEYS.feedCache, {
      savedAt: state.lastCacheSavedAt,
      items: state.posts,
    });

    if (ctx.ui?.updateCacheInfo) {
      ctx.ui.updateCacheInfo();
    }
  }

  function persistQueue() {
    storage.writeLocalJson(config.STORAGE_KEYS.queue, state.queue);
  }

  function persistVisiblePostIds() {
    storage.writeSessionJson(config.SESSION_KEYS.visiblePostIds, state.visiblePostIds);
  }

  function ensureVisiblePostIds() {
    state.visiblePostIds = state.visiblePostIds.filter((id) => state.posts.some((post) => post.id === id));

    if (!state.visiblePostIds.length && state.posts.length) {
      state.visiblePostIds = state.posts.slice(0, config.POSTS_BATCH_SIZE).map((post) => post.id);
    }

    persistVisiblePostIds();
  }

  function prependVisiblePost(postId) {
    state.visiblePostIds = [postId, ...state.visiblePostIds.filter((id) => id !== postId)];
    persistVisiblePostIds();
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

  return {
    findPost,
    persistFeedCache,
    persistQueue,
    persistVisiblePostIds,
    ensureVisiblePostIds,
    prependVisiblePost,
    getErrorMessage,
    formatTime,
  };
}
