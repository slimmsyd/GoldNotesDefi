import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cn } from "@/lib/utils";

// If you don't have class-variance-authority installed, I should check or handle it. 
// However, it's a very standard shadcn pattern. I will use standard props if CVA is not desired, 
// but CVA makes this much cleaner.
// Checking installed packages showed empty or error, so I'll stick to manual cn logic to be safe and avoid extra deps unless I install CVA too.
// Actually, I'll install CVA as well, it's lightweight and worth it.
// Wait, I can't install CVA in the middle of this `write_to_file` thought process.
// I'll stick to a simple `cn` implementation without CVA to avoid dependency hell if the user is strict, 
// OR I will just add `class-variance-authority` to the install command above.
// Let's keep it simple with just TS and `cn`.

export interface ButtonProps
    extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    asChild?: boolean;
    variant?: "primary" | "secondary" | "outline" | "ghost" | "link" | "black";
    size?: "default" | "sm" | "lg" | "icon";
    shape?: "default" | "pill" | "square";
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className, variant = "primary", size = "default", shape = "default", asChild = false, ...props }, ref) => {
        const Comp = asChild ? Slot : "button";

        // Base styles
        const baseStyles = "inline-flex items-center justify-center whitespace-nowrap font-medium transition-all duration-300 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gray-950 disabled:pointer-events-none disabled:opacity-50 active:scale-95 cursor-pointer";

        // Variants
        const variants = {
            primary: "bg-gradient-to-r from-[#FFE860] to-[#FEFDD6] text-gray-900 hover:scale-105 shadow-lg shadow-yellow-500/20 hover:shadow-yellow-500/30 border border-transparent",
            secondary: "bg-white/90 text-gray-900 border border-gray-200 hover:bg-yellow-50 hover:scale-105 shadow-sm backdrop-blur-sm",
            outline: "border border-gray-200 bg-transparent hover:bg-gray-100 text-gray-900",
            ghost: "hover:bg-gray-100 hover:text-gray-900 text-gray-600",
            link: "text-gray-900 underline-offset-4 hover:underline",
            black: "bg-gray-900 text-white hover:bg-gray-800 shadow-lg hover:shadow-gray-900/20 hover:scale-105"
        };

        // Sizes
        const sizes = {
            default: "h-9 px-4 py-2 text-sm",
            sm: "h-8 px-3 text-xs",
            lg: "h-12 px-10 text-lg", // Matches Hero large
            icon: "h-9 w-9",
        };

        // Shapes
        const shapes = {
            default: "rounded-xl", // Current default in Header
            pill: "rounded-full", // "Sleek" style
            square: "rounded-none",
        };

        return (
            <Comp
                className={cn(
                    baseStyles,
                    variants[variant],
                    sizes[size],
                    shapes[shape],
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
