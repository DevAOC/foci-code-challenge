import {
  createTodoSchema,
  updateTodoSchema,
  type CreateTodoInput,
  type TodoResponse,
  type UpdateTodoInput,
} from "@foci/contracts";
import { useId, useState, type FormEvent, type RefObject } from "react";
import { ApiError } from "@/api/client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DialogClose, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { isoToLocalInput, localInputToIso } from "@/lib/due-date";

type FieldName = "title" | "description" | "dueDate" | "isCompleted";
type FieldErrors = Partial<Record<FieldName, string>>;

const FIELD_NAMES: readonly FieldName[] = ["title", "description", "dueDate", "isCompleted"];

function isFieldName(value: string): value is FieldName {
  return (FIELD_NAMES as readonly string[]).includes(value);
}

/** Splits `issues` into per-field messages and the rest (joined into one form-level message). */
function splitIssues(issues: readonly { path: string; message: string }[]): {
  fields: FieldErrors;
  form: string | null;
} {
  const fields: FieldErrors = {};
  const rest: string[] = [];
  for (const issue of issues) {
    const field = issue.path.split(".")[0] ?? "";
    if (isFieldName(field)) fields[field] ??= issue.message;
    else rest.push(issue.message);
  }
  return { fields, form: rest.length > 0 ? rest.join(" ") : null };
}

const GENERIC_ERROR = "Something went wrong. Check your connection and try again.";
const NOT_FOUND_ERROR = "This todo no longer exists.";

export type TodoFormProps = {
  /** The title input, so the dialog can give it initial focus. */
  titleRef?: RefObject<HTMLInputElement | null>;
} & (
  | {
      mode: "create";
      /** Receives the schema-parsed input; throw to keep the form open with an error. */
      onSubmit: (input: CreateTodoInput) => Promise<unknown>;
    }
  | {
      mode: "edit";
      todo: TodoResponse;
      /** Receives only the fields that changed, schema-parsed. */
      onSubmit: (input: UpdateTodoInput) => Promise<unknown>;
      onDelete: () => Promise<unknown>;
      /** The todo vanished server-side; the caller should refresh its list. */
      onNotFound: () => void;
    }
);

interface Values {
  title: string;
  description: string;
  dueDate: string;
  isCompleted: boolean;
}

function initialValues(todo: TodoResponse | undefined): Values {
  return {
    title: todo?.title ?? "",
    description: todo?.description ?? "",
    dueDate: todo?.dueDate ? isoToLocalInput(todo.dueDate) : "",
    isCompleted: todo?.isCompleted ?? false,
  };
}

/** The create body: blank optional fields are omitted (the create schema does not accept null). */
function createCandidate(values: Values): Record<string, unknown> {
  const candidate: Record<string, unknown> = { title: values.title };
  if (values.description.trim() !== "") candidate.description = values.description;
  if (values.dueDate !== "") candidate.dueDate = localInputToIso(values.dueDate);
  return candidate;
}

/** The update body: only fields that differ from the original; blank optional fields become null. */
function updateCandidate(values: Values, initial: Values): Record<string, unknown> {
  const candidate: Record<string, unknown> = {};
  if (values.title !== initial.title) candidate.title = values.title;
  if (values.description !== initial.description) {
    candidate.description = values.description.trim() === "" ? null : values.description;
  }
  if (values.dueDate !== initial.dueDate) {
    candidate.dueDate = values.dueDate === "" ? null : localInputToIso(values.dueDate);
  }
  if (values.isCompleted !== initial.isCompleted) candidate.isCompleted = values.isCompleted;
  return candidate;
}

/**
 * The todo form, for both creating and editing. Validates with the shared
 * contract before submitting and sends the parsed output, so what the API
 * receives is exactly what it would have derived itself; server-side issues
 * are mapped back onto fields as a fallback.
 */
export function TodoForm(props: TodoFormProps) {
  const id = useId();
  const initial = initialValues(props.mode === "edit" ? props.todo : undefined);
  const [values, setValues] = useState<Values>(initial);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const set = <K extends keyof Values>(key: K, value: Values[K]) =>
    setValues((current) => ({ ...current, [key]: value }));

  const changed =
    props.mode === "create" || Object.keys(updateCandidate(values, initial)).length > 0;

  function fail(error: unknown) {
    if (error instanceof ApiError && error.code === "VALIDATION_ERROR" && error.issues.length > 0) {
      const { fields, form } = splitIssues(error.issues);
      setFieldErrors(fields);
      setFormError(form);
    } else if (error instanceof ApiError && error.code === "NOT_FOUND") {
      setFormError(NOT_FOUND_ERROR);
      if (props.mode === "edit") props.onNotFound();
    } else {
      setFormError(error instanceof ApiError ? error.message : GENERIC_ERROR);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    const result =
      props.mode === "create"
        ? createTodoSchema.safeParse(createCandidate(values))
        : updateTodoSchema.safeParse(updateCandidate(values, initial));
    if (!result.success) {
      const { fields, form } = splitIssues(
        result.error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })),
      );
      setFieldErrors(fields);
      setFormError(form);
      return;
    }
    setFieldErrors({});

    setPending(true);
    try {
      // `result.data` is typed by whichever schema ran; the union collapses on props.mode.
      if (props.mode === "create") await props.onSubmit(result.data as CreateTodoInput);
      else await props.onSubmit(result.data as UpdateTodoInput);
    } catch (error) {
      fail(error);
    } finally {
      setPending(false);
    }
  }

  async function handleDelete() {
    if (props.mode !== "edit") return;
    setFormError(null);
    setPending(true);
    try {
      await props.onDelete();
    } catch (error) {
      setConfirmingDelete(false);
      fail(error);
    } finally {
      setPending(false);
    }
  }

  const field = (name: FieldName) => ({
    id: `${id}-${name}`,
    "aria-invalid": fieldErrors[name] !== undefined || undefined,
    "aria-describedby": fieldErrors[name] !== undefined ? `${id}-${name}-error` : undefined,
  });
  const fieldError = (name: FieldName) =>
    fieldErrors[name] !== undefined ? (
      <p id={`${id}-${name}-error`} className="text-sm text-destructive">
        {fieldErrors[name]}
      </p>
    ) : null;

  return (
    <form onSubmit={(event) => void handleSubmit(event)} noValidate className="contents">
      <div className="space-y-4">
        {formError !== null && (
          <p role="alert" className="rounded-md border border-destructive/40 px-3 py-2 text-sm text-destructive">
            {formError}
          </p>
        )}
        <div className="space-y-1.5">
          <Label htmlFor={`${id}-title`}>Title</Label>
          <Input
            {...field("title")}
            ref={props.titleRef}
            value={values.title}
            onChange={(event) => set("title", event.target.value)}
            autoComplete="off"
          />
          {fieldError("title")}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${id}-description`}>Description</Label>
          <Textarea
            {...field("description")}
            value={values.description}
            onChange={(event) => set("description", event.target.value)}
            rows={3}
          />
          {fieldError("description")}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${id}-dueDate`}>Due</Label>
          <Input
            {...field("dueDate")}
            type="datetime-local"
            value={values.dueDate}
            onChange={(event) => set("dueDate", event.target.value)}
          />
          {fieldError("dueDate")}
        </div>
        {props.mode === "edit" && (
          <div className="flex items-center gap-2">
            <Checkbox
              {...field("isCompleted")}
              checked={values.isCompleted}
              onCheckedChange={(checked) => set("isCompleted", checked)}
            />
            <Label htmlFor={`${id}-isCompleted`}>Completed</Label>
            {fieldError("isCompleted")}
          </div>
        )}
      </div>

      {props.mode === "edit" && confirmingDelete ? (
        <DialogFooter className="sm:justify-between">
          <p className="self-center text-sm text-muted-foreground">Delete this todo?</p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setConfirmingDelete(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => void handleDelete()}
              disabled={pending}
            >
              {pending ? "Deleting…" : "Delete"}
            </Button>
          </div>
        </DialogFooter>
      ) : (
        <DialogFooter className={props.mode === "edit" ? "sm:justify-between" : undefined}>
          {props.mode === "edit" && (
            <Button
              type="button"
              variant="ghost"
              className="text-destructive hover:text-destructive"
              onClick={() => setConfirmingDelete(true)}
              disabled={pending}
            >
              Delete
            </Button>
          )}
          <div className="flex gap-2">
            <DialogClose render={<Button variant="outline" type="button" />}>Cancel</DialogClose>
            <Button type="submit" disabled={pending || !changed} aria-busy={pending || undefined}>
              {pending ? "Saving…" : "Save"}
            </Button>
          </div>
        </DialogFooter>
      )}
    </form>
  );
}
