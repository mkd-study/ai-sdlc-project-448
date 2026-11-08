import type { Config } from "../domain/model";

export const selectEmployees = (config: Config, groupId: string, userId: string) => {
  const selectedGroupId = config.groups.some((group) => group.id === groupId) ? groupId : "";
  const users = config.users.filter(
    (user) => !selectedGroupId || user.groupIds.includes(selectedGroupId),
  );
  return {
    groupId: selectedGroupId,
    users,
    userId: users.some((user) => user.id === userId) ? userId : "",
  };
};
