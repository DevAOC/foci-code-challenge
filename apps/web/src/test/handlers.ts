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

export interface RecordedRequest {
  method: string;
  path: string;
  body: unknown;
}

/**
 * A stateful fake of the todos API: the list reflects what was created through
 * it, and every write is recorded so tests can assert on exact bodies.
 */
export function fakeApi(initial: TodoResponse[] = []) {
  const todos: TodoResponse[] = [...initial];
  const requests: RecordedRequest[] = [];
  const handlers = [
    http.get("/api/todos", () => HttpResponse.json({ todos })),
    http.post("/api/todos", async ({ request }) => {
      const body = (await request.json()) as {
        title: string;
        description?: string | null;
        dueDate?: string | null;
      };
      requests.push({ method: "POST", path: "/todos", body });
      const todo = todoFixture({
        title: body.title,
        description: body.description ?? null,
        dueDate: body.dueDate ?? null,
      });
      todos.push(todo);
      return HttpResponse.json(todo, { status: 201 });
    }),
  ];
  return { todos, requests, handlers };
}
