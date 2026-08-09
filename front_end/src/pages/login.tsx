import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { login, register } from "../services/api";
import BackButton from "../components/back-button";
import {
  toastDismiss,
  toastError,
  toastLoading,
  toastSuccess,
  toastValidation,
} from "../services/toast";

type LoginProps = {
  onLogin: (token: string) => void;
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

function Login({ onLogin }: LoginProps) {
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
    <div className="flex     min-h-screen bg-[#080a0d] text-[#dfe2eb] font-inter overflow-hidden max-[900px]:overflow-auto max-[900px]:flex-col">
      <section className="flex-[0_0_60%] relative overflow-hidden border-r border-[#30363d] flex flex-col justify-between p-12 max-[900px]:hidden">
        <div className="absolute inset-0 bg-[radial-gradient(rgba(48,54,61,.5)_1px,transparent_1px)] bg-[size:24px_24px] opacity-20" />
        <div className="absolute left-0 right-0 h-[100px] z-5 bg-[linear-gradient(0deg,transparent,rgba(0,122,255,.05)_50%,transparent)] opacity-40 animate-scan" />
        <div className="relative z-10 flex flex-col justify-between h-full">
          <div className="flex items-center gap-[10px]">
            <span className="w-7 h-7 bg-[#007aff] text-white grid place-items-center text-[15px]">
              ✦
            </span>
            <span className="font-space font-bold tracking-[-.04em] text-[#007aff] text-lg">
              CODE ATLAS
            </span>
          </div>
          <div>
            <h1 className="font-space text-[clamp(40px,5vw,52px)] leading-[1.05] tracking-[-.02em] font-bold mt-0 mb-5 max-w-[560px]">
              The Knowledge Graph for your{" "}
              <span className="text-[#007aff]">Codebase.</span>
            </h1>
            <p className="text-[#c1c6d7] text-[15px] leading-[1.6] max-w-[420px] mt-0 mb-0">
              Navigate architectural complexity with AI-driven insights.
              Visualize flows, manage dependencies, and ship better code faster.
            </p>
            <div className="flex items-center gap-4 opacity-60 mt-12">
              <span className="w-2 h-2 rounded-full bg-[#10b981]" />
              <span
                className="font-jet tracking-[.05em] uppercase"
                style={{ fontSize: 10 }}
              >
                Stable v2.4
              </span>
              <span className="w-px h-3 bg-[#30363d]" />
              <span
                className="font-jet tracking-[.05em] uppercase"
                style={{ fontSize: 10, color: "#c1c6d7" }}
              >
                Node Engine: Running
              </span>
            </div>
          </div>
          <div className="flex justify-between font-jet text-[11px] text-[rgba(193,198,215,.5)]">
            <span>0x1A4F_SYSTEM_CORE</span>
            <span>© 2026 CODE ATLAS LABS</span>
          </div>
        </div>
      </section>

      <section className="flex-1 bg-[#10141a] flex items-center justify-center p-8">
        <form className="w-full max-w-[400px]" onSubmit={handleSubmit}>
          <div className="hidden items-center gap-2 mb-12 max-[900px]:flex">
            <img src="/codeAtlas_logo.png" alt="Code Atlas" className="w-7 h-7 rounded-full object-contain" />
            <span className="font-space font-bold tracking-[-.04em] text-[#007aff] text-lg">
              CODE ATLAS
            </span>
          </div>
          <h2 className="font-space text-2xl font-semibold mt-0 mb-2">
            Welcome back
          </h2>
          <p className="text-[#c1c6d7] text-sm mt-0 mb-8">
            Sign in to your development workspace.
          </p>

          <div className="flex flex-col gap-3 mb-8">
            <button
              type="button"
              onClick={handleGitHub}
              className="h-11 border-0 flex items-center justify-center gap-3 font-inter text-sm font-semibold cursor-pointer transition-[background,transform] duration-150 hover:scale-[.98] bg-[#dfe2eb] text-[#0a0e14] hover:bg-white"
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
              className="h-11 flex items-center justify-center gap-3 font-inter text-sm font-semibold cursor-pointer transition-[background,transform] duration-150 hover:scale-[.98] bg-[#181c22] border border-[#30363d] text-[#dfe2eb] hover:bg-[#262a31]"
            >
              <GoogleIcon />
              Continue with Google
            </button>
          </div>

          <div className="flex items-center gap-4 mb-8 before:flex-1 before:h-px before:bg-[#30363d] after:flex-1 after:h-px after:bg-[#30363d]">
            <span className="font-jet text-[10px] tracking-[.05em] uppercase text-[#c1c6d7]">
              Or with email
            </span>
          </div>

          {mode === "register" && (
            <div className="mb-5">
              <label
                htmlFor="ca-name"
                className="block font-jet text-[10px] tracking-[.05em] uppercase text-[#c1c6d7] mb-1.5"
              >
                Full Name
              </label>
              <input
                id="ca-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Ada Lovelace"
                autoComplete="name"
                className="w-full bg-[#181c22] border border-[#30363d] text-[#dfe2eb] p-3 px-4 font-inter text-sm outline-none transition-[border-color,box-shadow] duration-150 focus:border-[#007aff] focus:shadow-[0_0_0_2px_rgba(0,122,255,.3)]"
              />
            </div>
          )}
          <div className="mb-5">
            <label
              htmlFor="ca-email"
              className="block font-jet text-[10px] tracking-[.05em] uppercase text-[#c1c6d7] mb-1.5"
            >
              Email Address
            </label>
            <input
              id="ca-email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="dev@company.com"
              autoComplete="email"
              className="w-full bg-[#181c22] border border-[#30363d] text-[#dfe2eb] p-3 px-4 font-inter text-sm outline-none transition-[border-color,box-shadow] duration-150 focus:border-[#007aff] focus:shadow-[0_0_0_2px_rgba(0,122,255,.3)]"
            />
          </div>
          <div className="mb-5">
            <label
              htmlFor="ca-password"
              className="block font-jet text-[10px] tracking-[.05em] uppercase text-[#c1c6d7] mb-1.5"
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
              className="w-full bg-[#181c22] border border-[#30363d] text-[#dfe2eb] p-3 px-4 font-inter text-sm outline-none transition-[border-color,box-shadow] duration-150 focus:border-[#007aff] focus:shadow-[0_0_0_2px_rgba(0,122,255,.3)]"
            />
          </div>
          {mode === "login" && (
            <div className="flex items-center gap-2 mb-6">
              <input
                id="ca-remember"
                type="checkbox"
                className="w-4 h-4 accent-[#007aff]"
              />
              <label
                htmlFor="ca-remember"
                className="text-xs text-[#c1c6d7] cursor-pointer"
              >
                Remember this device for 30 days
              </label>
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full h-12 border-0 bg-[#007aff] text-white font-space text-sm font-bold tracking-[.06em] uppercase cursor-pointer relative overflow-hidden transition-[transform,filter] duration-150 hover:brightness-110 active:scale-[.98] disabled:opacity-60 disabled:pointer-events-none"
          >
            {submitting
              ? "PLEASE WAIT…"
              : mode === "register"
                ? "Create Account"
                : "Authorize Access"}
          </button>

          <div className="mt-10 pt-10 border-t border-[#30363d] text-center">
            <p className="text-sm text-[#c1c6d7] mt-0 mb-4">
              {mode === "login"
                ? "New to Code Atlas?"
                : "Already have an account?"}{" "}
              <a
                href="#"
                onClick={(event) => {
                  event.preventDefault();
                  setMode(mode === "login" ? "register" : "login");
                }}
                className="text-[#007aff] font-semibold no-underline"
              >
                {mode === "login" ? "Create an account" : "Sign in"}
              </a>
            </p>
            <div className="flex gap-4 justify-center text-[10px] text-[rgba(193,198,215,.6)]">
              <a href="#" className="no-underline hover:text-[#dfe2eb]">
                Privacy Policy
              </a>
              <span>•</span>
              <a href="#" className="no-underline hover:text-[#dfe2eb]">
                Terms of Service
              </a>
            </div>
          </div>
        </form>
      </section>

      <div className="fixed top-8 left-8 z-20">
        <BackButton />
      </div>
      <div className="fixed top-8 right-8 z-20 text-right font-jet text-[11px] text-[rgba(193,198,215,.5)] leading-[1.7] pointer-events-none">
        <span>SECURE_SHELL_ESTABLISHED</span>
        <br />
        <span>{timestamp}</span>
      </div>
    </div>
  );
}

export default Login;
