export function createSyncFeature(ctx) {
  const { state, config, api, helpers, parsers, storage, stateFeature, ui } = ctx;

  async function sendPostToServer(post) {
    try {
      post.syncStatus = config.SYNC_STATUS.SENDING;
      ui.renderFeed();

      const response = await api.publishPost({
        author: post.author,
        text: post.text,
        image: post.image,
        createdAt: post.createdAt,
      });

      const serverId = Number(response.id);
      if (Number.isFinite(serverId)) {
        post.serverId = serverId;
      }

      post.syncStatus = config.SYNC_STATUS.SYNCED;
      stateFeature.persistFeedCache();
      ui.renderFeed();
      ui.updateProfile();
      return true;
    } catch (error) {
      post.syncStatus = config.SYNC_STATUS.QUEUED;
      stateFeature.persistFeedCache();
      ui.renderFeed();
      ui.updateProfile();
      return false;
    }
  }

  function enqueuePost(post, reason = "") {
    const existingQueueItem = state.queue.find((item) => item.id === post.id);
    if (existingQueueItem) {
      existingQueueItem.lastError = reason || existingQueueItem.lastError;
      stateFeature.persistQueue();
      ui.updateSyncBadge();
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

    post.syncStatus = config.SYNC_STATUS.QUEUED;
    stateFeature.persistQueue();
    stateFeature.persistFeedCache();
    ui.updateSyncBadge();
    ui.updateProfile();
  }

  async function syncQueue() {
    if (state.isSyncingQueue || !navigator.onLine || !state.queue.length) {
      ui.updateSyncBadge();
      return;
    }

    state.isSyncingQueue = true;
    ui.updateSyncBadge();

    for (const queueItem of [...state.queue]) {
      const post = stateFeature.findPost(queueItem.id);

      if (!post) {
        removeQueueItem(queueItem.id);
        continue;
      }

      post.syncStatus = config.SYNC_STATUS.SENDING;
      ui.renderFeed();

      try {
        const response = await api.publishPost(queueItem.payload);
        const serverId = Number(response.id);

        if (Number.isFinite(serverId)) {
          post.serverId = serverId;
        }

        post.syncStatus = config.SYNC_STATUS.SYNCED;
        removeQueueItem(queueItem.id);
        storage.writeSessionValue(config.SESSION_KEYS.lastSync, `Синхронизация очереди: ${stateFeature.formatTime(Date.now())}`);
      } catch (error) {
        queueItem.attempts = Number(queueItem.attempts || 0) + 1;
        queueItem.lastError = stateFeature.getErrorMessage(error);

        if (queueItem.attempts >= config.QUEUE_RETRY_LIMIT) {
          post.syncStatus = config.SYNC_STATUS.FAILED;
        } else {
          post.syncStatus = config.SYNC_STATUS.QUEUED;
        }

        if (!navigator.onLine) {
          break;
        }
      }

      stateFeature.persistQueue();
      stateFeature.persistFeedCache();
      ui.renderFeed();
      ui.updateProfile();
      ui.updateSyncBadge();
    }

    state.isSyncingQueue = false;
    stateFeature.persistQueue();
    stateFeature.persistFeedCache();
    ui.renderFeed();
    ui.updateProfile();
    ui.updateSyncBadge();

    if (!state.queue.length) {
      ui.setFeedStatus("Очередь отправки синхронизирована.", "success");
    }
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
          author: String(item.payload?.author || helpers.DEFAULT_AUTHOR),
          text: String(item.payload?.text || ""),
          createdAt: Number(item.payload?.createdAt || Date.now()),
        },
      }))
      .filter((item) => item.id && item.payload.text);
  }

  function reconcileQueueWithPosts() {
    let recovered = false;

    for (const queueItem of state.queue) {
      const post = stateFeature.findPost(queueItem.id);
      if (post) {
        post.syncStatus =
          Number(queueItem.attempts || 0) >= config.QUEUE_RETRY_LIMIT ? config.SYNC_STATUS.FAILED : config.SYNC_STATUS.QUEUED;
        continue;
      }

      const payload = queueItem.payload || {};
      const status =
        Number(queueItem.attempts || 0) >= config.QUEUE_RETRY_LIMIT ? config.SYNC_STATUS.FAILED : config.SYNC_STATUS.QUEUED;

      if (ctx.composer?.createLocalPost) {
        state.posts.unshift(
          ctx.composer.createLocalPost({
            id: queueItem.id,
            author: payload.author || helpers.DEFAULT_AUTHOR,
            text: payload.text || "",
            syncStatus: status,
          }),
        );
      } else {
        state.posts.unshift(
          parsers.normalizePost({
            id: queueItem.id,
            source: "local",
            serverId: null,
            author: payload.author || helpers.DEFAULT_AUTHOR,
            text: payload.text || "",
            image: "",
            createdAt: Date.now(),
            likes: 0,
            comments: [],
            commentsLoaded: true,
            commentsLoading: false,
            commentsError: "",
            isLiked: false,
            areCommentsOpen: false,
            lastCommentAuthor: payload.author || helpers.DEFAULT_AUTHOR,
            syncStatus: status,
          }),
        );
      }

      recovered = true;
    }

    return recovered;
  }

  return {
    sendPostToServer,
    enqueuePost,
    syncQueue,
    normalizeQueue,
    removeQueueItem,
    reconcileQueueWithPosts,
  };
}
