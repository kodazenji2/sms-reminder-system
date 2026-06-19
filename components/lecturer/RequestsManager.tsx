"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import type { TimetableEntry, ChangeRequest, ChangeRequestType, DayOfWeek } from "@/types";

interface Props {
  myClasses: TimetableEntry[];
  myRequests: (ChangeRequest & {
    timetable_entry: { course_code: string; course_name: string; day_of_week: string; start_time: string }
  })[];
}

const DAYS: DayOfWeek[] = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

const emptyForm = {
  timetable_id: "",
  reason: "",
  request_type: "one_off" as ChangeRequestType,
  requested_date: "",
  requested_day_of_week: "" as DayOfWeek | "",
  requested_start_time: "",
};

export function RequestsManager({ myClasses, myRequests }: Props) {
  const router     = useRouter();
  const [isPending, startTransition] = useTransition();
  const [form, setForm] = useState(emptyForm);
  const [alert, setAlert] = useState<{ ok: boolean; text: string } | null>(null);

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  function setType(t: ChangeRequestType) {
    setForm(f => ({
      ...emptyForm,
      timetable_id: f.timetable_id,
      reason: f.reason,
      request_type: t,
    }));
  }

  async function handleSubmit() {
    if (!form.timetable_id || !form.reason.trim()) {
      setAlert({ ok: false, text: "Please select a class and provide a reason." });
      return;
    }
    if (form.request_type === "permanent" && (!form.requested_day_of_week || !form.requested_start_time)) {
      setAlert({ ok: false, text: "Please provide both a new day and time for a permanent change." });
      return;
    }

    const res  = await fetch("/api/lecturer/requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    if (!res.ok) {
      setAlert({ ok: false, text: data.error ?? "Submission failed. Please try again." });
      return;
    }
    setAlert({ ok: true, text: "Request submitted. The administrator will review it." });
    setForm(emptyForm);
    setTimeout(() => setAlert(null), 6000);
    startTransition(() => router.refresh());
  }

  return (
    <div>
      <div className="mb-7">
        <h1 className="font-serif text-nictm-950 text-3xl mb-1">Change Requests</h1>
        <p className="text-nictm-600 text-sm">
          Submit a request when you need to reschedule or cancel a class session,
          or permanently move a recurring slot. The department administrator will review and respond.
        </p>
      </div>

      {/* Submission form */}
      <div className="card p-6 mb-8">
        <h2 className="font-semibold text-nictm-950 mb-5">New Request</h2>

        <div className="mb-5">
          <label className="label">Type of Request</label>
          <div className="flex gap-2">
            <button type="button" onClick={() => setType("one_off")}
              className={`flex-1 text-sm font-semibold px-4 py-2.5 rounded-xl border transition-colors
                ${form.request_type === "one_off"
                  ? "bg-nictm-950 text-white border-nictm-950"
                  : "bg-white text-nictm-700 border-nictm-200 hover:border-nictm-400"}`}>
              One-off (specific date)
            </button>
            <button type="button" onClick={() => setType("permanent")}
              className={`flex-1 text-sm font-semibold px-4 py-2.5 rounded-xl border transition-colors
                ${form.request_type === "permanent"
                  ? "bg-nictm-950 text-white border-nictm-950"
                  : "bg-white text-nictm-700 border-nictm-200 hover:border-nictm-400"}`}>
              Permanent (day &amp; time)
            </button>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="label">Class to Change</label>
            <select className="input" value={form.timetable_id}
              onChange={e => set("timetable_id", e.target.value)}>
              <option value="">— Select a class —</option>
              {myClasses.map(c => (
                <option key={c.id} value={c.id}>
                  {c.day_of_week} {c.start_time.slice(0, 5)} · {c.course_code} — {c.course_name}
                </option>
              ))}
            </select>
          </div>

          {form.request_type === "one_off" ? (
            <div>
              <label className="label">Preferred New Date <span className="normal-case font-normal text-nictm-500">(optional)</span></label>
              <input type="date" className="input" value={form.requested_date}
                onChange={e => set("requested_date", e.target.value)} />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">New Day</label>
                <select className="input" value={form.requested_day_of_week}
                  onChange={e => set("requested_day_of_week", e.target.value)}>
                  <option value="">— Select —</option>
                  {DAYS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div>
                <label className="label">New Time</label>
                <input type="time" className="input" value={form.requested_start_time}
                  onChange={e => set("requested_start_time", e.target.value)} />
              </div>
            </div>
          )}
        </div>

        <div className="mb-5">
          <label className="label">Reason for Request</label>
          <textarea rows={3} className="input resize-none leading-relaxed"
            value={form.reason}
            onChange={e => set("reason", e.target.value)}
            placeholder="Briefly describe why you need to change this class session…" />
        </div>

        {alert && (
          <div className={`text-sm px-4 py-3 rounded-xl mb-4 font-medium
            ${alert.ok ? "bg-green-50 text-green-800" : "bg-red-50 text-red-700"}`}>
            {alert.text}
          </div>
        )}

        <button className="btn-primary" onClick={handleSubmit} disabled={isPending}>
          Submit Request
        </button>
      </div>

      {/* Past requests */}
      <h2 className="font-serif text-nictm-950 text-xl mb-4">My Submitted Requests</h2>

      {myRequests.length === 0 && (
        <div className="card p-8 text-center text-nictm-600 text-sm">
          You have not submitted any change requests yet.
        </div>
      )}

      <div className="space-y-3">
        {myRequests.map(req => (
          <div key={req.id} className="card px-6 py-4">
            <div className="flex flex-wrap items-start gap-4 justify-between">
              <div className="flex-1 min-w-0">
                {req.timetable_entry && (
                  <p className="font-bold text-nictm-950">
                    {req.timetable_entry.course_name}
                    <span className="ml-2 text-xs font-normal text-nictm-600">
                      {req.timetable_entry.day_of_week} · {req.timetable_entry.start_time?.slice(0, 5)}
                    </span>
                  </p>
                )}
                <p className="text-xs font-semibold text-nictm-500 uppercase tracking-wide mt-1">
                  {req.request_type === "permanent" ? "Permanent change" : "One-off exception"}
                </p>
                <p className="text-sm text-nictm-700 mt-1">
                  <span className="font-semibold">Reason:</span> {req.reason}
                </p>
                {req.request_type === "one_off" && req.requested_date && (
                  <p className="text-xs text-nictm-600 mt-1">Requested date: {req.requested_date}</p>
                )}
                {req.request_type === "permanent" && req.requested_day_of_week && (
                  <p className="text-xs text-nictm-600 mt-1">
                    Requested new slot: {req.requested_day_of_week} {req.requested_start_time?.slice(0, 5)}
                  </p>
                )}
                {req.admin_note && (
                  <p className="text-xs text-nictm-700 mt-1.5 bg-nictm-50 px-3 py-2 rounded-lg">
                    <span className="font-bold">Admin note:</span> {req.admin_note}
                  </p>
                )}
                <p className="text-xs text-nictm-500 mt-2">
                  Submitted: {new Date(req.created_at).toLocaleString("en-NG")}
                </p>
              </div>
              <Badge status={req.status} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
