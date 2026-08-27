import { createTodoSchema, type CreateTodoInput } from "@foci/contracts";
import { useId, useState, type FormEvent, type RefObject } from "react";
import { ApiError } from "@/api/client";
import { Button } from "@/components/ui/button";
import { DialogClose, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { localInputToIso } from "@/lib/due-date";

type FieldName = "title" | "description" | "dueDate";
type FieldErrors = Partial<Record<FieldName, string>>;

const FIELD_NAMES: readonly FieldName[] = ["title", "description", "dueDate"];

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
    if (isFieldName(field) && fields[field] === undefined) fields[field] = issue.message;
    else if (!isFieldName(field)) rest.push(issue.message);
  }
  return { fields, form: rest.length > 0 ? rest.join(" ") : null };
}

const GENERIC_ERROR = "Something went wrong. Check your connection and try again.";

export interface TodoFormProps {
  /** Receives the schema-parsed input; throw to keep the form open with an error. */
  onSubmit: (input: CreateTodoInput) => Promise<unknown>;
  /** The title input, so the dialog can give it initial focus. */
  titleRef?: RefObject<HTMLInputElement | null>;
}

/**
 * The todo form. Validates with the shared contract before submitting and
 * sends the parsed output, so what the API receives is exactly what it would
 * have derived itself; server-side issues are mapped back onto fields as a
 * fallback. Blank optional fields are omitted rather than sent empty.
 */
export function TodoForm({ onSubmit, titleRef }: TodoFormProps) {
  const id = useId();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    const candidate: Record<string, unknown> = { title };
    if (description.trim() !== "") candidate.description = description;
    if (dueDate !== "") candidate.dueDate = localInputToIso(dueDate);

    const result = createTodoSchema.safeParse(candidate);
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
      await onSubmit(result.data);
    } catch (error) {
      if (error instanceof ApiError && error.code === "VALIDATION_ERROR" && error.issues.length > 0) {
        const { fields, form } = splitIssues(error.issues);
        setFieldErrors(fields);
        setFormError(form);
      } else {
        setFormError(error instanceof ApiError ? error.message : GENERIC_ERROR);
      }
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
            ref={titleRef}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            autoComplete="off"
          />
          {fieldError("title")}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${id}-description`}>Description</Label>
          <Textarea
            {...field("description")}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={3}
          />
          {fieldError("description")}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${id}-dueDate`}>Due</Label>
          <Input
            {...field("dueDate")}
            type="datetime-local"
            value={dueDate}
            onChange={(event) => setDueDate(event.target.value)}
          />
          {fieldError("dueDate")}
        </div>
      </div>
      <DialogFooter>
        <DialogClose render={<Button variant="outline" type="button" />}>Cancel</DialogClose>
        <Button type="submit" disabled={pending} aria-busy={pending || undefined}>
          {pending ? "Saving…" : "Save"}
        </Button>
      </DialogFooter>
    </form>
  );
}
