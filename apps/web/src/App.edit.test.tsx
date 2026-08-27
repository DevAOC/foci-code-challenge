import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { describe, expect, it } from "vitest";
import { errorBody, fakeApi, todoFixture } from "./test/handlers.js";
import { renderApp } from "./test/render.js";
import { server } from "./test/server.js";

const seed = () =>
  todoFixture({
    title: "File taxes",
    description: "Federal and provincial",
    dueDate: "2026-09-03T15:00:00.000Z", // 11:00 in America/Toronto (pinned in vite.config.ts)
    isCompleted: false,
  });

async function openEditDialog(title = "File taxes") {
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: new RegExp(title) }));
  const dialog = await screen.findByRole("dialog", { name: "Edit todo" });
  return { user, dialog, within: within(dialog) };
}

describe("editing a todo", () => {
  it("opens the form prefilled from the card, with Save disabled", async () => {
    server.use(...fakeApi([{ ...seed(), isCompleted: true }]).handlers);
    renderApp();
    const { within: w } = await openEditDialog();

    expect(w.getByLabelText("Title")).toHaveValue("File taxes");
    expect(w.getByLabelText("Description")).toHaveValue("Federal and provincial");
    expect(w.getByLabelText("Due")).toHaveValue("2026-09-03T11:00");
    expect(w.getByRole("checkbox", { name: "Completed" })).toBeChecked();
    expect(w.getByRole("button", { name: "Save" })).toBeDisabled();
  });

  it("opens from the keyboard: Tab to the card and press Enter", async () => {
    server.use(...fakeApi([seed()]).handlers);
    renderApp();
    const user = userEvent.setup();
    await screen.findByRole("button", { name: /File taxes/ });

    await user.tab(); // New
    await user.tab(); // the card
    expect(screen.getByRole("button", { name: /File taxes/ })).toHaveFocus();
    await user.keyboard("{Enter}");

    expect(await screen.findByRole("dialog", { name: "Edit todo" })).toBeInTheDocument();
  });

  it("sends only the title when only the title changed, and shows it on the card", async () => {
    const todo = seed();
    const api = fakeApi([todo]);
    server.use(...api.handlers);
    renderApp();
    const { user, within: w } = await openEditDialog();

    await user.clear(w.getByLabelText("Title"));
    await user.type(w.getByLabelText("Title"), "File taxes early");
    await user.click(w.getByRole("button", { name: "Save" }));

    expect(await screen.findByRole("heading", { name: "File taxes early" })).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(api.requests).toEqual([
      { method: "PATCH", path: `/todos/${todo.id}`, body: { title: "File taxes early" } },
    ]);
  });

  it("sends null to clear the description and the due date", async () => {
    const api = fakeApi([seed()]);
    server.use(...api.handlers);
    renderApp();
    const { user, within: w } = await openEditDialog();

    await user.clear(w.getByLabelText("Description"));
    fireEvent.change(w.getByLabelText("Due"), { target: { value: "" } });
    await user.click(w.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(api.requests[0]?.body).toEqual({ description: null, dueDate: null });
  });

  it("sends a changed due date-time as a UTC instant", async () => {
    const api = fakeApi([seed()]);
    server.use(...api.handlers);
    renderApp();
    const { user, within: w } = await openEditDialog();

    fireEvent.change(w.getByLabelText("Due"), { target: { value: "2027-01-15T09:30" } });
    await user.click(w.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(api.requests[0]?.body).toEqual({ dueDate: "2027-01-15T14:30:00.000Z" });
  });

  it("sends isCompleted when Completed is ticked in the form", async () => {
    const api = fakeApi([seed()]);
    server.use(...api.handlers);
    renderApp();
    const { user, within: w } = await openEditDialog();

    await user.click(w.getByRole("checkbox", { name: "Completed" }));
    await user.click(w.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(api.requests[0]?.body).toEqual({ isCompleted: true });
    expect(screen.getByRole("listitem")).toHaveAttribute("data-completed", "true");
  });

  it("disables Save again when a change is reverted", async () => {
    server.use(...fakeApi([seed()]).handlers);
    renderApp();
    const { user, within: w } = await openEditDialog();

    await user.type(w.getByLabelText("Title"), "!");
    expect(w.getByRole("button", { name: "Save" })).toBeEnabled();
    await user.keyboard("{Backspace}");
    expect(w.getByRole("button", { name: "Save" })).toBeDisabled();
  });

  it("tells the user when the todo no longer exists and drops the stale card", async () => {
    const todo = seed();
    const api = fakeApi([todo]);
    server.use(...api.handlers);
    renderApp();
    const { user, within: w } = await openEditDialog();
    // Someone else deleted it while the dialog was open.
    api.todos.splice(0, 1);

    await user.type(w.getByLabelText("Title"), "!");
    await user.click(w.getByRole("button", { name: "Save" }));

    expect(await w.findByRole("alert")).toHaveTextContent("This todo no longer exists.");
    await waitFor(() => expect(screen.queryByRole("listitem")).not.toBeInTheDocument());
    expect(screen.getByText("No todos yet.")).toBeInTheDocument();
  });

  it("maps a server-side validation issue onto its field", async () => {
    server.use(
      http.patch("/api/todos/:id", () =>
        HttpResponse.json(
          errorBody(400, "VALIDATION_ERROR", "Request is invalid", [
            { path: "title", message: "Title is reserved" },
          ]),
          { status: 400 },
        ),
      ),
      ...fakeApi([seed()]).handlers,
    );
    renderApp();
    const { user, within: w } = await openEditDialog();

    await user.type(w.getByLabelText("Title"), "!");
    await user.click(w.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(w.getByLabelText("Title")).toHaveAccessibleDescription("Title is reserved"),
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("shows a form-level error on a server failure and keeps the values", async () => {
    server.use(
      http.patch("/api/todos/:id", () =>
        HttpResponse.json(errorBody(500, "INTERNAL_ERROR", "Internal server error"), { status: 500 }),
      ),
      ...fakeApi([seed()]).handlers,
    );
    renderApp();
    const { user, within: w } = await openEditDialog();

    await user.type(w.getByLabelText("Title"), "!");
    await user.click(w.getByRole("button", { name: "Save" }));

    expect(await w.findByRole("alert")).toHaveTextContent("Internal server error");
    expect(w.getByLabelText("Title")).toHaveValue("File taxes!");
  });
});

describe("deleting a todo", () => {
  it("asks for confirmation inline, can be cancelled, and deletes on confirm", async () => {
    const todo = seed();
    const api = fakeApi([todo, todoFixture({ title: "Keep" })]);
    server.use(...api.handlers);
    renderApp();
    const { user, within: w } = await openEditDialog();

    await user.click(w.getByRole("button", { name: "Delete" }));
    expect(w.getByText("Delete this todo?")).toBeInTheDocument();
    expect(w.queryByRole("button", { name: "Save" })).not.toBeInTheDocument();
    expect(api.requests).toHaveLength(0);

    await user.click(w.getByRole("button", { name: "Cancel" }));
    expect(w.queryByText("Delete this todo?")).not.toBeInTheDocument();
    expect(w.getByRole("button", { name: "Save" })).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    await user.click(w.getByRole("button", { name: "Delete" }));
    await user.click(w.getByRole("button", { name: "Delete" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.queryByRole("button", { name: /File taxes/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Keep/ })).toBeInTheDocument();
    expect(api.requests).toEqual([{ method: "DELETE", path: `/todos/${todo.id}`, body: undefined }]);
  });

  it("shows the error and returns to the normal footer when deletion fails", async () => {
    server.use(
      http.delete("/api/todos/:id", () =>
        HttpResponse.json(errorBody(500, "INTERNAL_ERROR", "Internal server error"), { status: 500 }),
      ),
      ...fakeApi([seed()]).handlers,
    );
    renderApp();
    const { user, within: w } = await openEditDialog();

    await user.click(w.getByRole("button", { name: "Delete" }));
    await user.click(w.getByRole("button", { name: "Delete" }));

    expect(await w.findByRole("alert")).toHaveTextContent("Internal server error");
    expect(w.getByRole("button", { name: "Save" })).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});
