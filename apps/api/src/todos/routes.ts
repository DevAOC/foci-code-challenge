// HTTP layer for /todos: parse, validate, delegate to the service, serialize.
import type { FastifyInstance } from "fastify";
import { createTodoSchema, todoIdParamsSchema } from "./schemas.js";
import { serializeTodo } from "./serialize.js";
import { createTodo, getTodoById } from "./service.js";

export async function todoRoutes(app: FastifyInstance): Promise<void> {
  app.post("/todos", async (request, reply) => {
    const input = createTodoSchema.parse(request.body);
    const todo = await createTodo(app.prisma, input);
    return reply.status(201).send(serializeTodo(todo));
  });

  app.get("/todos/:id", async (request) => {
    const { id } = todoIdParamsSchema.parse(request.params);
    return serializeTodo(await getTodoById(app.prisma, id));
  });
}
