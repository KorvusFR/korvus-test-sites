import { cn } from "@/lib/utils";
import type { ButtonHTMLAttributes } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
}

export function Button({
  variant = "primary",
  size = "md",
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center font-semibold transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-doom-red focus:ring-offset-2 focus:ring-offset-doom-900 disabled:opacity-50 disabled:cursor-not-allowed",
        {
          "bg-doom-red text-white hover:bg-red-600 active:scale-95":
            variant === "primary",
          "bg-doom-700 text-slate-200 hover:bg-doom-600 border border-doom-600":
            variant === "secondary",
          "border border-doom-red text-doom-red hover:bg-doom-red hover:text-white":
            variant === "outline",
          "text-slate-400 hover:text-slate-200 hover:bg-doom-700":
            variant === "ghost",
          "bg-red-900 text-red-300 hover:bg-red-800 border border-red-800":
            variant === "danger",
        },
        {
          "text-sm px-3 py-1.5 rounded": size === "sm",
          "text-sm px-4 py-2 rounded-md": size === "md",
          "text-base px-6 py-3 rounded-md": size === "lg",
        },
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}
