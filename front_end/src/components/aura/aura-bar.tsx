import { useCallback, useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { Move, Send, Sparkles, Volume2, VolumeX, X } from "lucide-react";
import AuraAvatar3D from "./aura-avatar-3d";
import EmptyState from "../empty-state";
import { auraChat } from "../../services/api";
import type {
  AuraAction,
  AuraEmotion,
  AuraMessage,
  ProjectGraph,
} from "../../types/project";

const EMOTION_LABEL: Record<AuraEmotion, string> = {
  neutral: "READY",
  happy: "HAPPY",
  excited: "EXCITED",
  concerned: "CONCERNED",
  alert: "ALERT",
  thinking: "THINKING…",
  sad: "HANGING IN",
  listening: "LISTENING",
};

const QUICK_PROMPTS = [
  "How healthy is this repo?",
  "Which files should we refactor?",
  "Any circular dependencies?",
  "Summarize the project",
];

let messageId = 0;
const nextId = () => `aura-${Date.now()}-${messageId++}`;

function pickMaleVoice(
  voices: SpeechSynthesisVoice[],
): SpeechSynthesisVoice | null {
  const hints = [
    "google uk english male",
    "google us english male",
    "microsoft david",
    "microsoft mark",
    "david",
    "mark",
    "daniel",
    "james",
    "ryan",
    "alex",
    "tom",
    "thomas",
    "male",
    "guy",
  ];
  const lowered = (voice: SpeechSynthesisVoice) => voice.name.toLowerCase();
  const en = voices.filter((voice) => voice.lang.startsWith("en"));
  return (
    hints
      .map((hint) => en.find((voice) => lowered(voice).includes(hint)))
      .find(Boolean) ??
    en.find((voice) => lowered(voice).includes("male")) ??
    en.find((voice) => voice.lang.startsWith("en-US")) ??
    en[0] ??
    voices[0] ??
    null
  );
}

export default function AuraBar({
  graph,
  projectId,
  token,
  onClose,
  onAgentAction,
}: {
  graph: ProjectGraph | null;
  projectId: string;
  token: string;
  onClose: () => void;
  onAgentAction?: (action: AuraAction) => void;
}) {
  const [messages, setMessages] = useState<AuraMessage[]>([]);
  const [input, setInput] = useState("");
  const [emotion, setEmotion] = useState<AuraEmotion>("neutral");
  const [busy, setBusy] = useState(false);
  const [speechOn, setSpeechOn] = useState(
    () => localStorage.getItem("ca-aura-speech") !== "0",
  );
  const [talking, setTalking] = useState(false);
  const [position, setPosition] = useState<{ x: number; y: number } | null>(
    () => {
      const stored = localStorage.getItem("ca-aura-pos");
      if (!stored) return null;
      try {
        const parsed = JSON.parse(stored) as { x: number; y: number };
        if (
          typeof parsed.x === "number" &&
          typeof parsed.y === "number" &&
          Number.isFinite(parsed.x) &&
          Number.isFinite(parsed.y)
        ) {
          return parsed;
        }
      } catch {
        // fall through to centered default
      }
      return null;
    },
  );
  const scrollRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const greetedRef = useRef(false);
  const voicesRef = useRef<SpeechSynthesisVoice[]>([]);

  useEffect(() => {
    if (position) {
      localStorage.setItem("ca-aura-pos", JSON.stringify(position));
    }
  }, [position]);

  useEffect(() => {
    const loadVoices = () => {
      voicesRef.current = window.speechSynthesis.getVoices();
    };
    loadVoices();
    window.speechSynthesis?.addEventListener?.("voiceschanged", loadVoices);
    return () =>
      window.speechSynthesis?.removeEventListener?.(
        "voiceschanged",
        loadVoices,
      );
  }, []);

  const speak = useCallback(
    (text: string, emote: AuraEmotion) => {
      if (!speechOn || !("speechSynthesis" in window)) return;
      const synthesis = window.speechSynthesis;
      synthesis.cancel();
      const utter = new SpeechSynthesisUtterance(text);
      utter.voice = pickMaleVoice(voicesRef.current);
      utter.pitch =
        emote === "sad"
          ? 0.78
          : emote === "excited"
            ? 1.06
            : emote === "happy"
              ? 1.02
              : 0.95;
      utter.rate = emote === "excited" ? 1.05 : 1.0;
      utter.onstart = () => setTalking(true);
      utter.onend = () => setTalking(false);
      utter.onerror = () => setTalking(false);
      synthesis.speak(utter);
    },
    [speechOn],
  );

  const greet = useCallback(() => {
    if (greetedRef.current) return;
    greetedRef.current = true;
    const greeting =
      graph && projectId
        ? `Hey! I'm Aura 1.0 — your architecture copilot. I've read the map for ${graph.project} through your permissions. Ask me about its health, risky files, or dependencies.`
        : "Hey! I'm Aura 1.0 — your architecture copilot. Open a project and ask me about its health, risky files, or dependencies.";
    setMessages([
      { id: nextId(), role: "aura", text: greeting, emotion: "happy" },
    ]);
    setEmotion("happy");
    speak(greeting, "happy");
  }, [graph, projectId, speak]);

  useEffect(() => {
    if (graph && projectId) greet();
  }, [graph, projectId, greet]);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, busy]);

  const toggleSpeech = () => {
    setSpeechOn((value) => {
      localStorage.setItem("ca-aura-speech", value ? "0" : "1");
      if (!value) speak("Speech is on. I'm Aura 1.0.", "happy");
      return !value;
    });
  };

  const send = async (raw?: string) => {
    const text = (raw ?? input).trim();
    if (!text || busy) return;
    setInput("");
    setMessages((current) => [
      ...current,
      { id: nextId(), role: "user", text },
    ]);
    setBusy(true);
    setEmotion("thinking");
    try {
      const response = await auraChat(token, text, projectId);
      const actions = (response.data.actions ?? []) as AuraAction[];
      setEmotion(response.data.emotion);
      setMessages((current) => [
        ...current,
        {
          id: nextId(),
          role: "aura",
          text: response.data.message,
          emotion: response.data.emotion,
          engine: response.data.engine,
          thinking: response.data.thinking,
          actions,
        },
      ]);
      speak(response.data.message, response.data.emotion);
      actions.forEach((action) => onAgentAction?.(action));
    } catch {
      setEmotion("sad");
      setMessages((current) => [
        ...current,
        {
          id: nextId(),
          role: "aura",
          text: "I couldn't reach my model. Check that the backend is running and try again.",
          emotion: "sad",
        },
      ]);
    } finally {
      setBusy(false);
    }
  };

  const startDrag = (event: ReactPointerEvent) => {
    event.preventDefault();
    const bar = barRef.current;
    if (!bar) return;
    const parent = bar.offsetParent as HTMLElement | null;
    const parentRect = parent?.getBoundingClientRect() ?? {
      left: 0,
      top: 0,
      width: window.innerWidth,
      height: window.innerHeight,
    };
    const barRect = bar.getBoundingClientRect();
    const startLeft = barRect.left - parentRect.left;
    const startTop = barRect.top - parentRect.top;
    const originX = event.clientX;
    const originY = event.clientY;
    document.body.style.cursor = "grabbing";
    document.body.style.userSelect = "none";

    const onMove = (move: PointerEvent) => {
      const maxX = Math.max(0, parentRect.width - barRect.width);
      const maxY = Math.max(0, parentRect.height - barRect.height);
      const x = Math.min(
        maxX,
        Math.max(0, startLeft + (move.clientX - originX)),
      );
      const y = Math.min(
        maxY,
        Math.max(0, startTop + (move.clientY - originY)),
      );
      setPosition({ x, y });
    };
    const onUp = () => {
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  const resetPosition = () => {
    localStorage.removeItem("ca-aura-pos");
    setPosition(null);
  };

  const insights = graph?.ml_insights;
  const riskTint =
    insights?.risk_tier === "high"
      ? "var(--ca-error)"
      : insights?.risk_tier === "medium"
        ? "var(--ca-primary)"
        : "var(--ca-success)";

  return (
    <div
      ref={barRef}
      className={`aura-bar ${position ? "aura-bar-dragged" : "aura-bar-centered"}`}
      style={
        position
          ? ({ left: position.x, top: position.y } as React.CSSProperties)
          : undefined
      }
      role="dialog"
      aria-label="Aura 1.0 assistant"
    >
      <div
        className="aura-bar-sheet"
        style={{ "--aura-tint": riskTint } as React.CSSProperties}
      >
       <div className="p-2 flex justify-center items-center w-full">
         <div
          className="aura-bar-grab  border border "
          onPointerDown={startDrag}
          onDoubleClick={resetPosition}
          title="Drag to move Aura · double-click to re-center"
          role="button"
          tabIndex={0}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              resetPosition();
            }
          }}
          aria-label="Drag to move Aura, double-click to re-center"
        />
       </div>
        <div className="flex items-center gap-3 border-b border-[color-mix(in_srgb,var(--graph-label)_16%,transparent)] px-4 pb-3 pt-1">
          <AuraAvatar3D emotion={emotion} speaking={talking} size={46} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 ca-mono-label !text-[11px] tracking-[.12em] text-[var(--ca-ink)] ">
              <Sparkles
                size={12}
                className="text-[color-mix(in_srgb,var(--aura-tint,var(--ca-success))_80%,transparent)]"
              />
              AURA 1.0
              <span className="rounded-full border border-[color-mix(in_srgb,var(--aura-tint,var(--ca-success))_45%,transparent)] px-2 py-[2px] ca-mono-label !text-[7px] text-[color-mix(in_srgb,var(--aura-tint,var(--ca-success))_82%,var(--ca-body))]">
                {EMOTION_LABEL[emotion]}
              </span>
            </div>
            <div className="mt-[3px] truncate ca-mono-label !text-[8px] text-[color-mix(in_srgb,var(--graph-label)_62%,transparent)]">
              {insights?.trained
                ? `Aura health ${insights.health_score ?? "—"}/100 · ${insights.risk_tier ?? "low"} risk · ${insights.refactor_candidates?.length ?? 0} refactor candidates`
                : "Predictive model ready · answering from your authorized view"}
            </div>
          </div>
          <button
            className="inline-flex h-[26px] w-[26px] items-center justify-center border border-[color-mix(in_srgb,var(--graph-label)_26%,transparent)] bg-transparent ca-mono-label !text-[10px] text-[var(--graph-label)] transition-colors hover:border-[var(--ca-primary)] hover:text-[var(--ca-primary)]"
            onPointerDown={startDrag}
            title="Drag to move Aura"
            aria-label="Drag to move Aura"
          >
            <Move size={13} />
          </button>
          <button
            className="inline-flex h-[26px] w-[26px] items-center justify-center border border-[color-mix(in_srgb,var(--graph-label)_26%,transparent)] bg-transparent ca-mono-label !text-[10px] text-[var(--graph-label)] transition-colors hover:border-[var(--ca-primary)] hover:text-[var(--ca-primary)]"
            onClick={toggleSpeech}
            title={speechOn ? "Mute Aura" : "Unmute Aura"}
            aria-label={speechOn ? "Mute Aura" : "Unmute Aura"}
          >
            {speechOn ? <Volume2 size={13} /> : <VolumeX size={13} />}
          </button>
          <button
            className="inline-flex h-[26px] w-[26px] items-center justify-center border border-[color-mix(in_srgb,var(--graph-label)_26%,transparent)] bg-transparent ca-mono-label !text-[10px] text-[var(--graph-label)] transition-colors hover:border-[var(--ca-error)] hover:text-[var(--ca-error)]"
            onClick={onClose}
            aria-label="Close Aura"
          >
            <X size={14} />
          </button>
        </div>
        <div className="aura-bar-chat">
          <div ref={scrollRef} className="aura-bar-messages no-scrollbar">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`aura-bubble ${message.role === "user" ? "aura-bubble-user" : "aura-bubble-aura"}`}
              >
                {message.role === "aura" && message.engine && (
                  <span className="mr-1 text-[8px] opacity-60">
                    [{message.engine.toUpperCase()}]
                  </span>
                )}
                {message.text}
                {message.role === "aura" &&
                  message.thinking &&
                  message.thinking.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {message.thinking.slice(0, 2).map((step, index) => (
                        <span
                          key={index}
                          className="rounded border border-[color-mix(in_srgb,var(--graph-label)_20%,transparent)] px-1 py-[1px] ca-mono-label !text-[7px] opacity-70"
                        >
                          {step}
                        </span>
                      ))}
                    </div>
                  )}
                {message.actions && message.actions.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {message.actions.map((action, index) => (
                      <button
                        key={index}
                        onClick={() => onAgentAction?.(action)}
                        className="rounded border border-[color-mix(in_srgb,var(--aura-tint,var(--ca-success))_45%,transparent)] bg-[color-mix(in_srgb,var(--aura-tint,var(--ca-success))_10%,transparent)] px-2 py-[3px] ca-mono-label !text-[8px] text-[color-mix(in_srgb,var(--aura-tint,var(--ca-success))_85%,var(--ca-body))] transition-colors hover:bg-[color-mix(in_srgb,var(--aura-tint,var(--ca-success))_24%,transparent)]"
                      >
                        ⌖ {action.label ?? action.path}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {busy && (
              <div className="aura-bubble aura-bubble-aura">
                <div className="aura-thinking-dots">
                  <i />
                  <i />
                  <i />
                </div>
              </div>
            )}
            {messages.length === 0 && !busy && (
              <>
                <EmptyState
                  compact
                  icon={Sparkles}
                  title="How can I help you with this codebase?"
                  description="Ask about architecture, imports, dependencies, or what would break if you change a file."
                />
                <div className="mt-1 flex flex-wrap gap-2">
                  {QUICK_PROMPTS.map((prompt) => (
                    <button
                      key={prompt}
                      className="aura-chip"
                      onClick={() => send(prompt)}
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
          <div className="aura-bar-input">
            <input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") send();
              }}
              placeholder="Ask Aura about this codebase…"
              aria-label="Message Aura"
            />
            <button
              className="inline-flex h-[28px] w-[28px] items-center justify-center border border-[color-mix(in_srgb,var(--aura-tint,var(--ca-success))_55%,transparent)] bg-[color-mix(in_srgb,var(--aura-tint,var(--ca-success))_16%,transparent)] text-[color-mix(in_srgb,var(--aura-tint,var(--ca-success))_85%,var(--ca-body))] transition-colors hover:bg-[color-mix(in_srgb,var(--aura-tint,var(--ca-success))_28%,transparent)] disabled:opacity-40"
              onClick={() => send()}
              disabled={busy || !input.trim()}
              aria-label="Send message"
            >
              <Send size={13} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
