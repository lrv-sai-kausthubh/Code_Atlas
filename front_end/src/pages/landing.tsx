import Navbar from "../components/navbar";
import { toastLoading, toastSuccess, toastValidation } from "../services/toast";

type LandingProps = {
    onGetStarted: () => void;
    isAuthenticated?: boolean;
};

function CanvasMock() {
    return (
        <svg viewBox="0 0 800 500" xmlns="http://www.w3.org/2000/svg">
            <g fill="none" stroke="#26251e" strokeWidth="1.2" opacity="0.6">
                <path d="M210 150 C 300 90, 400 90, 470 120" />
                <path d="M210 150 C 280 250, 380 260, 470 220" />
                <path d="M470 120 C 560 80, 620 130, 640 200" stroke="#5b8dd9" />
                <path d="M470 220 C 560 240, 600 300, 640 330" stroke="#7d5fc7" />
                <path d="M640 200 C 700 220, 680 300, 640 330" stroke="#cfcdc4" />
                <path d="M210 150 L 640 330" stroke="#cfcdc4" strokeDasharray="4 5" />
            </g>
            <g>
                <circle cx="210" cy="150" r="42" fill="#ffffff" stroke="#26251e" strokeWidth="1.4" />
                <text x="210" y="140" textAnchor="middle" fill="#26251e" fontSize="13" fontFamily="JetBrains Mono, monospace">UI</text>
                <text x="210" y="158" textAnchor="middle" fill="#807d72" fontSize="10" fontFamily="JetBrains Mono, monospace">SHELL</text>
                <circle cx="470" cy="120" r="42" fill="#ffffff" stroke="#5b8dd9" strokeWidth="1.4" />
                <text x="470" y="110" textAnchor="middle" fill="#5b8dd9" fontSize="12" fontFamily="JetBrains Mono, monospace">API</text>
                <text x="470" y="126" textAnchor="middle" fill="#807d72" fontSize="10" fontFamily="JetBrains Mono, monospace">ROUTER</text>
                <circle cx="470" cy="220" r="42" fill="#ffffff" stroke="#7d5fc7" strokeWidth="1.4" />
                <text x="470" y="210" textAnchor="middle" fill="#7d5fc7" fontSize="13" fontFamily="JetBrains Mono, monospace">DB</text>
                <text x="470" y="226" textAnchor="middle" fill="#807d72" fontSize="10" fontFamily="JetBrains Mono, monospace">STORE</text>
                <circle cx="640" cy="200" r="42" fill="#ffffff" stroke="#c08532" strokeWidth="1.4" />
                <text x="640" y="190" textAnchor="middle" fill="#c08532" fontSize="13" fontFamily="JetBrains Mono, monospace">AUTH</text>
                <text x="640" y="206" textAnchor="middle" fill="#807d72" fontSize="10" fontFamily="JetBrains Mono, monospace">SVC</text>
                <circle cx="640" cy="330" r="42" fill="#ffffff" stroke="#4f9d83" strokeWidth="1.4" />
                <text x="640" y="320" textAnchor="middle" fill="#4f9d83" fontSize="13" fontFamily="JetBrains Mono, monospace">EVT</text>
                <text x="640" y="336" textAnchor="middle" fill="#807d72" fontSize="10" fontFamily="JetBrains Mono, monospace">BUS</text>
            </g>
        </svg>
    );
}

function Landing({ onGetStarted, isAuthenticated = false }: LandingProps) {
    const bookDemo = () => toastLoading("Opening demo scheduler…");
    const showAssistant = () => toastSuccess("AI Architect will guide you through your codebase once you sign in.");
    const showSettings = () => toastValidation("Settings are available from your workspace after signing in.");
    const comingSoon = (label: string) => (event: { preventDefault: () => void }) => {
        event.preventDefault();
        toastLoading(`${label} is coming soon.`);
    };
    const joinNewsletter = (event: { preventDefault: () => void }) => {
        event.preventDefault();
        toastSuccess("Subscribed. Watch your inbox for architecture insights.");
    };
    return (
        <div className="min-h-screen bg-[var(--ca-canvas)] text-[var(--ca-ink)] font-sans overflow-x-hidden">
            <Navbar onGetStarted={onGetStarted} onAssistant={showAssistant} onSettings={showSettings} />
            <section className="relative flex min-h-screen items-center justify-center overflow-hidden pt-16">
                <div className="pointer-events-none absolute -right-[280px] -top-[120px] h-[560px] w-[560px] rounded-full border border-[var(--ca-hairline)] max-[1000px]:hidden" />
                <div className="pointer-events-none absolute -right-[160px] top-[60px] h-[320px] w-[320px] rounded-full border border-[var(--ca-hairline-soft)] max-[1000px]:hidden" />
                <div className="relative z-10 max-w-[880px] px-5 text-center">
                    <span className="ca-badge mb-8 inline-flex">Codebase visualization · v2.4</span>
                    <h1 className="ca-display-lg mt-0 mb-8 text-[clamp(40px,7vw,64px)]">
                        See how your code
                        <br />
                        <span className="text-[var(--ca-primary)]">actually works.</span>
                    </h1>
                    <p className="mx-auto mt-0 mb-10 max-w-[560px] text-[16px] leading-[1.6] text-[var(--ca-body)]">
                        Upload a repository and CodeAtlas will map its files, dependencies and
                        architecture into an interactive visual graph — without reading every file.
                    </p>
                    <div className="flex flex-wrap items-center justify-center gap-3">
                        <button onClick={onGetStarted} className="ca-btn-primary">{isAuthenticated ? "Access Dashboard" : "Upload ZIP"}</button>
                        <button onClick={bookDemo} className="ca-btn-secondary">Book a Demo</button>
                    </div>
                </div>
            </section>

            <section className="border-y border-[var(--ca-hairline)] bg-[var(--ca-canvas-soft)] py-[80px] px-4">
                <div className="mx-auto mb-12 max-w-[1160px] flex items-center gap-4">
                    <span className="ca-label">How it works</span>
                    <span className="h-px flex-1 max-w-[240px] bg-[var(--ca-hairline)]" />
                </div>
                <div className="mx-auto grid max-w-[1160px] grid-cols-1 gap-4 max-[900px]:grid-cols-1 md:grid-cols-3">
                    <article className="ca-card p-6 transition-colors duration-150 hover:border-[var(--ca-hairline-strong)]">
                        <div className="mb-5 flex items-center justify-between">
                            <span className="ca-mono text-[11px] text-[var(--ca-muted)]">01</span>
                            <span className="ca-label">Upload</span>
                        </div>
                        <h3 className="ca-title mt-0 mb-2 text-[18px]">Drop your repo</h3>
                        <p className="mt-0 mb-0 text-[14px] leading-[1.6] text-[var(--ca-body)]">Upload a ZIP or connect a GitHub repository. We scan every file, function and symbol.</p>
                    </article>
                    <article className="ca-card p-6 transition-colors duration-150 hover:border-[var(--ca-hairline-strong)]">
                        <div className="mb-5 flex items-center justify-between">
                            <span className="ca-mono text-[11px] text-[var(--ca-muted)]">02</span>
                            <span className="ca-label">Analyze</span>
                        </div>
                        <h3 className="ca-title mt-0 mb-2 text-[18px]">Build the graph</h3>
                        <p className="mt-0 mb-0 text-[14px] leading-[1.6] text-[var(--ca-body)]">We parse source into ASTs, resolve imports and dependencies, and assemble the architecture map.</p>
                    </article>
                    <article className="ca-card p-6 transition-colors duration-150 hover:border-[var(--ca-hairline-strong)]">
                        <div className="mb-5 flex items-center justify-between">
                            <span className="ca-mono text-[11px] text-[var(--ca-muted)]">03</span>
                            <span className="ca-label">Explore</span>
                        </div>
                        <h3 className="ca-title mt-0 mb-2 text-[18px]">Navigate the map</h3>
                        <p className="mt-0 mb-0 text-[14px] leading-[1.6] text-[var(--ca-body)]">Pan, zoom and trace flows visually. Select any node to inspect its relationships and metrics.</p>
                    </article>
                </div>
            </section>

            <section className="py-[80px] px-4">
                <div className="mx-auto mb-12 flex max-w-[1160px] items-center gap-4">
                    <span className="h-px w-12 bg-[var(--ca-primary)]" />
                    <span className="ca-display-md text-[28px]">The platform ecosystem</span>
                </div>
                <div className="mx-auto grid max-w-[1160px] grid-cols-12 gap-4">
                    <div className="relative col-span-12 h-[500px] overflow-hidden border border-[var(--ca-hairline)] bg-[var(--ca-surface-card)] md:col-span-8 max-[900px]:col-span-12">
                        <div className="absolute top-6 left-6 z-3">
                            <h4 className="ca-title mt-0 mb-1 text-[18px]">Interactive Canvas</h4>
                            <p className="ca-label mt-0 mb-0">Level 0: Macro structure</p>
                        </div>
                        <div className="absolute inset-0 opacity-90 [&_svg]:h-full [&_svg]:w-full"><CanvasMock /></div>
                    </div>
                    <div className="relative col-span-12 h-[500px] overflow-hidden border border-[var(--ca-hairline)] bg-[var(--ca-surface-card)] md:col-span-4 max-[900px]:col-span-12">
                        <div className="absolute top-6 left-6 z-3">
                            <h4 className="ca-title mt-0 mb-1 text-[18px]">Architecture Dashboard</h4>
                            <p className="ca-label mt-0 mb-0">Health &amp; metrics</p>
                        </div>
                        <div className="absolute inset-0 flex flex-col gap-4 p-[88px_24px_24px]">
                            <div className="border border-[var(--ca-hairline)] bg-[var(--ca-canvas-soft)] p-4">
                                <div className="ca-mono-label mb-2 flex justify-between">
                                    <span>Coupling</span>
                                    <span className="text-[var(--ca-error)]">High</span>
                                </div>
                                <div className="h-[3px] bg-[var(--ca-surface-strong)]"><i className="block h-full" style={{ width: "75%", background: "var(--ca-error)" }} /></div>
                            </div>
                            <div className="border border-[var(--ca-hairline)] bg-[var(--ca-canvas-soft)] p-4">
                                <div className="ca-mono-label mb-2 flex justify-between">
                                    <span>Test Coverage</span>
                                    <span className="text-[var(--ca-success)]">82%</span>
                                </div>
                                <div className="h-[3px] bg-[var(--ca-surface-strong)]"><i className="block h-full" style={{ width: "82%", background: "var(--ca-success)" }} /></div>
                            </div>
                            <div className="border border-[var(--ca-hairline)] bg-[var(--ca-canvas-soft)] p-4">
                                <div className="ca-mono-label mb-2 flex justify-between">
                                    <span>Cyclomatic Complexity</span>
                                    <span className="text-[#c08532]">Moderate</span>
                                </div>
                                <div className="h-[3px] bg-[var(--ca-surface-strong)]"><i className="block h-full" style={{ width: "48%", background: "#c08532" }} /></div>
                            </div>
                        </div>
                    </div>
                    <div className="relative col-span-12 h-[320px] overflow-hidden border border-[var(--ca-hairline)] bg-[var(--ca-surface-card)]">
                        <div className="absolute inset-0 grid grid-cols-2">
                            <div className="flex flex-col justify-center border-r border-[var(--ca-hairline)] p-10">
                                <h4 className="ca-title mt-0 mb-4 text-[18px]">AI Architect</h4>
                                <p className="mt-0 mb-6 max-w-[460px] text-[14px] leading-[1.6] text-[var(--ca-body)]">
                                    Ask &ldquo;how does login work?&rdquo; and watch the AI trace the
                                    path across your graph — Login.tsx → loginUser() → /api/login →
                                    AuthService → UserRepository → Database.
                                </p>
                                <div className="flex flex-wrap gap-2">
                                    <span className="ca-badge bg-[var(--ca-surface-strong)]">Natural language query</span>
                                    <span className="ca-badge">Path highlighting</span>
                                </div>
                            </div>
                            <div className="relative overflow-hidden bg-[var(--ca-canvas-soft)]">
                                <div className="absolute inset-0 bg-[radial-gradient(var(--ca-hairline-strong)_1px,transparent_1px)] bg-[size:24px_24px] opacity-40" />
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            <section className="border-y border-[var(--ca-hairline)] bg-[var(--ca-canvas-soft)] py-[80px] px-4">
                <div className="mx-auto grid max-w-[1160px] grid-cols-1 gap-4 md:grid-cols-3 max-[900px]:grid-cols-1">
                    <figure className="ca-card flex flex-col justify-between p-6">
                        <blockquote className="mt-0 mb-8 text-[14px] leading-[1.7] text-[var(--ca-body)]">&ldquo;CodeAtlas completely changed how we onboard new senior devs. What used to take weeks of reading code now takes 48 hours.&rdquo;</blockquote>
                        <figcaption className="flex items-center gap-4">
                            <span className="grid h-10 w-10 place-items-center rounded-full bg-[var(--ca-surface-strong)] ca-mono text-[12px] text-[var(--ca-ink)]">MC</span>
                            <div>
                                <strong className="ca-label block">Marcus Chen</strong>
                                <small className="text-[12px] text-[var(--ca-muted)]">Staff Engineer, FinTech OS</small>
                            </div>
                        </figcaption>
                    </figure>
                    <figure className="ca-card flex flex-col justify-between border-t-[3px] border-t-[var(--ca-primary)] p-6">
                        <blockquote className="mt-0 mb-8 text-[14px] leading-[1.7] text-[var(--ca-body)]">&ldquo;Visualizing dependencies in our monolith was a pipe dream until we plugged in CodeAtlas. The graph is incredibly fast even at our scale.&rdquo;</blockquote>
                        <figcaption className="flex items-center gap-4">
                            <span className="grid h-10 w-10 place-items-center rounded-full bg-[var(--ca-surface-strong)] ca-mono text-[12px] text-[var(--ca-ink)]">SJ</span>
                            <div>
                                <strong className="ca-label block">Sarah J. Miller</strong>
                                <small className="text-[12px] text-[var(--ca-muted)]">CTO, CloudScale</small>
                            </div>
                        </figcaption>
                    </figure>
                    <figure className="ca-card flex flex-col justify-between p-6">
                        <blockquote className="mt-0 mb-8 text-[14px] leading-[1.7] text-[var(--ca-body)]">&ldquo;The AI Architect doesn&apos;t just guess — it&apos;s grounded in the actual graph. It&apos;s the first LLM implementation that understands our system.&rdquo;</blockquote>
                        <figcaption className="flex items-center gap-4">
                            <span className="grid h-10 w-10 place-items-center rounded-full bg-[var(--ca-surface-strong)] ca-mono text-[12px] text-[var(--ca-ink)]">DV</span>
                            <div>
                                <strong className="ca-label block">David Vance</strong>
                                <small className="text-[12px] text-[var(--ca-muted)]">Senior Lead, GameStream</small>
                            </div>
                        </figcaption>
                    </figure>
                </div>
            </section>

            <footer className="border-t border-[var(--ca-hairline)] bg-[var(--ca-canvas)] px-4 pb-12 pt-[80px]">
                <div className="mx-auto grid max-w-[1160px] grid-cols-2 gap-10 pb-16 md:grid-cols-[4fr_2fr_2fr_4fr] max-[900px]:grid-cols-2 max-[900px]:gap-8">
                    <div>
                        <span className="ca-display-md text-[18px] font-medium tracking-[-0.02em]">CodeAtlas</span>
                        <p className="mt-4 mb-6 max-w-[320px] text-[13px] leading-[1.6] text-[var(--ca-body)]">
                            Understand your codebase without reading every file. Building the future of software comprehension.
                        </p>
                    </div>
                    <div>
                        <h5 className="ca-label mt-0 mb-6">Product</h5>
                        <ul className="mt-0 mb-0 flex list-none flex-col gap-3 p-0">
                            <li><a href="#" onClick={comingSoon("Features")} className="text-[13px] text-[var(--ca-body)] no-underline transition-colors hover:text-[var(--ca-ink)]">Features</a></li>
                            <li><a href="#" onClick={comingSoon("Pricing")} className="text-[13px] text-[var(--ca-body)] no-underline transition-colors hover:text-[var(--ca-ink)]">Pricing</a></li>
                            <li><a href="#" onClick={comingSoon("API Docs")} className="text-[13px] text-[var(--ca-body)] no-underline transition-colors hover:text-[var(--ca-ink)]">API Docs</a></li>
                            <li><a href="#" onClick={comingSoon("Security")} className="text-[13px] text-[var(--ca-body)] no-underline transition-colors hover:text-[var(--ca-ink)]">Security</a></li>
                        </ul>
                    </div>
                    <div>
                        <h5 className="ca-label mt-0 mb-6">Company</h5>
                        <ul className="mt-0 mb-0 flex list-none flex-col gap-3 p-0">
                            <li><a href="#" onClick={comingSoon("About")} className="text-[13px] text-[var(--ca-body)] no-underline transition-colors hover:text-[var(--ca-ink)]">About</a></li>
                            <li><a href="#" onClick={comingSoon("Blog")} className="text-[13px] text-[var(--ca-body)] no-underline transition-colors hover:text-[var(--ca-ink)]">Blog</a></li>
                            <li><a href="#" onClick={comingSoon("Careers")} className="text-[13px] text-[var(--ca-body)] no-underline transition-colors hover:text-[var(--ca-ink)]">Careers</a></li>
                            <li><a href="#" onClick={comingSoon("Contact")} className="text-[13px] text-[var(--ca-body)] no-underline transition-colors hover:text-[var(--ca-ink)]">Contact</a></li>
                        </ul>
                    </div>
                    <div>
                        <h5 className="ca-label mt-0 mb-6">Stay in the loop</h5>
                        <p className="m-0 text-[13px] text-[var(--ca-body)]">Get architecture tips and platform updates.</p>
                        <form className="mt-6 flex border border-[var(--ca-hairline-strong)] bg-[var(--ca-surface-card)] p-1" onSubmit={joinNewsletter}>
                            <input type="email" placeholder="email@company.com" className="flex-1 border-0 bg-transparent px-3 py-2 text-[13px] text-[var(--ca-ink)] outline-none placeholder:text-[var(--ca-muted-soft)]" />
                            <button type="submit" className="ca-btn-primary h-9 px-4 text-[13px]">Join</button>
                        </form>
                    </div>
                </div>
                <div className="mx-auto flex max-w-[1160px] flex-wrap items-center justify-between gap-4 border-t border-[var(--ca-hairline)] pt-8 text-[12px] text-[var(--ca-muted)]">
                    <span>© 2026 CodeAtlas Technologies Inc. All rights reserved.</span>
                    <div className="flex gap-6">
                        <a href="#" onClick={comingSoon("Privacy Policy")} className="text-[var(--ca-muted)] no-underline transition-colors hover:text-[var(--ca-ink)]">Privacy Policy</a>
                        <a href="#" onClick={comingSoon("Terms of Service")} className="text-[var(--ca-muted)] no-underline transition-colors hover:text-[var(--ca-ink)]">Terms of Service</a>
                    </div>
                </div>
            </footer>
        </div>
    );
}

export default Landing;