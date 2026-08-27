import type { TodoResponse } from "@foci/contracts";
import { formatDueDate, isOverdue } from "@/lib/due-date";
import { cn } from "@/lib/utils";

export function TodoCard({ todo }: { todo: TodoResponse }) {
  const overdue = isOverdue(todo.dueDate, todo.isCompleted);
  return (
    <li
      data-completed={todo.isCompleted}
      className={cn(
        "rounded-lg border bg-card p-4 text-card-foreground",
        todo.isCompleted && "opacity-60",
      )}
    >
      <div className="flex items-baseline justify-between gap-4">
        <h2 className={cn("text-base font-medium", todo.isCompleted && "line-through")}>
          {todo.title}
        </h2>
        {todo.dueDate !== null && (
          <time
            dateTime={todo.dueDate}
            data-overdue={overdue || undefined}
            className={cn(
              "shrink-0 text-sm text-muted-foreground",
              overdue && "text-destructive",
            )}
          >
            {formatDueDate(todo.dueDate)}
          </time>
        )}
      </div>
      {todo.description !== null && (
        <p className="mt-1 whitespace-pre-line text-sm text-muted-foreground">{todo.description}</p>
      )}
    </li>
  );
}
