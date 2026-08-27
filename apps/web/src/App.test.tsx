import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { describe, expect, it } from "vitest";
import { handlers, todoFixture } from "./test/handlers.js";
import { renderApp } from "./test/render.js";
import { server } from "./test/server.js";

describe("the todo list", () => {
  it("renders every todo as a card, in the order the API returned them", async () => {
    server.use(
      handlers.listTodos([
        todoFixture({ title: "Buy milk", dueDate: "2026-09-03T15:00:00.000Z" }),
        todoFixture({ title: "File taxes", description: "Federal and provincial" }),
        todoFixture({ title: "Call mum" }),
      ]),
    );
    renderApp();

    const cards = await screen.findAllByRole("listitem");
    expect(cards.map((card) => within(card).getByRole("heading").textContent)).toEqual([
      "Buy milk",
      "File taxes",
      "Call mum",
    ]);
    expect(within(cards[0]!).getByText("Sep 3, 11:00 AM")).toHaveAttribute(
      "datetime",
      "2026-09-03T15:00:00.000Z",
    );
    expect(within(cards[1]!).getByText("Federal and provincial")).toBeInTheDocument();
  });

  it("omits the due date and description lines when they are null", async () => {
    server.use(handlers.listTodos([todoFixture({ title: "Bare", description: null, dueDate: null })]));
    renderApp();

    const card = await screen.findByRole("listitem");
    expect(within(card).queryByRole("time")).not.toBeInTheDocument();
    expect(within(card).queryByRole("paragraph")).not.toBeInTheDocument();
  });

  it("renders a completed todo with done styling", async () => {
    server.use(
      handlers.listTodos([
        todoFixture({ title: "Done", isCompleted: true }),
        todoFixture({ title: "Open", isCompleted: false }),
      ]),
    );
    renderApp();

    const [done, open] = await screen.findAllByRole("listitem");
    expect(done).toHaveAttribute("data-completed", "true");
    expect(within(done!).getByRole("heading")).toHaveClass("line-through");
    expect(open).toHaveAttribute("data-completed", "false");
    expect(within(open!).getByRole("heading")).not.toHaveClass("line-through");
  });

  it("shows skeleton cards while the list is loading", async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    server.use(
      http.get("/api/todos", async () => {
        await gate;
        return HttpResponse.json({ todos: [todoFixture({ title: "Later" })] });
      }),
    );
    renderApp();

    expect(screen.getByRole("status", { name: "Loading todos" })).toBeInTheDocument();
    release();
    await screen.findByRole("heading", { name: "Later" });
    expect(screen.queryByRole("status", { name: "Loading todos" })).not.toBeInTheDocument();
  });

  it("shows an empty state with a call to action when there are no todos", async () => {
    server.use(handlers.listTodos([]));
    renderApp();

    expect(await screen.findByText("No todos yet.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create your first todo" })).toBeInTheDocument();
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });

  it("shows an inline error with Retry when the list fails, and recovers on retry", async () => {
    server.use(handlers.listTodosFails(500));
    renderApp();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Couldn't load your todos.");
    expect(alert).toHaveTextContent("Internal server error");

    server.use(handlers.listTodos([todoFixture({ title: "Recovered" })]));
    await userEvent.click(within(alert).getByRole("button", { name: "Retry" }));

    expect(await screen.findByRole("heading", { name: "Recovered" })).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("marks an incomplete past-due todo as overdue, but not a completed one", async () => {
    server.use(
      handlers.listTodos([
        todoFixture({ title: "Late", dueDate: "2000-01-01T12:00:00.000Z", isCompleted: false }),
        todoFixture({ title: "Done late", dueDate: "2000-01-01T12:00:00.000Z", isCompleted: true }),
        todoFixture({ title: "Future", dueDate: "2999-01-01T12:00:00.000Z", isCompleted: false }),
      ]),
    );
    renderApp();

    const [late, doneLate, future] = await screen.findAllByRole("listitem");
    expect(within(late!).getByRole("time")).toHaveAttribute("data-overdue", "true");
    expect(within(doneLate!).getByRole("time")).not.toHaveAttribute("data-overdue");
    expect(within(future!).getByRole("time")).not.toHaveAttribute("data-overdue");
  });

  it("always shows the New button in the header", async () => {
    server.use(handlers.listTodos([]));
    renderApp();
    expect(screen.getByRole("heading", { level: 1, name: "Todos" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "New" })).toBeInTheDocument();
  });
});
