import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { PhoneCall, History, Settings, Activity } from "lucide-react";
import { cn } from "@/lib/utils";

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const [location] = useLocation();

  const navItems = [
    { href: "/", label: "DISPATCH", icon: Activity },
    { href: "/history", label: "LOGS", icon: History },
    { href: "/settings", label: "CONFIG", icon: Settings },
  ];

  return (
    <div className="flex h-[100dvh] w-full bg-background text-foreground overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 border-r border-border bg-sidebar flex flex-col">
        <div className="p-6 border-b border-border">
          <div className="flex items-center gap-3 text-primary">
            <PhoneCall className="h-6 w-6" />
            <h1 className="font-mono font-bold text-xl tracking-wider">VOICE_BRIDGE</h1>
          </div>
          <div className="text-[10px] text-muted-foreground font-mono mt-2 tracking-widest uppercase">
            Real-time comms link
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          {navItems.map((item) => {
            const isActive = location === item.href;
            return (
              <Link key={item.href} href={item.href}>
                <div
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 rounded-md font-mono text-sm transition-all cursor-pointer",
                    isActive
                      ? "bg-primary/10 text-primary border border-primary/30 glow-teal"
                      : "text-muted-foreground hover:text-foreground hover:bg-white/5 border border-transparent"
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                  {isActive && (
                    <div className="ml-auto w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                  )}
                </div>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-border text-xs text-muted-foreground font-mono">
          <div className="flex justify-between items-center mb-2">
            <span>SYS_STATUS</span>
            <span className="text-primary">ONLINE</span>
          </div>
          <div className="flex justify-between items-center">
            <span>LATENCY</span>
            <span className="text-primary">24ms</span>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-hidden relative">
        {/* Subtle grid background applied in index.css */}
        <div className="absolute inset-0 pointer-events-none opacity-50 mix-blend-overlay"></div>
        {children}
      </main>
    </div>
  );
}
