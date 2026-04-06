export function createComposerFeature(ctx) {
  const { state, config, helpers, storage, parsers, stateFeature, ui, dom } = ctx;

  function openComposer() {
    const draft = getCurrentDraft();
    dom.nameInput.value = draft?.author || state.currentAuthor || helpers.DEFAULT_AUTHOR;
    dom.textInput.value = draft?.text || "";
    dom.imageInput.value = "";
    ui.updateCounter();
    updateDraftStatus(
      draft?.updatedAt
        ? `Черновик сохранен в ${stateFeature.formatTime(draft.updatedAt)} (в локальном и сессионном хранилище)`
        : "Черновик не сохранен",
    );
    ui.clearFormMessage();
    dom.modal.open();
    dom.textInput.focus();
  }

  async function handleSubmit(event) {
    event.preventDefault();

    const author = dom.nameInput.value.trim() || helpers.DEFAULT_AUTHOR;
    const text = dom.textInput.value.trim();
    const imageFile = dom.imageInput.files?.[0];
    const validationError = helpers.validatePostText(text);
    const imageError = helpers.validateImage(imageFile);

    if (validationError) {
      ui.showFormMessage(validationError, "error");
      return;
    }

    if (imageError) {
      ui.showFormMessage(imageError, "error");
      return;
    }

    ui.disableSubmit(true);

    try {
      let image = "";
      if (imageFile) {
        image = await readFileAsDataUrl(imageFile);
      }

      const post = createLocalPost({
        author,
        text,
        image,
        syncStatus: navigator.onLine ? config.SYNC_STATUS.SENDING : config.SYNC_STATUS.QUEUED,
      });

      state.posts = parsers.sortFeedPosts([post, ...state.posts]);
      state.currentAuthor = author;
      storage.writeLocalValue(config.STORAGE_KEYS.currentAuthor, state.currentAuthor);
      stateFeature.prependVisiblePost(post.id);
      stateFeature.persistFeedCache();
      ui.renderFeed();
      ui.updateProfile();
      clearDraft();

      if (navigator.onLine) {
        const synced = await ctx.sync.sendPostToServer(post);
        if (synced) {
          ui.showFormMessage("Пост опубликован и синхронизирован с сервером.", "success");
        } else {
          ctx.sync.enqueuePost(post, "Ошибка сети. Пост добавлен в очередь.");
          ui.showFormMessage("Пост добавлен в ленту и поставлен в очередь отправки.", "success");
        }
      } else {
        ctx.sync.enqueuePost(post, "Оффлайн режим. Пост ожидает сеть.");
        ui.showFormMessage("Оффлайн: пост сохранен локально и поставлен в очередь.", "success");
      }

      dom.postForm.reset();
      ui.updateCounter();
      setTimeout(() => {
        ui.clearFormMessage();
        dom.modal.close();
      }, 1000);
    } catch (error) {
      ui.showFormMessage(`Не удалось создать пост: ${stateFeature.getErrorMessage(error)}`, "error");
    } finally {
      ui.disableSubmit(false);
    }
  }

  function scheduleDraftSave() {
    if (state.draftTimer) {
      clearTimeout(state.draftTimer);
    }

    state.draftTimer = setTimeout(() => {
      saveDraft();
    }, config.DRAFT_AUTOSAVE_DELAY_MS);
  }

  function saveDraft() {
    const draft = {
      author: dom.nameInput.value.trim(),
      text: dom.textInput.value.trim(),
      updatedAt: Date.now(),
    };

    if (!draft.author && !draft.text) {
      clearDraft();
      return;
    }

    storage.writeLocalJson(config.STORAGE_KEYS.draft, draft);
    storage.writeSessionJson(config.SESSION_KEYS.draft, draft);
    updateDraftStatus(
      `Черновик сохранен в ${stateFeature.formatTime(draft.updatedAt)} (в локальном и сессионном хранилище)`,
    );
  }

  function restoreDraft() {
    const draft = getCurrentDraft();

    if (!draft) {
      dom.nameInput.value = state.currentAuthor || helpers.DEFAULT_AUTHOR;
      updateDraftStatus("Черновик не сохранен");
      return;
    }

    dom.nameInput.value = draft.author || state.currentAuthor || helpers.DEFAULT_AUTHOR;
    dom.textInput.value = draft.text || "";
    ui.updateCounter();
    updateDraftStatus(`Черновик восстановлен (${stateFeature.formatTime(draft.updatedAt)})`);
  }

  function clearDraft() {
    storage.removeLocalValue(config.STORAGE_KEYS.draft);
    storage.removeSessionValue(config.SESSION_KEYS.draft);
    updateDraftStatus("Черновик не сохранен");
  }

  function updateDraftStatus(message) {
    dom.draftStatus.textContent = message;
  }

  function getCurrentDraft() {
    const sessionDraft = storage.readSessionJson(config.SESSION_KEYS.draft, null);
    if (sessionDraft && (sessionDraft.author || sessionDraft.text)) {
      return sessionDraft;
    }

    const localDraft = storage.readLocalJson(config.STORAGE_KEYS.draft, null);
    if (localDraft && (localDraft.author || localDraft.text)) {
      return localDraft;
    }

    return null;
  }

  function createLocalPost({ id, author, text, image = "", syncStatus = config.SYNC_STATUS.SYNCED }) {
    const postId =
      id ||
      (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `post-${Date.now()}-${Math.floor(Math.random() * 100000)}`);

    return parsers.normalizePost({
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

  function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  }

  return {
    openComposer,
    handleSubmit,
    restoreDraft,
    scheduleDraftSave,
    clearDraft,
    updateDraftStatus,
    createLocalPost,
  };
}
