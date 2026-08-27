import type { TodoResponse } from "@foci/contracts";
import { Checkbox } from "@/components/ui/checkbox";
import { formatDueDate, isOverdue } from "@/lib/due-date";
import { cn } from "@/lib/utils";

export interface TodoCardProps {
  todo: TodoResponse;
  onOpen: (todo: TodoResponse) => void;
  onToggle: (todo: TodoResponse, isCompleted: boolean) => void;
}

/**
 * One todo in the list. Two sibling controls, never nested: a checkbox that
 * toggles completion and a full-width button that opens the edit dialog.
 */
export function TodoCard({ todo, onOpen, onToggle }: TodoCardProps) {
  const overdue = isOverdue(todo.dueDate, todo.isCompleted);
  return (
    <li
      data-completed={todo.isCompleted}
      className={cn(
        "flex items-start gap-3 rounded-lg border bg-card p-4 text-card-foreground transition-colors has-[button[type=button]:not([role]):hover]:bg-accent/40",
        todo.isCompleted && "opacity-60",
      )}
    >
      <Checkbox
        className="mt-1"
        checked={todo.isCompleted}
        onCheckedChange={(checked) => onToggle(todo, checked)}
        aria-label={`Mark "${todo.title}" as ${todo.isCompleted ? "not done" : "done"}`}
      />
      <button
        type="button"
        onClick={() => onOpen(todo)}
        className="-m-1 min-w-0 flex-1 rounded-md p-1 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
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
