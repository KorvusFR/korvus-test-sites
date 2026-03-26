import React from "react";
import { cn } from "@/lib/utils";

interface BadgeProps {
  children: React.ReactNode;
  variant?: "default" | "success" | "warning" | "danger" | "info" | "purple";
  className?: string;
}

export function Badge({ children, variant = "default", className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium",
        {
          "bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300":
            variant === "default",
          "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400":
            variant === "success",
          "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400":
            variant === "warning",
          "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400":
            variant === "danger",
          "bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-400":
            variant === "info",
          "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-400":
            variant === "purple",
        },
        className
      )}
    >
      {children}
    </span>
  );
}
