import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { describe, expect, it } from "vitest";
import { errorBody, fakeApi, todoFixture } from "./test/handlers.js";
import { renderApp } from "./test/render.js";
import { server } from "./test/server.js";

async function openNewDialog() {
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: "New" }));
  const dialog = await screen.findByRole("dialog", { name: "New todo" });
  return { user, dialog, within: within(dialog) };
}

describe("creating a todo", () => {
  it("opens a labelled form from New, focuses it, and closes on Escape returning focus", async () => {
    server.use(...fakeApi([todoFixture({ title: "Existing" })]).handlers);
    renderApp();
    const { user, dialog, within: w } = await openNewDialog();

    await waitFor(() => expect(w.getByLabelText("Title")).toHaveFocus());
    expect(w.getByLabelText("Description")).toBeInTheDocument();
    expect(w.getByLabelText("Due")).toHaveAttribute("type", "datetime-local");
    expect(dialog.contains(document.activeElement)).toBe(true);

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "New" })).toHaveFocus();
  });

  it("creates from a title alone, sending exactly the parsed output, and shows the new card", async () => {
    const api = fakeApi([]);
    server.use(...api.handlers);
    renderApp();
    const { user, within: w } = await openNewDialog();

    await user.type(w.getByLabelText("Title"), "  Buy milk  ");
    await user.click(w.getByRole("button", { name: "Save" }));

    expect(await screen.findByRole("heading", { name: "Buy milk" })).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(api.requests).toEqual([{ method: "POST", path: "/todos", body: { title: "Buy milk" } }]);
  });

  it("sends description and a local due date-time converted to a UTC instant", async () => {
    const api = fakeApi([]);
    server.use(...api.handlers);
    renderApp();
    const { user, within: w } = await openNewDialog();

    await user.type(w.getByLabelText("Title"), "File taxes");
    await user.type(w.getByLabelText("Description"), "Federal and provincial");
    // 11:00 in America/Toronto (pinned in vite.config.ts) is 15:00 UTC in September.
    fireEvent.change(w.getByLabelText("Due"), { target: { value: "2026-09-03T11:00" } });
    await user.click(w.getByRole("button", { name: "Save" }));

    await screen.findByRole("heading", { name: "File taxes" });
    expect(api.requests[0]?.body).toEqual({
      title: "File taxes",
      description: "Federal and provincial",
      dueDate: "2026-09-03T15:00:00.000Z",
    });
  });

  it("submits on Enter in the title field", async () => {
    const api = fakeApi([]);
    server.use(...api.handlers);
    renderApp();
    const { user, within: w } = await openNewDialog();

    await user.type(w.getByLabelText("Title"), "Quick add{Enter}");

    await screen.findByRole("heading", { name: "Quick add" });
    expect(api.requests).toHaveLength(1);
  });

  it("refuses a whitespace-only title without a request and links the message to the field", async () => {
    const api = fakeApi([]);
    server.use(...api.handlers);
    renderApp();
    const { user, within: w } = await openNewDialog();

    await user.type(w.getByLabelText("Title"), "   ");
    await user.click(w.getByRole("button", { name: "Save" }));

    const title = w.getByLabelText("Title");
    expect(title).toHaveAccessibleDescription("Title must not be empty");
    expect(title).toHaveAttribute("aria-invalid", "true");
    expect(api.requests).toHaveLength(0);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("refuses over-long title and description without a request", async () => {
    const api = fakeApi([]);
    server.use(...api.handlers);
    renderApp();
    const { user, within: w } = await openNewDialog();

    await user.click(w.getByLabelText("Title"));
    await user.paste("x".repeat(201));
    await user.click(w.getByLabelText("Description"));
    await user.paste("y".repeat(2001));
    await user.click(w.getByRole("button", { name: "Save" }));

    expect(w.getByLabelText("Title")).toHaveAccessibleDescription(
      "Title must be at most 200 characters",
    );
    expect(w.getByLabelText("Description")).toHaveAccessibleDescription(
      "Description must be at most 2000 characters",
    );
    expect(api.requests).toHaveLength(0);
  });

  it("maps a server-side validation issue onto its field and keeps the dialog open", async () => {
    server.use(
      http.post("/api/todos", () =>
        HttpResponse.json(
          errorBody(400, "VALIDATION_ERROR", "Request is invalid", [
            { path: "title", message: "Title is reserved" },
          ]),
          { status: 400 },
        ),
      ),
      ...fakeApi([]).handlers,
    );
    renderApp();
    const { user, within: w } = await openNewDialog();

    await user.type(w.getByLabelText("Title"), "admin");
    await user.click(w.getByRole("button", { name: "Save" }));

    expect(await w.findByText("Title is reserved")).toBeInTheDocument();
    expect(w.getByLabelText("Title")).toHaveAccessibleDescription("Title is reserved");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("shows a form-level error on a server failure and preserves the entered values", async () => {
    server.use(
      http.post("/api/todos", () =>
        HttpResponse.json(errorBody(500, "INTERNAL_ERROR", "Internal server error"), { status: 500 }),
      ),
      ...fakeApi([]).handlers,
    );
    renderApp();
    const { user, within: w } = await openNewDialog();

    await user.type(w.getByLabelText("Title"), "Keep me");
    await user.type(w.getByLabelText("Description"), "and me");
    await user.click(w.getByRole("button", { name: "Save" }));

    expect(await w.findByRole("alert")).toHaveTextContent("Internal server error");
    expect(w.getByLabelText("Title")).toHaveValue("Keep me");
    expect(w.getByLabelText("Description")).toHaveValue("and me");
    expect(w.getByRole("button", { name: "Save" })).toBeEnabled();
  });

  it("shows a generic message when the network fails", async () => {
    server.use(http.post("/api/todos", () => HttpResponse.error()), ...fakeApi([]).handlers);
    renderApp();
    const { user, within: w } = await openNewDialog();

    await user.type(w.getByLabelText("Title"), "Offline");
    await user.click(w.getByRole("button", { name: "Save" }));

    expect(await w.findByRole("alert")).toHaveTextContent("Something went wrong");
  });

  it("disables Save and shows a pending state while the request is in flight", async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    const api = fakeApi([]);
    server.use(
      http.post("/api/todos", async () => {
        await gate;
        const todo = todoFixture({ title: "Slow" });
        api.todos.push(todo);
        return HttpResponse.json(todo, { status: 201 });
      }),
      ...api.handlers,
    );
    renderApp();
    const { user, within: w } = await openNewDialog();

    await user.type(w.getByLabelText("Title"), "Slow");
    await user.click(w.getByRole("button", { name: "Save" }));

    const saving = await w.findByRole("button", { name: "Saving…" });
    expect(saving).toBeDisabled();
    release();
    await screen.findByRole("heading", { name: "Slow" });
  });

  it("opens the same dialog from the empty-state call to action", async () => {
    server.use(...fakeApi([]).handlers);
    renderApp();
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: "Create your first todo" }));

    expect(await screen.findByRole("dialog", { name: "New todo" })).toBeInTheDocument();
  });
});
