export const STORAGE_KEYS = {
  posts: "socialsphere-posts",
  theme: "socialsphere-theme",
  currentAuthor: "socialsphere-current-author",
  visiblePostIds: "socialsphere-visible-post-ids",
};

export const DEFAULT_AUTHOR = "Гость";
export const POST_LIMIT = 280;
export const COMMENT_LIMIT = 160;
export const POSTS_BATCH_SIZE = 3;

const seedTexts = [
  "Сегодня собрали первый кликабельный прототип ленты. Уже можно показывать на защите.",
  "Кто-нибудь уже сделал скриншоты консоли браузера для отчета? Можно свериться по оформлению.",
  "Добавил плавную прокрутку и переключение темы. Интерфейс стал заметно приятнее.",
  "Новая идея для следующей лабораторной: подключить API и загружать посты асинхронно.",
  "Напоминаю, что в этой работе нужно показать минимум три типа событий. У нас уже есть click, input и submit.",
  "Проверила LocalStorage: лайки и комментарии сохраняются даже после перезагрузки страницы.",
  "Кто свободен вечером, давайте вместе прогонять вопросы к защите.",
  "Обновил карточки постов, теперь комментарии открываются прямо внутри ленты без перехода на другую страницу.",
  "Если заметите баги на мобильной версии, пишите сюда. Хочется сдать аккуратную работу.",
];

const seedAuthors = ["Алина", "Максим", "Олег", "Ирина", "Кирилл", "София", "Денис"];
const seedComments = [
  "Выглядит очень аккуратно.",
  "Сохранение в LocalStorage особенно пригодилось.",
  "Давай добавим это в отчет как отдельный пункт.",
  "На телефоне тоже работает хорошо.",
];

export function createSeedPosts(count) {
  return Array.from({ length: count }, (_, index) =>
    createPost({
      author: seedAuthors[index % seedAuthors.length],
      text: seedTexts[index % seedTexts.length],
      createdAt: Date.now() - index * 1000 * 60 * 42,
      likes: 3 + index,
      comments:
        index % 2 === 0
          ? [createComment({ author: seedAuthors[(index + 2) % seedAuthors.length], text: seedComments[index % seedComments.length] })]
          : [],
    }),
  );
}

export function createPost({ author, text, image = "", createdAt = Date.now(), likes = 0, comments = [] }) {
  return {
    id: crypto.randomUUID(),
    author,
    text,
    image,
    createdAt,
    likes,
    comments,
    isLiked: false,
    areCommentsOpen: false,
    lastCommentAuthor: author,
  };
}

export function createComment({ author, text, createdAt = Date.now() }) {
  return {
    id: crypto.randomUUID(),
    author,
    text,
    createdAt,
  };
}

export function validatePostText(text) {
  if (!text) {
    return "Введите текст поста.";
  }

  if (text.length > POST_LIMIT) {
    return `Текст поста не должен превышать ${POST_LIMIT} символов.`;
  }

  return "";
}

export function validateImage(file) {
  if (!file) {
    return "";
  }

  if (!file.type.startsWith("image/")) {
    return "Можно загрузить только изображение.";
  }

  if (file.size > 2 * 1024 * 1024) {
    return "Размер изображения не должен превышать 2 МБ.";
  }

  return "";
}

export function validateCommentText(text) {
  if (!text) {
    return "Введите текст комментария.";
  }

  if (text.length > COMMENT_LIMIT) {
    return `Комментарий не должен превышать ${COMMENT_LIMIT} символов.`;
  }

  return "";
}

export function formatDate(timestamp) {
  return new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(timestamp));
}

export function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (symbol) => {
    const map = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    };

    return map[symbol];
  });
}

export function initials(name) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "SS";
}
