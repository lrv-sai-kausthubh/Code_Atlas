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
      <aside className="flex flex-col border-r border-[#2b3030] bg-[#141616] px-4 py-5 light:border-[#d6dfda] light:bg-[#f1f4f0] max-[900px]:border-r-0 max-[900px]:border-b">
        <div className="min-w-0 border-b border-[#2b3030] pb-4 light:border-[#d6dfda]">
          <div className="font-dm text-[10px] tracking-[.1em] text-[#64d5c4]">{title}</div>
          {subtitle && (
            <div className="mt-1 truncate font-dm text-[10px] text-[#79817e] light:text-[#61716a]">
              {subtitle}
            </div>
          )}
        </div>
        <nav className="mt-4 flex flex-1 flex-col gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              className={`flex items-center justify-between gap-2 border-l-2 bg-transparent px-3 py-2 text-left font-dm text-[11px] tracking-[.06em] transition-colors ${
                active === tab.id
                  ? "border-[#f2b84b] bg-[#1c201f] text-[#eef0eb] light:bg-[#e7ede9] light:text-[#202824]"
                  : "border-transparent text-[#79817e] hover:border-[#39413e] hover:text-[#f2b84b] light:text-[#61716a]"
              }`}
              onClick={() => onSelect(tab.id)}
            >
              <span>{tab.label}</span>
              {tab.badge !== undefined && tab.badge > 0 && (
                <span className="grid h-4 min-w-4 place-items-center rounded-full bg-[#f2b84b] px-1 font-dm text-[9px] text-[#0b1f1b]">
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
      <div className="min-w-0 overflow-y-auto no-scrollbar bg-[#111313] light:bg-[#f6f8f5]">
        {children}
      </div>
    </section>
  );
}

export default SecurityShell;
