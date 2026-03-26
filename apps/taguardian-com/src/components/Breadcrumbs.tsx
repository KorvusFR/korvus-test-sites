import Link from "next/link";
import { ChevronRight } from "lucide-react";

interface BreadcrumbItem {
  label: string;
  href?: string;
}

export function Breadcrumbs({ items }: { items: BreadcrumbItem[] }) {
  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-sm text-slate-500 dark:text-slate-500 py-3">
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        return (
          <span key={index} className="flex items-center gap-1">
            {index > 0 && <ChevronRight className="w-3.5 h-3.5 flex-shrink-0" />}
            {item.href && !isLast ? (
              <Link href={item.href} className="hover:text-brand-600 dark:hover:text-brand-400 transition-colors">
                {item.label}
              </Link>
            ) : (
              <span className={isLast ? "text-slate-900 dark:text-slate-100 font-medium" : ""} aria-current={isLast ? "page" : undefined}>
                {item.label}
              </span>
            )}
          </span>
        );
      })}
    </nav>
  );
}
