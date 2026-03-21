import { createModalController } from "./components/modal.js";
import { createPostCard } from "./components/post-card.js";
import {
  COMMENT_LIMIT,
  DEFAULT_AUTHOR,
  POSTS_BATCH_SIZE,
  POST_LIMIT,
  createComment,
  createPost,
  createSeedPosts,
  validateCommentText,
  validateImage,
  validatePostText,
} from "./utils/helpers.js";
import { loadState, saveState } from "./utils/storage.js";

const themeBtn = document.getElementById("themeBtn");
const feed = document.getElementById("feed");
const feedStatus = document.getElementById("feedStatus");
const feedSentinel = document.getElementById("feedSentinel");
const feedStats = document.getElementById("feedStats");
const profileName = document.getElementById("profileName");
const profileMeta = document.getElementById("profileMeta");
const totalCommentsStat = document.getElementById("totalCommentsStat");
const loadedPostsStat = document.getElementById("loadedPostsStat");
const postForm = document.getElementById("postForm");
const nameInput = document.getElementById("nameInput");
const textInput = document.getElementById("textInput");
const imageInput = document.getElementById("imageInput");
const textCounter = document.getElementById("textCounter");
const formMessage = document.getElementById("formMessage");
const openPostModalBtn = document.getElementById("openPostModalBtn");
const openPostComposerBtn = document.getElementById("openPostComposerBtn");
const closePostModalBtn = document.getElementById("closePostModalBtn");
const cancelPostBtn = document.getElementById("cancelPostBtn");

const modal = createModalController(document.getElementById("postModal"));
const state = loadState();

if (!state.posts.length) {
  state.posts = createSeedPosts(9);
}

if (!state.visiblePostIds.length) {
  state.visiblePostIds = state.posts.slice(0, POSTS_BATCH_SIZE).map(({ id }) => id);
}

let feedCycleIndex = state.visiblePostIds.length % Math.max(state.posts.length, 1);

applyTheme(state.theme);
renderFeed();
updateProfile();
updateCounter();
setupInfiniteScroll();

themeBtn.addEventListener("click", () => {
  state.theme = state.theme === "light" ? "dark" : "light";
  applyTheme(state.theme);
  persistState();
});

openPostModalBtn.addEventListener("click", openComposer);
openPostComposerBtn.addEventListener("click", openComposer);
closePostModalBtn.addEventListener("click", () => modal.close());
cancelPostBtn.addEventListener("click", () => modal.close());

textInput.addEventListener("input", () => {
  updateCounter();
  clearFormMessage();
});

nameInput.addEventListener("input", clearFormMessage);
imageInput.addEventListener("input", clearFormMessage);

postForm.addEventListener("submit", async (event) => {
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

  let image = "";

  if (imageFile) {
    try {
      image = await readFileAsDataUrl(imageFile);
    } catch (error) {
      console.error("Не удалось прочитать изображение", error);
      showFormMessage("Не удалось загрузить изображение.", "error");
      return;
    }
  }

  const post = createPost({ author, text, image });
  state.posts.unshift(post);
  state.visiblePostIds = [post.id, ...state.visiblePostIds.filter((id) => id !== post.id)];
  state.visiblePostIds = state.visiblePostIds.slice(0, Math.max(state.visiblePostIds.length, POSTS_BATCH_SIZE));
  state.currentAuthor = author;

  persistState();
  renderFeed();
  updateProfile();

  postForm.reset();
  updateCounter();
  showFormMessage("Пост опубликован и сразу появился в начале ленты.", "success");

  setTimeout(() => {
    clearFormMessage();
    modal.close();
  }, 900);
});

feed.addEventListener("click", (event) => {
  const likeButton = event.target.closest("[data-action='toggle-like']");
  if (likeButton) {
    const post = findPost(likeButton.dataset.postId);
    if (!post) {
      return;
    }

    post.isLiked = !post.isLiked;
    post.likes += post.isLiked ? 1 : -1;
    persistState();
    renderFeed();
    updateProfile();
    return;
  }

  const commentsButton = event.target.closest("[data-action='toggle-comments']");
  if (commentsButton) {
    const post = findPost(commentsButton.dataset.postId);
    if (!post) {
      return;
    }

    post.areCommentsOpen = !post.areCommentsOpen;
    persistState();
    renderFeed();
  }
});

feed.addEventListener("submit", (event) => {
  const form = event.target.closest("[data-role='comment-form']");
  if (!form) {
    return;
  }

  event.preventDefault();

  const post = findPost(form.dataset.postId);
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

  post.comments.push(createComment({ author, text }));
  post.areCommentsOpen = true;
  post.lastCommentAuthor = author;
  state.currentAuthor = author;

  persistState();
  renderFeed();
  updateProfile();
});

feed.addEventListener("input", (event) => {
  const form = event.target.closest("[data-role='comment-form']");
  if (!form) {
    return;
  }

  const messageBox = form.querySelector("[data-role='comment-message']");
  setElementMessage(messageBox, `До ${COMMENT_LIMIT} символов`, "");
});

function renderFeed() {
  const visiblePosts = state.visiblePostIds
    .map((id) => findPost(id))
    .filter(Boolean);

  feed.replaceChildren(...visiblePosts.map((post) => createPostCard(post)));
  loadedPostsStat.textContent = String(visiblePosts.length);
  feedStats.textContent = `${state.posts.length} постов`;
  feedStatus.textContent =
    state.posts.length > POSTS_BATCH_SIZE
      ? "Прокрутите вниз, чтобы продолжать листать ленту."
      : "Лента зациклена: после конца снова появляются первые посты.";
}

function updateProfile() {
  const totalLikes = state.posts.reduce((sum, post) => sum + post.likes, 0);
  const totalComments = state.posts.reduce((sum, post) => sum + post.comments.length, 0);
  const ownPosts = state.currentAuthor
    ? state.posts.filter((post) => post.author === state.currentAuthor).length
    : 0;

  profileName.textContent = state.currentAuthor || DEFAULT_AUTHOR;
  profileMeta.textContent = `${ownPosts} постов • ${totalLikes} лайков`;
  totalCommentsStat.textContent = String(totalComments);
}

function updateCounter() {
  textCounter.textContent = `${textInput.value.length} / ${POST_LIMIT}`;
}

function showFormMessage(message, tone) {
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
  showFormMessage("", "");
}

function setElementMessage(element, message, tone) {
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
  nameInput.value = state.currentAuthor || DEFAULT_AUTHOR;
  imageInput.value = "";
  updateCounter();
  clearFormMessage();
  modal.open();
  nameInput.focus();
}

function findPost(postId) {
  return state.posts.find((post) => post.id === postId);
}

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
}

function persistState() {
  saveState(state);
}

function setupInfiniteScroll() {
  const observer = new IntersectionObserver(
    (entries) => {
      const [entry] = entries;
      if (!entry?.isIntersecting) {
        return;
      }

      loadMorePosts();
    },
    { rootMargin: "220px 0px" },
  );

  observer.observe(feedSentinel);
}

function loadMorePosts() {
  if (!state.posts.length) {
    return;
  }

  const nextIds = [];

  for (let step = 0; step < POSTS_BATCH_SIZE; step += 1) {
    const post = state.posts[(feedCycleIndex + step) % state.posts.length];
    if (post) {
      nextIds.push(post.id);
    }
  }

  feedCycleIndex = (feedCycleIndex + POSTS_BATCH_SIZE) % state.posts.length;
  state.visiblePostIds.push(...nextIds);
  persistState();
  renderFeed();
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
