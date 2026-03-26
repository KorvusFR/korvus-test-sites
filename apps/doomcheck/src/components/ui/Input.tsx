import { cn } from "@/lib/utils";
import type { InputHTMLAttributes } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export function Input({ label, error, className, id, ...props }: InputProps) {
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label
          htmlFor={id}
          className="text-sm font-medium text-slate-300"
        >
          {label}
        </label>
      )}
      <input
        id={id}
        className={cn(
          "bg-doom-800 border border-doom-600 text-slate-200 rounded-md px-3 py-2 text-sm placeholder-doom-400 focus:outline-none focus:ring-2 focus:ring-doom-red focus:border-transparent transition-colors",
          error && "border-red-500 focus:ring-red-500",
          className
        )}
        {...props}
      />
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
