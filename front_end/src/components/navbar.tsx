type NavbarProps = {
    onGetStarted: () => void;
};

function LogoMark() {
    return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="12" cy="12" r="2.2" fill="#f54e00" />
            <circle cx="4.5" cy="5.5" r="1.8" stroke="currentColor" strokeWidth="1.4" fill="none" />
            <circle cx="19.5" cy="5.5" r="1.8" stroke="currentColor" strokeWidth="1.4" fill="none" />
            <circle cx="4.5" cy="18.5" r="1.8" stroke="currentColor" strokeWidth="1.4" fill="none" />
            <circle cx="19.5" cy="18.5" r="1.8" stroke="currentColor" strokeWidth="1.4" fill="none" />
            <path d="M5.6 6.9 10.4 10.6M18.4 6.9 13.6 10.6M5.6 17.1l4.8-3.7M18.4 17.1l-4.8-3.7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
    );
}

export default function Navbar({ onGetStarted }: NavbarProps) {
    return (
        <header className="fixed top-0 left-0 right-0 z-50 flex h-16 items-center justify-between border-b border-[var(--ca-hairline)] bg-[var(--ca-canvas)] px-6 backdrop-blur-[10px]">
            <div className="flex items-center gap-3">
                <span className="text-[var(--ca-ink)]"><LogoMark /></span>
                <span className="text-[17px] font-medium tracking-[-0.02em] text-[var(--ca-ink)]">CodeAtlas</span>
                <nav className="ml-8 hidden gap-6 max-[900px]:hidden">
                    <a href="#platform" className="no-underline text-[14px] font-medium text-[var(--ca-body)] transition-colors hover:text-[var(--ca-ink)]">Platform</a>
                    <a href="#about" className="no-underline text-[14px] font-medium text-[var(--ca-body)] transition-colors hover:text-[var(--ca-ink)]">About</a>
                    <a href="#faq" className="no-underline text-[14px] font-medium text-[var(--ca-body)] transition-colors hover:text-[var(--ca-ink)]">FAQ</a>
                </nav>
            </div>
            <div className="flex items-center gap-3">
                <button onClick={onGetStarted} className="inline-flex h-10 items-center rounded-[8px] border border-[var(--ca-primary)] bg-[var(--ca-primary)] px-[18px] text-[14px] font-medium text-[var(--ca-on-primary)] transition-colors hover:bg-[var(--ca-primary-active)]">Login</button>
            </div>
        </header>
    );
}
