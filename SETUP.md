# NICTM SMS Timetable Reminder System — Setup Guide

## Prerequisites
- Node.js 16+
- A Supabase project (free tier works)
- A Termii account with a registered Sender ID 

---

## 1. Clone & Install

```bash

cd sms-reminder-system
npm install
```

---

## 2. Supabase Setup

1. Go to [supabase.com](https://supabase.com) → New project
2. In **SQL Editor**, paste and run `supabase/schema.sql`
3. Go to **Authentication → Users → Add User** and create your admin account
4. Back in SQL Editor, run:
   ```sql
   UPDATE public.profiles
   SET role = 'admin', full_name = 'Administrator'
   WHERE email = 'your-admin@nictm.edu.ng';
   ```
5. Copy your project URL, anon key, and service role key from **Settings → API**

---

## 3. Termii Setup

1. Sign up at [termii.com](https://termii.com)
2. Register a Sender ID (e.g., `NICTM`) — approval takes 1–3 business days
3. Copy your API key from the dashboard


https://developers.termii.com/?_gl=1%2a19fwzii%2a_gcl_au%2aMjA4NjY2MTkwLjE3ODA5MjEwMTc.
---

## 4. Environment Variables


```

Fill in `.env.local`: (this is never committed to GitHub but added on Vercel for server building protected from client browser)
```
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
TERMII_API_KEY=TLxxx...
TERMII_SENDER_ID=NICTM
TERMII_BASE_URL=https://api.ng.termii.com/api
TERMII_SMS_CHANNEL=generic
CRON_SECRET=any-long-random-string
```

---

## 5. Run Locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and sign in as admin.

---

## 6. Deploy to Vercel

```bash
npm install -g vercel
vercel
```

Add all `.env.local` variables in **Vercel → Project Settings → Environment Variables**.

Vercel will automatically detect `vercel.json` and enable the cron job
(runs every 5 minutes, calls `/api/cron/send-reminders`).

---

## 7. Test the Cron Manually

In production, call:
```
GET https://your-app.vercel.app/api/cron/send-reminders
Authorization: Bearer <CRON_SECRET>
```

Or add a timetable entry for 30 minutes from now and wait for Vercel Cron to fire.

---

## Folder Structure

```
app/
  login/                  Login page (shared for admin + lecturer)
  admin/                  Admin portal (Dashboard, Timetable, Lecturers, Notifications)
  lecturer/               Lecturer portal (Schedule, Change Requests)
  api/
    admin/                Admin REST API routes
    lecturer/             Lecturer REST API routes
    cron/send-reminders/  Automated SMS dispatch (called by Vercel Cron)
components/
  admin/                  Admin UI components
  lecturer/               Lecturer UI components
  ui/                     Shared atoms (Badge, Modal, StatCard)
lib/
  supabase/               Supabase client helpers (browser + server + admin)
  termii.ts               Termii SMS utility
types/                    Shared TypeScript interfaces
supabase/
  schema.sql              Full database schema + RLS policies
  seed.sql                Optional test data
```




## Optional: We added a simple Supabase-backed assistant

This assistant is intentionally simple and free of paid LLMs. It uses user text input, cleans it, matches keywords with regex, runs safe Supabase lookups, and returns a short response.

### What it does
- User submits a message in the chat panel.
- The app normalizes the text and checks for keyword patterns.
- It uses Supabase authorized queries to read matching rows from your tables.
- It returns a short answer like "today's classes", "pending requests", or "SMS counts".

### Why this is useful
- No third-party LLM billing needed.
- No AI API key storage required.
- The assistant works with your existing Supabase data and tables.
- Good for FAQ-style support, schedule lookup, and admin summaries.

### Files added
- `app/api/chat/route.ts`: keyword matching and Supabase query handler.
- `components/ui/ChatWidget.tsx`: simple chat bubble panel.
- `app/lecturer/page.tsx`: embeds the chat widget on the lecturer dashboard.

### How it works
1. User types a message like:
   - "What classes do I have today?"
   - "Do I have pending change requests?"
   - "How many SMS messages were delivered?"
2. The backend normalizes text to lower-case clean input.
3. It matches patterns with regular expressions.
4. It runs Supabase queries against `timetable`, `change_requests`, or `notifications`.
5. It returns a plain text reply.

### Setup
1. No extra API keys are required.
2. Just deploy the new `app/api/chat/route.ts` route with the project.
3. The route uses your current Supabase auth session for the signed-in user.
4. If you want the route to also support admin-only metrics, it checks the user role in `profiles`.

### Notes
- This is not a generative AI assistant; it is a rules-based helper.
- It is ideal when you want control, privacy, and no paid model costs.
- You can extend the regex patterns later for more question types.

### Example questions it supports
- "What classes do I have today?"
- "Do I have any pending requests?"
- "How many SMS notifications have been delivered?"
- "How many lecturers are registered?" (admin only)

### Cost
- This setup is effectively free.
- It only uses your Supabase project reads, which are covered by the free tier if you stay within its limits.
- If you exceed Supabase free tier usage, you may pay the normal Supabase database/read pricing, but there is no external AI billing.

### If you want to customize it
- Add more regex rules for specific question types.
- Extend the backend to search `course_name`, `venue`, or `notification` text.
- Add more context in the frontend chat panel, like recent suggestions or style.


## Cron-job.org setup

Use your existing cron-job.org account to call this app route on a schedule:

- URL: `https://<your-app>.vercel.app/api/cron/send-reminders`
- Method: `GET`
- Headers:
  - `Authorization: Bearer <CRON_SECRET>`

### Recommended schedule
- Every `5 minutes`

### Why
- The app route checks `Authorization` to protect the cron endpoint.
- If the header is missing, the request will be rejected.

### Example configuration
- Job type: HTTP(s)
- Request type: `GET`
- Target URL: `https://<your-app>.vercel.app/api/cron/send-reminders`
- Add header:
  - `Authorization`
  - `Bearer your-secret-string`

### Test it manually first
```bash
curl -H "Authorization: Bearer your-secret-string" \
  https://<your-app>.vercel.app/api/cron/send-reminders
```

### If cron-job.org can’t send headers
If cron-job.org somehow does not support custom headers in your plan, I can help modify the route to also accept:
- `https://<your-app>.vercel.app/api/cron/send-reminders?secret=your-secret-string`

> For now, use the header-based setup because the app is already built to require `Authorization: Bearer <CRON_SECRET>`.