import { MantineProvider } from "@mantine/core";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { exportConfig } from "../app/config-file";
import { seedConfig } from "../app/seed";
import { STORAGE_KEY } from "../app/storage";
import { App } from "./App";

const renderApp = () =>
  render(
    <MantineProvider>
      <App />
    </MantineProvider>,
  );

const pickAccess = async (user: string, service: string) => {
  const events = userEvent.setup();
  await events.selectOptions(screen.getByTestId("user-select"), user);
  await events.selectOptions(screen.getByTestId("service-select"), service);
};

const upload = async (text: string) => {
  const file = new File([text], "config.json", { type: "application/json" });
  await userEvent.setup().upload(screen.getByTestId("import-input"), file);
};

describe("редактирование разрешений", () => {
  it("показывает все разрешения конфигурации", () => {
    renderApp();

    expect(screen.getAllByTestId(/^permission-item-/)).toHaveLength(seedConfig.permissions.length);
    expect(screen.getByTestId("permission-item-p3")).toHaveTextContent("Борис Каримов");
    expect(screen.getByTestId("permission-item-p3")).toHaveTextContent("Репозиторий");
  });

  it("добавляет разрешение, и расчёт сразу его учитывает", async () => {
    renderApp();
    const events = userEvent.setup();
    await events.selectOptions(screen.getByTestId("permission-subject-select"), "Вера Лисицына");
    await events.selectOptions(screen.getByTestId("permission-service-select"), "Учёт");
    await events.click(screen.getByTestId("permission-add"));
    await pickAccess("Вера Лисицына", "Учёт");

    expect(screen.getByTestId("access-result")).toHaveTextContent("Доступ есть");
  });

  it("сообщает о повторной выдаче и не создаёт дубль", async () => {
    renderApp();
    const events = userEvent.setup();
    await events.selectOptions(screen.getByTestId("permission-subject-select"), "Анна Белова");
    await events.selectOptions(screen.getByTestId("permission-service-select"), "Учёт");
    await events.click(screen.getByTestId("permission-add"));

    expect(screen.getByTestId("permission-message")).toHaveTextContent("уже выдано");
    expect(screen.getAllByTestId(/^permission-item-/)).toHaveLength(seedConfig.permissions.length);
  });

  it("отзыв одного разрешения сохраняет независимый источник доступа", async () => {
    renderApp();
    await userEvent.setup().click(screen.getByTestId("permission-remove-p1"));
    await pickAccess("Анна Белова", "Учёт");

    expect(screen.queryByTestId("permission-item-p1")).not.toBeInTheDocument();
    expect(screen.getByTestId("access-result")).toHaveTextContent("Доступ есть");
    expect(screen.getByTestId("access-sources")).toHaveTextContent("Группа «Бухгалтерия»");
    expect(screen.getByTestId("access-sources")).not.toHaveTextContent("Прямое разрешение");
  });

  it("изменения переживают перезагрузку страницы", async () => {
    const first = renderApp();
    await userEvent.setup().click(screen.getByTestId("permission-remove-p3"));
    first.unmount();
    renderApp();

    expect(screen.queryByTestId("permission-item-p3")).not.toBeInTheDocument();
    expect(screen.getAllByTestId(/^permission-item-/)).toHaveLength(4);
  });
});

describe("импорт конфигурации", () => {
  const imported = {
    ...seedConfig,
    permissions: [seedConfig.permissions[4]],
  };

  it("заменяет конфигурацию целиком и сохраняет её в браузере", async () => {
    renderApp();
    await upload(exportConfig(imported));
    await screen.findByTestId("import-status");

    const items = screen.getAllByTestId(/^permission-item-/);
    expect(items).toHaveLength(1);
    expect(within(items[0]).getByText(/Поддержка/)).toBeInTheDocument();
    expect(localStorage.getItem(STORAGE_KEY)).toBe(exportConfig(imported));
  });

  it("отвергает некорректный файл, показывает причину и не меняет конфигурацию", async () => {
    renderApp();
    const broken = JSON.parse(exportConfig(seedConfig));
    broken.permissions[0].serviceId = "vault";
    await upload(JSON.stringify(broken));

    expect(await screen.findByTestId("import-error")).toHaveTextContent(
      "permissions[0]: нет сервиса «vault»",
    );
    expect(screen.getAllByTestId(/^permission-item-/)).toHaveLength(seedConfig.permissions.length);
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it("после ошибки следующий корректный файл принимается и сообщение об ошибке уходит", async () => {
    renderApp();
    await upload("{oops");
    await screen.findByTestId("import-error");
    await upload(exportConfig(imported));

    await screen.findByTestId("import-status");
    expect(screen.queryByTestId("import-error")).not.toBeInTheDocument();
  });
});

describe("экспорт конфигурации", () => {
  it("отдаёт текущую конфигурацию для скачивания в формате файла импорта", async () => {
    renderApp();
    await userEvent.setup().click(screen.getByTestId("permission-remove-p5"));

    const href = screen.getByTestId("export-link").getAttribute("href") ?? "";
    const expected = {
      ...seedConfig,
      permissions: seedConfig.permissions.slice(0, 4),
    };
    expect(decodeURIComponent(href)).toBe(
      `data:application/json;charset=utf-8,${exportConfig(expected)}`,
    );
    expect(screen.getByTestId("export-link")).toHaveAttribute(
      "download",
      "access-policy-config.json",
    );
  });
});
