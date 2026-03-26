import type { Metadata } from "next";
import Link from "next/link";
import { Clock, User } from "lucide-react";
import { getAllPosts } from "@/lib/blog";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { Badge } from "@/components/ui/Badge";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Security Blog" };

const categoryColors: Record<string, "info" | "success" | "warning" | "purple" | "default"> = {
  strategy: "info",
  "threat-intelligence": "warning",
  compliance: "success",
  cloud: "purple",
  hardening: "warning",
  operations: "default",
};

export default function BlogPage() {
  const posts = getAllPosts();

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Security Blog" }]} />

      <div className="max-w-3xl mb-10">
        <h1 className="text-3xl font-extrabold text-slate-900 dark:text-slate-100 mb-2">
          Security Intelligence
        </h1>
        <p className="text-slate-500 dark:text-slate-400">
          Expert analysis, hardening guides, and compliance resources from certified security practitioners.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {posts.map((post) => (
          <Link
            key={post.id}
            href={`/blog/${post.slug}`}
            className="group bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:border-brand-300 dark:hover:border-brand-700 rounded-xl overflow-hidden hover:shadow-md transition-all flex flex-col"
          >
            {/* Top accent */}
            <div className="h-1.5 bg-gradient-to-r from-brand-600 to-brand-400" />

            <div className="flex flex-col flex-1 p-5 gap-3">
              <div className="flex items-center gap-2">
                <Badge variant={categoryColors[post.category] ?? "default"} className="capitalize">
                  {post.category.replace("-", " ")}
                </Badge>
                <span className="text-xs text-slate-400 flex items-center gap-1">
                  <Clock className="w-3 h-3" /> {post.readingTime} min
                </span>
              </div>

              <h2 className="font-bold text-slate-900 dark:text-slate-100 group-hover:text-brand-700 dark:group-hover:text-brand-400 transition-colors leading-snug line-clamp-3 text-sm">
                {post.title}
              </h2>

              <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-3 leading-relaxed flex-1">
                {post.excerpt}
              </p>

              <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <div className="w-6 h-6 rounded-full bg-brand-100 dark:bg-brand-900/40 flex items-center justify-center">
                  <User className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400" />
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-medium text-slate-700 dark:text-slate-300">{post.author}</span>
                  <span className="text-xs text-slate-400">{formatDate(post.publishedAt)}</span>
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
