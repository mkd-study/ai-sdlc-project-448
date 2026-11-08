import { MantineProvider } from "@mantine/core";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type { Config } from "../app";
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

const readExport = (): Config => {
  const href = screen.getByTestId("export-link").getAttribute("href") ?? "";
  return JSON.parse(decodeURIComponent(href.slice(href.indexOf(",") + 1)));
};

describe("редактирование разрешений", () => {
  it("без группы предлагает всех сотрудников, включая сотрудника без групп, но не всех сразу", () => {
    localStorage.setItem(
      STORAGE_KEY,
      exportConfig({
        ...seedConfig,
        users: [...seedConfig.users, { id: "guest", name: "Гость", groupIds: [] }],
      }),
    );
    renderApp();
    expect(screen.getByLabelText("Группа сотрудников для выдачи")).toHaveDisplayValue("Не выбрана");
    expect(
      within(screen.getByLabelText("Кому выдать"))
        .getAllByRole("option")
        .map((option) => option.textContent),
    ).toEqual(["Не выбрано", "Анна Белова", "Борис Каримов", "Вера Лисицына", "Гость"]);
    expect(screen.getByLabelText("Кому выдать")).toHaveValue("");
    expect(screen.getByTestId("permission-add")).toBeDisabled();
  });

  it.each([
    { recipient: "user:anna", permission: "Анна Белова: Почта" },
    { recipient: "group:accounting", permission: "Группа «Бухгалтерия»: Почта" },
  ])(
    "после перезагрузки сохраняет разрешение «$permission» и возвращает оба полных списка",
    async ({ recipient, permission }) => {
      const first = renderApp();
      const events = userEvent.setup();
      await events.selectOptions(
        screen.getByLabelText("Группа сотрудников для проверки"),
        "support",
      );
      await events.selectOptions(
        screen.getByLabelText("Группа сотрудников для выдачи"),
        "accounting",
      );
      await events.selectOptions(screen.getByLabelText("Кому выдать"), recipient);
      await events.selectOptions(screen.getByLabelText("К какому сервису"), "mail");
      await events.click(screen.getByTestId("permission-add"));
      first.unmount();
      renderApp();
      expect(screen.getByText(permission)).toBeInTheDocument();
      expect(screen.getByLabelText("Группа сотрудников для проверки")).toHaveDisplayValue(
        "Все группы",
      );
      expect(screen.getByLabelText("Группа сотрудников для выдачи")).toHaveDisplayValue(
        "Не выбрана",
      );
      expect(screen.getByLabelText("Кому выдать")).toHaveValue("");
      expect(
        screen.queryByRole("option", { name: "Все сотрудники группы" }),
      ).not.toBeInTheDocument();
      expect(within(screen.getByLabelText("Сотрудник")).getAllByRole("option")).toHaveLength(4);
      expect(within(screen.getByLabelText("Кому выдать")).getAllByRole("option")).toHaveLength(4);
    },
  );

  it.each(["user:boris", "group:support"])(
    "при активных фильтрах удаляет один источник, сохраняя остальные данные и получателя %s",
    async (recipient) => {
      renderApp();
      const events = userEvent.setup();
      await events.selectOptions(
        screen.getByLabelText("Группа сотрудников для проверки"),
        "accounting",
      );
      await pickAccess("Анна Белова", "Учёт");
      await events.selectOptions(screen.getByLabelText("Группа сотрудников для выдачи"), "support");
      await events.selectOptions(screen.getByLabelText("Кому выдать"), recipient);
      await events.click(screen.getByTestId("permission-remove-p1"));
      expect(screen.getByTestId("access-result")).toHaveTextContent("Доступ есть");
      expect(screen.getByTestId("access-sources")).toHaveTextContent("Группа «Бухгалтерия»");
      expect(screen.getByTestId("access-sources")).not.toHaveTextContent("Прямое разрешение");
      expect(screen.getByLabelText("Группа сотрудников для проверки")).toHaveValue("accounting");
      expect(screen.getByLabelText("Группа сотрудников для выдачи")).toHaveValue("support");
      expect(screen.getByLabelText("Сотрудник")).toHaveValue("anna");
      expect(screen.getByLabelText("Кому выдать")).toHaveValue(recipient);
      const expected = exportConfig({
        ...seedConfig,
        permissions: seedConfig.permissions.slice(1),
      });
      expect(decodeURIComponent(screen.getByTestId("export-link").getAttribute("href") ?? "")).toBe(
        `data:application/json;charset=utf-8,${expected}`,
      );
    },
  );

  it("выдаёт одно групповое разрешение без прямых разрешений участникам и без дублей", async () => {
    const config = {
      ...seedConfig,
      users: [
        seedConfig.users[0],
        { ...seedConfig.users[1], groupIds: ["support", "accounting"] },
        seedConfig.users[2],
      ],
    };
    localStorage.setItem(STORAGE_KEY, exportConfig(config));
    renderApp();
    const events = userEvent.setup();
    await events.selectOptions(
      screen.getByLabelText("Группа сотрудников для выдачи"),
      "accounting",
    );
    await events.selectOptions(screen.getByLabelText("Кому выдать"), "Все сотрудники группы");
    await events.selectOptions(screen.getByLabelText("К какому сервису"), "mail");
    await events.click(screen.getByTestId("permission-add"));
    expect(screen.getByText("Группа «Бухгалтерия»: Почта")).toBeInTheDocument();
    const granted = readExport();
    expect(granted).toEqual({
      version: 1,
      ...config,
      permissions: [
        ...config.permissions,
        { id: expect.any(String), subject: { type: "group", id: "accounting" }, serviceId: "mail" },
      ],
    });
    expect(screen.getByLabelText("Кому выдать")).toHaveValue("group:accounting");
    await events.click(screen.getByTestId("permission-add"));
    expect(screen.getByTestId("permission-message")).toHaveTextContent("уже выдано");
    expect(readExport()).toEqual(granted);
    await pickAccess("Анна Белова", "Почта");
    expect(screen.getByTestId("access-sources")).toHaveTextContent("Группа «Бухгалтерия»");
  });

  it.each(["support", ""])(
    "при смене группы на «%s» сбрасывает всех участников, сохраняет сервис и не восстанавливает выбор",
    async (nextGroup) => {
      renderApp();
      const events = userEvent.setup();
      const filter = screen.getByLabelText("Группа сотрудников для выдачи");
      const recipients = screen.getByLabelText("Кому выдать");
      await events.selectOptions(filter, "accounting");
      await events.selectOptions(recipients, "Все сотрудники группы");
      await events.selectOptions(screen.getByLabelText("К какому сервису"), "mail");
      await events.selectOptions(filter, "accounting");
      expect(recipients).toHaveValue("group:accounting");
      expect(screen.getByTestId("permission-add")).toBeEnabled();
      await events.selectOptions(filter, nextGroup);
      expect(screen.getByTestId("permission-add")).toBeDisabled();
      expect(recipients).toHaveValue("");
      expect(screen.getByLabelText("К какому сервису")).toHaveValue("mail");
      await events.click(screen.getByTestId("permission-add"));
      expect(screen.getAllByTestId(/^permission-item-/)).toHaveLength(5);
      await events.selectOptions(filter, "accounting");
      expect(recipients).toHaveValue("");
      expect(screen.getByTestId("permission-add")).toBeDisabled();
    },
  );

  it("выдаёт разрешение выбранному участнику, сохраняет выбор и не создаёт дубль", async () => {
    const config = {
      ...seedConfig,
      users: [
        { ...seedConfig.users[0], groupIds: ["accounting", "support"] },
        ...seedConfig.users.slice(1),
      ],
    };
    localStorage.setItem(STORAGE_KEY, exportConfig(config));
    renderApp();
    const events = userEvent.setup();
    const filter = screen.getByLabelText("Группа сотрудников для выдачи");
    await events.selectOptions(filter, "accounting");
    await events.selectOptions(screen.getByLabelText("Кому выдать"), "user:anna");
    await events.selectOptions(screen.getByLabelText("К какому сервису"), "mail");
    await events.click(screen.getByTestId("permission-add"));
    expect(screen.getByText("Анна Белова: Почта")).toBeInTheDocument();
    expect(screen.getAllByTestId(/^permission-item-/)).toHaveLength(6);
    expect(readExport()).toEqual({
      version: 1,
      ...config,
      permissions: [
        ...config.permissions,
        { id: expect.any(String), subject: { type: "user", id: "anna" }, serviceId: "mail" },
      ],
    });
    expect(filter).toHaveValue("accounting");
    await events.selectOptions(filter, "support");
    expect(screen.getByLabelText("Кому выдать")).toHaveValue("user:anna");
    await events.selectOptions(filter, "");
    expect(screen.getByLabelText("Кому выдать")).toHaveValue("user:anna");
    expect(screen.getByLabelText("К какому сервису")).toHaveValue("mail");
    await events.click(screen.getByTestId("permission-add"));
    expect(screen.getByTestId("permission-message")).toHaveTextContent("уже выдано");
    expect(screen.getAllByTestId(/^permission-item-/)).toHaveLength(6);
  });

  it("запрещает выдачу скрытому сотруднику и не восстанавливает его при сбросе фильтра", async () => {
    renderApp();
    const events = userEvent.setup();
    await events.selectOptions(screen.getByLabelText("Кому выдать"), "user:anna");
    await events.selectOptions(screen.getByLabelText("К какому сервису"), "mail");
    const filter = screen.getByLabelText("Группа сотрудников для выдачи");
    await events.selectOptions(filter, "support");
    expect(screen.getByLabelText("Кому выдать")).toHaveValue("");
    expect(screen.getByLabelText("К какому сервису")).toHaveValue("mail");
    expect(screen.getByTestId("permission-add")).toBeDisabled();
    await events.click(screen.getByTestId("permission-add"));
    expect(screen.getAllByTestId(/^permission-item-/)).toHaveLength(5);
    await events.selectOptions(filter, "");
    expect(screen.getByLabelText("Кому выдать")).toHaveValue("");
    expect(screen.getByTestId("permission-add")).toBeDisabled();
  });

  it("объясняет пустую группу и позволяет выдать разрешение группе", async () => {
    localStorage.setItem(
      STORAGE_KEY,
      exportConfig({
        ...seedConfig,
        groups: [...seedConfig.groups, { id: "archive", name: "Архив" }],
      }),
    );
    renderApp();
    const events = userEvent.setup();
    await events.selectOptions(screen.getByLabelText("Группа сотрудников для выдачи"), "archive");
    expect(screen.getByText("В этой группе нет сотрудников")).toBeInTheDocument();
    expect(
      within(screen.getByLabelText("Кому выдать"))
        .getAllByRole("option")
        .map((option) => option.textContent),
    ).toEqual(["Не выбрано", "Все сотрудники группы"]);
    expect(screen.getByLabelText("Кому выдать")).toHaveValue("");
    await events.selectOptions(screen.getByLabelText("Кому выдать"), "Все сотрудники группы");
    await events.selectOptions(screen.getByLabelText("К какому сервису"), "mail");
    await events.click(screen.getByTestId("permission-add"));
    expect(screen.getByText("Группа «Архив»: Почта")).toBeInTheDocument();
  });

  it("предлагает всех участников выбранной группы и её сотрудников независимо от проверки", async () => {
    renderApp();
    const events = userEvent.setup();
    const accessFilter = screen.getByLabelText("Группа сотрудников для проверки");
    const grantFilter = screen.getByLabelText("Группа сотрудников для выдачи");
    const recipients = screen.getByLabelText("Кому выдать");
    expect(grantFilter).toHaveValue("");
    await events.selectOptions(accessFilter, "accounting");
    await pickAccess("Анна Белова", "Учёт");
    await events.selectOptions(grantFilter, "support");
    expect(
      within(recipients)
        .getAllByRole("option")
        .map((option) => option.textContent),
    ).toEqual(["Не выбрано", "Все сотрудники группы", "Борис Каримов"]);
    expect(recipients).toHaveValue("");
    expect(accessFilter).toHaveValue("accounting");
    expect(screen.getByLabelText("Сотрудник")).toHaveValue("anna");
    await events.selectOptions(recipients, "Все сотрудники группы");
    await events.selectOptions(accessFilter, "development");
    expect(grantFilter).toHaveValue("support");
    expect(recipients).toHaveValue("group:support");
    expect(screen.getAllByTestId(/^permission-item-/)).toHaveLength(5);
  });

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
  it.each([
    {
      name: "других участников",
      users: [{ id: "new", name: "Новый сотрудник", groupIds: ["accounting"] }],
      names: ["Новый сотрудник"],
    },
    { name: "пустую группу", users: [], names: [] },
  ])(
    "сохраняет выбор всех при импорте $name и выдаёт разрешение той же группе",
    async ({ users, names }) => {
      renderApp();
      const events = userEvent.setup();
      await events.selectOptions(
        screen.getByLabelText("Группа сотрудников для выдачи"),
        "accounting",
      );
      await events.selectOptions(screen.getByLabelText("Кому выдать"), "Все сотрудники группы");
      await events.selectOptions(screen.getByLabelText("К какому сервису"), "mail");
      const imported = { ...seedConfig, users, permissions: [] };
      await upload(exportConfig(imported));
      await screen.findByTestId("import-status");
      expect(screen.getByLabelText("Группа сотрудников для выдачи")).toHaveValue("accounting");
      expect(screen.getByLabelText("Кому выдать")).toHaveValue("group:accounting");
      expect(screen.getByLabelText("К какому сервису")).toHaveValue("mail");
      expect(
        within(screen.getByLabelText("Кому выдать"))
          .getAllByRole("option")
          .map((option) => option.textContent),
      ).toEqual(["Не выбрано", "Все сотрудники группы", ...names]);
      expect(screen.getByTestId("permission-add")).toBeEnabled();
      await events.click(screen.getByTestId("permission-add"));
      expect(readExport()).toEqual({
        version: 1,
        ...imported,
        permissions: [
          {
            id: expect.any(String),
            subject: { type: "group", id: "accounting" },
            serviceId: "mail",
          },
        ],
      });
    },
  );

  it("предоставляет новому участнику доступ через ранее выданное групповое разрешение", async () => {
    renderApp();
    const events = userEvent.setup();
    await events.selectOptions(
      screen.getByLabelText("Группа сотрудников для выдачи"),
      "accounting",
    );
    await events.selectOptions(screen.getByLabelText("Кому выдать"), "Все сотрудники группы");
    await events.selectOptions(screen.getByLabelText("К какому сервису"), "mail");
    await events.click(screen.getByTestId("permission-add"));
    const granted = readExport();
    await upload(
      exportConfig({
        ...granted,
        users: [...granted.users, { id: "new", name: "Новый сотрудник", groupIds: ["accounting"] }],
      }),
    );
    await screen.findByTestId("import-status");
    await events.selectOptions(
      screen.getByLabelText("Группа сотрудников для проверки"),
      "accounting",
    );
    await pickAccess("Новый сотрудник", "Почта");
    expect(screen.getByTestId("access-result")).toHaveTextContent("Доступ есть");
    expect(screen.getByTestId("access-sources")).toHaveTextContent("Группа «Бухгалтерия»");
    expect(screen.getByTestId("access-sources")).not.toHaveTextContent("Прямое разрешение");
    expect(readExport().permissions).toEqual(granted.permissions);
  });

  it.each(["user:boris", "group:support"])(
    "при ошибке импорта сохраняет получателя %s, оба фильтра и конфигурацию",
    async (recipient) => {
      const saved = exportConfig(seedConfig);
      localStorage.setItem(STORAGE_KEY, saved);
      renderApp();
      const events = userEvent.setup();
      await events.selectOptions(
        screen.getByLabelText("Группа сотрудников для проверки"),
        "accounting",
      );
      await pickAccess("Анна Белова", "Учёт");
      await events.selectOptions(screen.getByLabelText("Группа сотрудников для выдачи"), "support");
      await events.selectOptions(screen.getByLabelText("Кому выдать"), recipient);
      await events.selectOptions(screen.getByLabelText("К какому сервису"), "mail");
      const broken = {
        ...seedConfig,
        permissions: [
          { id: "broken", subject: { type: "user", id: "missing" }, serviceId: "mail" },
        ],
      };
      await upload(JSON.stringify({ version: 1, ...broken }));
      await screen.findByTestId("import-error");
      expect(screen.getByLabelText("Группа сотрудников для проверки")).toHaveValue("accounting");
      expect(screen.getByLabelText("Группа сотрудников для выдачи")).toHaveValue("support");
      expect(screen.getByLabelText("Сотрудник")).toHaveValue("anna");
      expect(screen.getByLabelText("Кому выдать")).toHaveValue(recipient);
      expect(screen.getByLabelText("Сервис")).toHaveValue("ledger");
      expect(screen.getByLabelText("К какому сервису")).toHaveValue("mail");
      expect(screen.getByTestId("access-result")).toHaveTextContent("Доступ есть");
      expect(localStorage.getItem(STORAGE_KEY)).toBe(saved);
      expect(decodeURIComponent(screen.getByTestId("export-link").getAttribute("href") ?? "")).toBe(
        `data:application/json;charset=utf-8,${saved}`,
      );
    },
  );

  it("очищает выбор при пустом импорте и не восстанавливает удалённого сотрудника", async () => {
    renderApp();
    const events = userEvent.setup();
    for (const label of ["Группа сотрудников для проверки", "Группа сотрудников для выдачи"]) {
      await events.selectOptions(screen.getByLabelText(label), "accounting");
    }
    await pickAccess("Анна Белова", "Учёт");
    await events.selectOptions(screen.getByLabelText("Кому выдать"), "user:anna");
    await events.selectOptions(screen.getByLabelText("К какому сервису"), "ledger");
    await upload(exportConfig({ users: [], groups: [], services: [], permissions: [] }));
    await screen.findByTestId("import-status");
    for (const label of [
      "Группа сотрудников для проверки",
      "Группа сотрудников для выдачи",
      "Сотрудник",
      "Кому выдать",
      "Сервис",
      "К какому сервису",
    ]) {
      const field = screen.getByLabelText(label);
      expect(field).toHaveValue("");
      expect(within(field).getAllByRole("option")).toHaveLength(1);
    }
    expect(screen.getByTestId("access-result")).toHaveTextContent("Выберите сотрудника и сервис");
    expect(screen.getByTestId("permission-add")).toBeDisabled();
    await upload(exportConfig(seedConfig));
    await within(screen.getByLabelText("Сотрудник")).findByRole("option", { name: "Анна Белова" });
    expect(screen.getByLabelText("Сотрудник")).toHaveValue("");
    expect(screen.getByLabelText("Кому выдать")).toHaveValue("");
  });

  it("сбрасывает удалённый сервис в обеих формах и требует выбрать его заново", async () => {
    renderApp();
    const events = userEvent.setup();
    await pickAccess("Анна Белова", "Учёт");
    await events.selectOptions(screen.getByLabelText("Кому выдать"), "user:anna");
    await events.selectOptions(screen.getByLabelText("К какому сервису"), "ledger");
    await upload(exportConfig({ ...seedConfig, services: [], permissions: [] }));
    await screen.findByTestId("import-status");
    expect(screen.getByTestId("access-result")).toHaveTextContent("Выберите сотрудника и сервис");
    expect(screen.getByTestId("permission-add")).toBeDisabled();
    expect(screen.getByLabelText("Сотрудник")).toHaveValue("anna");
    expect(screen.getByLabelText("Кому выдать")).toHaveValue("user:anna");
    await upload(exportConfig(seedConfig));
    await within(screen.getByLabelText("Сервис")).findByRole("option", { name: "Учёт" });
    expect(screen.getByLabelText("Сервис")).toHaveValue("");
    expect(screen.getByLabelText("К какому сервису")).toHaveValue("");
    expect(screen.getByTestId("permission-add")).toBeDisabled();
  });

  it("сбрасывает удалённую группу-получателя и не восстанавливает её после следующего импорта", async () => {
    renderApp();
    const events = userEvent.setup();
    await events.selectOptions(
      screen.getByLabelText("Группа сотрудников для выдачи"),
      "accounting",
    );
    await events.selectOptions(screen.getByLabelText("Кому выдать"), "Все сотрудники группы");
    await events.selectOptions(screen.getByLabelText("К какому сервису"), "ledger");
    await upload(exportConfig({ ...seedConfig, users: [], groups: [], permissions: [] }));
    await screen.findByTestId("import-status");
    expect(screen.getByLabelText("Группа сотрудников для выдачи")).toHaveDisplayValue("Не выбрана");
    expect(screen.getByLabelText("Кому выдать")).toHaveValue("");
    expect(screen.queryByRole("option", { name: "Все сотрудники группы" })).not.toBeInTheDocument();
    expect(screen.getByLabelText("К какому сервису")).toHaveValue("ledger");
    expect(screen.getByTestId("permission-add")).toBeDisabled();
    await upload(exportConfig(seedConfig));
    await within(screen.getByLabelText("Группа сотрудников для выдачи")).findByRole("option", {
      name: "Бухгалтерия",
    });
    expect(screen.getByLabelText("Группа сотрудников для выдачи")).toHaveDisplayValue("Не выбрана");
    expect(screen.getByLabelText("Кому выдать")).toHaveValue("");
    expect(screen.getByTestId("permission-add")).toBeDisabled();
  });

  it("возвращает все группы при удалении фильтра и сохраняет допустимый выбор", async () => {
    renderApp();
    const events = userEvent.setup();
    for (const label of ["Группа сотрудников для проверки", "Группа сотрудников для выдачи"]) {
      await events.selectOptions(screen.getByLabelText(label), "accounting");
    }
    await pickAccess("Анна Белова", "Учёт");
    await events.selectOptions(screen.getByLabelText("Кому выдать"), "user:anna");
    await events.selectOptions(screen.getByLabelText("К какому сервису"), "ledger");
    await upload(
      exportConfig({
        ...seedConfig,
        groups: seedConfig.groups.slice(1),
        users: [{ ...seedConfig.users[0], groupIds: [] }, ...seedConfig.users.slice(1)],
        permissions: [seedConfig.permissions[0]],
      }),
    );
    await screen.findByTestId("import-status");
    expect(screen.getByLabelText("Группа сотрудников для проверки")).toHaveValue("");
    expect(screen.getByLabelText("Группа сотрудников для выдачи")).toHaveValue("");
    expect(screen.getByLabelText("Сотрудник")).toHaveValue("anna");
    expect(screen.getByLabelText("Кому выдать")).toHaveValue("user:anna");
    expect(screen.getByLabelText("Сервис")).toHaveValue("ledger");
    expect(screen.getByLabelText("К какому сервису")).toHaveValue("ledger");
    await upload(exportConfig(seedConfig));
    await within(screen.getByLabelText("Группа сотрудников для проверки")).findByRole("option", {
      name: "Бухгалтерия",
    });
    expect(screen.getByLabelText("Группа сотрудников для проверки")).toHaveValue("");
    expect(screen.getByLabelText("Группа сотрудников для выдачи")).toHaveValue("");
  });

  it("сбрасывает скрытого после импорта сотрудника в обеих формах и не восстанавливает выбор", async () => {
    renderApp();
    const events = userEvent.setup();
    for (const label of ["Группа сотрудников для проверки", "Группа сотрудников для выдачи"]) {
      await events.selectOptions(screen.getByLabelText(label), "accounting");
    }
    await pickAccess("Анна Белова", "Учёт");
    await events.selectOptions(screen.getByLabelText("Кому выдать"), "user:anna");
    await events.selectOptions(screen.getByLabelText("К какому сервису"), "ledger");
    await upload(
      exportConfig({
        ...seedConfig,
        users: [{ ...seedConfig.users[0], groupIds: ["support"] }, ...seedConfig.users.slice(1)],
      }),
    );
    await screen.findByTestId("import-status");

    expect(screen.getByTestId("access-result")).toHaveTextContent("Выберите сотрудника и сервис");
    expect(screen.queryByTestId("access-sources")).not.toBeInTheDocument();
    expect(screen.getByTestId("permission-add")).toBeDisabled();
    expect(screen.getByLabelText("Сервис")).toHaveValue("ledger");
    expect(screen.getByLabelText("К какому сервису")).toHaveValue("ledger");
    expect(screen.getByLabelText("Группа сотрудников для проверки")).toHaveValue("accounting");
    expect(screen.getByLabelText("Группа сотрудников для выдачи")).toHaveValue("accounting");
    await upload(exportConfig(seedConfig));
    expect(
      await within(screen.getByLabelText("Сотрудник")).findByRole("option", {
        name: "Анна Белова",
      }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Сотрудник")).toHaveValue("");
    expect(screen.getByLabelText("Кому выдать")).toHaveValue("");
    expect(screen.getByTestId("permission-add")).toBeDisabled();
  });

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
  it("фильтрация сохраняет полный экспорт, хранилище и список разрешений", async () => {
    const saved = exportConfig(seedConfig);
    localStorage.setItem(STORAGE_KEY, saved);
    renderApp();
    const events = userEvent.setup();
    const href = screen.getByTestId("export-link").getAttribute("href");
    for (const group of ["support", "accounting", ""]) {
      for (const label of ["Группа сотрудников для проверки", "Группа сотрудников для выдачи"]) {
        await events.selectOptions(screen.getByLabelText(label), group);
      }
      if (group) {
        await events.selectOptions(screen.getByLabelText("Кому выдать"), "Все сотрудники группы");
      }
      expect(screen.getByTestId("export-link")).toHaveAttribute("href", href);
      expect(localStorage.getItem(STORAGE_KEY)).toBe(saved);
      expect(screen.getAllByTestId(/^permission-item-/)).toHaveLength(5);
    }
  });

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
