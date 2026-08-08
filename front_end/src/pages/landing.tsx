import Navbar from "../components/navbar";

type LandingProps = {
    onGetStarted: () => void;
};

function CanvasMock() {
    return (
        <svg viewBox="0 0 800 500" xmlns="http://www.w3.org/2000/svg">
            <g fill="none" stroke="#007AFF" strokeWidth="1.2" opacity="0.85">
                <path d="M210 150 C 300 90, 400 90, 470 120" />
                <path d="M210 150 C 280 250, 380 260, 470 220" />
                <path d="M470 120 C 560 80, 620 130, 640 200" stroke="#10B981" />
                <path d="M470 220 C 560 240, 600 300, 640 330" stroke="#8B5CF6" />
                <path d="M640 200 C 700 220, 680 300, 640 330" stroke="#30363D" />
                <path d="M210 150 L 640 330" stroke="#30363D" strokeDasharray="4 5" />
            </g>
            <g>
                <circle cx="210" cy="150" r="42" fill="#10141a" stroke="#007AFF" strokeWidth="1.4" />
                <text x="210" y="140" textAnchor="middle" fill="#007AFF" fontSize="13" fontFamily="JetBrains Mono, monospace">UI</text>
                <text x="210" y="158" textAnchor="middle" fill="#c1c6d7" fontSize="10" fontFamily="JetBrains Mono, monospace">SHELL</text>
                <circle cx="470" cy="120" r="42" fill="#10141a" stroke="#10B981" strokeWidth="1.4" />
                <text x="470" y="110" textAnchor="middle" fill="#10B981" fontSize="12" fontFamily="JetBrains Mono, monospace">API</text>
                <text x="470" y="126" textAnchor="middle" fill="#c1c6d7" fontSize="10" fontFamily="JetBrains Mono, monospace">ROUTER</text>
                <circle cx="470" cy="220" r="42" fill="#10141a" stroke="#8B5CF6" strokeWidth="1.4" />
                <text x="470" y="210" textAnchor="middle" fill="#8B5CF6" fontSize="13" fontFamily="JetBrains Mono, monospace">DB</text>
                <text x="470" y="226" textAnchor="middle" fill="#c1c6d7" fontSize="10" fontFamily="JetBrains Mono, monospace">STORE</text>
                <circle cx="640" cy="200" r="42" fill="#10141a" stroke="#F97316" strokeWidth="1.4" />
                <text x="640" y="190" textAnchor="middle" fill="#F97316" fontSize="13" fontFamily="JetBrains Mono, monospace">AUTH</text>
                <text x="640" y="206" textAnchor="middle" fill="#c1c6d7" fontSize="10" fontFamily="JetBrains Mono, monospace">SVC</text>
                <circle cx="640" cy="330" r="42" fill="#10141a" stroke="#FACC15" strokeWidth="1.4" />
                <text x="640" y="320" textAnchor="middle" fill="#FACC15" fontSize="13" fontFamily="JetBrains Mono, monospace">EVT</text>
                <text x="640" y="336" textAnchor="middle" fill="#c1c6d7" fontSize="10" fontFamily="JetBrains Mono, monospace">BUS</text>
            </g>
        </svg>
    );
}

function Landing({ onGetStarted }: LandingProps) {
    return (
        <div className="min-h-screen bg-[#080a0d] text-[#dfe2eb] font-inter overflow-x-hidden">
            <Navbar onGetStarted={onGetStarted} />

            <section className="relative min-h-screen flex items-center justify-center pt-14 overflow-hidden">
                <div className="absolute inset-0 bg-[radial-gradient(rgba(48,54,61,.5)_1px,transparent_1px)] bg-[size:24px_24px] opacity-20" />
                <div className="relative z-10 max-w-[880px] text-center px-5">
                    <span className="inline-block border border-[rgba(0,122,255,.3)] bg-[rgba(0,122,255,.05)] text-[#007aff] px-3 py-[5px] mb-6 font-jet tracking-[.05em] uppercase text-[10px]">V2.4.0 Now Stable</span>
                    <h1 className="font-space text-[clamp(40px,7vw,64px)] leading-[1.05] tracking-[-.02em] font-bold mt-0 mb-6">Map Your Architecture, <span className="text-[#007aff]">Not Just Your Files.</span></h1>
                    <p className="text-[#c1c6d7] text-[15px] leading-[1.6] max-w-[620px] mx-auto mt-0 mb-10">The first AI-native semantic engine that visualizes your codebase&apos;s hidden logic. Traverse dependencies, debug flows, and refactor with surgical precision.</p>
                    <div className="flex gap-4 justify-center flex-wrap">
                        <button className="px-8 py-4 font-space text-base font-semibold border border-[#007aff] bg-[#007aff] text-white cursor-pointer shadow-[4px_4px_0_0_#00285c] transition-[filter,box-shadow,transform] duration-150 hover:brightness-110 active:shadow-none active:translate-x-1 active:translate-y-1" onClick={onGetStarted}>Get Started for Free</button>
                        <button className="px-8 py-4 font-space text-base font-semibold border border-[#30363d] bg-transparent text-[#dfe2eb] cursor-pointer backdrop-blur-[6px] transition-colors duration-150 hover:bg-[#262a31]">Book a Demo</button>
                    </div>
                </div>
            </section>

            <section className="py-24 px-4 bg-[#10141a] border-y border-[#30363d]">
                <div className="max-w-[1160px] mx-auto grid grid-cols-1 md:grid-cols-3 border border-[#30363d] max-[900px]:grid-cols-1">
                    <article className="p-10 border-r border-[#30363d] transition-colors duration-150 hover:bg-[#181c22] max-[900px]:border-r-0 max-[900px]:border-b max-[900px]:border-[#30363d] max-[900px]:last:border-b-0">
                        <div className="flex items-center justify-between mb-6">
                            <span className="w-12 h-12 grid place-items-center text-2xl border" style={{ color: "#10B981", borderColor: "rgba(16,185,129,.3)", background: "rgba(16,185,129,.08)" }}>⌘</span>
                            <span className="text-[10px] text-[#c1c6d7] font-jet tracking-[.05em] uppercase">Tree-Sitter Powered</span>
                        </div>
                        <h3 className="font-space text-2xl font-semibold mt-0 mb-4">Semantic Analysis</h3>
                        <p className="text-[#c1c6d7] text-sm leading-[1.6] mt-0 mb-0">We don&apos;t just index strings. We parse your code into high-fidelity ASTs across 20+ languages to understand true logic flow and class hierarchies.</p>
                    </article>
                    <article className="p-10 border-r border-[#30363d] transition-colors duration-150 hover:bg-[#181c22] max-[900px]:border-r-0 max-[900px]:border-b max-[900px]:border-[#30363d] max-[900px]:last:border-b-0">
                        <div className="flex items-center justify-between mb-6">
                            <span className="w-12 h-12 grid place-items-center text-2xl border" style={{ color: "#8B5CF6", borderColor: "rgba(139,92,246,.3)", background: "rgba(139,92,246,.08)" }}>◎</span>
                            <span className="text-[10px] text-[#c1c6d7] font-jet tracking-[.05em] uppercase">Neo4j Integration</span>
                        </div>
                        <h3 className="font-space text-2xl font-semibold mt-0 mb-4">Knowledge Graph</h3>
                        <p className="text-[#c1c6d7] text-sm leading-[1.6] mt-0 mb-0">Every function, variable, and API endpoint becomes a node in a persistent graph. Query your architecture using a visual interface or direct Cypher logic.</p>
                    </article>
                    <article className="p-10 transition-colors duration-150 hover:bg-[#181c22]">
                        <div className="flex items-center justify-between mb-6">
                            <span className="w-12 h-12 grid place-items-center text-2xl border" style={{ color: "#007AFF", borderColor: "rgba(0,122,255,.3)", background: "rgba(0,122,255,.08)" }}>✦</span>
                            <span className="text-[10px] text-[#c1c6d7] font-jet tracking-[.05em] uppercase">LLM Resident</span>
                        </div>
                        <h3 className="font-space text-2xl font-semibold mt-0 mb-4">AI Architect</h3>
                        <p className="text-[#c1c6d7] text-sm leading-[1.6] mt-0 mb-0">An AI that actually knows your codebase. Ask &ldquo;Where should I implement the new payment hook?&rdquo; and watch it draw the path in real-time.</p>
                    </article>
                </div>
            </section>

            <section className="py-24 px-4">
                <div className="max-w-[1160px] mx-auto mb-12 flex items-center gap-4 font-space text-2xl font-semibold before:w-12 before:h-px before:bg-[#007aff]">The Platform Ecosystem</div>
                <div className="max-w-[1160px] mx-auto grid grid-cols-12 gap-6">
                    <div className="relative overflow-hidden border border-[#30363d] bg-[#181c22] col-span-12 md:col-span-8 h-[500px] max-[900px]:col-span-12">
                        <div className="absolute top-6 left-6 z-3">
                            <h4 className="font-space text-lg mt-0 mb-1">Interactive Canvas</h4>
                            <p className="text-[10px] text-[#c1c6d7] uppercase tracking-[.05em] mt-0 mb-0">Level 0: Macro Structure</p>
                        </div>
                        <div className="absolute inset-0 opacity-90 [&_svg]:w-full [&_svg]:h-full"><CanvasMock /></div>
                        <div style={{ position: "absolute", bottom: 24, right: 24, display: "flex", gap: 8, background: "rgba(255,255,255,.04)", border: "1px solid #30363d", backdropFilter: "blur(12px)", padding: 12 }}>
                            <span style={{ width: 12, height: 12, borderRadius: "50%", background: "#EF4444" }} />
                            <span style={{ width: 12, height: 12, borderRadius: "50%", background: "#FACC15" }} />
                            <span style={{ width: 12, height: 12, borderRadius: "50%", background: "#10B981" }} />
                        </div>
                    </div>
                    <div className="relative overflow-hidden border border-[#30363d] bg-[#262a31] col-span-12 md:col-span-4 h-[500px] max-[900px]:col-span-12">
                        <div className="absolute top-6 left-6 z-3">
                            <h4 className="font-space text-lg mt-0 mb-1">Architecture Dashboard</h4>
                            <p className="text-[10px] text-[#c1c6d7] uppercase tracking-[.05em] mt-0 mb-0">Health &amp; Metrics</p>
                        </div>
                        <div className="absolute inset-0 p-[88px_24px_24px] flex flex-col gap-4">
                            <div className="bg-[#10141a] border border-[#30363d] p-4">
                                <div className="flex justify-between mb-2 text-[10px] text-[#c1c6d7] uppercase tracking-[.05em]"><span>Cyclomatic Complexity</span><span style={{ color: "#EF4444" }}>High</span></div>
                                <div className="h-2 bg-[#31353c]"><i className="block h-full" style={{ width: "75%", background: "#EF4444" }} /></div>
                            </div>
                            <div className="bg-[#10141a] border border-[#30363d] p-4">
                                <div className="flex justify-between mb-2 text-[10px] text-[#c1c6d7] uppercase tracking-[.05em]"><span>Test Coverage</span><span style={{ color: "#10B981" }}>82%</span></div>
                                <div className="h-2 bg-[#31353c]"><i className="block h-full" style={{ width: "82%", background: "#10B981" }} /></div>
                            </div>
                            <div className="bg-[#10141a] border border-[#30363d] p-4">
                                <div className="flex justify-between mb-2 text-[10px] text-[#c1c6d7] uppercase tracking-[.05em]"><span>Coupling</span><span style={{ color: "#FACC15" }}>Moderate</span></div>
                                <div className="h-2 bg-[#31353c]"><i className="block h-full" style={{ width: "48%", background: "#FACC15" }} /></div>
                            </div>
                        </div>
                    </div>
                    <div className="relative overflow-hidden border border-[#30363d] bg-[#0a0e14] col-span-12 h-[320px]">
                        <div className="absolute inset-0 grid grid-cols-2">
                            <div className="p-10 flex flex-col justify-center border-r border-[#30363d]">
                                <h4 className="font-space text-lg mt-0 mb-4">AI Walkthrough</h4>
                                <p className="text-[#c1c6d7] text-sm leading-[1.6] max-w-[460px] mt-0 mb-6">Let the AI guide you through unfamiliar codebases. &ldquo;Explain the authentication flow&rdquo; triggers a step-by-step visual tour of every participating module.</p>
                                <div className="flex gap-3 flex-wrap">
                                    <span className="border border-[#007aff] text-[#007aff] px-3 py-1 text-[10px] tracking-[.05em] uppercase">Natural Language Query</span>
                                    <span className="border border-[#30363d] text-[#c1c6d7] px-3 py-1 text-[10px] tracking-[.05em] uppercase">Path Highlighting</span>
                                </div>
                            </div>
                            <div className="relative bg-[rgba(0,0,0,.4)] overflow-hidden">
                                <div className="absolute inset-0 bg-[radial-gradient(rgba(48,54,61,.5)_1px,transparent_1px)] bg-[size:24px_24px] opacity-30" />
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            <section className="py-24 px-4 bg-[#10141a] border-y border-[#30363d]">
                <div className="max-w-[1160px] mx-auto grid grid-cols-1 md:grid-cols-3 gap-8 max-[900px]:grid-cols-1">
                    <figure className="flex flex-col justify-between p-8 border border-[#30363d] bg-[#080a0d]">
                        <blockquote className="italic text-[#dfe2eb] text-sm leading-[1.7] mt-0 mb-8">&ldquo;Code Atlas completely changed how we onboard new senior devs. What used to take weeks of &lsquo;reading the code&rsquo; now takes 48 hours with a visual architect session.&rdquo;</blockquote>
                        <figcaption className="flex items-center gap-4">
                            <span className="w-12 h-12 bg-[#31353c] border border-[#30363d] grid place-items-center font-jet text-sm text-[#007aff]">MC</span>
                            <div><strong className="block font-jet text-[10px] tracking-[.05em] uppercase">Marcus Chen</strong><small className="text-[#c1c6d7] text-[10px]">Staff Engineer, FinTech OS</small></div>
                        </figcaption>
                    </figure>
                    <figure className="flex flex-col justify-between p-8 border border-[#30363d] bg-[#080a0d] border-t-4 border-t-[#007aff]">
                        <blockquote className="italic text-[#dfe2eb] text-sm leading-[1.7] mt-0 mb-8">&ldquo;Visualizing dependencies in our monolith was a pipe dream until we plugged in Code Atlas. The Neo4j backend is incredibly fast even at our scale.&rdquo;</blockquote>
                        <figcaption className="flex items-center gap-4">
                            <span className="w-12 h-12 bg-[#31353c] border border-[#30363d] grid place-items-center font-jet text-sm text-[#007aff]">SJ</span>
                            <div><strong className="block font-jet text-[10px] tracking-[.05em] uppercase">Sarah J. Miller</strong><small className="text-[#c1c6d7] text-[10px]">CTO, CloudScale</small></div>
                        </figcaption>
                    </figure>
                    <figure className="flex flex-col justify-between p-8 border border-[#30363d] bg-[#080a0d]">
                        <blockquote className="italic text-[#dfe2eb] text-sm leading-[1.7] mt-0 mb-8">&ldquo;The AI Architect doesn&apos;t just guess — it&apos;s grounded in the actual graph. It&apos;s the first LLM implementation that actually understands my system constraints.&rdquo;</blockquote>
                        <figcaption className="flex items-center gap-4">
                            <span className="w-12 h-12 bg-[#31353c] border border-[#30363d] grid place-items-center font-jet text-sm text-[#007aff]">DV</span>
                            <div><strong className="block font-jet text-[10px] tracking-[.05em] uppercase">David Vance</strong><small className="text-[#c1c6d7] text-[10px]">Senior Lead, GameStream</small></div>
                        </figcaption>
                    </figure>
                </div>
            </section>

            <footer className="bg-[#080a0d] border-t border-[#30363d] px-4 pb-12 pt-24">
                <div className="max-w-[1160px] mx-auto grid grid-cols-[4fr_2fr_2fr_4fr] gap-12 pb-20 max-[900px]:grid-cols-2 max-[900px]:gap-8">
                    <div>
                        <span className="inline-grid w-7 h-7 bg-[#007aff] text-white place-items-center text-[15px]">✦</span>
                        <p className="text-[#c1c6d7] text-sm leading-[1.6] max-w-[320px] mt-4 mb-6">Building the future of software comprehension. Understand anything, build everything.</p>
                    </div>
                    <div>
                        <h5 className="font-jet text-[10px] tracking-[.05em] uppercase text-[#dfe2eb] mt-0 mb-6">Product</h5>                        <ul className="list-none mt-0 mb-0 p-0 flex flex-col gap-4">
                            <li><a href="#" className="text-[#c1c6d7] text-xs no-underline transition-colors duration-150 hover:text-[#007aff]">Features</a></li>
                            <li><a href="#" className="text-[#c1c6d7] text-xs no-underline transition-colors duration-150 hover:text-[#007aff]">Pricing</a></li>
                            <li><a href="#" className="text-[#c1c6d7] text-xs no-underline transition-colors duration-150 hover:text-[#007aff]">API Docs</a></li>
                            <li><a href="#" className="text-[#c1c6d7] text-xs no-underline transition-colors duration-150 hover:text-[#007aff]">Security</a></li>
                        </ul>
                    </div>
                    <div>
                        <h5 className="font-jet text-[10px] tracking-[.05em] uppercase text-[#dfe2eb] mt-0 mb-6">Company</h5>
                        <ul className="list-none mt-0 mb-0 p-0 flex flex-col gap-4">
                            <li><a href="#" className="text-[#c1c6d7] text-xs no-underline transition-colors duration-150 hover:text-[#007aff]">About</a></li>
                            <li><a href="#" className="text-[#c1c6d7] text-xs no-underline transition-colors duration-150 hover:text-[#007aff]">Blog</a></li>
                            <li><a href="#" className="text-[#c1c6d7] text-xs no-underline transition-colors duration-150 hover:text-[#007aff]">Careers</a></li>
                            <li><a href="#" className="text-[#c1c6d7] text-xs no-underline transition-colors duration-150 hover:text-[#007aff]">Contact</a></li>
                        </ul>
                    </div>
                    <div>
                        <h5 className="font-jet text-[10px] tracking-[.05em] uppercase text-[#dfe2eb] mt-0 mb-6">Stay in the Flow</h5>
                        <p style={{ color: "#c1c6d7", fontSize: 12, margin: 0 }}>Get architecture tips and platform updates.</p>
                        <form className="flex border border-[#30363d] bg-[#10141a] p-1 mt-6" onSubmit={(event) => event.preventDefault()}>
                            <input type="email" placeholder="email@company.com" className="flex-1 bg-transparent border-0 outline-none text-[#dfe2eb] px-3 py-2 font-inter text-xs" />
                            <button type="submit" className="bg-[#007aff] text-white border-0 px-5 py-2 font-jet text-[10px] tracking-[.05em] uppercase cursor-pointer">Join</button>
                        </form>
                    </div>
                </div>
                <div className="max-w-[1160px] mx-auto flex flex-wrap gap-6 justify-between items-center pt-8 border-t border-[rgba(48,54,61,.5)] text-[10px] text-[#c1c6d7]">
                    <span>© 2026 CODE ATLAS TECHNOLOGIES INC. ALL RIGHTS RESERVED.</span>
                    <div style={{ display: "flex", gap: 24 }}>
                        <a href="#" className="text-[#c1c6d7] no-underline transition-colors duration-150 hover:text-[#dfe2eb]">Privacy Policy</a>
                        <a href="#" className="text-[#c1c6d7] no-underline transition-colors duration-150 hover:text-[#dfe2eb]">Terms of Service</a>
                    </div>
                </div>
            </footer>
        </div>
    );
}

export default Landing;
