export function createFeedFeature(ctx) {
  const { state, config, api, parsers, helpers, storage, stateFeature, ui } = ctx;

  async function fetchRemotePosts({ reset = false } = {}) {
    if (state.isFetchingFeed || (!state.hasMoreRemote && !reset) || !navigator.onLine) {
      return;
    }

    state.isFetchingFeed = true;
    if (reset) {
      state.hasMoreRemote = true;
      state.remoteOffset = 0;
    }
    ui.setFeedStatus("Загружаем посты с сервера...", "info");

    try {
      const start = reset ? 0 : state.remoteOffset;
      const response = await api.fetchPosts({ start, limit: config.FEED_INITIAL_LIMIT });
      const remotePosts = parsers.parseApiPosts(response);

      if (remotePosts.length < config.FEED_INITIAL_LIMIT) {
        state.hasMoreRemote = false;
      }

      state.remoteOffset = start + remotePosts.length;

      const localPosts = state.posts.filter((post) => post.source === "local");
      const mergedRemote = parsers.mergeRemotePosts(state.posts, remotePosts);
      state.posts = parsers.sortFeedPosts([...localPosts, ...mergedRemote]);

      stateFeature.ensureVisiblePostIds();
      stateFeature.persistFeedCache();
      ui.renderFeed();
      ui.updateProfile();
      ui.updateCacheInfo();

      if (remotePosts.length) {
        ui.setFeedStatus("Лента обновлена с сервера.", "success");
      } else {
        ui.setFeedStatus("Сервер вернул пустой список постов.", "info");
      }
    } catch (error) {
      ui.setFeedStatus(`Ошибка загрузки ленты: ${stateFeature.getErrorMessage(error)}`, "error");
    } finally {
      state.isFetchingFeed = false;
    }
  }

  function handleCommentSubmit(form) {
    const postId = form.dataset.postId;
    const post = stateFeature.findPost(postId);
    if (!post) {
      return;
    }

    const authorInput = form.querySelector("[name='commentAuthor']");
    const textArea = form.querySelector("[name='commentText']");
    const messageBox = form.querySelector("[data-role='comment-message']");
    const author = authorInput.value.trim() || helpers.DEFAULT_AUTHOR;
    const text = textArea.value.trim();
    const validationError = helpers.validateCommentText(text);

    if (validationError) {
      ui.setElementMessage(messageBox, validationError, "error");
      return;
    }

    post.comments.push(
      parsers.normalizeComment(
        helpers.createComment({
          author,
          text,
        }),
      ),
    );
    post.commentsLoaded = true;
    post.lastCommentAuthor = author;
    post.areCommentsOpen = true;
    state.currentAuthor = author;
    storage.writeLocalValue(config.STORAGE_KEYS.currentAuthor, state.currentAuthor);

    stateFeature.persistFeedCache();
    ui.renderFeed();
    ui.updateProfile();
  }

  function toggleLike(postId) {
    const post = stateFeature.findPost(postId);
    if (!post) {
      return;
    }

    post.isLiked = !post.isLiked;
    post.likes += post.isLiked ? 1 : -1;

    stateFeature.persistFeedCache();
    ui.renderFeed();
    ui.updateProfile();
  }

  function toggleComments(postId) {
    const post = stateFeature.findPost(postId);
    if (!post) {
      return;
    }

    post.areCommentsOpen = !post.areCommentsOpen;

    if (post.areCommentsOpen && post.source === "remote" && post.serverId && !post.commentsLoaded && !post.commentsLoading) {
      void loadCommentsForPost(post);
    }

    stateFeature.persistFeedCache();
    ui.renderFeed();
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
    ui.renderFeed();

    try {
      const response = await api.fetchComments(post.serverId);
      post.comments = parsers.parseApiComments(response);
      post.commentsLoaded = true;
      post.commentsError = "";
    } catch (error) {
      post.commentsError = stateFeature.getErrorMessage(error);
    } finally {
      post.commentsLoading = false;
      stateFeature.persistFeedCache();
      ui.renderFeed();
      ui.updateProfile();
    }
  }

  async function loadMorePosts() {
    const hiddenPosts = state.posts.filter((post) => !state.visiblePostIds.includes(post.id));
    if (hiddenPosts.length) {
      const nextIds = hiddenPosts.slice(0, config.POSTS_BATCH_SIZE).map((post) => post.id);
      state.visiblePostIds.push(...nextIds);
      stateFeature.persistVisiblePostIds();
      ui.renderFeed();
      ui.updateProfile();
      return;
    }

    if (navigator.onLine && state.hasMoreRemote) {
      await fetchRemotePosts();

      const hiddenAfterFetch = state.posts.filter((post) => !state.visiblePostIds.includes(post.id));
      if (hiddenAfterFetch.length) {
        const nextIds = hiddenAfterFetch.slice(0, config.POSTS_BATCH_SIZE).map((post) => post.id);
        state.visiblePostIds.push(...nextIds);
        stateFeature.persistVisiblePostIds();
        ui.renderFeed();
        ui.updateProfile();
        return;
      }
    }

    if (!navigator.onLine) {
      ui.setFeedStatus("Оффлайн: новые посты загрузятся после восстановления сети.", "info");
    } else {
      ui.setFeedStatus("Вы просмотрели все загруженные посты.", "info");
    }
  }

  return {
    fetchRemotePosts,
    loadMorePosts,
    toggleLike,
    toggleComments,
    loadCommentsForPost,
    handleCommentSubmit,
  };
}
