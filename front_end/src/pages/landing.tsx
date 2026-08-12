import Navbar from "../components/navbar";
import { useEffect, useState } from "react";
import { toastLoading, toastSuccess } from "../services/toast";
import DemoWorkflow from "../components/landing/demo-workflow";
import FaqAccordion from "../components/landing/faq-accordion";
import { useNavigation } from "../services/navigation";

type LandingProps = {
    onGetStarted: () => void;
    isAuthenticated?: boolean;
};

function CanvasMock() {
    return (
        <svg viewBox="0 0 800 500" xmlns="http://www.w3.org/2000/svg">
            <g fill="none" stroke="#26251e" strokeWidth="1.2" opacity="0.6">
                <path className="landing-flow-line" d="M210 150 C 300 90, 400 90, 470 120" />
                <path className="landing-flow-line landing-flow-line-delay" d="M210 150 C 280 250, 380 260, 470 220" />
                <path className="landing-flow-line landing-flow-line-delay-2" d="M470 120 C 560 80, 620 130, 640 200" stroke="#5b8dd9" />
                <path className="landing-flow-line landing-flow-line-delay" d="M470 220 C 560 240, 600 300, 640 330" stroke="#7d5fc7" />
                <path className="landing-flow-line landing-flow-line-delay-2" d="M640 200 C 700 220, 680 300, 640 330" stroke="#cfcdc4" />
                <path className="landing-flow-line landing-flow-line-delay" d="M210 150 L 640 330" stroke="#cfcdc4" strokeDasharray="4 5" />
            </g>
            <g>
                <circle className="landing-node-pulse" cx="210" cy="150" r="42" fill="#ffffff" stroke="#26251e" strokeWidth="1.4" />
                <text x="210" y="140" textAnchor="middle" fill="#26251e" fontSize="13" fontFamily="JetBrains Mono, monospace">UI</text>
                <text x="210" y="158" textAnchor="middle" fill="#807d72" fontSize="10" fontFamily="JetBrains Mono, monospace">SHELL</text>
                <circle className="landing-node-pulse landing-node-delay" cx="470" cy="120" r="42" fill="#ffffff" stroke="#5b8dd9" strokeWidth="1.4" />
                <text x="470" y="110" textAnchor="middle" fill="#5b8dd9" fontSize="12" fontFamily="JetBrains Mono, monospace">API</text>
                <text x="470" y="126" textAnchor="middle" fill="#807d72" fontSize="10" fontFamily="JetBrains Mono, monospace">ROUTER</text>
                <circle className="landing-node-pulse landing-node-delay-2" cx="470" cy="220" r="42" fill="#ffffff" stroke="#7d5fc7" strokeWidth="1.4" />
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

function CountUp({ value, duration = 1200 }: { value: number; duration?: number }) {
    const [current, setCurrent] = useState(0);
    useEffect(() => {
        let frame = 0;
        const started = performance.now();
        const tick = (now: number) => {
            const progress = Math.min((now - started) / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            setCurrent(Math.round(value * eased));
            if (progress < 1) frame = requestAnimationFrame(tick);
        };
        frame = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(frame);
    }, [duration, value]);
    return <>{current.toString().padStart(2, "0")}</>;
}

function AnimatedBar({ value, color }: { value: number; color: string }) {
    const [width, setWidth] = useState(0);
    useEffect(() => {
        const timer = window.setTimeout(() => setWidth(value), 180);
        return () => window.clearTimeout(timer);
    }, [value]);
    return <i className="block h-full transition-[width] duration-[1400ms] ease-out" style={{ width: `${width}%`, background: color }} />;
}

function SignalDashboard() {
    return (
        <div className="relative overflow-hidden rounded-[22px] border border-[var(--ca-hairline)] bg-[var(--ca-surface-card)] p-4 shadow-[0_30px_90px_rgba(38,37,30,.12)]">
            <div className="absolute -right-16 -top-20 h-52 w-52 rounded-full bg-[color-mix(in_srgb,var(--ca-primary)_18%,transparent)] blur-3xl" />
            <div className="relative flex items-center justify-between border-b border-[var(--ca-hairline)] pb-3">
                <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-[var(--ca-success)]" /><span className="ca-mono-label !text-[10px]">LIVE ARCHITECTURE SIGNAL</span></div>
                <span className="ca-mono-label !text-[10px] text-[var(--ca-muted)]">atlas://workspace</span>
            </div>
            <div className="relative mt-4 grid grid-cols-[1.2fr_.8fr] gap-3">
                <div className="min-h-[270px] rounded-xl border border-[var(--ca-hairline)] bg-[var(--ca-canvas-soft)] p-2">
                    <CanvasMock />
                </div>
                <div className="flex flex-col gap-3">
                    {["Languages", "API calls", "Risk score"].map((label, index) => (
                        <div key={label} className="landing-metric-card rounded-xl border border-[var(--ca-hairline)] bg-[var(--ca-canvas-soft)] p-3">
                            <span className="ca-mono-label !text-[9px]">{label}</span>
                            <strong className="mt-2 block text-2xl font-medium text-[var(--ca-ink)]"><CountUp value={index === 0 ? 8 : index === 1 ? 142 : 84} /></strong>
                            <span className="ca-mono-label !text-[9px] text-[var(--ca-success)]">{index === 2 ? "healthy" : "detected"}</span>
                        </div>
                    ))}
                </div>
            </div>
            <div className="relative mt-3 flex flex-wrap gap-2">
                {['TypeScript', 'Python', 'Dart', 'GraphQL', 'Postgres'].map((item) => <span key={item} className="ca-badge !h-6 !px-2.5 !text-[9px]">{item}</span>)}
            </div>
        </div>
    );
}

function WorkflowCards({ activeStep, setActiveStep }: { activeStep: number; setActiveStep: (step: number) => void }) {
    const [order, setOrder] = useState([1, 2, 3]);
    const [dragged, setDragged] = useState<number | null>(null);
    const cards = {
        1: { label: "Upload", title: "Drop your repo", text: "Upload a ZIP or connect a GitHub repository. We scan every file, function and symbol." },
        2: { label: "Analyze", title: "Build the graph", text: "We parse source, resolve imports and dependencies, and assemble the architecture map." },
        3: { label: "Explore", title: "Navigate the map", text: "Pan, zoom and trace flows visually. Select any node to inspect relationships and metrics." },
    } as const;
    const moveCard = (target: number) => {
        if (dragged === null || dragged === target) return;
        setOrder((current) => {
            const next = [...current];
            const from = next.indexOf(dragged);
            const to = next.indexOf(target);
            next.splice(from, 1);
            next.splice(to, 0, dragged);
            return next;
        });
    };
    return <>
        <div className="mx-auto grid max-w-[1160px] grid-cols-1 gap-4 md:grid-cols-3">
            {order.map((id, index) => {
                const card = cards[id as keyof typeof cards];
                return <article key={id} draggable onDragStart={() => setDragged(id)} onDragEnd={() => setDragged(null)} onDragOver={(event) => { event.preventDefault(); moveCard(id); }} onClick={() => setActiveStep(id)} className={`landing-workflow-card ca-card p-6 transition-colors duration-150 hover:border-[var(--ca-hairline-strong)] ${activeStep === id ? "landing-workflow-card-active" : ""} ${dragged === id ? "opacity-50" : ""}`}>
                    <div className="mb-5 flex items-center justify-between"><span className="ca-mono text-[11px] text-[var(--ca-muted)]">0{index + 1}</span><span className="ca-label">{card.label}</span></div>
                    <h3 className="ca-title mt-0 mb-2 text-[18px]">{card.title}</h3>
                    <p className="mt-0 mb-0 text-[14px] leading-[1.6] text-[var(--ca-body)]">{card.text}</p>
                    <span className="mt-5 block ca-mono-label !text-[9px] text-[var(--ca-muted-soft)]">DRAG TO REORDER</span>
                </article>;
            })}
        </div>
    </>;
}

function Landing({ onGetStarted, isAuthenticated = false }: LandingProps) {
    const { navigate } = useNavigation();
    const [activeStep, setActiveStep] = useState(1);
    useEffect(() => {
        const previousTheme = document.documentElement.dataset.theme;
        document.documentElement.dataset.theme = "light";
        return () => {
            document.documentElement.dataset.theme = previousTheme || "light";
        };
    }, []);
    const bookDemo = () => toastLoading("Opening demo scheduler…");
    const comingSoon = (label: string) => (event: { preventDefault: () => void }) => {
        event.preventDefault();
        toastLoading(`${label} is coming soon.`);
    };
    const joinNewsletter = (event: { preventDefault: () => void }) => {
        event.preventDefault();
        toastSuccess("Subscribed. Watch your inbox for architecture insights.");
    };
    const scrollTo = (id: string) => (event: { preventDefault: () => void }) => {
        event.preventDefault();
        document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
    };
    return (
        <div className="min-h-screen bg-[var(--ca-canvas)] text-[var(--ca-ink)] font-sans overflow-x-hidden">
            <Navbar onGetStarted={onGetStarted} />
            <section className="relative flex min-h-screen items-center overflow-hidden px-5 pb-20 pt-28">
                <img src="/codeatlas-architecture-bg.svg" alt="" aria-hidden="true" className="landing-background-art pointer-events-none absolute inset-0 h-full w-full object-cover" />
                <div className="pointer-events-none absolute -right-[280px] -top-[120px] h-[560px] w-[560px] rounded-full border border-[var(--ca-hairline)] max-[1000px]:hidden" />
                <div className="pointer-events-none absolute -right-[160px] top-[60px] h-[320px] w-[320px] rounded-full border border-[var(--ca-hairline-soft)] max-[1000px]:hidden" />
                <div className="relative z-10 mx-auto grid w-full max-w-[1180px] items-center gap-12 lg:grid-cols-[.9fr_1.1fr]">
                    <div>
                    <span className="ca-badge mb-8 inline-flex">Codebase intelligence · v2.4</span>
                    <h1 className="ca-display-lg mt-0 mb-7 text-[clamp(44px,6vw,76px)]">
                        See how your code
                        <br />
                        <span className="text-[var(--ca-primary)]">actually works.</span>
                    </h1>
                    <p className="mt-0 mb-9 max-w-[510px] text-[17px] leading-[1.65] text-[var(--ca-body)]">
                        Upload Flutter, Python, TypeScript, Go, Rust, Java, or almost any modern repository. CodeAtlas detects languages, API calls, dependencies, risks, and the connections between them.
                    </p>
                    <div className="flex flex-wrap items-center gap-3">
                        <button onClick={onGetStarted} className="ca-btn-primary">{isAuthenticated ? "Access Dashboard" : "Upload ZIP"}</button>
                        <button onClick={bookDemo} className="ca-btn-secondary">See the map</button>
                    </div>
                    <div className="mt-9 flex flex-wrap gap-x-6 gap-y-2 ca-mono-label !text-[10px]"><span>01 / detect</span><span>02 / connect</span><span>03 / understand</span></div>
                    </div>
                    <div className="relative lg:translate-y-6"><SignalDashboard /></div>
                </div>
            </section>

            <section className="border-y border-[var(--ca-hairline)] bg-[var(--ca-canvas-soft)] py-[80px] px-4">
                <div className="mx-auto mb-12 max-w-[1160px] flex items-center gap-4">
                    <span className="ca-label">From archive to architecture</span>
                    <span className="h-px flex-1 max-w-[240px] bg-[var(--ca-hairline)]" />
                </div>
                <WorkflowCards activeStep={activeStep} setActiveStep={setActiveStep} />
                <div className="mx-auto mt-6 flex max-w-[1160px] items-center gap-3">
                    <div className="h-1 flex-1 overflow-hidden rounded-full bg-[var(--ca-surface-strong)]"><div className="h-full rounded-full bg-[var(--ca-primary)] transition-all duration-500" style={{ width: `${activeStep * 33.333}%` }} /></div>
                    <span className="ca-mono-label !text-[10px]">STEP {activeStep} / 3</span>
                </div>
            </section>

            <section id="platform" className="relative overflow-hidden py-[80px] px-4">
                <img src="/codeatlas-architecture-bg.svg" alt="" aria-hidden="true" className="landing-background-art landing-background-art-platform pointer-events-none absolute inset-0 h-full w-full object-cover" />
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
                                    <div className="h-[3px] bg-[var(--ca-surface-strong)]"><AnimatedBar value={75} color="var(--ca-error)" /></div>
                            </div>
                            <div className="border border-[var(--ca-hairline)] bg-[var(--ca-canvas-soft)] p-4">
                                <div className="ca-mono-label mb-2 flex justify-between">
                                    <span>Test Coverage</span>
                                    <span className="text-[var(--ca-success)]">82%</span>
                                </div>
                                <div className="h-[3px] bg-[var(--ca-surface-strong)]"><AnimatedBar value={82} color="var(--ca-success)" /></div>
                            </div>
                            <div className="border border-[var(--ca-hairline)] bg-[var(--ca-canvas-soft)] p-4">
                                <div className="ca-mono-label mb-2 flex justify-between">
                                    <span>Cyclomatic Complexity</span>
                                    <span className="text-[#c08532]">Moderate</span>
                                </div>
                                <div className="h-[3px] bg-[var(--ca-surface-strong)]"><AnimatedBar value={48} color="#c08532" /></div>
                            </div>
                        </div>
                    </div>
                    <div className="col-span-12"><DemoWorkflow onTryIt={onGetStarted} /></div>
                </div>
            </section>

            <FaqAccordion />

            <section id="about" className="px-4 py-[90px]">
                <div className="mx-auto max-w-[1160px]">
                    <div className="mb-10 max-w-[620px]">
                        <span className="ca-label text-[var(--ca-primary)]">About the builders</span>
                        <h2 className="ca-display-md mt-3 mb-4 text-[clamp(30px,4vw,48px)]">Started by two builders who wanted code to explain itself.</h2>
                        <p className="m-0 text-[15px] leading-[1.7] text-[var(--ca-body)]">CodeAtlas began as a collaboration between Hemanth and Sai Kausthubh: two developers turning the hardest part of onboarding and architecture work into a visual, living map.</p>
                    </div>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        {[
                            { name: "Hemanth Atthuluri", handle: "hemanth174", bio: "Full Stack Developer and AI enthusiast building real-world products.", avatar: "https://avatars.githubusercontent.com/u/179906437?v=4" },
                            { name: "Lanka Rv Sai Kausthubh", handle: "lrv-sai-kausthubh", bio: "Developer, creator, and entrepreneur exploring web products and new ideas.", avatar: "https://avatars.githubusercontent.com/u/173589646?v=4" },
                        ].map((person) => (
                            <a key={person.handle} href={`https://github.com/${person.handle}`} target="_blank" rel="noreferrer" className="landing-person-card group flex items-center gap-5 rounded-2xl border border-[var(--ca-hairline)] bg-[var(--ca-surface-card)] p-5 no-underline">
                                <img src={person.avatar} alt={person.name} className="h-16 w-16 rounded-full border-2 border-[var(--ca-hairline)] object-cover transition-transform duration-300 group-hover:scale-105" />
                                <div className="min-w-0"><h3 className="ca-title m-0 text-[17px] text-[var(--ca-ink)]">{person.name}</h3><p className="ca-mono-label mt-1 mb-2 !text-[10px] text-[var(--ca-primary)]">@{person.handle}</p><p className="m-0 text-[13px] leading-[1.5] text-[var(--ca-body)]">{person.bio}</p></div>
                            </a>
                        ))}
                    </div>
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
                            <li><a href="#platform" onClick={scrollTo("platform")} className="text-[13px] text-[var(--ca-body)] no-underline transition-colors hover:text-[var(--ca-ink)]">Features</a></li>
                            <li><a href="#faq" onClick={scrollTo("faq")} className="text-[13px] text-[var(--ca-body)] no-underline transition-colors hover:text-[var(--ca-ink)]">Pricing</a></li>
                            <li><a href="#platform" onClick={scrollTo("platform")} className="text-[13px] text-[var(--ca-body)] no-underline transition-colors hover:text-[var(--ca-ink)]">API Docs</a></li>
                            <li><a href="#faq" onClick={scrollTo("faq")} className="text-[13px] text-[var(--ca-body)] no-underline transition-colors hover:text-[var(--ca-ink)]">Security</a></li>
                        </ul>
                    </div>
                    <div>
                        <h5 className="ca-label mt-0 mb-6">Company</h5>
                        <ul className="mt-0 mb-0 flex list-none flex-col gap-3 p-0">
                            <li><a href="#about" onClick={scrollTo("about")} className="text-[13px] text-[var(--ca-body)] no-underline transition-colors hover:text-[var(--ca-ink)]">About</a></li>
                            <li><a href="#" onClick={comingSoon("Blog")} className="text-[13px] text-[var(--ca-body)] no-underline transition-colors hover:text-[var(--ca-ink)]">Blog</a></li>
                            <li><a href="#" onClick={comingSoon("Careers")} className="text-[13px] text-[var(--ca-body)] no-underline transition-colors hover:text-[var(--ca-ink)]">Careers</a></li>
                            <li><a href="mailto:codeatlas.team@gmail.com" className="text-[13px] text-[var(--ca-body)] no-underline transition-colors hover:text-[var(--ca-ink)]">Contact</a></li>
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
                        <a href="/privacy" onClick={(event) => { event.preventDefault(); navigate("privacy"); }} className="text-[var(--ca-muted)] no-underline transition-colors hover:text-[var(--ca-ink)]">Privacy Policy</a>
                        <a href="/terms" onClick={(event) => { event.preventDefault(); navigate("terms"); }} className="text-[var(--ca-muted)] no-underline transition-colors hover:text-[var(--ca-ink)]">Terms of Service</a>
                    </div>
                </div>
            </footer>
        </div>
    );
}

export default Landing;
