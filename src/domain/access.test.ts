import { describe, expect, it } from "vitest";
import { calculateAccess } from "./access";
import type { Config } from "./model";

const config: Config = {
  users: [
    { id: "anna", name: "Анна Белова", groupIds: ["accounting", "support"] },
    { id: "boris", name: "Борис Каримов", groupIds: ["support"] },
    { id: "vera", name: "Вера Лисицына", groupIds: [] },
  ],
  groups: [
    { id: "accounting", name: "Бухгалтерия" },
    { id: "support", name: "Поддержка" },
  ],
  services: [
    { id: "ledger", name: "Учёт" },
    { id: "mail", name: "Почта" },
  ],
  permissions: [
    { id: "p1", subject: { type: "user", id: "boris" }, serviceId: "ledger" },
    { id: "p2", subject: { type: "group", id: "accounting" }, serviceId: "ledger" },
    { id: "p3", subject: { type: "group", id: "support" }, serviceId: "mail" },
    { id: "p4", subject: { type: "user", id: "anna" }, serviceId: "mail" },
  ],
};

const at = new Date("2026-10-06T12:00:00Z");

describe("calculateAccess", () => {
  it("даёт доступ по прямому разрешению", () => {
    const result = calculateAccess(config, { userId: "boris", serviceId: "ledger", at });

    expect(result.granted).toBe(true);
    expect(result.sources).toEqual([{ kind: "direct", permissionId: "p1" }]);
  });

  it("даёт доступ по разрешению группы", () => {
    const result = calculateAccess(config, { userId: "boris", serviceId: "mail", at });

    expect(result.granted).toBe(true);
    expect(result.sources).toEqual([{ kind: "group", permissionId: "p3", groupId: "support" }]);
  });

  it("называет прямой и групповой источники вместе", () => {
    const result = calculateAccess(config, { userId: "anna", serviceId: "mail", at });

    expect(result.granted).toBe(true);
    expect(result.sources).toEqual([
      { kind: "direct", permissionId: "p4" },
      { kind: "group", permissionId: "p3", groupId: "support" },
    ]);
  });

  it("называет источники нескольких групп", () => {
    const result = calculateAccess(config, { userId: "anna", serviceId: "ledger", at });

    expect(result.sources).toEqual([{ kind: "group", permissionId: "p2", groupId: "accounting" }]);
  });

  it("не даёт доступ без разрешений", () => {
    const result = calculateAccess(config, { userId: "vera", serviceId: "ledger", at });

    expect(result).toEqual({ granted: false, sources: [] });
  });

  it("не берёт разрешения чужих групп и других сервисов", () => {
    const result = calculateAccess(config, { userId: "boris", serviceId: "unknown", at });

    expect(result.granted).toBe(false);
  });

  it("принимает момент расчёта параметром и даёт тот же ответ в любое время", () => {
    const early = calculateAccess(config, {
      userId: "boris",
      serviceId: "ledger",
      at: new Date("2020-01-01T00:00:00Z"),
    });
    const late = calculateAccess(config, {
      userId: "boris",
      serviceId: "ledger",
      at: new Date("2040-01-01T00:00:00Z"),
    });

    expect(early).toEqual(late);
  });
});
