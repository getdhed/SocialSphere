export function createUiFeature(ctx) {
  const { state, dom, config, components, stateFeature } = ctx;

  function renderFeed() {
    stateFeature.ensureVisiblePostIds();
    const visiblePosts = state.visiblePostIds.map((id) => stateFeature.findPost(id)).filter(Boolean);

    if (!visiblePosts.length) {
      const empty = document.createElement("div");
      empty.className = "feed-status muted";
      empty.textContent = "Нет постов для отображения.";
      dom.feed.replaceChildren(empty);
    } else {
      dom.feed.replaceChildren(...visiblePosts.map((post) => components.createPostCard(post)));
    }

    dom.feedStats.textContent = `${state.posts.length} постов`;
    dom.loadedPostsStat.textContent = String(visiblePosts.length);
  }

  function updateProfile() {
    const totalLikes = state.posts.reduce((sum, post) => sum + post.likes, 0);
    const totalComments = state.posts.reduce((sum, post) => sum + post.comments.length, 0);
    const ownPosts = state.currentAuthor ? state.posts.filter((post) => post.author === state.currentAuthor).length : 0;

    dom.profileName.textContent = state.currentAuthor || ctx.helpers.DEFAULT_AUTHOR;
    dom.profileMeta.textContent = `${ownPosts} постов • ${totalLikes} лайков`;
    dom.totalCommentsStat.textContent = String(totalComments);
    dom.queuedPostsStat.textContent = String(state.queue.length);
  }

  function updateCounter() {
    dom.textCounter.textContent = `${dom.textInput.value.length} / ${ctx.helpers.POST_LIMIT}`;
  }

  function showFormMessage(message, tone = "") {
    dom.formMessage.textContent = message;
    dom.formMessage.className = "form__message";

    if (tone === "error") {
      dom.formMessage.classList.add("is-error");
    }

    if (tone === "success") {
      dom.formMessage.classList.add("is-success");
    }
  }

  function clearFormMessage() {
    showFormMessage("");
  }

  function setFeedStatus(message, tone = "") {
    dom.feedStatus.textContent = message;
    dom.feedStatus.className = "feed-status muted";

    if (tone === "error") {
      dom.feedStatus.classList.add("is-error");
    }

    if (tone === "info") {
      dom.feedStatus.classList.add("is-info");
    }

    if (tone === "success") {
      dom.feedStatus.classList.add("is-success");
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

  function updateConnectionBadge() {
    dom.connectionBadge.textContent = navigator.onLine ? "Онлайн" : "Оффлайн";
    dom.connectionBadge.classList.toggle("badge--success", navigator.onLine);
    dom.connectionBadge.classList.toggle("badge--danger", !navigator.onLine);
  }

  function updateSyncBadge() {
    dom.syncBadge.classList.remove("badge--success", "badge--warning", "badge--danger");

    if (state.isSyncingQueue) {
      dom.syncBadge.textContent = `Синхронизация: ${state.queue.length}`;
      dom.syncBadge.classList.add("badge--warning");
    } else if (state.queue.length === 0) {
      dom.syncBadge.textContent = "Очередь: 0";
      dom.syncBadge.classList.add("badge--success");
    } else if (state.queue.some((item) => Number(item.attempts || 0) >= config.QUEUE_RETRY_LIMIT)) {
      dom.syncBadge.textContent = `Ошибки очереди: ${state.queue.length}`;
      dom.syncBadge.classList.add("badge--danger");
    } else {
      dom.syncBadge.textContent = `Очередь: ${state.queue.length}`;
      dom.syncBadge.classList.add("badge--warning");
    }
  }

  function disableSubmit(disabled) {
    dom.submitPostBtn.disabled = disabled;
    dom.submitPostBtn.textContent = disabled ? "Отправляем..." : "Опубликовать";
  }

  function updateCacheInfo() {
    if (!state.lastCacheSavedAt) {
      dom.cacheInfo.textContent = "Кэш еще не создан.";
      return;
    }

    const minutesAgo = Math.max(0, Math.round((Date.now() - state.lastCacheSavedAt) / 60000));
    dom.cacheInfo.textContent =
      minutesAgo === 0
        ? "Кэш обновлен только что."
        : `Кэш обновлен ${minutesAgo} мин. назад (в локальном хранилище).`;
  }

  return {
    renderFeed,
    updateProfile,
    setFeedStatus,
    showFormMessage,
    clearFormMessage,
    updateConnectionBadge,
    updateSyncBadge,
    updateCacheInfo,
    updateCounter,
    setElementMessage,
    disableSubmit,
  };
}
