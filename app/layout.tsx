import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "NICTM SMS Reminder System",
  description: "Automated SMS Timetable Reminder — CS Department, NICTM Uromi",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
