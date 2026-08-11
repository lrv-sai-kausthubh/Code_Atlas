import type { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonVariant = "primary" | "ghost" | "solid" | "outline";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: ButtonVariant;
    children: ReactNode;
};

const VARIANTS: Record<ButtonVariant, string> = {
    primary: "ca-btn-primary font-mono !text-[11px] !tracking-[.08em] uppercase",
    ghost: "ca-btn-secondary font-mono !text-[11px] !tracking-[.08em] uppercase",
    solid: "ca-btn-dark px-8 text-base",
    outline: "ca-btn-secondary px-8 text-base",
};

export default function Button({ variant = "primary", children, className = "", ...rest }: ButtonProps) {
    return (
        <button className={`${VARIANTS[variant]} ${className}`} {...rest}>
            {children}
        </button>
    );
}