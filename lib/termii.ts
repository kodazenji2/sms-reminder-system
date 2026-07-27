/**
 * Termii SMS Gateway Integration
 * Docs: https://developers.termii.com/messaging
 *
 * The "generic" channel routes through the best path for the recipient's network.
 * Termii auto-selects Airtel, MTN, Glo, 9Mobile routes based on the number prefix.
 */

const TERMII_BASE = process.env.TERMII_BASE_URL ?? "https://v3.api.termii.com/api";

interface TermiiSendResponse {
  code?: string;
  message_id?: string;
  message_id_str?: string;
  message: string;
  balance?: number;
  user?: string;
}

interface SendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Termii requires international format without a leading "+".
 * Converts local Nigerian format ("0801...") to "234801...".
 * Leaves already-international numbers ("234801...") unchanged.
 */
function toInternationalFormat(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("234")) return digits;
  if (digits.startsWith("0")) return "234" + digits.slice(1);
  return digits;
}

/**
 * Strips a trailing single-letter middle initial, keeping title + name.
 * "Mr. Nanle D"           -> "Mr. Nanle"
 * "Surv. Henry Oriakhi E" -> "Surv. Henry Oriakhi"
 * "Dr. Adeyemi O."        -> "Dr. Adeyemi"
 * "Mrs. Blessing"         -> "Mrs. Blessing" (unchanged, no trailing initial)
 */
function formatLecturerName(fullName: string): string {
  return fullName.trim().replace(/\s+[A-Za-z]\.?$/, "").trim();
}

/**
 * Converts "HH:MM" or "HH:MM:SS" (24h) to a 12h "H:MM AM/PM" string.
 * "13:00"    -> "1:00 PM"
 * "08:00:00" -> "8:00 AM"
 */
export function formatTime12h(time: string): string {
  const [hStr, mStr] = time.split(":");
  const h = parseInt(hStr, 10);
  const m = parseInt(mStr ?? "0", 10);
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${m.toString().padStart(2, "0")} ${period}`;
}

/**
 * Send a single SMS via Termii.
 * @param to   - Phone number in local ("0801...") or international ("234801...")
 *               format. Normalized internally before being sent to Termii.
 * @param message - Plain text SMS body (max 160 chars per segment)
 */
export async function sendSMS(to: string, message: string): Promise<SendResult> {
  try {
    const res = await fetch(`${TERMII_BASE}/sms/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: process.env.TERMII_API_KEY,
        to: toInternationalFormat(to),
        from: process.env.TERMII_SENDER_ID ?? "NICTM",
        sms: message,
        type: "plain",
        channel: process.env.TERMII_SMS_CHANNEL ?? "generic",
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error("[Termii] HTTP error:", res.status, text);
      return { success: false, error: `HTTP ${res.status}: ${text}` };
    }

    const data: TermiiSendResponse = await res.json();

    const messageId = data.message_id ?? data.message_id_str;
    const success = data.code === "ok" || data.message?.toLowerCase().includes("success");

    if (success) {
      return { success: true, messageId };
    } else {
      return { success: false, error: data.message || "Unknown Termii error." };
    }
  } catch (err) {
    console.error("[Termii] fetch error:", err);
    return { success: false, error: String(err) };
  }
}

/**
 * Builds the standard SMS reminder message format.
 * Aims to read like a respectful note from the department, not a terse alert —
 * the same tone whether the recipient is a junior lecturer or the HOD.
 *
 * Keep under 160 characters where possible to avoid multi-part billing —
 * adding a name will sometimes push a message into a 2nd segment, which is
 * an acceptable trade-off for tone.
 */
export function buildReminderMessage(opts: {
  courseCode: string;
  courseName: string;
  startTime: string;     // "HH:MM"
  venue: string;
  lecturerName?: string; // optional, e.g. "Dr. Adeyemi" — use surname/title only, not full bio
}): string {
  const greeting = opts.lecturerName
    ? `Good day ${formatLecturerName(opts.lecturerName)},`
    : `Good day,`;

  const msg =
    `${greeting} this is a kind reminder that your class ${opts.courseCode} (${opts.courseName}) ` +
    `is scheduled for ${opts.startTime} at ${opts.venue}. ` +
    `Kindly note the time. Thank you. NICTM CS Dept.`;

  if (process.env.NODE_ENV === "development" && msg.length > 160) {
    console.warn(`[Termii] Message is ${msg.length} chars — will use multiple SMS segments.`);
  }
  return msg;
}

/**
 * Builds a single batched SMS listing multiple classes for one lecturer.
 * Used for "night_before" and "morning_of" reminders, where a lecturer with
 * several classes the next day (or same day) would otherwise receive
 * multiple back-to-back texts at the same trigger time — which is both a
 * poor experience and a real risk of carrier flood/anti-spam rejection.
 *
 * "one_hour_before" and "thirty_minutes_before" reminders stay on
 * buildReminderMessage — those rarely collide since classes at different
 * times trigger at different moments.
 */
export function buildDigestMessage(opts: {
  lecturerName?: string;
  reminderType: "night_before" | "morning_of";
  classes: { courseCode: string; startTime: string; venue: string }[];
}): string {
  const greeting = opts.lecturerName
    ? `Good day ${formatLecturerName(opts.lecturerName)},`
    : `Good day,`;

  const intro =
    opts.reminderType === "night_before"
      ? "you have the following classes coming up tomorrow:"
      : "you have the following classes coming up today:";

  const lines = opts.classes
    .map((c, i) => `${i + 1}) ${c.courseCode} ${c.startTime} at ${c.venue}.`)
    .join(" ");

  const msg = `${greeting} ${intro} ${lines} Kindly note the time. Thank you. NICTM CS Dept.`;

  if (process.env.NODE_ENV === "development" && msg.length > 160) {
    console.warn(`[Termii] Digest message is ${msg.length} chars — will use multiple SMS segments.`);
  }
  return msg;
}
