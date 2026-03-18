"use client";

import { cn } from "@/lib/utils";

export type ToastTone = "success" | "error" | "neutral";

export interface ToastItem {
  id: string;
  message: string;
  tone: ToastTone;
}

interface ToastStackProps {
  items: ToastItem[];
  onDismiss: (id: string) => void;
}

const toneClasses: Record<ToastTone, string> = {
  success: "border-white bg-black text-white",
  error: "border-red-400 bg-black text-red-400",
  neutral: "border-[#1a1a1a] bg-black text-white",
};

export function ToastStack({ items, onDismiss }: ToastStackProps) {
  return (
    <div className="pointer-events-none fixed bottom-6 right-6 flex w-80 flex-col gap-3">
      {items.map((toast) => (
        <div
          key={toast.id}
          className={cn(
            "pointer-events-auto border px-4 py-3 text-body shadow-lg",
            toneClasses[toast.tone],
          )}
        >
          <div className="flex items-start justify-between gap-3">
            <p>{toast.message}</p>
            <button
              type="button"
              onClick={() => onDismiss(toast.id)}
              className="text-sm text-gray-500 hover:text-white"
            >
              Close
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
