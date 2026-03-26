import Link from "next/link";
import { Button } from "@/components/ui/Button";

export default function NotFound() {
  return (
    <div className="max-w-lg mx-auto px-4 py-24 text-center flex flex-col items-center gap-5">
      <p className="text-8xl font-extrabold text-slate-100 dark:text-slate-800">404</p>
      <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Page Not Found</h2>
      <p className="text-slate-500 dark:text-slate-400">
        This page does not exist or has been moved.
      </p>
      <Link href="/"><Button size="lg">Back to Home</Button></Link>
    </div>
  );
}
