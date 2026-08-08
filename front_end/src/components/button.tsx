import type { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonVariant = "primary" | "ghost" | "solid" | "outline";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: ButtonVariant;
    children: ReactNode;
};

export default function Button({ variant = "primary", children, className = "", ...rest }: ButtonProps) {
    return (
        <button className={`ca-btn-${variant} ${className}`} {...rest}>
            {children}
        </button>
    );
}
