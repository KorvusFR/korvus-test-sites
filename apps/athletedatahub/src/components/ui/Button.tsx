import React from "react";
import { cn } from "@/lib/utils";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  fullWidth?: boolean;
}

export function Button({
  variant = "primary",
  size = "md",
  fullWidth = false,
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 font-semibold rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed",
        {
          "bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800":
            variant === "primary",
          "bg-gray-100 text-gray-900 hover:bg-gray-200 active:bg-gray-300":
            variant === "secondary",
          "border border-gray-300 bg-white text-gray-700 hover:bg-gray-50":
            variant === "outline",
          "text-gray-600 hover:bg-gray-100 hover:text-gray-900":
            variant === "ghost",
          "bg-red-600 text-white hover:bg-red-700": variant === "danger",
          "text-sm px-3 py-1.5": size === "sm",
          "text-sm px-4 py-2": size === "md",
          "text-base px-6 py-3": size === "lg",
          "w-full": fullWidth,
        },
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}
