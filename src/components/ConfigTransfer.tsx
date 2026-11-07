import { Alert, Button, Group, List, Paper, Stack, Text, Title } from "@mantine/core";
import { useState } from "react";
import type { ImportResult } from "../app";

type Props = {
  exportJson: () => string;
  onImport: (text: string) => ImportResult;
};

export const ConfigTransfer = ({ exportJson, onImport }: Props) => {
  const [errors, setErrors] = useState<string[]>([]);
  const [imported, setImported] = useState(false);

  const handleFile = async (file: File | undefined) => {
    if (!file) {
      return;
    }
    const result = onImport(await file.text());
    setImported(result.ok);
    setErrors(result.ok ? [] : result.errors);
  };

  return (
    <Paper withBorder p="md">
      <Stack gap="sm">
        <Title order={2} size="h3">
          Конфигурация
        </Title>
        <Group>
          <Button
            component="a"
            variant="default"
            data-testid="export-link"
            download="access-policy-config.json"
            href={`data:application/json;charset=utf-8,${encodeURIComponent(exportJson())}`}
          >
            Экспортировать
          </Button>
          <input
            type="file"
            accept=".json,application/json"
            aria-label="Импортировать конфигурацию"
            data-testid="import-input"
            onChange={(event) => {
              void handleFile(event.currentTarget.files?.[0]);
              event.currentTarget.value = "";
            }}
          />
        </Group>
        {imported && <Text data-testid="import-status">Конфигурация заменена</Text>}
        {errors.length > 0 && (
          <Alert
            color="red"
            title="Файл не принят, конфигурация осталась прежней"
            data-testid="import-error"
          >
            <List>
              {errors.map((error) => (
                <List.Item key={error}>{error}</List.Item>
              ))}
            </List>
          </Alert>
        )}
      </Stack>
    </Paper>
  );
};
