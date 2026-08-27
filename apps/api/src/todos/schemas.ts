// Validation schemas for the /todos endpoints. Kept free of Prisma and Fastify
// so they can later move to a shared contracts package unchanged.
import { z } from "zod";

// Length limits are mirrored by prisma/schema.prisma (`@db.VarChar(200)` /
// `@db.VarChar(2000)`); the database is the backstop, this is the source of the
// user-facing message.
export const TITLE_MAX_LENGTH = 200;
export const DESCRIPTION_MAX_LENGTH = 2000;

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** True when `value` is a `YYYY-MM-DD` string naming a real calendar date. */
export function isCalendarDate(value: string): boolean {
  const match = DATE_RE.exec(value);
  if (!match) return false;
  const [, y, m, d] = match;
  const year = Number(y);
  const month = Number(m);
  const day = Number(d);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
}

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

const dueDateSchema = z
  .string({ error: "Due date must be a string" })
  .refine(isCalendarDate, "Due date must be a real calendar date in YYYY-MM-DD format");

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
