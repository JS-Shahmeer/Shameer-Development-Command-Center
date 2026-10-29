import { Label } from "@/components/ui/label";

export function FormField({
  id,
  label,
  error,
  hint,
  required,
  children,
}: {
  id: string;
  label: string;
  error?: string[] | string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  const message = Array.isArray(error) ? error[0] : error;
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>
        {label}
        {required && (
          <span className="text-danger ml-0.5" aria-hidden>
            *
          </span>
        )}
      </Label>
      {children}
      {message ? (
        <p id={`${id}-error`} className="text-danger text-xs" role="alert">
          {message}
        </p>
      ) : hint ? (
        <p className="text-muted text-xs">{hint}</p>
      ) : null}
    </div>
  );
}
