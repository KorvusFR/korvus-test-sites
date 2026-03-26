import Link from "next/link";
import { Zap } from "lucide-react";

export function Footer() {
  return (
    <footer className="border-t border-doom-700 bg-doom-900 mt-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          <div className="col-span-2 md:col-span-1">
            <Link href="/" className="flex items-center gap-2 text-doom-red font-bold font-mono mb-3">
              <Zap className="w-4 h-4" />
              doomcheck.me
            </Link>
            <p className="text-sm text-doom-400 leading-relaxed">
              Electronics and gadgets for those who operate at the edge.
            </p>
          </div>

          <div>
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
              Categories
            </h3>
            <ul className="space-y-2 text-sm text-doom-400">
              {[
                { href: "/catalog/phones", label: "Phones & Tablets" },
                { href: "/catalog/audio", label: "Audio" },
                { href: "/catalog/gaming", label: "Gaming" },
                { href: "/catalog/laptops", label: "Laptops" },
                { href: "/catalog/accessories", label: "Accessories" },
              ].map(({ href, label }) => (
                <li key={href}>
                  <Link href={href} className="hover:text-doom-red transition-colors">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
              Shop
            </h3>
            <ul className="space-y-2 text-sm text-doom-400">
              {[
                { href: "/catalog", label: "All Products" },
                { href: "/cart", label: "Cart" },
                { href: "/checkout", label: "Checkout" },
              ].map(({ href, label }) => (
                <li key={href}>
                  <Link href={href} className="hover:text-doom-red transition-colors">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
              Chaos Lab
            </h3>
            <ul className="space-y-2 text-sm text-doom-400">
              <li>
                <span className="font-mono text-xs bg-doom-800 px-1.5 py-0.5 rounded text-doom-green">
                  slow_snippet
                </span>
              </li>
              <li>
                <span className="font-mono text-xs bg-doom-800 px-1.5 py-0.5 rounded text-doom-green">
                  js_error
                </span>
              </li>
              <li>
                <span className="font-mono text-xs bg-doom-800 px-1.5 py-0.5 rounded text-doom-green">
                  broken_images
                </span>
              </li>
              <li>
                <span className="font-mono text-xs bg-doom-800 px-1.5 py-0.5 rounded text-doom-green">
                  checkout_crash
                </span>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-doom-700 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-doom-400">
          <p>© {new Date().getFullYear()} doomcheck.me — Chaos lab. No real products sold.</p>
          <p className="font-mono">
            NEXT_PUBLIC_CHAOS_FLAGS={process.env.NEXT_PUBLIC_CHAOS_FLAGS || "(none)"}
          </p>
        </div>
      </div>
    </footer>
  );
}
