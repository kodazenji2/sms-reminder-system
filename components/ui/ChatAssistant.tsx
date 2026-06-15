"use client";

import { useState } from "react";
import { ChatWidget } from "@/components/ui/ChatWidget";

export function ChatAssistant() {
    const [open, setOpen] = useState(false);

    return (
        <>
            <button
                type="button"
                onClick={() => setOpen(open => !open)}
                className="fixed bottom-5 right-5 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-nictm-950 text-white shadow-2xl shadow-slate-950/30 transition-transform hover:-translate-y-0.5"
                aria-label={open ? "Close assistant" : "Open assistant"}
            >
                {open ? "×" : "💬"}
            </button>

            {open ? (
                <div className="fixed bottom-24 right-5 z-40 w-[90vw] max-w-xl rounded-3xl border border-nictm-100 bg-white/95 shadow-2xl shadow-slate-950/20 backdrop-blur-xl">
                    <ChatWidget />
                </div>
            ) : null}
        </>
    );
}
