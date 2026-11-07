import { describe, expect, it } from "vitest";
import { CONFIG_VERSION, exportConfig, parseConfigFile } from "./config-file";
import { seedConfig } from "./seed";

const parseWith = (change: (file: Record<string, any>) => void) => {
  const file = JSON.parse(exportConfig(seedConfig));
  change(file);
  return parseConfigFile(JSON.stringify(file));
};

const errorsOf = (result: ReturnType<typeof parseConfigFile>) => (result.ok ? [] : result.errors);

describe("экспорт и импорт конфигурации", () => {
  it("пишет в файл целочисленную версию формата", () => {
    const file = JSON.parse(exportConfig(seedConfig));

    expect(file.version).toBe(CONFIG_VERSION);
    expect(Number.isInteger(file.version)).toBe(true);
  });

  it("возвращает ту же конфигурацию после экспорта и импорта", () => {
    const result = parseConfigFile(exportConfig(seedConfig));

    expect(result).toEqual({ ok: true, config: seedConfig });
  });

  it("принимает пустую конфигурацию", () => {
    const empty = { users: [], groups: [], services: [], permissions: [] };

    expect(parseConfigFile(exportConfig(empty))).toEqual({ ok: true, config: empty });
  });

  it("игнорирует неизвестные поля, чтобы файлы с будущими необязательными полями читались", () => {
    const result = parseWith((file) => {
      file.exportedBy = "later";
      file.users[0].nickname = "an";
    });

    expect(result).toEqual({ ok: true, config: seedConfig });
  });
});

describe("проверка файла импорта", () => {
  it("отвергает текст, который не разбирается как JSON", () => {
    expect(errorsOf(parseConfigFile("{oops"))).toEqual(["Файл не разбирается как JSON"]);
  });

  it("отвергает корень, который не объект", () => {
    expect(errorsOf(parseConfigFile("[]"))).toEqual(["Файл должен содержать объект конфигурации"]);
    expect(errorsOf(parseConfigFile("null"))).toEqual([
      "Файл должен содержать объект конфигурации",
    ]);
  });

  it("отвергает файл без версии", () => {
    expect(errorsOf(parseWith((file) => delete file.version))).toEqual([
      "Нет поля version с целым числом",
    ]);
  });

  it("отвергает нецелую версию", () => {
    expect(errorsOf(parseWith((file) => (file.version = "1")))).toEqual([
      "Нет поля version с целым числом",
    ]);
  });

  it("отвергает версию новее поддерживаемой", () => {
    expect(errorsOf(parseWith((file) => (file.version = CONFIG_VERSION + 1)))).toEqual([
      `Версия формата ${CONFIG_VERSION + 1} новее поддерживаемой ${CONFIG_VERSION}`,
    ]);
  });

  it("отвергает отсутствующий список", () => {
    expect(errorsOf(parseWith((file) => delete file.groups))).toEqual([
      "Поле groups должно быть списком",
    ]);
  });

  it("отвергает запись неправильной формы с указанием места", () => {
    expect(errorsOf(parseWith((file) => (file.users[1].name = 5)))).toEqual([
      "users[1]: поле name должно быть непустой строкой",
    ]);
  });

  it("отвергает повтор идентификатора", () => {
    const result = parseWith((file) => (file.services[1].id = "ledger"));

    expect(errorsOf(result)).toContain("services[1]: идентификатор «ledger» уже занят");
  });

  it("отвергает разрешение на несуществующего пользователя", () => {
    const result = parseWith((file) => (file.permissions[0].subject.id = "nobody"));

    expect(errorsOf(result)).toEqual(["permissions[0]: нет пользователя «nobody»"]);
  });

  it("отвергает разрешение на несуществующую группу", () => {
    const result = parseWith((file) => (file.permissions[1].subject.id = "ghosts"));

    expect(errorsOf(result)).toEqual(["permissions[1]: нет группы «ghosts»"]);
  });

  it("отвергает разрешение на несуществующий сервис", () => {
    const result = parseWith((file) => (file.permissions[2].serviceId = "vault"));

    expect(errorsOf(result)).toEqual(["permissions[2]: нет сервиса «vault»"]);
  });

  it("отвергает пользователя в несуществующей группе", () => {
    const result = parseWith((file) => file.users[0].groupIds.push("ghosts"));

    expect(errorsOf(result)).toEqual(["users[0]: нет группы «ghosts»"]);
  });

  it("отвергает неизвестный тип субъекта", () => {
    const result = parseWith((file) => (file.permissions[0].subject.type = "team"));

    expect(errorsOf(result)).toEqual(["permissions[0]: тип субъекта должен быть user или group"]);
  });

  it("собирает все ошибки файла, а не только первую", () => {
    const result = parseWith((file) => {
      file.permissions[0].serviceId = "vault";
      file.permissions[1].subject.id = "ghosts";
    });

    expect(errorsOf(result)).toHaveLength(2);
  });
});
