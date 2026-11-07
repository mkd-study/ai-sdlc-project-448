import type { Config, Group, Permission, Service, User } from "../domain/model";

// Формат файла конфигурации (JSON, одинаковый для экспорта, импорта и хранения в браузере):
//   {
//     "version": 1,                                   целое число
//     "users": [{ "id", "name", "groupIds": [groupId] }],
//     "groups": [{ "id", "name" }],
//     "services": [{ "id", "name" }],
//     "permissions": [{ "id", "subject": { "type": "user" | "group", "id" }, "serviceId" }]
//   }
// Идентификаторы внутри списка уникальны. Разрешения и участие в группах ссылаются на
// существующие записи, иначе файл отвергается целиком. Неизвестные поля игнорируются: новые
// поля добавляются как необязательные, версия растёт только при несовместимой правке.

export const CONFIG_VERSION = 1;

export type ParseResult = { ok: true; config: Config } | { ok: false; errors: string[] };

type Json = Record<string, unknown>;

const isObject = (value: unknown): value is Json =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isText = (value: unknown): value is string => typeof value === "string" && value !== "";

export const exportConfig = (config: Config): string =>
  JSON.stringify({ version: CONFIG_VERSION, ...config }, null, 2);

const readList = <T>(
  root: Json,
  key: string,
  errors: string[],
  readItem: (item: Json, where: string, errors: string[]) => T | null,
): T[] => {
  const list = root[key];
  if (!Array.isArray(list)) {
    errors.push(`Поле ${key} должно быть списком`);
    return [];
  }
  const items: T[] = [];
  const ids = new Set<string>();
  list.forEach((item, index) => {
    const where = `${key}[${index}]`;
    if (!isObject(item)) {
      errors.push(`${where}: запись должна быть объектом`);
      return;
    }
    const before = errors.length;
    const read = readItem(item, where, errors);
    if (read === null || errors.length > before) {
      return;
    }
    const id = (read as { id: string }).id;
    if (ids.has(id)) {
      errors.push(`${where}: идентификатор «${id}» уже занят`);
      return;
    }
    ids.add(id);
    items.push(read);
  });
  return items;
};

const readText = (item: Json, field: string, where: string, errors: string[]): string => {
  const value = item[field];
  if (!isText(value)) {
    errors.push(`${where}: поле ${field} должно быть непустой строкой`);
    return "";
  }
  return value;
};

const readNamed = (item: Json, where: string, errors: string[]): Group | Service => ({
  id: readText(item, "id", where, errors),
  name: readText(item, "name", where, errors),
});

const readUser = (item: Json, where: string, errors: string[]): User => {
  const { groupIds } = item;
  if (!Array.isArray(groupIds) || !groupIds.every(isText)) {
    errors.push(`${where}: поле groupIds должно быть списком строк`);
  }
  return {
    ...readNamed(item, where, errors),
    groupIds: Array.isArray(groupIds) ? groupIds.filter(isText) : [],
  };
};

const readPermission = (item: Json, where: string, errors: string[]): Permission | null => {
  const { subject } = item;
  if (!isObject(subject)) {
    errors.push(`${where}: поле subject должно быть объектом`);
    return null;
  }
  if (subject.type !== "user" && subject.type !== "group") {
    errors.push(`${where}: тип субъекта должен быть user или group`);
    return null;
  }
  return {
    id: readText(item, "id", where, errors),
    subject: { type: subject.type, id: readText(subject, "id", `${where}.subject`, errors) },
    serviceId: readText(item, "serviceId", where, errors),
  };
};

const checkReferences = (config: Config, source: Json, errors: string[]): void => {
  const groups = new Set(config.groups.map(({ id }) => id));
  const users = new Set(config.users.map(({ id }) => id));
  const services = new Set(config.services.map(({ id }) => id));
  // Индексы берём из исходного списка, чтобы они совпадали с позицией в файле.
  const position = <T extends { id: string }>(key: string, item: T): number =>
    (source[key] as Json[]).findIndex((candidate) => candidate.id === item.id);

  for (const user of config.users) {
    for (const groupId of user.groupIds) {
      if (!groups.has(groupId)) {
        errors.push(`users[${position("users", user)}]: нет группы «${groupId}»`);
      }
    }
  }
  for (const permission of config.permissions) {
    const where = `permissions[${position("permissions", permission)}]`;
    const { subject } = permission;
    if (subject.type === "user" && !users.has(subject.id)) {
      errors.push(`${where}: нет пользователя «${subject.id}»`);
    }
    if (subject.type === "group" && !groups.has(subject.id)) {
      errors.push(`${where}: нет группы «${subject.id}»`);
    }
    if (!services.has(permission.serviceId)) {
      errors.push(`${where}: нет сервиса «${permission.serviceId}»`);
    }
  }
};

/** Проверяет файл целиком и ничего не меняет. Либо готовая конфигурация, либо список причин. */
export const parseConfigFile = (text: string): ParseResult => {
  let root: unknown;
  try {
    root = JSON.parse(text);
  } catch {
    return { ok: false, errors: ["Файл не разбирается как JSON"] };
  }
  if (!isObject(root)) {
    return { ok: false, errors: ["Файл должен содержать объект конфигурации"] };
  }
  const { version } = root;
  if (typeof version !== "number" || !Number.isInteger(version)) {
    return { ok: false, errors: ["Нет поля version с целым числом"] };
  }
  if (version > CONFIG_VERSION) {
    return {
      ok: false,
      errors: [`Версия формата ${version} новее поддерживаемой ${CONFIG_VERSION}`],
    };
  }

  const errors: string[] = [];
  const config: Config = {
    users: readList(root, "users", errors, readUser),
    groups: readList(root, "groups", errors, readNamed),
    services: readList(root, "services", errors, readNamed),
    permissions: readList(root, "permissions", errors, readPermission),
  };
  if (errors.length > 0) {
    return { ok: false, errors };
  }
  checkReferences(config, root, errors);
  return errors.length > 0 ? { ok: false, errors } : { ok: true, config };
};
