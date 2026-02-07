const themeBtn = document.getElementById("themeBtn");
const postForm = document.getElementById("postForm");
const nameInput = document.getElementById("nameInput");
const textInput = document.getElementById("textInput");
const feed = document.getElementById("feed");

let postsCount = 0;

function formatTime(date) {
  return date.toLocaleString("ru-RU", { dateStyle: "short", timeStyle: "short" });
}

function renderPost(name, text) {
  const post = document.createElement("div");
  post.className = "post";

  post.innerHTML = `
    <div class="post__top">
      <div class="post__name">${escapeHtml(name)}</div>
      <div class="post__time">${formatTime(new Date())}</div>
    </div>
    <p class="post__text">${escapeHtml(text)}</p>
  `;

  feed.prepend(post);
}

function escapeHtml(str) {
  return str.replace(/[&<>"']/g, (m) => {
    const map = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" };
    return map[m];
  });
}

themeBtn.addEventListener("click", () => {
  const isLight = document.documentElement.getAttribute("data-theme") === "light";
  document.documentElement.setAttribute("data-theme", isLight ? "dark" : "light");
});

postForm.addEventListener("submit", (e) => {
  e.preventDefault();

  const name = nameInput.value.trim() || "Гость";
  const text = textInput.value.trim();

  if (!text) return;

  renderPost(name, text);
  postsCount++;

  document.querySelector(".profile__name").textContent = name;
  document.querySelector(".profile__meta").textContent = `${postsCount} постов`;

  textInput.value = "";
});