import type { CreateTodoInput, TodoResponse } from "@foci/contracts";
import { queryOptions } from "@tanstack/react-query";
import { request } from "./client.js";

export const todosQueryKey = ["todos"] as const;

export async function listTodos(): Promise<TodoResponse[]> {
  const { todos } = await request<{ todos: TodoResponse[] }>("GET", "/todos");
  return todos;
}

export const todosQuery = queryOptions({ queryKey: todosQueryKey, queryFn: listTodos });

export function createTodo(input: CreateTodoInput): Promise<TodoResponse> {
  return request<TodoResponse>("POST", "/todos", input);
}
