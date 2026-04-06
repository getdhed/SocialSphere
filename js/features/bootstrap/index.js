export function createBootstrapFeature(ctx) {
  const { state, config, storage, parsers, stateFeature, ui } = ctx;

  function ensureStorageVersion() {
    const savedVersion = storage.readLocalValue(config.STORAGE_KEYS.storageVersion, "");
    if (savedVersion === config.APP_STORAGE_VERSION) {
      return;
    }

    storage.removeLocalValue(config.STORAGE_KEYS.feedCache);
    storage.removeLocalValue(config.STORAGE_KEYS.queue);
    storage.removeLocalValue(config.STORAGE_KEYS.draft);

    storage.removeSessionValue(config.SESSION_KEYS.visiblePostIds);
    storage.removeSessionValue(config.SESSION_KEYS.draft);
    storage.removeSessionValue(config.SESSION_KEYS.lastSync);

    storage.writeLocalValue(config.STORAGE_KEYS.storageVersion, config.APP_STORAGE_VERSION);
  }

  function hydrateStateFromStorage() {
    state.queue = ctx.sync.normalizeQueue(storage.readLocalJson(config.STORAGE_KEYS.queue, []));

    const cachedFeed = storage.readLocalJson(config.STORAGE_KEYS.feedCache, null);
    if (cachedFeed && Array.isArray(cachedFeed.items)) {
      state.posts = parsers.sortFeedPosts(cachedFeed.items.map(parsers.normalizePost));
      state.lastCacheSavedAt = Number(cachedFeed.savedAt) || null;

      if (Date.now() - (state.lastCacheSavedAt || 0) > config.CACHE_TTL_MS) {
        ui.setFeedStatus("Показываем кэш. Обновляем данные с сервера...", "info");
      }
    }

    const queueRecoveredPosts = ctx.sync.reconcileQueueWithPosts();
    if (queueRecoveredPosts) {
      stateFeature.persistFeedCache();
    }

    const savedVisibleIds = storage.readSessionJson(config.SESSION_KEYS.visiblePostIds, []);
    if (Array.isArray(savedVisibleIds)) {
      state.visiblePostIds = savedVisibleIds.filter((id) => state.posts.some((post) => post.id === id));
    }

    stateFeature.ensureVisiblePostIds();
    state.remoteOffset = state.posts.filter((post) => post.source === "remote").length;

    const lastSyncRaw = storage.readSessionValue(config.SESSION_KEYS.lastSync, "");
    if (lastSyncRaw) {
      ui.setFeedStatus(lastSyncRaw, "success");
    } else if (!state.posts.length) {
      ui.setFeedStatus("Загружаем данные с сервера...", "info");
    }
  }

  async function bootstrapAsyncData() {
    if (!navigator.onLine) {
      if (!state.posts.length) {
        ui.setFeedStatus("Нет интернета и нет кэша. Подключитесь к сети для загрузки данных.", "error");
      }
      return;
    }

    await ctx.feed.fetchRemotePosts({ reset: true });
    await ctx.sync.syncQueue();
  }

  return {
    ensureStorageVersion,
    hydrateStateFromStorage,
    bootstrapAsyncData,
  };
}
