import { cn } from "~/lib/cn";

type Variant = "primary" | "secondary" | "danger" | "ghost";
type Size = "sm" | "md";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

const variantClasses: Record<Variant, string> = {
  primary: "bg-brand-600 hover:bg-brand-700 text-white border-transparent",
  secondary: "bg-white hover:bg-slate-50 text-slate-700 border-slate-300",
  danger: "bg-red-600 hover:bg-red-700 text-white border-transparent",
  ghost: "bg-transparent hover:bg-slate-100 text-slate-700 border-transparent",
};

const sizeClasses: Record<Size, string> = {
  sm: "px-2.5 py-1 text-xs",
  md: "px-3 py-1.5 text-sm",
};

export function Button({
  variant = "primary",
  size = "md",
  className,
  disabled,
  ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      disabled={disabled}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
        variantClasses[variant],
        sizeClasses[size],
        className
      )}
    />
  );
}
