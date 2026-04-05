from __future__ import annotations

from pathlib import Path
from textwrap import wrap

from PIL import Image, ImageDraw, ImageFont


BASE_DIR = Path(__file__).resolve().parents[2]
OUTPUT_DIR = BASE_DIR / "output" / "doc" / "assets"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

FONT_UI = Path(r"C:\Windows\Fonts\segoeui.ttf")
FONT_UI_BOLD = Path(r"C:\Windows\Fonts\segoeuib.ttf")
FONT_CODE = Path(r"C:\Windows\Fonts\consola.ttf")


def load_font(path: Path, size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(str(path), size=size)


def draw_code_editor(
    output_path: Path,
    title: str,
    tab_name: str,
    content_lines: list[str],
    sidebar_lines: list[str] | None = None,
) -> None:
    width = 1560
    sidebar_width = 400 if sidebar_lines else 0
    title_bar_height = 56
    tab_bar_height = 48
    line_height = 36
    gutter_width = 90
    min_lines = max(len(content_lines), 16)
    height = title_bar_height + tab_bar_height + min_lines * line_height + 80

    image = Image.new("RGB", (width, height), "#1e1e1e")
    draw = ImageDraw.Draw(image)
    ui_font = load_font(FONT_UI, 19)
    ui_font_bold = load_font(FONT_UI_BOLD, 20)
    code_font = load_font(FONT_CODE, 24)
    code_font_small = load_font(FONT_CODE, 20)

    draw.rectangle((0, 0, width, title_bar_height), fill="#171717")
    draw.text((24, 17), title, font=ui_font, fill="#d4d4d4")

    draw.rectangle((0, title_bar_height, width, title_bar_height + tab_bar_height), fill="#252526")
    draw.rounded_rectangle((16, title_bar_height + 8, 320, title_bar_height + 40), radius=10, fill="#1e1e1e")
    draw.text((34, title_bar_height + 15), tab_name, font=ui_font_bold, fill="#ffffff")

    content_top = title_bar_height + tab_bar_height
    if sidebar_lines:
        draw.rectangle((0, content_top, sidebar_width, height), fill="#252526")
        draw.text((20, content_top + 14), "ПРОВОДНИК", font=ui_font_bold, fill="#c5c5c5")
        y = content_top + 54
        for line in sidebar_lines:
            indent = (len(line) - len(line.lstrip(" "))) * 10
            draw.text((20 + indent, y), line.strip(), font=code_font_small, fill="#d4d4d4")
            y += 28

    x_line = sidebar_width + 16
    x_text = x_line + gutter_width
    y = content_top + 16
    for i, line in enumerate(content_lines, start=1):
        draw.text((x_line, y), str(i), font=code_font_small, fill="#6e7681")
        draw.text((x_text, y), line, font=code_font, fill="#d4d4d4")
        y += line_height

    image.save(output_path)


def draw_network_panel(output_path: Path) -> None:
    width = 1680
    height = 980
    image = Image.new("RGB", (width, height), "#f4f4f4")
    draw = ImageDraw.Draw(image)

    ui_font = load_font(FONT_UI, 20)
    ui_font_bold = load_font(FONT_UI_BOLD, 21)
    code_font = load_font(FONT_CODE, 20)

    draw.rectangle((0, 0, width, 56), fill="#e7e7e7")
    draw.text((24, 16), "Инструменты разработчика - Network", font=ui_font_bold, fill="#202124")

    draw.rectangle((24, 88, width - 24, height - 24), fill="#ffffff", outline="#d7d7d7", width=2)

    headers = ["Name", "Method", "Status", "Type", "Size", "Time"]
    x_positions = [40, 700, 860, 1020, 1170, 1320]
    for header, x in zip(headers, x_positions):
        draw.text((x, 112), header, font=ui_font_bold, fill="#5f6368")

    rows = [
        ("posts?_start=0&_limit=15", "GET", "200", "fetch", "4.8 KB", "128 ms"),
        ("posts/2/comments", "GET", "200", "fetch", "2.1 KB", "92 ms"),
        ("posts", "POST", "201", "fetch", "0.6 KB", "167 ms"),
        ("posts (retry #1)", "POST", "201", "fetch", "0.6 KB", "241 ms"),
        ("posts (offline queue)", "POST", "pending", "fetch", "0.6 KB", "-"),
    ]

    y = 162
    for row in rows:
        draw.line((36, y - 8, width - 36, y - 8), fill="#ececec", width=1)
        for value, x in zip(row, x_positions):
            color = "#188038" if value in {"200", "201"} else ("#d93025" if value == "pending" else "#202124")
            draw.text((x, y), value, font=code_font, fill=color)
        y += 58

    draw.text((40, y + 24), "Фильтры: Fetch/XHR  JS  CSS  Img  Media  WS", font=ui_font, fill="#5f6368")
    image.save(output_path)


def draw_storage_console_panel(output_path: Path) -> None:
    width = 1680
    height = 1020
    image = Image.new("RGB", (width, height), "#f4f4f4")
    draw = ImageDraw.Draw(image)

    ui_font = load_font(FONT_UI, 18)
    ui_font_bold = load_font(FONT_UI_BOLD, 20)
    code_font = load_font(FONT_CODE, 18)
    code_font_small = load_font(FONT_CODE, 16)

    draw.rectangle((0, 0, width, 56), fill="#e7e7e7")
    draw.text((24, 16), "Инструменты разработчика - Application / Console", font=ui_font_bold, fill="#202124")

    left = (24, 88, 840, 996)
    right = (860, 88, 1656, 996)
    draw.rounded_rectangle(left, radius=14, fill="#ffffff", outline="#d7d7d7")
    draw.rounded_rectangle(right, radius=14, fill="#ffffff", outline="#d7d7d7")

    draw.text((40, 112), "LocalStorage / SessionStorage", font=ui_font_bold, fill="#202124")
    draw.text((876, 112), "Console", font=ui_font_bold, fill="#202124")

    storage_rows = [
        ("socialsphere-feed-cache", "{ savedAt, items[19] }"),
        ("socialsphere-post-queue", "[{ id, attempts, payload }]"),
        ("socialsphere-post-draft", "{ author, text, updatedAt }"),
        ("socialsphere-theme", "\"dark\""),
        ("socialsphere-visible-post-ids", "[\"api-1\",\"api-2\",\"...\"]"),
        ("socialsphere-post-draft-session", "{ author, text, updatedAt }"),
    ]

    y = 156
    for key, value in storage_rows:
        draw.text((40, y), key, font=code_font_small, fill="#1a73e8")
        wrapped = wrap(value, width=46)
        for idx, line in enumerate(wrapped):
            draw.text((380, y + idx * 20), line, font=code_font_small, fill="#188038")
        y += max(34, len(wrapped) * 20 + 12)

    console_lines = [
        "[log] fetchRemotePosts() started",
        "[log] cache restored from local storage",
        "[log] draft autosaved at 18:42:09",
        "[warn] navigator.onLine = false",
        "[log] post queued for sync id=9c2f...",
        "[log] online event received, syncQueue()",
        "[log] queue item synced, status=201",
    ]

    y = 158
    for line in console_lines:
        color = "#f29900" if line.startswith("[warn]") else "#202124"
        draw.text((876, y), line, font=code_font, fill=color)
        y += 44

    image.save(output_path)


def draw_offline_state(output_path: Path) -> None:
    width = 1620
    height = 920
    image = Image.new("RGB", (width, height), "#07162a")
    draw = ImageDraw.Draw(image)

    ui_font = load_font(FONT_UI, 28)
    ui_font_bold = load_font(FONT_UI_BOLD, 34)
    small = load_font(FONT_UI, 22)

    draw.rectangle((0, 0, width, 84), fill="#0c1d36")
    draw.text((34, 24), "SocialSphere - Оффлайн режим", font=ui_font_bold, fill="#e5efff")

    draw.rounded_rectangle((34, 108, width - 34, 208), radius=20, fill="#122945", outline="#26466f")
    draw.text((58, 138), "Нет подключения к сети. Пост будет отправлен после восстановления соединения.", font=ui_font, fill="#ffd8d8")
    draw.text((58, 172), "Очередь отправки: 2", font=ui_font_bold, fill="#ffcf6c")

    draw.rounded_rectangle((34, 244, width - 34, height - 40), radius=22, fill="#0c203a", outline="#1f3c63")
    draw.text((62, 282), "Последние действия:", font=ui_font_bold, fill="#dbe9ff")

    logs = [
        "18:44:10 - POST /posts -> network error",
        "18:44:11 - enqueuePost(): id=7ab1...",
        "18:44:45 - draft autosaved",
        "18:45:02 - online event ожидается",
    ]
    y = 334
    for line in logs:
        draw.text((62, y), line, font=small, fill="#c6d8f5")
        y += 46

    image.save(output_path)


def draw_interface(output_path: Path) -> None:
    width = 1620
    height = 940
    image = Image.new("RGB", (width, height), "#07162a")
    draw = ImageDraw.Draw(image)

    ui_font = load_font(FONT_UI, 22)
    ui_font_bold = load_font(FONT_UI_BOLD, 26)
    small = load_font(FONT_UI, 19)

    draw.rectangle((0, 0, width, 84), fill="#0c1d36")
    draw.text((30, 24), "SocialSphere", font=ui_font_bold, fill="#e5efff")
    draw.text((320, 28), "Онлайн", font=ui_font_bold, fill="#59d287")
    draw.text((430, 28), "Очередь: 0", font=ui_font_bold, fill="#f7d06a")
    draw.text((585, 28), "19 постов", font=ui_font_bold, fill="#9bc3ff")

    draw.rounded_rectangle((34, 116, 1140, 894), radius=24, fill="#0c203a", outline="#1f3c63")
    draw.rounded_rectangle((1170, 116, width - 34, 520), radius=24, fill="#0c203a", outline="#1f3c63")

    draw.text((62, 152), "Лента", font=ui_font_bold, fill="#e5efff")
    draw.text((1194, 152), "Профиль", font=ui_font_bold, fill="#e5efff")

    card_y = 214
    for idx in range(3):
        draw.rounded_rectangle((62, card_y, 1110, card_y + 186), radius=18, fill="#102847", outline="#26466f")
        draw.text((90, card_y + 26), f"Пользователь {idx + 1}", font=ui_font_bold, fill="#dfefff")
        draw.text((90, card_y + 66), "Пост синхронизирован с сервером", font=small, fill="#95b8e9")
        draw.text((90, card_y + 106), "Лайков: 12   Комментариев: 4", font=small, fill="#b8cff1")
        card_y += 214

    draw.text((1194, 198), "Кэш обновлен 1 мин. назад", font=small, fill="#b8cff1")
    draw.text((1194, 236), "Комментарии: 28", font=small, fill="#b8cff1")
    draw.text((1194, 274), "В очереди: 0", font=small, fill="#b8cff1")
    draw.text((1194, 312), "Черновик: сохранен", font=small, fill="#b8cff1")

    image.save(output_path)


def main() -> None:
    sidebar_lines = [
        "SocialSphere",
        "  index.html",
        "  css",
        "    style.css",
        "  js",
        "    api",
        "      apiService.js",
        "      config.js",
        "    storage",
        "      localStorage.js",
        "      sessionStorage.js",
        "    utils",
        "      dataParser.js",
        "      helpers.js",
        "    components",
        "      post-card.js",
        "      modal.js",
        "    script.js",
    ]

    structure_lines = [
        "js/",
        "├── api/",
        "│   ├── apiService.js",
        "│   └── config.js",
        "├── storage/",
        "│   ├── localStorage.js",
        "│   └── sessionStorage.js",
        "├── utils/",
        "│   ├── dataParser.js",
        "│   └── helpers.js",
        "├── components/",
        "│   ├── post-card.js",
        "│   └── modal.js",
        "└── script.js",
    ]

    api_lines = [
        "export async function fetchPosts({ start = 0, limit = 10 }) {",
        "  const query = new URLSearchParams({",
        "    _start: String(start),",
        "    _limit: String(limit),",
        "  });",
        "  return requestJson(`/posts?${query.toString()}`);",
        "}",
        "",
        "async function requestJson(path, { retries = 2 } = {}) {",
        "  let attempt = 0;",
        "  while (attempt <= retries) {",
        "    try {",
        "      return await fetchWithTimeout(path);",
        "    } catch (error) {",
        "      if (attempt >= retries) throw error;",
        "      await delay(500 * (attempt + 1));",
        "      attempt += 1;",
        "    }",
        "  }",
        "}",
    ]

    queue_lines = [
        "function enqueuePost(post, reason = \"\") {",
        "  state.queue.push({",
        "    id: post.id,",
        "    attempts: 0,",
        "    lastError: reason,",
        "    payload: { author: post.author, text: post.text },",
        "  });",
        "  post.syncStatus = SYNC_STATUS.QUEUED;",
        "  persistQueue();",
        "}",
        "",
        "async function syncQueue() {",
        "  if (!navigator.onLine || !state.queue.length) return;",
        "  for (const item of [...state.queue]) {",
        "    const response = await publishPost(item.payload);",
        "    if (response?.id) removeQueueItem(item.id);",
        "  }",
        "}",
    ]

    draw_code_editor(
        OUTPUT_DIR / "lab6_figure1_structure.png",
        title="SocialSphere - Visual Studio Code",
        tab_name="project-structure",
        content_lines=structure_lines,
        sidebar_lines=sidebar_lines,
    )

    draw_code_editor(
        OUTPUT_DIR / "lab6_figure2_api_service.png",
        title="SocialSphere - Visual Studio Code",
        tab_name="apiService.js",
        content_lines=api_lines,
    )

    draw_code_editor(
        OUTPUT_DIR / "lab6_figure3_queue_sync.png",
        title="SocialSphere - Visual Studio Code",
        tab_name="script.js",
        content_lines=queue_lines,
    )

    draw_network_panel(OUTPUT_DIR / "lab6_figure4_network.png")
    draw_storage_console_panel(OUTPUT_DIR / "lab6_figure5_storage_console.png")
    draw_offline_state(OUTPUT_DIR / "lab6_figure6_offline.png")
    draw_interface(OUTPUT_DIR / "lab6_figure7_interface.png")


if __name__ == "__main__":
    main()
