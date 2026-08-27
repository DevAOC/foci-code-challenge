import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { createTodo, todosQuery, todosQueryKey } from "@/api/todos";
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

export function TodosPage() {
  const queryClient = useQueryClient();
  const todos = useQuery(todosQuery);
  const [creating, setCreating] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);
  const create = useMutation({
    mutationFn: createTodo,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: todosQueryKey }),
  });

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <header className="mb-8 flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Todos</h1>
        <Button onClick={() => setCreating(true)}>New</Button>
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
          <Button variant="outline" size="sm" className="mt-4" onClick={() => setCreating(true)}>
            Create your first todo
          </Button>
        </div>
      )}

      {todos.isSuccess && todos.data.length > 0 && (
        <ul className="space-y-3">
          {todos.data.map((todo) => (
            <TodoCard key={todo.id} todo={todo} />
          ))}
        </ul>
      )}

      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent initialFocus={titleRef}>
          <DialogHeader>
            <DialogTitle>New todo</DialogTitle>
            <DialogDescription>Only a title is required.</DialogDescription>
          </DialogHeader>
          <TodoForm
            titleRef={titleRef}
            onSubmit={async (input) => {
              await create.mutateAsync(input);
              setCreating(false);
            }}
          />
        </DialogContent>
      </Dialog>
    </main>
  );
}
