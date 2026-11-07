import type { Config } from "../domain/model";

// Учебные данные: вымышленные сотрудники, группы и сервисы.
export const seedConfig: Config = {
  users: [
    { id: "anna", name: "Анна Белова", groupIds: ["accounting"] },
    { id: "boris", name: "Борис Каримов", groupIds: ["support"] },
    { id: "vera", name: "Вера Лисицына", groupIds: ["development"] },
  ],
  groups: [
    { id: "accounting", name: "Бухгалтерия" },
    { id: "development", name: "Разработка" },
    { id: "support", name: "Поддержка" },
  ],
  services: [
    { id: "ledger", name: "Учёт" },
    { id: "repository", name: "Репозиторий" },
    { id: "mail", name: "Почта" },
  ],
  permissions: [
    { id: "p1", subject: { type: "user", id: "anna" }, serviceId: "ledger" },
    { id: "p2", subject: { type: "group", id: "accounting" }, serviceId: "ledger" },
    { id: "p3", subject: { type: "user", id: "boris" }, serviceId: "repository" },
    { id: "p4", subject: { type: "group", id: "development" }, serviceId: "repository" },
    { id: "p5", subject: { type: "group", id: "support" }, serviceId: "mail" },
  ],
};
