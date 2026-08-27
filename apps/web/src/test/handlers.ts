// Handler builders typed against @foci/contracts so the fake API can only
// return what the real one would.
import type { ErrorBody, ErrorIssue, TodoResponse } from "@foci/contracts";
import { HttpResponse, http } from "msw";

let counter = 0;

export function todoFixture(overrides: Partial<TodoResponse> = {}): TodoResponse {
  counter += 1;
  const n = counter.toString(16).padStart(12, "0");
  return {
    id: `00000000-0000-4000-8000-${n}`,
    title: `Todo ${counter}`,
    description: null,
    dueDate: null,
    isCompleted: false,
    createdAt: "2026-08-27T12:00:00.000Z",
    updatedAt: "2026-08-27T12:00:00.000Z",
    ...overrides,
  };
}

export function errorBody(
  statusCode: number,
  code: ErrorBody["error"]["code"],
  message: string,
  issues?: ErrorIssue[],
): ErrorBody {
  return { error: { statusCode, code, message, ...(issues ? { issues } : {}) } };
}

export const handlers = {
  listTodos: (todos: TodoResponse[]) =>
    http.get("/api/todos", () => HttpResponse.json({ todos })),
  listTodosFails: (statusCode = 500) =>
    http.get("/api/todos", () =>
      HttpResponse.json(errorBody(statusCode, "INTERNAL_ERROR", "Internal server error"), {
        status: statusCode,
      }),
    ),
};
