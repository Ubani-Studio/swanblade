import { forwardRef, TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        "w-full border border-[#1a1a1a] bg-black px-4 py-4 text-body text-white leading-relaxed placeholder:text-gray-500 focus:border-white focus:bg-black focus:outline-none disabled:opacity-40 disabled:cursor-not-allowed",
        className,
      )}
      {...props}
    />
  ),
);

Textarea.displayName = "Textarea";
