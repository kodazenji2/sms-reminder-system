"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import type { Profile, Network } from "@/types";

const NETWORKS: Network[] = ["MTN", "Glo", "Airtel", "9Mobile"];
const emptyForm = { full_name: "", phone: "", email: "", network: "MTN" as Network, password: "" };

interface Props {
  initialLecturers: Profile[];
  classCounts: Record<string, number>;
}

export function LecturersManager({ initialLecturers, classCounts }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [active, setActive] = useState(true);
  const [editId, setEditId] = useState<string | null>(null);
  const [mode, setMode] = useState<"add" | "edit">("add");
  const [error, setError] = useState<string | null>(null);

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  function openAdd() {
    setError(null);
    setMode("add");
    setEditId(null);
    setForm(emptyForm);
    setShowModal(true);
  }

  function openEdit(lecturer: Profile) {
    setError(null);
    setMode("edit");
    setEditId(lecturer.id);
    setActive(lecturer.active ?? true);
    setForm({
      full_name: lecturer.full_name ?? "",
      phone: lecturer.phone ?? "",
      email: lecturer.email ?? "",
      network: lecturer.network ?? "MTN",
      password: "",
    });
    setShowModal(true);
  }

  async function handleSave() {
    setError(null);
    if (mode === "add") {
      if (!form.full_name || !form.email || !form.password) {
        setError("Name, email, and a temporary password are required."); return;
      }
      const res = await fetch("/api/admin/lecturers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Failed to create lecturer."); return; }
    } else {
      if (!editId) return;
      if (!form.full_name) {
        setError("Name is required."); return;
      }
      const res = await fetch(`/api/admin/lecturers/${editId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: form.full_name,
          phone: form.phone,
          network: form.network,
          active,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Failed to update lecturer."); return; }
    }

    setShowModal(false);
    setForm(emptyForm);
    setEditId(null);
    setMode("add");
    startTransition(() => router.refresh());
  }

  return (
    <div>
      <div className="flex justify-end mb-5">
        <button className="btn-primary" onClick={openAdd}>+ Add Lecturer</button>
      </div>

      <div className="card overflow-x-auto">
        <table className="data-table w-full min-w-[700px]">
          <thead>
            <tr>
              <th>Name</th><th>Phone</th><th>Network</th>
              <th>Email</th><th>Classes/Wk</th><th>Status</th><th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {initialLecturers.length === 0 && (
              <tr><td colSpan={7} className="text-center text-nictm-600 py-8">
                No lecturers registered yet.
              </td></tr>
            )}
            {initialLecturers.map(l => (
              <tr key={l.id}>
                <td>
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-nictm-800 flex items-center
                                    justify-center text-white font-bold text-xs flex-shrink-0">
                      {l.full_name.charAt(0)}
                    </div>
                    <span className="font-semibold text-nictm-950">{l.full_name}</span>
                  </div>
                </td>
                <td className="font-mono text-xs text-nictm-700">{l.phone ?? "—"}</td>
                <td>
                  {l.network && (
                    <span className="text-xs font-bold bg-nictm-50 text-nictm-700
                                     px-2 py-0.5 rounded-md">{l.network}</span>
                  )}
                </td>
                <td className="text-nictm-600 text-xs">{l.email ?? "—"}</td>
                <td className="font-bold text-nictm-800 text-center">
                  {classCounts[l.id] ?? 0}
                </td>
                <td><Badge status={l.active ? "active" : "inactive"} /></td>
                <td>
                  <button className="btn-secondary btn-sm" onClick={() => openEdit(l)}>
                    Edit
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <Modal title={mode === "add" ? "Add New Lecturer" : "Edit Lecturer"} onClose={() => setShowModal(false)}>
          {error && (
            <div className="bg-red-50 text-red-700 text-sm px-4 py-2.5 rounded-xl mb-5">{error}</div>
          )}
          <div className="space-y-4">
            <div>
              <label className="label">Full Name</label>
              <input className="input" value={form.full_name}
                onChange={e => set("full_name", e.target.value)} placeholder="Dr. John Doe" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Phone Number</label>
                <input className="input" value={form.phone}
                  onChange={e => set("phone", e.target.value)} placeholder="08012345678" />
              </div>
              <div>
                <label className="label">Mobile Network</label>
                <select className="input" value={form.network}
                  onChange={e => set("network", e.target.value as Network)}>
                  {NETWORKS.map(n => <option key={n}>{n}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="label">Email Address</label>
              <input type="email" className="input" value={form.email}
                onChange={e => set("email", e.target.value)}
                placeholder="john.doe@nictm.edu.ng"
                disabled={mode === "edit"} />
            </div>
            {mode === "edit" ? (
              <div>
                <label className="label">Status</label>
                <select className="input" value={active ? "active" : "inactive"}
                  onChange={e => setActive(e.target.value === "active")}>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
            ) : null}
            {mode === "add" ? (
              <div>
                <label className="label">Temporary Password</label>
                <input type="password" className="input" value={form.password}
                  onChange={e => set("password", e.target.value)}
                  placeholder="They can change this after first login" />
              </div>
            ) : null}
          </div>
          <div className="flex gap-3 justify-end mt-6">
            <button className="btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
            <button className="btn-primary" onClick={handleSave} disabled={isPending}>
              {mode === "add" ? "Create Account" : "Save Changes"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
