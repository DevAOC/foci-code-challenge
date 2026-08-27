// The one module that touches the todos table. Routes call these functions and
// nothing else; Prisma-specific behaviour (not-found errors) is
// translated here so it never leaks into the HTTP layer.
import { NotFoundError } from "../http/errors.js";
import { Prisma, type PrismaClient, type Todo } from "../generated/prisma/client.js";
import type { CreateTodoInput, UpdateTodoInput } from "@foci/contracts";

export async function createTodo(prisma: PrismaClient, input: CreateTodoInput): Promise<Todo> {
  return prisma.todo.create({
    data: {
      title: input.title,
      description: input.description ?? null,
      dueDate: input.dueDate === undefined ? null : new Date(input.dueDate),
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

/** All todos, oldest first; `id` breaks ties so the order is deterministic. */
export async function listTodos(prisma: PrismaClient): Promise<Todo[]> {
  return prisma.todo.findMany({ orderBy: [{ createdAt: "asc" }, { id: "asc" }] });
}

export async function deleteTodo(prisma: PrismaClient, id: string): Promise<void> {
  const { count } = await prisma.todo.deleteMany({ where: { id } });
  if (count === 0) {
    throw new NotFoundError(`Todo ${id} not found`);
  }
}

export async function updateTodo(
  prisma: PrismaClient,
  id: string,
  input: UpdateTodoInput,
): Promise<Todo> {
  // Only fields present in the input are written; an explicit null clears the column.
  const data: Prisma.TodoUpdateInput = {};
  if (input.title !== undefined) data.title = input.title;
  if (input.description !== undefined) data.description = input.description;
  if (input.dueDate !== undefined) {
    data.dueDate = input.dueDate === null ? null : new Date(input.dueDate);
  }
  if (input.isCompleted !== undefined) data.isCompleted = input.isCompleted;

  try {
    return await prisma.todo.update({ where: { id }, data });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      throw new NotFoundError(`Todo ${id} not found`);
    }
    throw error;
  }
}
