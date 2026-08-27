import type { Todo } from "../generated/prisma/client.js";

/** The JSON representation of a todo returned by every /todos endpoint. */
export interface TodoResponse {
  id: string;
  title: string;
  description: string | null;
  /** ISO 8601 instant in UTC, or null. */
  dueDate: string | null;
  isCompleted: boolean;
  /** ISO 8601 timestamps. */
  createdAt: string;
  updatedAt: string;
}

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
