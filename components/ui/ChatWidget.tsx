"use client";

import { useMemo, useState } from "react";

interface ChatMessage {
    role: "user" | "assistant";
    text: string;
}

export function ChatWidget() {
    const [input, setInput] = useState("");
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const showMessages = useMemo(() => messages.slice(-10), [messages]);

    async function sendMessage() {
        if (!input.trim()) return;
        const userMessage = input.trim();
        setMessages(curr => [...curr, { role: "user", text: userMessage }]);
        setInput("");
        setLoading(true);
        setError("");

        try {
            const res = await fetch("/api/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ message: userMessage }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data?.reply || "Chat request failed.");
            setMessages(curr => [...curr, { role: "assistant", text: data.reply ?? "No response." }]);
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="glass rounded-3xl border border-nictm-100 shadow-sm p-5 max-w-xl mx-auto">
            <div className="flex items-center justify-between mb-4">
                <div>
                    <h2 className="font-serif text-nictm-950 text-lg">Assistant</h2>
                    <p className="text-nictm-600 text-sm">Ask about your schedule, requests, or SMS summary.</p>
                    <p className="text-nictm-500 text-xs mt-1">
                        Example: "What classes do I have today?" or "Do I have pending change requests?"
                    </p>
                </div>
            </div>

            <div className="space-y-3 mb-4 max-h-72 overflow-y-auto">
                {showMessages.length === 0 ? (
                    <div className="rounded-3xl bg-nictm-50 px-4 py-3 text-sm text-nictm-600">
                        No messages yet. Type a question and press Enter or Send.
                    </div>
                ) : (
                    showMessages.map((message, index) => (
                        <div
                            key={index}
                            className={`rounded-3xl px-4 py-3 text-sm leading-relaxed ${message.role === "user"
                                ? "bg-slate-950 text-white self-end ml-auto"
                                : "bg-nictm-50 text-nictm-950"
                                }`}
                        >
                            {message.text}
                        </div>
                    ))
                )}
            </div>

            {error ? <p className="text-red-600 text-sm mb-3">{error}</p> : null}

            <div className="grid gap-3">
                <textarea
                    rows={3}
                    className="input resize-none"
                    placeholder="Ask about today's classes, pending requests, or SMS delivery..."
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => {
                        if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            sendMessage();
                        }
                    }}
                    disabled={loading}
                />
                <button
                    onClick={sendMessage}
                    disabled={loading || !input.trim()}
                    className="btn-primary w-full"
                >
                    {loading ? "Sending..." : "Send Message"}
                </button>
            </div>
        </div>
    );
}
