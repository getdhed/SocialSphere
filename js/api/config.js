const runtimeConfig =
  typeof window !== "undefined" && window.__SOCIALSPHERE_CONFIG__ ? window.__SOCIALSPHERE_CONFIG__ : {};

export const API_BASE_URL =
  typeof runtimeConfig.API_BASE_URL === "string" && runtimeConfig.API_BASE_URL.trim()
    ? runtimeConfig.API_BASE_URL
    : "https://jsonplaceholder.typicode.com";

export const REQUEST_TIMEOUT_MS = 10000;
export const RETRY_ATTEMPTS = 2;
export const RETRY_DELAY_MS = 500;
export const FEED_INITIAL_LIMIT = 15;
export const POSTS_BATCH_SIZE = 4;
export const CACHE_TTL_MS = 15 * 60 * 1000;
export const QUEUE_RETRY_LIMIT = 5;
export const DRAFT_AUTOSAVE_DELAY_MS = 450;
export const APP_STORAGE_VERSION = "lab6-utf8-fix-v2";

export const STORAGE_KEYS = {
  storageVersion: "socialsphere-storage-version",
  theme: "socialsphere-theme",
  currentAuthor: "socialsphere-current-author",
  feedCache: "socialsphere-feed-cache",
  queue: "socialsphere-post-queue",
  draft: "socialsphere-post-draft",
};

export const SESSION_KEYS = {
  visiblePostIds: "socialsphere-visible-post-ids",
  draft: "socialsphere-post-draft-session",
  lastSync: "socialsphere-last-sync",
};

export const SYNC_STATUS = {
  SYNCED: "synced",
  QUEUED: "queued",
  SENDING: "sending",
  FAILED: "failed",
};
