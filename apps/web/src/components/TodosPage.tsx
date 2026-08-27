import type { TodoResponse, UpdateTodoInput } from "@foci/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { createTodo, deleteTodo, todosQuery, todosQueryKey, updateTodo } from "@/api/todos";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { TodoCard } from "./TodoCard.js";
import { TodoForm } from "./TodoForm.js";

type DialogState = { kind: "closed" } | { kind: "create" } | { kind: "edit"; todo: TodoResponse };

export function TodosPage() {
  const queryClient = useQueryClient();
  const todos = useQuery(todosQuery);
  const [dialog, setDialog] = useState<DialogState>({ kind: "closed" });
  const titleRef = useRef<HTMLInputElement>(null);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: todosQueryKey });
  const create = useMutation({ mutationFn: createTodo, onSuccess: invalidate });
  const update = useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateTodoInput }) => updateTodo(id, input),
    onSuccess: invalidate,
  });
  const remove = useMutation({ mutationFn: deleteTodo, onSuccess: invalidate });

  const close = () => setDialog({ kind: "closed" });

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <header className="mb-8 flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Todos</h1>
        <Button onClick={() => setDialog({ kind: "create" })}>New</Button>
      </header>

      {todos.isPending && (
        <div role="status" aria-label="Loading todos" className="space-y-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-16 w-full rounded-lg" />
          ))}
        </div>
      )}

      {todos.isError && (
        <div role="alert" className="rounded-lg border border-destructive/40 p-4">
          <p className="text-sm">Couldn't load your todos. {todos.error.message}</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => void todos.refetch()}>
            Retry
          </Button>
        </div>
      )}

      {todos.isSuccess && todos.data.length === 0 && (
        <div className="rounded-lg border border-dashed p-10 text-center">
          <p className="text-sm text-muted-foreground">No todos yet.</p>
          <Button
            variant="outline"
            size="sm"
            className="mt-4"
            onClick={() => setDialog({ kind: "create" })}
          >
            Create your first todo
          </Button>
        </div>
      )}

      {todos.isSuccess && todos.data.length > 0 && (
        <ul className="space-y-3">
          {todos.data.map((todo) => (
            <TodoCard key={todo.id} todo={todo} onOpen={(t) => setDialog({ kind: "edit", todo: t })} />
          ))}
        </ul>
      )}

      <Dialog open={dialog.kind !== "closed"} onOpenChange={(open) => !open && close()}>
        <DialogContent initialFocus={titleRef}>
          <DialogHeader>
            <DialogTitle>{dialog.kind === "edit" ? "Edit todo" : "New todo"}</DialogTitle>
            <DialogDescription>
              {dialog.kind === "edit" ? "Changes are saved when you press Save." : "Only a title is required."}
            </DialogDescription>
          </DialogHeader>
          {dialog.kind === "create" && (
            <TodoForm
              mode="create"
              titleRef={titleRef}
              onSubmit={async (input) => {
                await create.mutateAsync(input);
                close();
              }}
            />
          )}
          {dialog.kind === "edit" && (
            <TodoForm
              key={dialog.todo.id}
              mode="edit"
              todo={dialog.todo}
              titleRef={titleRef}
              onSubmit={async (input) => {
                await update.mutateAsync({ id: dialog.todo.id, input });
                close();
              }}
              onDelete={async () => {
                await remove.mutateAsync(dialog.todo.id);
                close();
              }}
              onNotFound={() => void invalidate()}
            />
          )}
        </DialogContent>
      </Dialog>
    </main>
  );
}
