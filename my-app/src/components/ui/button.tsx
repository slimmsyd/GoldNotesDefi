import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cn } from "@/lib/utils";

export interface ButtonProps
    extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    asChild?: boolean;
    variant?: "primary" | "secondary" | "tertiary" | "outline" | "ghost" | "link" | "danger";
    size?: "default" | "sm" | "lg" | "icon";
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className, variant = "primary", size = "default", asChild = false, ...props }, ref) => {
        const Comp = asChild ? Slot : "button";

        const baseStyles = "inline-flex items-center justify-center whitespace-nowrap font-bold transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d4af37] disabled:pointer-events-none disabled:opacity-50 active:scale-95 cursor-pointer rounded-none";

        const variants: Record<string, string> = {
            primary: "bg-linear-to-r from-[#c9a84c] to-[#a48a3a] text-black hover:brightness-110 shadow-[0_4px_16px_rgba(201,168,76,0.35)]",
            secondary: "bg-[#0a0a0a]/80 border border-[#c9a84c]/40 text-[#e8d48b] font-semibold hover:bg-[#0a0a0a] hover:border-[#c9a84c]/60 backdrop-blur-sm",
            tertiary: "bg-[#0a0a0a] text-white hover:bg-[#1a1a1a]",
            outline: "border border-gray-200 bg-transparent hover:bg-gray-100 text-gray-900",
            ghost: "text-gray-300 hover:text-[#d4af37] font-medium",
            link: "text-[#d4af37] underline-offset-4 hover:underline font-medium",
            danger: "bg-[#ff0000] text-white hover:bg-red-600",
        };

        const sizes: Record<string, string> = {
            default: "h-10 px-6 text-sm",
            sm: "h-8 px-4 text-xs",
            lg: "h-12 px-10 text-base",
            icon: "h-10 w-10",
        };

        return (
            <Comp
                className={cn(
                    baseStyles,
                    variants[variant],
                    sizes[size],
                    className
                )}
                ref={ref}
                {...props}
            />
        );
    }
);
Button.displayName = "Button";

export { Button };
