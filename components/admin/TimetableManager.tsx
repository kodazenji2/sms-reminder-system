"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import type { TimetableEntry, Profile, DayOfWeek } from "@/types";

const DAYS: DayOfWeek[] = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

interface Props {
  initialEntries: (TimetableEntry & { lecturer: Profile })[],
  lecturers: Profile[],
}

const emptyForm = {
  course_code: "", course_name: "", lecturer_id: "",
  day_of_week: "Monday" as DayOfWeek,
  start_time: "08:00", end_time: "10:00", venue: "",
  active: "true",
};

export function TimetableManager({ initialEntries, lecturers }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [filter, setFilter] = useState<DayOfWeek | "All">("All");
  const [modal, setModal] = useState<"add" | "edit" | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState<string | null>(null);
  const [smsMsg, setSmsMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmInput, setConfirmInput] = useState("");

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const filtered = filter === "All"
    ? initialEntries
    : initialEntries.filter(e => e.day_of_week === filter);

  function openAdd() { setForm(emptyForm); setEditId(null); setModal("add"); }
  function openEdit(e: TimetableEntry) {
    setForm({
      course_code: e.course_code, course_name: e.course_name,
      lecturer_id: e.lecturer_id, day_of_week: e.day_of_week,
      start_time: e.start_time.slice(0, 5), end_time: e.end_time.slice(0, 5),
      venue: e.venue ?? "",
      active: e.active ? "true" : "false",
    });
    setEditId(e.id);
    setModal("edit");
  }

  async function handleSave() {
    setError(null);
    const url = editId ? `/api/admin/timetable/${editId}` : "/api/admin/timetable";
    const method = editId ? "PUT" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        lecturer_id: form.lecturer_id || undefined,
        active: form.active === "true",
      }),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error ?? "Failed to save."); return; }
    setModal(null);
    startTransition(() => router.refresh());
  }

  async function handleDelete(id: string) {
    // Open in-app confirmation modal (avoid using prompt/confirm which may be unsupported)
    setConfirmDeleteId(id);
    setConfirmInput("");
  }

  async function performDelete() {
    if (!confirmDeleteId) return;
    if (confirmInput !== "DELETE") return setError("Type DELETE to confirm.");
    setError(null);
    await fetch(`/api/admin/timetable/${confirmDeleteId}`, { method: "DELETE" });
    setConfirmDeleteId(null);
    setConfirmInput("");
    startTransition(() => router.refresh());
  }

  async function handleToggleActive(entry: TimetableEntry) {
    const res = await fetch(`/api/admin/timetable/${entry.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !entry.active }),
    });
    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Failed to update status.");
      return;
    }
    startTransition(() => router.refresh());
  }

  async function handleSendSMS(entryId: string) {
    setSmsMsg(null);
    const res = await fetch(`/api/admin/timetable/${entryId}/sms`, { method: "POST" });
    const data = await res.json();
    setSmsMsg(res.ok ? `✓ SMS sent to ${data.phone}.` : `✗ ${data.error}`);
    setTimeout(() => setSmsMsg(null), 5000);
    startTransition(() => router.refresh());
  }

  return (
    <div>
      {smsMsg && (
        <div className={`mb-5 px-4 py-3 rounded-xl text-sm font-medium
          ${smsMsg.startsWith("✓") ? "bg-green-50 text-green-800" : "bg-red-50 text-red-700"}`}>
          {smsMsg}
        </div>
      )}

      {/* Filter + Add */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div className="flex flex-wrap gap-2">
          {(["All", ...DAYS] as const).map(d => (
            <button key={d} onClick={() => setFilter(d)}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold border transition-colors
                ${filter === d
                  ? "bg-nictm-800 text-white border-nictm-800"
                  : "bg-white text-nictm-700 border-nictm-200 hover:border-nictm-600"}`}>
              {d === "All" ? "All Days" : d}
            </button>
          ))}
        </div>
        <button className="btn-primary" onClick={openAdd}>+ Add Entry</button>
      </div>

      {/* Table */}
      <div className="card overflow-x-auto">
        <table className="data-table w-full min-w-[900px]">
          <thead>
            <tr>
              <th>Day</th><th>Time</th><th>Course</th><th>Code</th>
              <th>Lecturer</th><th>Status</th><th>Venue</th><th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={8} className="text-center text-nictm-600 py-8">
                No entries for {filter}.
              </td></tr>
            )}
            {filtered.map(entry => (
              <tr key={entry.id}>
                <td className="font-bold text-nictm-800">{entry.day_of_week}</td>
                <td className="font-mono text-xs text-nictm-700">
                  {entry.start_time.slice(0, 5)} – {entry.end_time.slice(0, 5)}
                </td>
                <td className="font-semibold text-nictm-950 max-w-[180px]">{entry.course_name}</td>
                <td>
                  <span className="bg-nictm-50 text-nictm-800 text-xs font-bold px-2 py-0.5 rounded-md">
                    {entry.course_code}
                  </span>
                </td>
                <td className="text-nictm-700">{entry.lecturer?.full_name ?? "—"}</td>
                <td>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${entry.active ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
                    {entry.active ? "Active" : "Inactive"}
                  </span>
                </td>
                <td className="text-nictm-600">{entry.venue ?? "—"}</td>
                <td>
                  <div className="flex flex-wrap gap-1.5">
                    <button className="btn-gold" onClick={() => handleSendSMS(entry.id)}
                      title={entry.active ? "Send SMS reminder now (test/manual)" : "Inactive entry cannot send SMS."}
                      disabled={!entry.active}>SMS</button>
                    <button className="btn-secondary btn-sm" onClick={() => handleToggleActive(entry)}>
                      {entry.active ? "Deactivate" : "Activate"}
                    </button>
                    <button className="btn-secondary btn-sm" onClick={() => openEdit(entry)}>Edit</button>
                    <button className="btn-danger btn-sm" onClick={() => handleDelete(entry.id)}>Del</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-nictm-600 mt-3">
        Reminders are sent automatically 30 minutes before each class.
        Click <strong>SMS</strong> to send a manual reminder immediately.
      </p>

      {/* Add / Edit Modal */}
      {modal && (
        <Modal title={modal === "add" ? "Add Timetable Entry" : "Edit Timetable Entry"}
          onClose={() => setModal(null)}>
          {error && (
            <div className="bg-red-50 text-red-700 text-sm px-4 py-2.5 rounded-xl mb-5">{error}</div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Course Code</label>
              <input className="input" value={form.course_code}
                onChange={e => set("course_code", e.target.value)} placeholder="COM 111" />
            </div>
            <div>
              <label className="label">Day of Week</label>
              <select className="input" value={form.day_of_week}
                onChange={e => set("day_of_week", e.target.value)}>
                {DAYS.map(d => <option key={d}>{d}</option>)}
              </select>
            </div>
          </div>
          <div className="mt-4">
            <label className="label">Course Name</label>
            <input className="input" value={form.course_name}
              onChange={e => set("course_name", e.target.value)}
              placeholder="Computer Programming I" />
          </div>
          <div className="mt-4">
            <label className="label">Assign Lecturer</label>
            <select className="input" value={form.lecturer_id}
              onChange={e => set("lecturer_id", e.target.value)}>
              <option value="">— Select Lecturer —</option>
              {lecturers.map(l => (
                <option key={l.id} value={l.id}>{l.full_name}</option>
              ))}
            </select>
          </div>
          <div className="mt-4">
            <label className="label">Status</label>
            <select className="input" value={form.active}
              onChange={e => set("active", e.target.value)}>
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>
          </div>
          <div className="grid grid-cols-3 gap-4 mt-4">
            <div>
              <label className="label">Start Time</label>
              <input type="time" className="input" value={form.start_time}
                onChange={e => set("start_time", e.target.value)} />
            </div>
            <div>
              <label className="label">End Time</label>
              <input type="time" className="input" value={form.end_time}
                onChange={e => set("end_time", e.target.value)} />
            </div>
            <div>
              <label className="label">Venue</label>
              <input className="input" value={form.venue}
                onChange={e => set("venue", e.target.value)} placeholder="Lab A" />
            </div>
          </div>
          <div className="flex gap-3 justify-end mt-6">
            <button className="btn-secondary" onClick={() => setModal(null)}>Cancel</button>
            <button className="btn-primary" onClick={handleSave} disabled={isPending}>
              {modal === "add" ? "Add Entry" : "Save Changes"}
            </button>
          </div>
        </Modal>
      )}

      {confirmDeleteId && (
        <Modal title="Confirm Delete" onClose={() => setConfirmDeleteId(null)}>
          <div className="space-y-4">
            <p className="text-sm text-nictm-700">Type <strong>DELETE</strong> to permanently remove this timetable entry. This cannot be undone.</p>
            <input className="input" value={confirmInput} onChange={e => setConfirmInput(e.target.value)} />
            {error ? <div className="bg-red-50 text-red-700 px-4 py-2 rounded-xl">{error}</div> : null}
            <div className="flex justify-end gap-3">
              <button className="btn-secondary" onClick={() => setConfirmDeleteId(null)}>Cancel</button>
              <button className="btn-danger" onClick={performDelete}>Delete</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
