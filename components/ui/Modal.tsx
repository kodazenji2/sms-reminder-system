"use client";
import { useEffect } from "react";

interface ModalProps {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}

export function Modal({ title, onClose, children, wide }: ModalProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={`bg-white rounded-2xl shadow-2xl w-full ${wide ? "max-w-2xl" : "max-w-xl"}
                       max-h-[92vh] overflow-y-auto`}>
        <div className="flex items-center justify-between px-7 py-5 border-b border-nictm-100">
          <h2 className="font-serif text-nictm-950 text-xl">{title}</h2>
          <button onClick={onClose}
            className="w-8 h-8 rounded-full bg-nictm-50 flex items-center justify-center
                       text-nictm-600 hover:bg-nictm-100 transition-colors text-lg">
            ×
          </button>
        </div>
        <div className="p-7">{children}</div>
      </div>
    </div>
  );
}
