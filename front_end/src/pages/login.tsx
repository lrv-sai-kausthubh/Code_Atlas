import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { login, register } from "../services/api";
import BackButton from "../components/back-button";
import { Moon, Sun } from "lucide-react";
import {
  toastDismiss,
  toastError,
  toastLoading,
  toastSuccess,
  toastValidation,
} from "../services/toast";

type LoginProps = {
  onLogin: (token: string) => void;
  theme: "dark" | "light";
  onToggleTheme: () => void;
};

function GitHubIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
    </svg>
  );
}

function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}

function LogoSymbol() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="2.2" fill="#f54e00" />
      <circle cx="4.5" cy="5.5" r="1.8" stroke="#26251e" strokeWidth="1.4" fill="none" />
      <circle cx="19.5" cy="5.5" r="1.8" stroke="#26251e" strokeWidth="1.4" fill="none" />
      <circle cx="4.5" cy="18.5" r="1.8" stroke="#26251e" strokeWidth="1.4" fill="none" />
      <circle cx="19.5" cy="18.5" r="1.8" stroke="#26251e" strokeWidth="1.4" fill="none" />
      <path d="M5.6 6.9 10.4 10.6M18.4 6.9 13.6 10.6M5.6 17.1l4.8-3.7M18.4 17.1l-4.8-3.7" stroke="#26251e" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function Login({ onLogin, theme, onToggleTheme }: LoginProps) {
  const [timestamp, setTimestamp] = useState("");
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const update = () =>
      setTimestamp(new Date().toISOString().replace("T", " ").split(".")[0]);
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!email || !password) {
      toastValidation("Email and password are required.");
      return;
    }
    if (mode === "register" && password.length < 6) {
      toastValidation("Password must be at least 6 characters long.");
      return;
    }
    setSubmitting(true);
    const loadingId = toastLoading(
      mode === "register" ? "Creating your account…" : "Signing you in…",
    );
    try {
      const response =
        mode === "register"
          ? await register(name, email, password)
          : await login(email, password);
      toastDismiss(loadingId);
      toastSuccess(
        mode === "register"
          ? "Account created. Welcome!"
          : "Signed in successfully.",
      );
      onLogin(response.data.token);
    } catch (error) {
      toastDismiss(loadingId);
      const detail =
        error && typeof error === "object" && "response" in error
          ? (error as { response?: { data?: { detail?: string } } }).response
              ?.data?.detail
          : undefined;
      toastError(detail ?? "Could not complete sign-in. Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleGitHub = () => {
    window.location.href = `${import.meta.env.VITE_API_URL || "http://127.0.0.1:8000"}/api/auth/github/authorize`;
  };

  return (
    <div className="flex min-h-screen bg-[var(--ca-canvas)] text-[var(--ca-ink)] font-sans overflow-hidden max-[900px]:overflow-auto max-[900px]:flex-col">
      <section className="relative flex-[0_0_55%] flex flex-col justify-between overflow-hidden border-r border-[var(--ca-hairline)] p-12 max-[900px]:hidden">
        <div className="pointer-events-none absolute -left-[180px] -top-[140px] h-[520px] w-[520px] rounded-full border border-[var(--ca-hairline)]" />
        <div className="pointer-events-none absolute -right-[220px] bottom-[-180px] h-[560px] w-[560px] rounded-full border border-[var(--ca-hairline-soft)]" />
        <div className="relative z-10 flex h-full flex-col justify-between">
          <div className="flex items-center gap-[10px]">
            <span className="text-[var(--ca-ink)]"><LogoSymbol /></span>
            <span className="text-[17px] font-medium tracking-[-0.02em]">CodeAtlas</span>
          </div>
          <div>
            <h1 className="ca-display-lg mt-0 mb-5 max-w-[560px] text-[clamp(38px,4.5vw,54px)]">
              Understand your codebase
              <br />
              <span className="text-[var(--ca-primary)]">without reading every file.</span>
            </h1>
            <p className="mt-0 mb-0 max-w-[420px] text-[15px] leading-[1.6] text-[var(--ca-body)]">
              Upload a repository and CodeAtlas maps its files, dependencies
              and architecture into an interactive visual graph.
            </p>
            <div className="ca-mono-label mt-12 flex items-center gap-4 opacity-70">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--ca-success)]" />
              <span>Stable v2.4</span>
              <span className="h-3 w-px bg-[var(--ca-hairline-strong)]" />
              <span>Graph engine: ready</span>
            </div>
          </div>
          <div className="ca-mono-label flex justify-between text-[10px] opacity-60">
            <span>codeatlas · architecture</span>
            <span>© 2026 CodeAtlas Technologies</span>
          </div>
        </div>
      </section>

      <section className="flex flex-1 items-center justify-center p-8 max-[900px]:pt-24">
        
        <form className="w-full max-w-[400px]" onSubmit={handleSubmit}>
           <div className="relative bottom-3 right-35">
        <BackButton />
        <button
        type="button"
        onClick={onToggleTheme}
        className="fixed top-29 right-8 z-20 grid h-9 w-9 place-items-center rounded-lg border border-[var(--ca-hairline)] bg-[var(--ca-surface-card)] text-[var(--ca-muted)] transition-colors hover:border-[var(--ca-primary)] hover:text-[var(--ca-primary)]"
        aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
        title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
      >
        {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
      </button>
      </div>  

          <div className="mb-12 flex items-center gap-2 max-[900px]:flex">
           
            <span className="text-[var(--ca-ink)]"><LogoSymbol /></span>
            <span className="text-[17px] font-medium tracking-[-0.02em]">CodeAtlas</span>
          </div>
          <h2 className="ca-display-md mt-0 mb-2 text-[26px]">
            {mode === "login" ? "Welcome back" : "Create your account"}
          </h2>
          <p className="mt-0 mb-8 text-[14px] text-[var(--ca-body)]">
            {mode === "login"
              ? "Sign in to your development workspace."
              : "Start mapping your repositories."}
          </p>

          <div className="mb-8 flex flex-col gap-3">
            <button
              type="button"
              onClick={handleGitHub}
              className="ca-btn-secondary h-11 w-full gap-3 !text-[14px]"
            >
              <GitHubIcon />
              Continue with GitHub
            </button>
            <button
              type="button"
              onClick={() =>
                toastValidation(
                  "Google sign-in is coming soon. Use GitHub or email instead.",
                )
              }
              className="ca-btn-secondary h-11 w-full gap-3 !text-[14px]"
            >
              <GoogleIcon />
              Continue with Google
            </button>
          </div>

          <div className="mb-8 flex items-center gap-4 before:flex-1 before:h-px before:bg-[var(--ca-hairline)] after:flex-1 after:h-px after:bg-[var(--ca-hairline)]">
            <span className="ca-label">Or with email</span>
          </div>

          {mode === "register" && (
            <div className="mb-5">
              <label
                htmlFor="ca-name"
                className="ca-label mb-1.5 block"
              >
                Full Name
              </label>
              <input
                id="ca-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Ada Lovelace"
                autoComplete="name"
                className="ca-input w-full"
              />
            </div>
          )}
          <div className="mb-5">
            <label
              htmlFor="ca-email"
              className="ca-label mb-1.5 block"
            >
              Email Address
            </label>
            <input
              id="ca-email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="dev@company.com"
              autoComplete="email"
              className="ca-input w-full"
            />
          </div>
          <div className="mb-5">
            <label
              htmlFor="ca-password"
              className="ca-label mb-1.5 block"
            >
              Password
            </label>
            <input
              id="ca-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              placeholder="••••••••"
              autoComplete={
                mode === "register" ? "new-password" : "current-password"
              }
              className="ca-input w-full"
            />
          </div>
          {mode === "login" && (
            <div className="mb-6 flex items-center gap-2">
              <input
                id="ca-remember"
                type="checkbox"
                className="h-4 w-4 accent-[var(--ca-primary)]"
              />
              <label
                htmlFor="ca-remember"
                className="cursor-pointer text-[13px] text-[var(--ca-body)]"
              >
                Remember this device for 30 days
              </label>
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="ca-btn-primary h-11 w-full"
          >
            {submitting
              ? "Please wait…"
              : mode === "register"
                ? "Create Account"
                : "Authorize Access"}
          </button>

          <div className="mt-10 border-t border-[var(--ca-hairline)] pt-10 text-center">
            <p className="mt-0 mb-4 text-[14px] text-[var(--ca-body)]">
              {mode === "login"
                ? "New to CodeAtlas?"
                : "Already have an account?"}{" "}
              <a
                href="#"
                onClick={(event) => {
                  event.preventDefault();
                  setMode(mode === "login" ? "register" : "login");
                }}
                className="no-underline font-medium text-[var(--ca-primary)] hover:text-[var(--ca-primary-active)]"
              >
                {mode === "login" ? "Create an account" : "Sign in"}
              </a>
            </p>
            <div className="flex justify-center gap-4 text-[11px] text-[var(--ca-muted)]">
              <a href="#" className="no-underline hover:text-[var(--ca-ink)]">
                Privacy Policy
              </a>
              <span>•</span>
              <a href="#" className="no-underline hover:text-[var(--ca-ink)]">
                Terms of Service
              </a>
            </div>
          </div>
        </form>
      </section>

      
      
      <div className="ca-mono-label pointer-events-none fixed top-[68px] right-8 z-20 text-right text-[10px] leading-[1.7] opacity-60">
        
        <span>secure session</span>
        <br />
        <span>{timestamp}</span>
      </div>
    </div>
  );
}

export default Login;
