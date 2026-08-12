import { useState } from "react";
import { Minus, Plus } from "lucide-react";

const items = [
  [
    "Which languages can CodeAtlas detect?",
    "CodeAtlas detects TypeScript, JavaScript, Python, Dart and Flutter, Java, Kotlin, Swift, Go, Rust, Ruby, PHP, C, C++, C#, SQL, Shell, Vue, Svelte, YAML, XML, and more as the analyzer grows.",
  ],
  [
    "Can I analyze a Flutter project?",
    "Yes. Upload a Flutter repository as a ZIP or import it from GitHub. Dart files, package imports, API calls, and the surrounding project structure are included in the map.",
  ],
  [
    "What does API-call detection show?",
    "The analyzer identifies common REST and service integrations such as fetch, Axios, requests, httpx, Dio, GraphQL, gRPC, Firebase, and Supabase, then shows the provider and source file.",
  ],
  [
    "Is my source code public?",
    "No. Projects are private by default. Access is controlled by repository policies, grants, teams, and organization membership. You can delete a project and its stored analysis from the workspace.",
  ],
  [
    "How does GitHub import work?",
    "Connect GitHub through OAuth or provide a repository URL. CodeAtlas downloads the repository archive, analyzes it, and creates a permission-aware architecture graph.",
  ],
  [
    "Can I pause or delete an analysis?",
    "The landing demo can be paused and restarted. Authenticated repository analysis supports progress tracking and cancellation from the project workflow.",
  ],
];

export default function FaqAccordion() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section
      id="faq"
      className="border-y border-[var(--ca-hairline)] bg-[var(--ca-canvas-soft)] px-4 py-[90px]"
    >
      <div className="mx-auto grid max-w-[1160px] gap-14 lg:grid-cols-[.75fr_1.25fr]">
        <div>
          <span className="ca-label text-[var(--ca-primary)]">
            Questions, answered
          </span>
          <h2 className="ca-display-md mt-3 mb-4 text-[clamp(30px,4vw,48px)]">
            Everything you need to know.
          </h2>
          <p className="m-0 max-w-[360px] text-[15px] leading-[1.7] text-[var(--ca-body)]">
            A practical architecture map for teams that want clarity without
            giving up control of their code.
          </p>
        </div>
        <div className="divide-y divide-[var(--ca-hairline)] border-y border-[var(--ca-hairline)]">
          {items.map(([question, answer], index) => {
            const expanded = open === index;
            return (
              <div key={question}>
                <button
                  className="flex w-full items-center justify-between gap-6 py-5 text-left"
                  aria-expanded={expanded}
                  onClick={() => setOpen(expanded ? null : index)}
                >
                  <span className="text-[15px] font-medium text-[var(--ca-ink)]">
                    {question}
                  </span>
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-[var(--ca-hairline-strong)] text-[var(--ca-primary)]">
                    {expanded ? <Minus size={14} /> : <Plus size={14} />}
                  </span>
                </button>
                {expanded && (
                  <p className="max-w-[620px] pb-5 pr-12 text-[14px] leading-[1.7] text-[var(--ca-body)]">
                    {answer}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
