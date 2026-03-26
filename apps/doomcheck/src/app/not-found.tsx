import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      <p className="font-mono text-8xl font-bold text-doom-red mb-2">404</p>
      <h1 className="text-2xl font-bold text-slate-200 mb-3">Signal Lost</h1>
      <p className="text-doom-400 mb-8 max-w-sm">
        The page you requested has been swallowed by the void. It may have
        never existed, or perhaps chaos got to it first.
      </p>
      <Link
        href="/"
        className="inline-flex items-center gap-2 bg-doom-red text-white font-semibold px-5 py-2.5 rounded-md hover:bg-red-600 transition-colors"
      >
        Return to Base
      </Link>
    </div>
  );
}
