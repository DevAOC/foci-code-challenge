import { useQuery } from "@tanstack/react-query";
import { todosQuery } from "@/api/todos";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { TodoCard } from "./TodoCard.js";

export function TodosPage() {
  const todos = useQuery(todosQuery);

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <header className="mb-8 flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Todos</h1>
        <Button>New</Button>
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
          <Button variant="outline" size="sm" className="mt-4">
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
    </main>
  );
}
