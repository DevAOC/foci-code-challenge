import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { describe, expect, it } from "vitest";
import { errorBody, fakeApi, todoFixture } from "./test/handlers.js";
import { renderApp } from "./test/render.js";
import { server } from "./test/server.js";

describe("toggling completion from the card", () => {
  it("ticks and unticks, sending only isCompleted each time", async () => {
    const todo = todoFixture({ title: "Buy milk" });
    const api = fakeApi([todo]);
    server.use(...api.handlers);
    renderApp();
    const user = userEvent.setup();

    const tick = await screen.findByRole("checkbox", { name: 'Mark "Buy milk" as done' });
    await user.click(tick);

    await waitFor(() => expect(api.requests).toHaveLength(1));
    expect(api.requests[0]).toEqual({
      method: "PATCH",
      path: `/todos/${todo.id}`,
      body: { isCompleted: true },
    });
    const untick = await screen.findByRole("checkbox", { name: 'Mark "Buy milk" as not done' });
    expect(untick).toBeChecked();
    expect(screen.getByRole("listitem")).toHaveAttribute("data-completed", "true");

    await user.click(untick);
    await waitFor(() => expect(api.requests).toHaveLength(2));
    expect(api.requests[1]?.body).toEqual({ isCompleted: false });
    expect(screen.getByRole("listitem")).toHaveAttribute("data-completed", "false");
  });

  it("restyles the card before the response arrives", async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    const todo = todoFixture({ title: "Slow" });
    const api = fakeApi([todo]);
    server.use(
      http.patch("/api/todos/:id", async () => {
        await gate;
        const updated = { ...todo, isCompleted: true };
        api.todos[0] = updated;
        return HttpResponse.json(updated);
      }),
      ...api.handlers,
    );
    renderApp();
    const user = userEvent.setup();

    await user.click(await screen.findByRole("checkbox", { name: 'Mark "Slow" as done' }));

    expect(screen.getByRole("listitem")).toHaveAttribute("data-completed", "true");
    expect(screen.getByRole("heading", { name: "Slow" })).toHaveClass("line-through");
    release();
    await waitFor(() => expect(screen.getByRole("listitem")).toHaveAttribute("data-completed", "true"));
  });

  it("rolls back and shows a toast when the server rejects the change", async () => {
    server.use(
      http.patch("/api/todos/:id", () =>
        HttpResponse.json(errorBody(500, "INTERNAL_ERROR", "Internal server error"), { status: 500 }),
      ),
      ...fakeApi([todoFixture({ title: "Flaky" })]).handlers,
    );
    renderApp();
    const user = userEvent.setup();

    await user.click(await screen.findByRole("checkbox", { name: 'Mark "Flaky" as done' }));

    const toast = await screen.findByText("Couldn't mark the todo as done.");
    expect(toast.closest("[role=status],[role=alert],[aria-live]")).not.toBeNull();
    const list = within(screen.getByRole("list", { name: "Todos" }));
    await waitFor(() => expect(list.getByRole("listitem")).toHaveAttribute("data-completed", "false"));
    expect(screen.getByRole("checkbox", { name: 'Mark "Flaky" as done' })).not.toBeChecked();
  });

  it("keeps a completed card in its place in the list", async () => {
    server.use(
      ...fakeApi([
        todoFixture({ title: "First" }),
        todoFixture({ title: "Second" }),
        todoFixture({ title: "Third" }),
      ]).handlers,
    );
    renderApp();
    const user = userEvent.setup();

    await user.click(await screen.findByRole("checkbox", { name: 'Mark "First" as done' }));
    await screen.findByRole("checkbox", { name: 'Mark "First" as not done' });

    const titles = screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent);
    expect(titles).toEqual(["First", "Second", "Third"]);
  });

  it("keeps the checkbox and the open-button independent", async () => {
    const api = fakeApi([todoFixture({ title: "Independent" })]);
    server.use(...api.handlers);
    renderApp();
    const user = userEvent.setup();

    await user.click(await screen.findByRole("checkbox", { name: 'Mark "Independent" as done' }));
    await waitFor(() => expect(api.requests).toHaveLength(1));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Independent/ }));
    expect(await screen.findByRole("dialog", { name: "Edit todo" })).toBeInTheDocument();
    expect(api.requests).toHaveLength(1);
  });

  it("is reachable by keyboard before the open-button and toggles with Space", async () => {
    const api = fakeApi([todoFixture({ title: "Keys" })]);
    server.use(...api.handlers);
    renderApp();
    const user = userEvent.setup();
    const checkbox = await screen.findByRole("checkbox", { name: 'Mark "Keys" as done' });

    await user.tab(); // New
    await user.tab();
    expect(checkbox).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("button", { name: /Keys/ })).toHaveFocus();

    await user.tab({ shift: true });
    await user.keyboard(" ");
    await waitFor(() => expect(api.requests).toHaveLength(1));
    expect(api.requests[0]?.body).toEqual({ isCompleted: true });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
