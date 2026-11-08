import { Container, List, NativeSelect, Paper, Stack, Text, Title } from "@mantine/core";
import { useState } from "react";
import { selectEmployees, useSimulator } from "../app";
import type { AccessSource, Config } from "../app";
import { ConfigTransfer } from "./ConfigTransfer";
import { PermissionsPanel } from "./PermissionsPanel";

const describeSource = (source: AccessSource, config: Config): string => {
  if (source.kind === "direct") {
    return "Прямое разрешение";
  }
  const group = config.groups.find((candidate) => candidate.id === source.groupId);
  return `Группа «${group?.name ?? source.groupId}»`;
};

export const App = () => {
  const { config, checkAccess, grantPermission, revokePermission, exportJson, importJson } =
    useSimulator();
  const [userId, setUserId] = useState("");
  const [groupId, setGroupId] = useState("");
  const [serviceId, setServiceId] = useState("");
  const selection = selectEmployees(config, groupId, userId);
  const selectedServiceId = config.services.some((service) => service.id === serviceId)
    ? serviceId
    : "";

  if (groupId !== selection.groupId) {
    setGroupId(selection.groupId);
  }
  if (userId !== selection.userId) {
    setUserId(selection.userId);
  }
  if (serviceId !== selectedServiceId) {
    setServiceId(selectedServiceId);
  }

  const result =
    selection.userId && selectedServiceId ? checkAccess(selection.userId, selectedServiceId) : null;

  return (
    <Container size="sm" py="xl">
      <Stack gap="md">
        <Title order={1}>Симулятор политик доступа</Title>
        <NativeSelect
          label="Группа сотрудников для проверки"
          value={selection.groupId}
          onChange={(event) => {
            const next = selectEmployees(config, event.currentTarget.value, userId);
            setGroupId(next.groupId);
            setUserId(next.userId);
          }}
          data={[
            { value: "", label: "Все группы" },
            ...config.groups.map((group) => ({ value: group.id, label: group.name })),
          ]}
        />
        <NativeSelect
          label="Сотрудник"
          description={
            selection.groupId && selection.users.length === 0
              ? "В этой группе нет сотрудников"
              : undefined
          }
          data-testid="user-select"
          value={selection.userId}
          onChange={(event) => setUserId(event.currentTarget.value)}
          data={[
            { value: "", label: "Не выбран" },
            ...selection.users.map((user) => ({ value: user.id, label: user.name })),
          ]}
        />
        <NativeSelect
          label="Сервис"
          data-testid="service-select"
          value={selectedServiceId}
          onChange={(event) => setServiceId(event.currentTarget.value)}
          data={[
            { value: "", label: "Не выбран" },
            ...config.services.map((service) => ({ value: service.id, label: service.name })),
          ]}
        />
        <Paper withBorder p="md">
          <Text data-testid="access-result" fw={600}>
            {result === null
              ? "Выберите сотрудника и сервис"
              : result.granted
                ? "Доступ есть"
                : "Доступа нет"}
          </Text>
          {result?.granted && (
            <List data-testid="access-sources" mt="sm">
              {result.sources.map((source) => (
                <List.Item key={source.permissionId}>{describeSource(source, config)}</List.Item>
              ))}
            </List>
          )}
        </Paper>
        <PermissionsPanel config={config} onGrant={grantPermission} onRevoke={revokePermission} />
        <ConfigTransfer exportJson={exportJson} onImport={importJson} />
      </Stack>
    </Container>
  );
};
