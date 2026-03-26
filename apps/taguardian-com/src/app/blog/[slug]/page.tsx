import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Clock, User, ArrowLeft, Tag } from "lucide-react";
import { getPostBySlug, getAllPosts } from "@/lib/blog";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { Badge } from "@/components/ui/Badge";
import { formatDate } from "@/lib/utils";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return getAllPosts().map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  return { title: post?.title ?? "Article" };
}

export default async function BlogPostPage({ params }: PageProps) {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) notFound();

  // Render content paragraphs
  const paragraphs = post.content.split("\n\n").filter(Boolean);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Blog", href: "/blog" }, { label: post.title }]} />

      <article>
        {/* Header */}
        <header className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <Badge variant="info" className="capitalize">{post.category.replace("-", " ")}</Badge>
            <span className="text-xs text-slate-400 flex items-center gap-1">
              <Clock className="w-3 h-3" /> {post.readingTime} min read
            </span>
          </div>

          <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900 dark:text-slate-100 leading-tight mb-4">
            {post.title}
          </h1>

          <p className="text-lg text-slate-500 dark:text-slate-400 mb-6 leading-relaxed">
            {post.excerpt}
          </p>

          <div className="flex items-center gap-3 pb-6 border-b border-slate-200 dark:border-slate-700">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-brand-600 to-brand-400 flex items-center justify-center">
              <User className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="font-semibold text-slate-900 dark:text-slate-100 text-sm">{post.author}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {post.authorRole} · {formatDate(post.publishedAt)}
              </p>
            </div>
          </div>
        </header>

        {/* Content */}
        <div className="prose-custom space-y-5">
          {paragraphs.map((para, i) => {
            // Detect list items
            if (para.startsWith("1.") || para.match(/^\d+\./)) {
              const items = para.split("\n").filter(Boolean);
              return (
                <ol key={i} className="list-decimal list-inside space-y-3">
                  {items.map((item, j) => (
                    <li key={j} className="text-slate-600 dark:text-slate-400 leading-relaxed text-sm">
                      <span className="ml-1">{item.replace(/^\d+\.\s*/, "")}</span>
                    </li>
                  ))}
                </ol>
              );
            }
            return (
              <p key={i} className="text-slate-600 dark:text-slate-400 leading-relaxed text-sm">
                {para}
              </p>
            );
          })}
        </div>

        {/* Tags */}
        <div className="flex flex-wrap gap-2 mt-8 pt-6 border-t border-slate-200 dark:border-slate-700">
          <Tag className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" />
          {post.tags.map((tag) => (
            <Badge key={tag} variant="default">{tag}</Badge>
          ))}
        </div>
      </article>

      <div className="mt-8">
        <Link href="/blog">
          <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-600 dark:text-brand-400 hover:underline">
            <ArrowLeft className="w-4 h-4" /> Back to Blog
          </span>
        </Link>
      </div>
    </div>
  );
}
