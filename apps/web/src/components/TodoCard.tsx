import type { TodoResponse } from "@foci/contracts";
import { formatDueDate, isOverdue } from "@/lib/due-date";
import { cn } from "@/lib/utils";

export interface TodoCardProps {
  todo: TodoResponse;
  onOpen: (todo: TodoResponse) => void;
}

/**
 * One todo in the list. The card body is a real button (keyboard- and
 * screen-reader-operable) that opens the edit dialog.
 */
export function TodoCard({ todo, onOpen }: TodoCardProps) {
  const overdue = isOverdue(todo.dueDate, todo.isCompleted);
  return (
    <li
      data-completed={todo.isCompleted}
      className={cn(
        "rounded-lg border bg-card text-card-foreground transition-colors has-[button:hover]:bg-accent/40",
        todo.isCompleted && "opacity-60",
      )}
    >
      <button
        type="button"
        onClick={() => onOpen(todo)}
        className="w-full rounded-lg p-4 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
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
      </button>
    </li>
  );
}
