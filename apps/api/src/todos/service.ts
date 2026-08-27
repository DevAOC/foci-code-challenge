// The one module that touches the todos table. Routes call these functions and
// nothing else; Prisma-specific behaviour (not-found errors, date columns) is
// translated here so it never leaks into the HTTP layer.
import { NotFoundError } from "../http/errors.js";
import type { PrismaClient, Todo } from "../generated/prisma/client.js";
import type { CreateTodoInput } from "./schemas.js";
import { parseCalendarDate } from "./serialize.js";

export async function createTodo(prisma: PrismaClient, input: CreateTodoInput): Promise<Todo> {
  return prisma.todo.create({
    data: {
      title: input.title,
      description: input.description ?? null,
      dueDate: input.dueDate === undefined ? null : parseCalendarDate(input.dueDate),
    },
  });
}

export async function getTodoById(prisma: PrismaClient, id: string): Promise<Todo> {
  const todo = await prisma.todo.findUnique({ where: { id } });
  if (todo === null) {
    throw new NotFoundError(`Todo ${id} not found`);
  }
  return todo;
}
