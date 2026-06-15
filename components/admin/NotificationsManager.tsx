"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import type { Notification, ChangeRequest, Profile, NotificationStatus } from "@/types";

type Filter = "all" | NotificationStatus;

interface Props {
  notifications: (Notification & { lecturer: Profile })[];
  requests: (ChangeRequest & { lecturer: Profile; timetable_entry?: { course_code: string; course_name: string; day_of_week: string; start_time: string } })[];
}

export function NotificationsManager({ notifications, requests }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [filter, setFilter] = useState<Filter>("all");
  const [adminNote, setAdminNote] = useState<Record<string, string>>({});

  const pending  = requests.filter(r => r.status === "pending");
  const filtered = filter === "all" ? notifications : notifications.filter(n => n.status === filter);

  async function handleRequest(id: string, status: "approved" | "rejected") {
    await fetch(`/api/admin/requests/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, admin_note: adminNote[id] ?? "" }),
    });
    startTransition(() => router.refresh());
  }

  return (
    <div className="space-y-8">

      {/* Pending change requests */}
      {pending.length > 0 && (
        <div>
          <h2 className="font-serif text-nictm-950 text-xl mb-4">
            Pending Change Requests
            <span className="ml-2 bg-nictm-gold text-nictm-950 text-xs font-extrabold
                             rounded-full px-2 py-0.5">{pending.length}</span>
          </h2>
          <div className="space-y-3">
            {pending.map(req => (
              <div key={req.id} className="card p-5">
                <div className="flex flex-wrap items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-nictm-950">{req.lecturer?.full_name}</p>
                    {req.timetable_entry && (
                      <p className="text-xs text-nictm-700 mt-0.5">
                        {req.timetable_entry.course_code} — {req.timetable_entry.course_name}
                        · {req.timetable_entry.day_of_week} {req.timetable_entry.start_time?.slice(0,5)}
                      </p>
                    )}
                    <p className="text-sm text-nictm-700 mt-2">
                      <span className="font-semibold">Reason:</span> {req.reason}
                    </p>
                    {req.requested_date && (
                      <p className="text-xs text-nictm-600 mt-1">
                        Requested new date: {req.requested_date}
                      </p>
                    )}
                    <p className="text-xs text-nictm-500 mt-1">
                      Submitted: {new Date(req.created_at).toLocaleString("en-NG")}
                    </p>
                  </div>
                  <div className="flex flex-col gap-2 min-w-[200px]">
                    <textarea
                      className="input text-xs py-2 resize-none"
                      rows={2}
                      placeholder="Optional note to lecturer…"
                      value={adminNote[req.id] ?? ""}
                      onChange={e => setAdminNote(n => ({ ...n, [req.id]: e.target.value }))}
                    />
                    <div className="flex gap-2">
                      <button onClick={() => handleRequest(req.id, "approved")}
                        className="flex-1 bg-green-50 text-green-800 font-bold text-xs py-2
                                   rounded-lg hover:bg-green-100 transition-colors" disabled={isPending}>
                        ✓ Approve
                      </button>
                      <button onClick={() => handleRequest(req.id, "rejected")}
                        className="flex-1 btn-danger btn-sm" disabled={isPending}>
                        ✕ Reject
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* All requests (past) */}
      {requests.filter(r => r.status !== "pending").length > 0 && (
        <div>
          <h2 className="font-serif text-nictm-950 text-xl mb-4">Previous Requests</h2>
          <div className="card">
            <table className="data-table">
              <thead>
                <tr><th>Lecturer</th><th>Course</th><th>Reason</th><th>Date</th><th>Status</th></tr>
              </thead>
              <tbody>
                {requests.filter(r => r.status !== "pending").map(r => (
                  <tr key={r.id}>
                    <td className="font-semibold text-nictm-950">{r.lecturer?.full_name}</td>
                    <td className="text-nictm-700 text-xs">
                      {r.timetable_entry?.course_code}
                    </td>
                    <td className="text-nictm-700 max-w-[220px] truncate">{r.reason}</td>
                    <td className="text-nictm-600 text-xs">{r.requested_date ?? "—"}</td>
                    <td><Badge status={r.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SMS Log */}
      <div>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h2 className="font-serif text-nictm-950 text-xl">SMS Delivery Log</h2>
          <div className="flex gap-2">
            {(["all", "delivered", "failed", "pending"] as Filter[]).map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors capitalize
                  ${filter === f
                    ? "bg-nictm-800 text-white border-nictm-800"
                    : "bg-white text-nictm-700 border-nictm-200 hover:border-nictm-600"}`}>
                {f}
              </button>
            ))}
          </div>
        </div>

        <div className="card">
          <table className="data-table">
            <thead>
              <tr><th>Recipient</th><th>Phone</th><th>Message</th><th>Sent At</th><th>Status</th></tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={5} className="text-center text-nictm-600 py-8">
                  No records match the selected filter.
                </td></tr>
              )}
              {filtered.map(n => (
                <tr key={n.id}>
                  <td className="font-semibold text-nictm-950">{n.lecturer?.full_name ?? "—"}</td>
                  <td className="font-mono text-xs text-nictm-700">{n.phone}</td>
                  <td className="text-nictm-600 text-xs max-w-[260px]">
                    {n.message.length > 70 ? n.message.slice(0, 70) + "…" : n.message}
                  </td>
                  <td className="text-nictm-600 text-xs whitespace-nowrap">
                    {new Date(n.sent_at).toLocaleString("en-NG")}
                  </td>
                  <td><Badge status={n.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-nictm-600 mt-2">
          Showing {filtered.length} of {notifications.length} total messages.
        </p>
      </div>
    </div>
  );
}
