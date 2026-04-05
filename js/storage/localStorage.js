export function readLocalValue(key, fallbackValue = "") {
  try {
    const value = localStorage.getItem(key);
    return value === null ? fallbackValue : value;
  } catch (error) {
    console.error(`Не удалось прочитать ключ ${key} из локального хранилища`, error);
    return fallbackValue;
  }
}

export function writeLocalValue(key, value) {
  try {
    localStorage.setItem(key, String(value));
    return true;
  } catch (error) {
    console.error(`Не удалось сохранить ключ ${key} в локальное хранилище`, error);
    return false;
  }
}

export function readLocalJson(key, fallbackValue = null) {
  try {
    const rawValue = localStorage.getItem(key);
    return rawValue ? JSON.parse(rawValue) : fallbackValue;
  } catch (error) {
    console.error(`Не удалось прочитать JSON из локального хранилища (${key})`, error);
    return fallbackValue;
  }
}

export function writeLocalJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    console.error(`Не удалось сохранить JSON в локальное хранилище (${key})`, error);
    return false;
  }
}

export function removeLocalValue(key) {
  try {
    localStorage.removeItem(key);
  } catch (error) {
    console.error(`Не удалось удалить ключ ${key} из локального хранилища`, error);
  }
}
