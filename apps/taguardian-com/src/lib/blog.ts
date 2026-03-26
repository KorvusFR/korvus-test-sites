import rawPosts from "../../data/blog.json";
import type { BlogPost } from "@/types";

const posts = rawPosts as BlogPost[];

export function getAllPosts(): BlogPost[] {
  return [...posts].sort(
    (a, b) =>
      new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  );
}

export function getPostBySlug(slug: string): BlogPost | undefined {
  return posts.find((p) => p.slug === slug);
}
