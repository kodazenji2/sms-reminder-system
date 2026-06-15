type BadgeStatus = "delivered" | "failed" | "pending" | "approved" | "rejected" | "active" | "inactive";

export function Badge({ status }: { status: BadgeStatus }) {
  return <span className={`badge-${status}`}>{status.charAt(0).toUpperCase() + status.slice(1)}</span>;
}
