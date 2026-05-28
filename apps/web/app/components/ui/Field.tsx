import { cn } from "~/lib/cn";

interface FieldProps {
  label: string;
  name: string;
  type?: "text" | "email" | "url" | "number" | "color";
  defaultValue?: string | number;
  required?: boolean;
  placeholder?: string;
  className?: string;
  children?: React.ReactNode;
}

/** Label + input/select envueltos con estilo consistente. */
export function Field({
  label,
  name,
  type = "text",
  defaultValue,
  required,
  placeholder,
  className,
  children,
}: FieldProps) {
  return (
    <label className={cn("block text-sm", className)}>
      <span className="block font-medium text-slate-700 mb-1">{label}</span>
      {children ?? (
        <input
          name={name}
          type={type}
          defaultValue={defaultValue}
          required={required}
          placeholder={placeholder}
          className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
      )}
    </label>
  );
}

interface SelectFieldProps extends Omit<FieldProps, "type" | "children"> {
  options: { value: string; label: string }[];
  emptyLabel?: string;
}

export function SelectField({
  label,
  name,
  defaultValue,
  required,
  options,
  emptyLabel,
  className,
}: SelectFieldProps) {
  return (
    <label className={cn("block text-sm", className)}>
      <span className="block font-medium text-slate-700 mb-1">{label}</span>
      <select
        name={name}
        defaultValue={defaultValue as string | undefined}
        required={required}
        className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
      >
        {emptyLabel !== undefined ? <option value="">{emptyLabel}</option> : null}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
