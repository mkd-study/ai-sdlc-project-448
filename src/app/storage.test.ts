import { beforeEach, describe, expect, it } from "vitest";
import { exportConfig } from "./config-file";
import { seedConfig } from "./seed";
import { STORAGE_KEY, loadConfig, saveConfig } from "./storage";

const createStorage = (): Storage => {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (key) => data.get(key) ?? null,
    key: (index) => [...data.keys()][index] ?? null,
    removeItem: (key) => void data.delete(key),
    setItem: (key, value) => void data.set(key, value),
  };
};

describe("хранение конфигурации в браузере", () => {
  let storage: Storage;
  beforeEach(() => {
    storage = createStorage();
  });

  it("отдаёт учебные данные, пока ничего не сохранено", () => {
    expect(loadConfig(storage)).toEqual(seedConfig);
  });

  it("возвращает сохранённую конфигурацию", () => {
    const changed = { ...seedConfig, permissions: seedConfig.permissions.slice(1) };
    saveConfig(storage, changed);

    expect(loadConfig(storage)).toEqual(changed);
  });

  it("хранит конфигурацию в том же формате, что и экспорт", () => {
    saveConfig(storage, seedConfig);

    expect(storage.getItem(STORAGE_KEY)).toBe(exportConfig(seedConfig));
  });

  it("возвращается к учебным данным, если сохранённое повреждено", () => {
    storage.setItem(STORAGE_KEY, "{oops");

    expect(loadConfig(storage)).toEqual(seedConfig);
  });

  it("возвращается к учебным данным, если сохранённое нарушает ссылочную целостность", () => {
    const broken = { ...seedConfig, services: [] };
    storage.setItem(STORAGE_KEY, exportConfig(broken));

    expect(loadConfig(storage)).toEqual(seedConfig);
  });
});
