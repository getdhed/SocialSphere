import { API_BASE_URL, REQUEST_TIMEOUT_MS, RETRY_ATTEMPTS, RETRY_DELAY_MS } from "./config.js";

const ALLOWED_METHODS = new Set(["GET", "POST"]);

export class ApiError extends Error {
  constructor(message, { status = 0, url = "", payload = null, cause } = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.url = url;
    this.payload = payload;
    this.cause = cause;
  }
}

export async function fetchPosts({ start = 0, limit = 10, signal } = {}) {
  const query = new URLSearchParams({
    _start: String(Math.max(0, start)),
    _limit: String(Math.max(1, limit)),
  });

  return requestJson(`/posts?${query.toString()}`, { method: "GET", signal });
}

export async function fetchComments(postId, { signal } = {}) {
  return requestJson(`/posts/${postId}/comments`, { method: "GET", signal });
}

export async function publishPost(payload, { signal } = {}) {
  const safePayload = {
    title: String(payload.text || "").trim().slice(0, 60),
    body: String(payload.text || ""),
    userId: 1,
    author: String(payload.author || ""),
  };

  return requestJson("/posts", { method: "POST", body: safePayload, signal });
}

async function requestJson(
  path,
  { method = "GET", body, headers = {}, signal, timeoutMs = REQUEST_TIMEOUT_MS, retries = RETRY_ATTEMPTS } = {},
) {
  const normalizedMethod = method.toUpperCase();
  if (!ALLOWED_METHODS.has(normalizedMethod)) {
    throw new ApiError(`HTTP метод ${normalizedMethod} не разрешен в клиенте`);
  }

  const url = `${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
  let attempt = 0;

  while (attempt <= retries) {
    try {
      const result = await fetchWithTimeout(url, {
        method: normalizedMethod,
        body: body ? JSON.stringify(body) : undefined,
        headers: {
          "Content-Type": "application/json; charset=UTF-8",
          ...headers,
        },
        signal,
        timeoutMs,
      });

      return result;
    } catch (error) {
      if (!shouldRetry(error) || attempt >= retries) {
        throw error;
      }

      const delayMs = RETRY_DELAY_MS * (attempt + 1);
      await delay(delayMs);
      attempt += 1;
    }
  }

  throw new ApiError("Запрос завершился неизвестной ошибкой", { url });
}

async function fetchWithTimeout(url, { timeoutMs, signal, ...options }) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  const detachAbort = bindAbortSignal(signal, controller);

  try {
    const response = await fetch(url, {
      ...options,
      mode: "cors",
      cache: "no-store",
      signal: controller.signal,
    });

    const contentType = response.headers.get("content-type") || "";
    const payload = contentType.includes("application/json") ? await response.json() : await response.text();

    if (!response.ok) {
      throw new ApiError(`HTTP ${response.status}`, { status: response.status, url, payload });
    }

    return payload;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }

    if (error.name === "AbortError") {
      throw new ApiError("Превышено время ожидания ответа сервера", { url, cause: error });
    }

    throw new ApiError("Ошибка сети при обращении к серверу", { url, cause: error });
  } finally {
    detachAbort();
    clearTimeout(timeoutId);
  }
}

function bindAbortSignal(parentSignal, controller) {
  if (!parentSignal) {
    return () => {};
  }

  if (parentSignal.aborted) {
    controller.abort();
    return () => {};
  }

  const onAbort = () => controller.abort();
  parentSignal.addEventListener("abort", onAbort, { once: true });

  return () => parentSignal.removeEventListener("abort", onAbort);
}

function shouldRetry(error) {
  if (!(error instanceof ApiError)) {
    return false;
  }

  if (error.status === 0) {
    return true;
  }

  return error.status >= 500 || error.status === 429;
}

function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
