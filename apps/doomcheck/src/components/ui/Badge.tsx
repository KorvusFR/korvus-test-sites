import { cn } from "@/lib/utils";

interface BadgeProps {
  children: React.ReactNode;
  variant?: "default" | "success" | "warning" | "danger" | "doom";
  className?: string;
}

export function Badge({ children, variant = "default", className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded text-xs font-medium",
        {
          "bg-doom-700 text-slate-300": variant === "default",
          "bg-green-900 text-green-300 border border-green-700":
            variant === "success",
          "bg-yellow-900 text-yellow-300 border border-yellow-700":
            variant === "warning",
          "bg-red-900 text-red-300 border border-red-700": variant === "danger",
          "bg-doom-red text-white": variant === "doom",
        },
        className
      )}
    >
      {children}
    </span>
  );
}
