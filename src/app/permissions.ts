import type { Config, Subject } from "../domain/model";

const sameSubject = (left: Subject, right: Subject): boolean =>
  left.type === right.type && left.id === right.id;

const nextPermissionId = (config: Config): string => {
  const taken = new Set(config.permissions.map(({ id }) => id));
  let number = config.permissions.length + 1;
  while (taken.has(`p${number}`)) {
    number += 1;
  }
  return `p${number}`;
};

/** Выдаёт постоянное разрешение. Если такое уже есть, конфигурация не меняется. */
export const addPermission = (config: Config, subject: Subject, serviceId: string): Config => {
  const exists = config.permissions.some(
    (permission) => sameSubject(permission.subject, subject) && permission.serviceId === serviceId,
  );
  if (exists) {
    return config;
  }
  return {
    ...config,
    permissions: [
      ...config.permissions,
      { id: nextPermissionId(config), subject: { ...subject }, serviceId },
    ],
  };
};

/** Снимает ровно одно разрешение по идентификатору. Остальные источники доступа не трогает. */
export const removePermission = (config: Config, permissionId: string): Config => ({
  ...config,
  permissions: config.permissions.filter(({ id }) => id !== permissionId),
});
