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
        <div className="ca-landing">
            <Navbar onGetStarted={onGetStarted} />

            <section className="ca-hero">
                <div className="ca-grid-bg" />
                <div className="ca-hero-content">
                    <span className="ca-hero-badge ca-label">V2.4.0 Now Stable</span>
                    <h1 className="ca-display ca-hero-title">Map Your Architecture, <span>Not Just Your Files.</span></h1>
                    <p className="ca-hero-sub">The first AI-native semantic engine that visualizes your codebase&apos;s hidden logic. Traverse dependencies, debug flows, and refactor with surgical precision.</p>
                    <div className="ca-hero-actions">
                        <button className="ca-btn-solid" onClick={onGetStarted}>Get Started for Free</button>
                        <button className="ca-btn-outline">Book a Demo</button>
                    </div>
                </div>
            </section>

            <section className="ca-features-section">
                <div className="ca-features-grid">
                    <article className="ca-feature">
                        <div className="ca-feature-head">
                            <span className="ca-feature-icon" style={{ color: "#10B981", borderColor: "rgba(16,185,129,.3)", background: "rgba(16,185,129,.08)" }}>⌘</span>
                            <span className="ca-feature-tag ca-label">Tree-Sitter Powered</span>
                        </div>
                        <h3>Semantic Analysis</h3>
                        <p>We don&apos;t just index strings. We parse your code into high-fidelity ASTs across 20+ languages to understand true logic flow and class hierarchies.</p>
                    </article>
                    <article className="ca-feature">
                        <div className="ca-feature-head">
                            <span className="ca-feature-icon" style={{ color: "#8B5CF6", borderColor: "rgba(139,92,246,.3)", background: "rgba(139,92,246,.08)" }}>◎</span>
                            <span className="ca-feature-tag ca-label">Neo4j Integration</span>
                        </div>
                        <h3>Knowledge Graph</h3>
                        <p>Every function, variable, and API endpoint becomes a node in a persistent graph. Query your architecture using a visual interface or direct Cypher logic.</p>
                    </article>
                    <article className="ca-feature">
                        <div className="ca-feature-head">
                            <span className="ca-feature-icon" style={{ color: "#007AFF", borderColor: "rgba(0,122,255,.3)", background: "rgba(0,122,255,.08)" }}>✦</span>
                            <span className="ca-feature-tag ca-label">LLM Resident</span>
                        </div>
                        <h3>AI Architect</h3>
                        <p>An AI that actually knows your codebase. Ask &ldquo;Where should I implement the new payment hook?&rdquo; and watch it draw the path in real-time.</p>
                    </article>
                </div>
            </section>

            <section className="ca-showcase-section">
                <div className="ca-section-heading">The Platform Ecosystem</div>
                <div className="ca-bento">
                    <div className="ca-bento-card ca-bento-canvas">
                        <div className="ca-bento-title">
                            <h4>Interactive Canvas</h4>
                            <p>Level 0: Macro Structure</p>
                        </div>
                        <div className="ca-canvas-mock"><CanvasMock /></div>
                        <div style={{ position: "absolute", bottom: 24, right: 24, display: "flex", gap: 8, background: "rgba(255,255,255,.04)", border: "1px solid #30363d", backdropFilter: "blur(12px)", padding: 12 }}>
                            <span style={{ width: 12, height: 12, borderRadius: "50%", background: "#EF4444" }} />
                            <span style={{ width: 12, height: 12, borderRadius: "50%", background: "#FACC15" }} />
                            <span style={{ width: 12, height: 12, borderRadius: "50%", background: "#10B981" }} />
                        </div>
                    </div>
                    <div className="ca-bento-card ca-bento-dash">
                        <div className="ca-bento-title">
                            <h4>Architecture Dashboard</h4>
                            <p>Health &amp; Metrics</p>
                        </div>
                        <div className="ca-dash-stack">
                            <div className="ca-dash-metric">
                                <div className="ca-metric-label"><span>Cyclomatic Complexity</span><span style={{ color: "#EF4444" }}>High</span></div>
                                <div className="ca-metric-bar"><i style={{ width: "75%", background: "#EF4444" }} /></div>
                            </div>
                            <div className="ca-dash-metric">
                                <div className="ca-metric-label"><span>Test Coverage</span><span style={{ color: "#10B981" }}>82%</span></div>
                                <div className="ca-metric-bar"><i style={{ width: "82%", background: "#10B981" }} /></div>
                            </div>
                            <div className="ca-dash-metric">
                                <div className="ca-metric-label"><span>Coupling</span><span style={{ color: "#FACC15" }}>Moderate</span></div>
                                <div className="ca-metric-bar"><i style={{ width: "48%", background: "#FACC15" }} /></div>
                            </div>
                        </div>
                    </div>
                    <div className="ca-bento-card ca-bento-walk">
                        <div className="ca-walk-grid">
                            <div className="ca-walk-copy">
                                <h4>AI Walkthrough</h4>
                                <p>Let the AI guide you through unfamiliar codebases. &ldquo;Explain the authentication flow&rdquo; triggers a step-by-step visual tour of every participating module.</p>
                                <div className="ca-chip-row">
                                    <span className="ca-chip">Natural Language Query</span>
                                    <span className="ca-chip ca-chip-muted">Path Highlighting</span>
                                </div>
                            </div>
                            <div className="ca-walk-visual">
                                <div className="ca-grid-bg" style={{ opacity: .3 }} />
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            <section className="ca-testimonials-section">
                <div className="ca-testimonials">
                    <figure className="ca-quote">
                        <blockquote>&ldquo;Code Atlas completely changed how we onboard new senior devs. What used to take weeks of &lsquo;reading the code&rsquo; now takes 48 hours with a visual architect session.&rdquo;</blockquote>
                        <figcaption className="ca-quote-author">
                            <span className="ca-avatar">MC</span>
                            <div><strong>Marcus Chen</strong><small>Staff Engineer, FinTech OS</small></div>
                        </figcaption>
                    </figure>
                    <figure className="ca-quote featured">
                        <blockquote>&ldquo;Visualizing dependencies in our monolith was a pipe dream until we plugged in Code Atlas. The Neo4j backend is incredibly fast even at our scale.&rdquo;</blockquote>
                        <figcaption className="ca-quote-author">
                            <span className="ca-avatar">SJ</span>
                            <div><strong>Sarah J. Miller</strong><small>CTO, CloudScale</small></div>
                        </figcaption>
                    </figure>
                    <figure className="ca-quote">
                        <blockquote>&ldquo;The AI Architect doesn&apos;t just guess — it&apos;s grounded in the actual graph. It&apos;s the first LLM implementation that actually understands my system constraints.&rdquo;</blockquote>
                        <figcaption className="ca-quote-author">
                            <span className="ca-avatar">DV</span>
                            <div><strong>David Vance</strong><small>Senior Lead, GameStream</small></div>
                        </figcaption>
                    </figure>
                </div>
            </section>

            <footer className="ca-footer">
                <div className="ca-footer-grid">
                    <div className="ca-footer-brand">
                        <span className="ca-brand-mark">✦</span>
                        <p>Building the future of software comprehension. Understand anything, build everything.</p>
                    </div>
                    <div className="ca-footer-col">
                        <h5>Product</h5>
                        <ul>
                            <li><a href="#">Features</a></li>
                            <li><a href="#">Pricing</a></li>
                            <li><a href="#">API Docs</a></li>
                            <li><a href="#">Security</a></li>
                        </ul>
                    </div>
                    <div className="ca-footer-col">
                        <h5>Company</h5>
                        <ul>
                            <li><a href="#">About</a></li>
                            <li><a href="#">Blog</a></li>
                            <li><a href="#">Careers</a></li>
                            <li><a href="#">Contact</a></li>
                        </ul>
                    </div>
                    <div className="ca-footer-col">
                        <h5>Stay in the Flow</h5>
                        <p style={{ color: "#c1c6d7", fontSize: 12, margin: 0 }}>Get architecture tips and platform updates.</p>
                        <form className="ca-newsletter-form" onSubmit={(event) => event.preventDefault()}>
                            <input type="email" placeholder="email@company.com" />
                            <button type="submit">Join</button>
                        </form>
                    </div>
                </div>
                <div className="ca-footer-bottom">
                    <span>© 2026 CODE ATLAS TECHNOLOGIES INC. ALL RIGHTS RESERVED.</span>
                    <div style={{ display: "flex", gap: 24 }}>
                        <a href="#">Privacy Policy</a>
                        <a href="#">Terms of Service</a>
                    </div>
                </div>
            </footer>
        </div>
    );
}

export default Landing;
