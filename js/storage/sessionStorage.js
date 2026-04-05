export function readSessionValue(key, fallbackValue = "") {
  try {
    const value = sessionStorage.getItem(key);
    return value === null ? fallbackValue : value;
  } catch (error) {
    console.error(`Не удалось прочитать ключ ${key} из сессионного хранилища`, error);
    return fallbackValue;
  }
}

export function writeSessionValue(key, value) {
  try {
    sessionStorage.setItem(key, String(value));
    return true;
  } catch (error) {
    console.error(`Не удалось сохранить ключ ${key} в сессионное хранилище`, error);
    return false;
  }
}

export function readSessionJson(key, fallbackValue = null) {
  try {
    const rawValue = sessionStorage.getItem(key);
    return rawValue ? JSON.parse(rawValue) : fallbackValue;
  } catch (error) {
    console.error(`Не удалось прочитать JSON из сессионного хранилища (${key})`, error);
    return fallbackValue;
  }
}

export function writeSessionJson(key, value) {
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    console.error(`Не удалось сохранить JSON в сессионное хранилище (${key})`, error);
    return false;
  }
}

export function removeSessionValue(key) {
  try {
    sessionStorage.removeItem(key);
  } catch (error) {
    console.error(`Не удалось удалить ключ ${key} из сессионного хранилища`, error);
  }
}
