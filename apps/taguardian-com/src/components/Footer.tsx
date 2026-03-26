import Link from "next/link";
import { Shield } from "lucide-react";

export function Footer() {
  return (
    <footer className="bg-slate-900 dark:bg-slate-950 text-slate-400 border-t border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="md:col-span-1">
            <Link href="/" className="flex items-center gap-2 font-bold text-xl text-white mb-3">
              <Shield className="w-5 h-5 text-brand-400" />
              <span>TagGuardian</span>
            </Link>
            <p className="text-sm text-slate-500">
              Enterprise cybersecurity solutions for security-first organisations.
            </p>
          </div>

          <div>
            <h3 className="font-semibold text-slate-200 mb-3 text-sm uppercase tracking-wider">Solutions</h3>
            <ul className="space-y-2">
              {[
                { href: "/catalog/software", label: "Security Software" },
                { href: "/catalog/hardware", label: "Hardware & Appliances" },
                { href: "/catalog/managed-services", label: "Managed Services" },
                { href: "/catalog/infrastructure", label: "Infrastructure" },
              ].map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="text-sm hover:text-slate-200 transition-colors">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="font-semibold text-slate-200 mb-3 text-sm uppercase tracking-wider">Resources</h3>
            <ul className="space-y-2">
              {[
                { href: "/blog", label: "Security Blog" },
                { href: "/catalog", label: "Full Catalogue" },
              ].map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="text-sm hover:text-slate-200 transition-colors">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="font-semibold text-slate-200 mb-3 text-sm uppercase tracking-wider">Company</h3>
            <ul className="space-y-2">
              {["Privacy Policy", "Terms of Service", "Cookie Policy", "Contact Us"].map((label) => (
                <li key={label}>
                  <span className="text-sm cursor-default">{label}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="border-t border-slate-800 mt-10 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-slate-600">
            &copy; {new Date().getFullYear()} TagGuardian. All rights reserved.
          </p>
          <p className="text-xs text-slate-700">taguardian.com</p>
        </div>
      </div>
    </footer>
  );
}
