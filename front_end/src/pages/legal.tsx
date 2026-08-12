import { useState } from "react";
import { ChevronDown } from "lucide-react";
import BackButton from "../components/back-button";

const content = {
  privacy: {
    eyebrow: "Privacy policy",
    title: "Your code stays under your control.",
    intro: "This overview explains how CodeAtlas handles account, repository, and usage information while you explore your architecture.",
    sections: [
      ["Information we collect", "We collect account details, authentication records, project metadata, uploaded archives, analysis results, access policies, and audit events needed to provide CodeAtlas."],
      ["How we use repository data", "Repository data is processed to build dependency maps, language summaries, API-call findings, security findings, and interactive workspace views. We do not sell source code or use private source to advertise to you."],
      ["GitHub and third parties", "When you connect GitHub, CodeAtlas uses the permissions granted in OAuth to access repositories and collaborators. GitHub access can be disconnected and revoked from your account."],
      ["Storage and retention", "Projects remain available until you delete them or an applicable retention policy removes them. Deleting a project removes its graph, extracted files, secrets findings, and access policies while security audit records may be retained for accountability."],
      ["Your choices", "You can update your profile, change your password, disconnect integrations, request access changes, and delete projects. Contact the builders for privacy questions or deletion requests."],
    ],
  },
  terms: {
    eyebrow: "Terms of service",
    title: "A clear agreement for clearer software.",
    intro: "These terms describe the responsible use of CodeAtlas and the boundaries around repositories, accounts, and analysis results.",
    sections: [
      ["Using CodeAtlas", "You may use CodeAtlas to analyze repositories you own or are authorized to access. Do not upload code, credentials, or personal data that you do not have permission to process."],
      ["Accounts and security", "Keep your credentials private, use a strong password, and notify the team if you believe your account or connected GitHub identity has been compromised."],
      ["Analysis limitations", "Architecture, security, and API findings are assistive signals, not a guarantee that a repository is safe, complete, or production-ready. Review findings with qualified engineers."],
      ["Acceptable use", "Do not abuse uploads, attempt to bypass access policies, enumerate restricted projects, interfere with other users, or use CodeAtlas to distribute malicious content."],
      ["Changes and contact", "The product and these terms may evolve as CodeAtlas moves from an early collaboration project toward a broader service. Questions can be sent to the builders through their GitHub profiles."],
    ],
  },
};

export default function LegalPage({ kind, onBack }: { kind: "privacy" | "terms"; onBack: () => void }) {
  const page = content[kind];
  const [open, setOpen] = useState(0);
  return <main className="min-h-screen bg-[var(--ca-canvas)] px-5 py-8 text-[var(--ca-ink)]"><div className="mx-auto max-w-[1100px]"><BackButton variant="ghost" onClick={onBack} label="BACK" /><div className="mt-16 grid gap-16 lg:grid-cols-[.75fr_1.25fr]"><header className="lg:sticky lg:top-10 lg:self-start"><span className="ca-label text-[var(--ca-primary)]">{page.eyebrow}</span><h1 className="ca-display-lg mt-4 mb-5 text-[clamp(38px,5vw,64px)]">{page.title}</h1><p className="max-w-[380px] text-[15px] leading-[1.7] text-[var(--ca-body)]">{page.intro}</p><p className="mt-8 ca-mono-label !text-[10px]">Last updated · August 2026</p></header><section className="divide-y divide-[var(--ca-hairline)] border-y border-[var(--ca-hairline)]">{page.sections.map(([title, body], index) => { const expanded = open === index; return <div key={title}><button className="flex w-full items-center justify-between gap-5 py-6 text-left" aria-expanded={expanded} onClick={() => setOpen(expanded ? -1 : index)}><span className="text-[17px] font-medium">{title}</span><ChevronDown size={18} className={`shrink-0 transition-transform ${expanded ? "rotate-180 text-[var(--ca-primary)]" : "text-[var(--ca-muted)]"}`} /></button>{expanded && <p className="max-w-[680px] pb-7 pr-8 text-[15px] leading-[1.8] text-[var(--ca-body)]">{body}</p>}</div>; })}</section></div></div></main>;
}
