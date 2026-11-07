import { Button, Group, NativeSelect, Paper, Stack, Text, Title } from "@mantine/core";
import { useState } from "react";
import type { Config, GrantResult, Permission, Subject } from "../app";

type Props = {
  config: Config;
  onGrant: (subject: Subject, serviceId: string) => GrantResult;
  onRevoke: (permissionId: string) => void;
};

const subjectName = (subject: Subject, config: Config): string => {
  if (subject.type === "user") {
    return config.users.find(({ id }) => id === subject.id)?.name ?? subject.id;
  }
  const name = config.groups.find(({ id }) => id === subject.id)?.name ?? subject.id;
  return `Группа «${name}»`;
};

const describePermission = (permission: Permission, config: Config): string => {
  const service = config.services.find(({ id }) => id === permission.serviceId);
  return `${subjectName(permission.subject, config)}: ${service?.name ?? permission.serviceId}`;
};

const toSubject = (value: string): Subject | null => {
  const [type, id] = value.split(":");
  return (type === "user" || type === "group") && id ? { type, id } : null;
};

export const PermissionsPanel = ({ config, onGrant, onRevoke }: Props) => {
  const [subjectValue, setSubjectValue] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [message, setMessage] = useState("");

  const subject = toSubject(subjectValue);

  const grant = () => {
    if (!subject || !serviceId) {
      return;
    }
    setMessage(
      onGrant(subject, serviceId) === "exists" ? "Это разрешение уже выдано" : "Разрешение выдано",
    );
  };

  return (
    <Paper withBorder p="md">
      <Stack gap="sm">
        <Title order={2} size="h3">
          Разрешения
        </Title>
        {config.permissions.map((permission) => (
          <Group
            key={permission.id}
            justify="space-between"
            data-testid={`permission-item-${permission.id}`}
          >
            <Text>{describePermission(permission, config)}</Text>
            <Button
              variant="default"
              size="xs"
              data-testid={`permission-remove-${permission.id}`}
              onClick={() => onRevoke(permission.id)}
            >
              Удалить
            </Button>
          </Group>
        ))}
        <Group align="flex-end">
          <NativeSelect
            label="Кому выдать"
            data-testid="permission-subject-select"
            value={subjectValue}
            onChange={(event) => setSubjectValue(event.currentTarget.value)}
            data={[
              { value: "", label: "Не выбрано" },
              ...config.users.map((user) => ({ value: `user:${user.id}`, label: user.name })),
              ...config.groups.map((group) => ({
                value: `group:${group.id}`,
                label: `Группа «${group.name}»`,
              })),
            ]}
          />
          <NativeSelect
            label="К какому сервису"
            data-testid="permission-service-select"
            value={serviceId}
            onChange={(event) => setServiceId(event.currentTarget.value)}
            data={[
              { value: "", label: "Не выбран" },
              ...config.services.map((service) => ({ value: service.id, label: service.name })),
            ]}
          />
          <Button data-testid="permission-add" disabled={!subject || !serviceId} onClick={grant}>
            Выдать
          </Button>
        </Group>
        {message && <Text data-testid="permission-message">{message}</Text>}
      </Stack>
    </Paper>
  );
};
