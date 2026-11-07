import { useState } from "react";
import { calculateAccess } from "../domain/access";
import type { AccessResult } from "../domain/access";
import type { Config, Subject } from "../domain/model";
import { exportConfig, parseConfigFile } from "./config-file";
import { addPermission, removePermission } from "./permissions";
import { loadConfig, saveConfig } from "./storage";

export type { AccessResult, AccessSource } from "../domain/access";
export type { Config, Group, Permission, Service, Subject, User } from "../domain/model";

export type GrantResult = "granted" | "exists";
export type ImportResult = { ok: true } | { ok: false; errors: string[] };

export type Simulator = {
  config: Config;
  checkAccess: (userId: string, serviceId: string) => AccessResult;
  grantPermission: (subject: Subject, serviceId: string) => GrantResult;
  revokePermission: (permissionId: string) => void;
  /** Текст файла экспорта для текущей конфигурации. */
  exportJson: () => string;
  /** Проверяет файл целиком. При ошибке конфигурация не меняется, при успехе заменяется и сохраняется. */
  importJson: (text: string) => ImportResult;
};

// Слой приложения единственный отдаёт компонентам конфигурацию и результат расчёта и единственный
// обращается к хранилищу браузера. Момент расчёта берётся здесь, модуль расчёта часы не читает.
export const useSimulator = (): Simulator => {
  const [config, setConfig] = useState<Config>(() => loadConfig(window.localStorage));

  const replace = (next: Config): void => {
    setConfig(next);
    saveConfig(window.localStorage, next);
  };

  return {
    config,
    checkAccess: (userId, serviceId) =>
      calculateAccess(config, { userId, serviceId, at: new Date() }),
    grantPermission: (subject, serviceId) => {
      const next = addPermission(config, subject, serviceId);
      if (next === config) {
        return "exists";
      }
      replace(next);
      return "granted";
    },
    revokePermission: (permissionId) => replace(removePermission(config, permissionId)),
    exportJson: () => exportConfig(config),
    importJson: (text) => {
      const result = parseConfigFile(text);
      if (!result.ok) {
        return result;
      }
      replace(result.config);
      return { ok: true };
    },
  };
};
