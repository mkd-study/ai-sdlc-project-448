import { describe, expect, it } from "vitest";
import { selectEmployees } from "./index";
import type { Config } from "./index";

const config: Config = {
  users: [
    { id: "boris", name: "Борис", groupIds: ["support"] },
    { id: "anna", name: "Анна", groupIds: ["accounting", "support", "accounting"] },
    { id: "vera", name: "Вера", groupIds: [] },
  ],
  groups: [
    { id: "accounting", name: "Бухгалтерия" },
    { id: "support", name: "Поддержка" },
    { id: "archive", name: "Архив" },
  ],
  services: [],
  permissions: [],
};

describe("выбор сотрудников", () => {
  it("возвращает полный список при исчезновении группы, включая конфигурацию без групп", () => {
    const selection = selectEmployees(config, "removed", "vera");
    expect(selection.groupId).toBe("");
    expect(selection.userId).toBe("vera");
    expect(selection.users.map(({ id }) => id)).toEqual(["boris", "anna", "vera"]);
    expect(
      selectEmployees({ users: [], groups: [], services: [], permissions: [] }, "removed", "vera"),
    ).toEqual({ groupId: "", users: [], userId: "" });
    const withoutGroups = { ...config, groups: [], users: [config.users[2]] };
    expect(selectEmployees(withoutGroups, "", "vera").userId).toBe("vera");
  });

  it("сбрасывает сотрудника вне списка, включая пустую группу, и сохраняет участника", () => {
    expect(selectEmployees(config, "accounting", "boris").userId).toBe("");
    expect(selectEmployees(config, "archive", "anna")).toEqual({
      groupId: "archive",
      users: [],
      userId: "",
    });
    expect(selectEmployees(config, "support", "anna").userId).toBe("anna");
    expect(selectEmployees(config, "", "missing").userId).toBe("");
    expect(selectEmployees(config, "support", "").userId).toBe("");
  });

  it("отбирает участников каждой группы один раз, сохраняя порядок и конфигурацию", () => {
    const before = structuredClone(config);

    expect(selectEmployees(config, "accounting", "anna").users.map(({ id }) => id)).toEqual([
      "anna",
    ]);
    expect(selectEmployees(config, "support", "anna").users.map(({ id }) => id)).toEqual([
      "boris",
      "anna",
    ]);
    expect(config).toEqual(before);
  });

  it("без фильтра возвращает всех сотрудников в исходном порядке и сохраняет выбор", () => {
    const selection = selectEmployees(config, "", "vera");

    expect(selection.groupId).toBe("");
    expect(selection.users.map(({ id }) => id)).toEqual(["boris", "anna", "vera"]);
    expect(selection.userId).toBe("vera");
  });
});
