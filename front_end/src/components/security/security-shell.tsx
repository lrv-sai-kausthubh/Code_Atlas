import type { ReactNode } from "react";
import BackButton from "../back-button";

export type ShellTab = {
  id: string;
  label: string;
  badge?: number;
};

function SecurityShell({
  title,
  subtitle,
  tabs,
  active,
  onSelect,
  onBack,
  children,
}: {
  title: string;
  subtitle?: string;
  tabs: ShellTab[];
  active: string;
  onSelect: (tabId: string) => void;
  onBack: () => void;
  children: ReactNode;
}) {
  return (
    <section className="grid h-[calc(100vh-62px)] grid-cols-[210px_minmax(0,1fr)] max-[900px]:grid-cols-1 max-[900px]:h-auto">
      <aside className="flex flex-col border-r border-[var(--ca-hairline)] bg-[var(--ca-surface-card)] px-4 py-5 max-[900px]:border-r-0 max-[900px]:border-b">
        <div className="min-w-0 border-b border-[var(--ca-hairline)] pb-4">
          <div className="ca-mono-label !text-[10px] font-semibold uppercase tracking-[.08em] text-[var(--ca-success)]">{title}</div>
          {subtitle && (
            <div className="mt-1 truncate ca-mono-label !text-[10px] text-[var(--ca-muted)]">
              {subtitle}
            </div>
          )}
        </div>
        <nav className="mt-4 flex flex-1 flex-col gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              className={`flex items-center justify-between gap-2 border-l-2 bg-transparent px-3 py-2 text-left ca-mono-label !text-[11px] tracking-[.06em] transition-colors ${
                active === tab.id
                  ? "border-[var(--ca-primary)] bg-[var(--ca-surface-strong)] text-[var(--ca-ink)]"
                  : "border-transparent text-[var(--ca-muted)] hover:border-[var(--ca-hairline-strong)] hover:text-[var(--ca-primary)]"
              }`}
              onClick={() => onSelect(tab.id)}
            >
              <span>{tab.label}</span>
              {tab.badge !== undefined && tab.badge > 0 && (
                <span className="grid h-4 min-w-4 place-items-center rounded-full bg-[var(--ca-primary)] px-1 ca-mono-label !text-[9px] text-[var(--ca-on-primary)]">
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </nav>
        <div className="pt-4">
          <BackButton onClick={onBack} label="BACK TO PROJECTS" />
        </div>
      </aside>
      <div className="min-w-0 overflow-y-auto no-scrollbar bg-[var(--ca-canvas)]">
        {children}
      </div>
    </section>
  );
}

export default SecurityShell;
