import type { TodoResponse } from "@foci/contracts";
import type { Todo } from "../generated/prisma/client.js";

export type { TodoResponse };

export function serializeTodo(todo: Todo): TodoResponse {
  return {
    id: todo.id,
    title: todo.title,
    description: todo.description,
    dueDate: todo.dueDate === null ? null : todo.dueDate.toISOString(),
    isCompleted: todo.isCompleted,
    createdAt: todo.createdAt.toISOString(),
    updatedAt: todo.updatedAt.toISOString(),
  };
}
