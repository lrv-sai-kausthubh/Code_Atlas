import type { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonVariant = "primary" | "ghost" | "solid" | "outline";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: ButtonVariant;
    children: ReactNode;
};

const VARIANTS: Record<ButtonVariant, string> = {
    primary: "bg-[#007aff] text-[#00285c] border border-[#007aff] px-4 py-[10px] font-jet text-[10px] font-bold tracking-[.05em] uppercase cursor-pointer transition-[filter,transform] duration-150 hover:brightness-110 active:scale-[.98]",
    ghost: "bg-transparent border border-[#30363d] text-[#dfe2eb] px-[14px] py-[9px] font-jet text-[10px] tracking-[.05em] uppercase cursor-pointer transition-colors duration-150 hover:bg-[#262a31] hover:border-[#007aff] hover:text-[#007aff]",
    solid: "px-8 py-4 font-space text-base font-semibold border border-[#007aff] bg-[#007aff] text-white cursor-pointer shadow-[4px_4px_0_0_#00285c] transition-[filter,box-shadow,transform] duration-150 hover:brightness-110 active:shadow-none active:translate-x-1 active:translate-y-1",
    outline: "px-8 py-4 font-space text-base font-semibold border border-[#30363d] bg-transparent text-[#dfe2eb] cursor-pointer backdrop-blur-[6px] transition-colors duration-150 hover:bg-[#262a31]",
};

export default function Button({ variant = "primary", children, className = "", ...rest }: ButtonProps) {
    return (
        <button className={`${VARIANTS[variant]} ${className}`} {...rest}>
            {children}
        </button>
    );
}
