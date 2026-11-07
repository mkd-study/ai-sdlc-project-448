import type { Config } from "../domain/model";
import { exportConfig, parseConfigFile } from "./config-file";
import { seedConfig } from "./seed";

export const STORAGE_KEY = "access-policy-simulator:config";

/** Читает сохранённую конфигурацию. Пусто, повреждено или нарушает целостность: учебные данные. */
export const loadConfig = (storage: Storage): Config => {
  try {
    const saved = storage.getItem(STORAGE_KEY);
    if (saved === null) {
      return seedConfig;
    }
    const result = parseConfigFile(saved);
    return result.ok ? result.config : seedConfig;
  } catch {
    return seedConfig;
  }
};

export const saveConfig = (storage: Storage, config: Config): void => {
  try {
    storage.setItem(STORAGE_KEY, exportConfig(config));
  } catch {
    // Хранилище может быть закрыто или переполнено. Работа в текущей вкладке продолжается.
  }
};
