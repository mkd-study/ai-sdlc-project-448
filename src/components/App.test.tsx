import { MantineProvider } from "@mantine/core";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { App } from "./App";
import { exportConfig } from "../app/config-file";
import { seedConfig } from "../app/seed";
import { STORAGE_KEY } from "../app/storage";

const renderApp = () =>
  render(
    <MantineProvider>
      <App />
    </MantineProvider>,
  );

const pick = async (user: string, service: string) => {
  const events = userEvent.setup();
  await events.selectOptions(screen.getByTestId("user-select"), user);
  await events.selectOptions(screen.getByTestId("service-select"), service);
};

describe("экран расчёта доступа", () => {
  it("сохраняет видимого сотрудника и все источники доступа при смене его группы", async () => {
    localStorage.setItem(
      STORAGE_KEY,
      exportConfig({
        ...seedConfig,
        users: [{ ...seedConfig.users[0], groupIds: ["accounting", "support"] }],
        permissions: [
          seedConfig.permissions[0],
          seedConfig.permissions[1],
          { id: "extra", subject: { type: "group", id: "support" }, serviceId: "ledger" },
        ],
      }),
    );
    renderApp();
    await pick("Анна Белова", "Учёт");
    const events = userEvent.setup();
    for (const group of ["accounting", "support", ""]) {
      await events.selectOptions(screen.getByLabelText("Группа сотрудников для проверки"), group);
      expect(screen.getByLabelText("Сотрудник")).toHaveValue("anna");
      expect(screen.getByLabelText("Сервис")).toHaveValue("ledger");
      expect(
        within(screen.getByTestId("access-sources"))
          .getAllByRole("listitem")
          .map((item) => item.textContent),
      ).toEqual(["Прямое разрешение", "Группа «Бухгалтерия»", "Группа «Поддержка»"]);
    }
    await events.selectOptions(
      screen.getByLabelText("Группа сотрудников для проверки"),
      "accounting",
    );
    await events.selectOptions(screen.getByLabelText("Сервис"), "repository");
    expect(screen.getByTestId("access-result")).toHaveTextContent("Доступа нет");
    expect(screen.queryByTestId("access-sources")).not.toBeInTheDocument();
  });

  it("сбрасывает скрытого сотрудника и результат без смены сервиса и восстановления выбора", async () => {
    renderApp();
    await pick("Анна Белова", "Учёт");
    const events = userEvent.setup();
    const filter = screen.getByLabelText("Группа сотрудников для проверки");
    await events.selectOptions(filter, "support");

    expect(screen.getByLabelText("Сотрудник")).toHaveValue("");
    expect(screen.getByLabelText("Сервис")).toHaveValue("ledger");
    expect(screen.getByTestId("access-result")).toHaveTextContent("Выберите сотрудника и сервис");
    expect(screen.queryByTestId("access-sources")).not.toBeInTheDocument();
    await events.selectOptions(filter, "");
    expect(screen.getByLabelText("Сотрудник")).toHaveValue("");
  });

  it("позволяет выбрать сотрудника при отсутствии групп", () => {
    localStorage.setItem(
      STORAGE_KEY,
      exportConfig({
        users: [{ id: "vera", name: "Вера", groupIds: [] }],
        groups: [],
        services: [],
        permissions: [],
      }),
    );
    renderApp();
    expect(
      within(screen.getByLabelText("Группа сотрудников для проверки")).getAllByRole("option"),
    ).toHaveLength(1);
    expect(
      within(screen.getByLabelText("Сотрудник")).getByRole("option", { name: "Вера" }),
    ).toBeInTheDocument();
  });

  it("показывает участника нескольких групп один раз, а сотрудника без групп только в полном списке", async () => {
    localStorage.setItem(
      STORAGE_KEY,
      exportConfig({
        ...seedConfig,
        users: [
          { id: "anna", name: "Анна", groupIds: ["accounting", "support", "accounting"] },
          { id: "vera", name: "Вера", groupIds: [] },
        ],
        permissions: [],
      }),
    );
    renderApp();
    const events = userEvent.setup();
    const filter = screen.getByLabelText("Группа сотрудников для проверки");
    const employees = screen.getByLabelText("Сотрудник");
    for (const group of ["accounting", "support"]) {
      await events.selectOptions(filter, group);
      expect(
        within(employees)
          .getAllByRole("option")
          .map((option) => option.textContent),
      ).toEqual(["Не выбран", "Анна"]);
    }
    await events.selectOptions(filter, "");
    expect(within(employees).getByRole("option", { name: "Вера" })).toBeInTheDocument();
  });

  it("объясняет отсутствие сотрудников в пустой группе", async () => {
    localStorage.setItem(
      STORAGE_KEY,
      exportConfig({
        ...seedConfig,
        groups: [...seedConfig.groups, { id: "archive", name: "Архив" }],
      }),
    );
    renderApp();
    const events = userEvent.setup();
    await events.selectOptions(screen.getByLabelText("Группа сотрудников для проверки"), "archive");

    expect(screen.getByText("В этой группе нет сотрудников")).toBeInTheDocument();
    expect(within(screen.getByLabelText("Сотрудник")).getAllByRole("option")).toHaveLength(1);
    expect(screen.getByTestId("access-result")).toHaveTextContent("Выберите сотрудника и сервис");
    await events.selectOptions(screen.getByLabelText("Группа сотрудников для проверки"), "");
    expect(screen.queryByText("В этой группе нет сотрудников")).not.toBeInTheDocument();
  });

  it("позволяет выбрать сотрудника группы и вернуть полный список", async () => {
    renderApp();
    const events = userEvent.setup();
    const filter = screen.getByRole("combobox", { name: "Группа сотрудников для проверки" });
    const employees = screen.getByRole("combobox", { name: "Сотрудник" });
    expect(filter).toHaveValue("");
    expect(
      within(employees)
        .getAllByRole("option")
        .map((option) => option.textContent),
    ).toEqual(["Не выбран", "Анна Белова", "Борис Каримов", "Вера Лисицына"]);

    await events.selectOptions(filter, "accounting");
    expect(
      within(employees)
        .getAllByRole("option")
        .map((option) => option.textContent),
    ).toEqual(["Не выбран", "Анна Белова"]);
    await pick("Анна Белова", "Учёт");
    expect(screen.getByTestId("access-result")).toHaveTextContent("Доступ есть");
    await events.selectOptions(filter, "");
    expect(within(employees).getAllByRole("option")).toHaveLength(4);
  });

  it("предлагает выбрать сотрудника и сервис до расчёта", () => {
    renderApp();

    expect(screen.getByTestId("access-result")).toHaveTextContent("Выберите сотрудника и сервис");
  });

  it("показывает доступ по прямому разрешению", async () => {
    renderApp();
    await pick("Борис Каримов", "Репозиторий");

    expect(screen.getByTestId("access-result")).toHaveTextContent("Доступ есть");
    expect(screen.getByTestId("access-sources")).toHaveTextContent("Прямое разрешение");
  });

  it("показывает доступ по разрешению группы", async () => {
    renderApp();
    await pick("Вера Лисицына", "Репозиторий");

    expect(screen.getByTestId("access-result")).toHaveTextContent("Доступ есть");
    expect(screen.getByTestId("access-sources")).toHaveTextContent("Группа «Разработка»");
  });

  it("показывает прямой и групповой источники вместе", async () => {
    renderApp();
    await pick("Анна Белова", "Учёт");

    expect(screen.getByTestId("access-sources")).toHaveTextContent("Прямое разрешение");
    expect(screen.getByTestId("access-sources")).toHaveTextContent("Группа «Бухгалтерия»");
  });

  it("сообщает об отсутствии доступа", async () => {
    renderApp();
    await pick("Вера Лисицына", "Учёт");

    expect(screen.getByTestId("access-result")).toHaveTextContent("Доступа нет");
    expect(screen.queryByTestId("access-sources")).not.toBeInTheDocument();
  });
});
