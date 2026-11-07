import type { Config } from "./model";

export type AccessQuery = {
  userId: string;
  serviceId: string;
  /** Момент расчёта. Модуль не читает часы, время приходит от вызывающего. */
  at: Date;
};

export type AccessSource =
  | { kind: "direct"; permissionId: string }
  | { kind: "group"; permissionId: string; groupId: string };

export type AccessResult = { granted: boolean; sources: AccessSource[] };

export const calculateAccess = (config: Config, query: AccessQuery): AccessResult => {
  const user = config.users.find((candidate) => candidate.id === query.userId);
  const groupIds = user?.groupIds ?? [];
  const forService = config.permissions.filter(
    (permission) => permission.serviceId === query.serviceId,
  );

  const direct: AccessSource[] = forService
    .filter(({ subject }) => subject.type === "user" && subject.id === query.userId)
    .map(({ id }) => ({ kind: "direct", permissionId: id }));
  const viaGroups: AccessSource[] = forService
    .filter(({ subject }) => subject.type === "group" && groupIds.includes(subject.id))
    .map(({ id, subject }) => ({ kind: "group", permissionId: id, groupId: subject.id }));

  // Прямые источники идут первыми, групповые следуют в порядке разрешений.
  const sources = [...direct, ...viaGroups];

  return { granted: sources.length > 0, sources };
};
