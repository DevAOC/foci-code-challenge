// Validation schemas and the wire representation for /todos. Shared by the API
// (as the request boundary) and the web app (for pre-submit validation).
import { z } from "zod";

// Length limits are mirrored by apps/api/prisma/schema.prisma (`@db.VarChar(200)` /
// `@db.VarChar(2000)`); the database is the backstop, this is the source of the
// user-facing message.
export const TITLE_MAX_LENGTH = 200;
export const DESCRIPTION_MAX_LENGTH = 2000;

const titleSchema = z
  .string({ error: "Title must be a string" })
  .trim()
  .min(1, "Title must not be empty")
  .max(TITLE_MAX_LENGTH, `Title must be at most ${TITLE_MAX_LENGTH} characters`);

/** Trimmed; an empty (or whitespace-only) description becomes null so "no description" has one representation. */
const descriptionSchema = z
  .string({ error: "Description must be a string" })
  .trim()
  .max(DESCRIPTION_MAX_LENGTH, `Description must be at most ${DESCRIPTION_MAX_LENGTH} characters`)
  .transform((value) => (value === "" ? null : value));

/** An ISO 8601 instant with an explicit offset (`Z` or `±hh:mm`); bare dates are rejected. */
const dueDateSchema = z.iso.datetime({
  offset: true,
  error: (issue) =>
    issue.input === undefined || typeof issue.input === "string"
      ? "Due date must be an ISO 8601 date-time with a timezone offset"
      : "Due date must be a string",
});

const isCompletedSchema = z.boolean({ error: "isCompleted must be a boolean" });

export const createTodoSchema = z.strictObject({
  title: titleSchema,
  description: descriptionSchema.optional(),
  dueDate: dueDateSchema.optional(),
});

export const updateTodoSchema = z
  .strictObject({
    title: titleSchema.optional(),
    description: descriptionSchema.nullable().optional(),
    dueDate: dueDateSchema.nullable().optional(),
    isCompleted: isCompletedSchema.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one of title, description, dueDate, isCompleted must be provided",
  });

export const todoIdParamsSchema = z.strictObject({
  id: z.uuid({ error: "id must be a UUID" }),
});

export type CreateTodoInput = z.infer<typeof createTodoSchema>;
export type UpdateTodoInput = z.infer<typeof updateTodoSchema>;
export type TodoIdParams = z.infer<typeof todoIdParamsSchema>;

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
