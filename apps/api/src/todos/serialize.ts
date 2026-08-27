import type { Todo } from "../generated/prisma/client.js";

/** The JSON representation of a todo returned by every /todos endpoint. */
export interface TodoResponse {
  id: string;
  title: string;
  description: string | null;
  /** Calendar date as YYYY-MM-DD, or null. */
  dueDate: string | null;
  isCompleted: boolean;
  /** ISO 8601 timestamps. */
  createdAt: string;
  updatedAt: string;
}

/** Postgres `date` columns come back as a JS Date at UTC midnight; keep only the calendar date. */
export function formatCalendarDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Parses a validated YYYY-MM-DD string into the UTC-midnight Date Prisma expects for a `date` column. */
export function parseCalendarDate(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

export function serializeTodo(todo: Todo): TodoResponse {
  return {
    id: todo.id,
    title: todo.title,
    description: todo.description,
    dueDate: todo.dueDate === null ? null : formatCalendarDate(todo.dueDate),
    isCompleted: todo.isCompleted,
    createdAt: todo.createdAt.toISOString(),
    updatedAt: todo.updatedAt.toISOString(),
  };
}
