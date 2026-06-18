"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Network } from "@/types";

const NETWORKS: Network[] = ["MTN", "Glo", "Airtel", "9Mobile"];

export function LecturerSettings() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [savingProfile, setSavingProfile] = useState(false);
    const [changingPassword, setChangingPassword] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [passwordMessage, setPasswordMessage] = useState<string | null>(null);
    const [phone, setPhone] = useState("");
    const [network, setNetwork] = useState<Network>("MTN");
    const [reminderPreferences, setReminderPreferences] = useState<string[]>([]);
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");

    useEffect(() => {
        async function loadProfile() {
            const supabase = createClient();
            const { data: userData, error: userError } = await supabase.auth.getUser();
            if (userError || !userData.user) {
                router.push("/login");
                return;
            }

            const { data, error } = await supabase
                .from("profiles")
                .select("phone, network, reminder_preferences")
                .eq("id", userData.user.id)
                .single();

            if (error) {
                setError(error.message || "Unable to load profile details.");
            } else if (data) {
                setPhone(data.phone ?? "");
                setNetwork(data.network ?? "MTN");
                setReminderPreferences(data.reminder_preferences ?? ["one_hour_before"]);
            }
            setLoading(false);
        }

        loadProfile();
    }, [router]);

    async function handleSaveProfile() {
        setError(null);
        setSuccessMessage(null);
        setSavingProfile(true);

        const supabase = createClient();
        const { data: userData, error: userError } = await supabase.auth.getUser();
        if (userError || !userData.user) {
            setSavingProfile(false);
            router.push("/login");
            return;
        }

        const { error } = await supabase
            .from("profiles")
            .update({ phone, network, reminder_preferences: reminderPreferences })
            .eq("id", userData.user.id);

        if (error) {
            setError(error.message || "Failed to save profile settings.");
        } else {
            setSuccessMessage("Your contact details have been updated.");
        }

        setSavingProfile(false);
    }

    async function handleChangePassword() {
        setError(null);
        setPasswordMessage(null);
        if (!password) {
            setPasswordMessage("Enter a new password to continue.");
            return;
        }
        if (password !== confirmPassword) {
            setPasswordMessage("Passwords do not match.");
            return;
        }

        setChangingPassword(true);
        const supabase = createClient();
        const { error } = await supabase.auth.updateUser({ password });

        if (error) {
            setPasswordMessage(error.message || "Unable to change password.");
        } else {
            setPasswordMessage("Password updated successfully.");
            setPassword("");
            setConfirmPassword("");
        }

        setChangingPassword(false);
    }

    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-semibold text-nictm-950">Lecturer Settings</h1>
                    <p className="text-nictm-600 mt-2">Update your phone number, network, and change your password here.</p>
                </div>
            </div>

            <div className="card space-y-6 p-6">
                <div>
                    <h2 className="text-xl font-semibold text-nictm-950">Contact details</h2>
                    <p className="text-sm text-nictm-600 mt-1">These details are used for timetable reminders and admin communication.</p>
                </div>

                {loading ? (
                    <div className="text-nictm-600">Loading profile...</div>
                ) : (
                    <div className="space-y-4">
                        {error ? (
                            <div className="bg-red-50 text-red-700 px-4 py-3 rounded-xl">{error}</div>
                        ) : null}
                        {successMessage ? (
                            <div className="bg-green-50 text-green-700 px-4 py-3 rounded-xl">{successMessage}</div>
                        ) : null}

                        <div>
                            <label className="label">Phone Number</label>
                            <input type="tel" className="input" value={phone}
                                onChange={e => setPhone(e.target.value)} placeholder="08012345678" />
                        </div>

                        <div>
                            <label className="label">Mobile Network</label>
                            <select className="input" value={network} onChange={e => setNetwork(e.target.value as Network)}>
                                {NETWORKS.map(n => <option key={n} value={n}>{n}</option>)}
                            </select>
                        </div>

                        <div>
                            <label className="label">Reminder preferences</label>
                            <div className="grid grid-cols-1 gap-2">
                                <label className="flex items-center gap-2"><input type="checkbox" checked={reminderPreferences.includes('night_before')} onChange={e => {
                                    const next = reminderPreferences.includes('night_before') ? reminderPreferences.filter(x => x !== 'night_before') : [...reminderPreferences, 'night_before'];
                                    setReminderPreferences(next);
                                }} /> Night before (21:00)</label>
                                <label className="flex items-center gap-2"><input type="checkbox" checked={reminderPreferences.includes('morning_of')} onChange={e => {
                                    const next = reminderPreferences.includes('morning_of') ? reminderPreferences.filter(x => x !== 'morning_of') : [...reminderPreferences, 'morning_of'];
                                    setReminderPreferences(next);
                                }} /> Morning of class (07:00)</label>
                                <label className="flex items-center gap-2"><input type="checkbox" checked={reminderPreferences.includes('one_hour_before')} onChange={e => {
                                    const next = reminderPreferences.includes('one_hour_before') ? reminderPreferences.filter(x => x !== 'one_hour_before') : [...reminderPreferences, 'one_hour_before'];
                                    setReminderPreferences(next);
                                }} /> 1 hour before class</label>
                                <label className="flex items-center gap-2"><input type="checkbox" checked={reminderPreferences.includes('thirty_minutes_before')} onChange={e => {
                                    const next = reminderPreferences.includes('thirty_minutes_before') ? reminderPreferences.filter(x => x !== 'thirty_minutes_before') : [...reminderPreferences, 'thirty_minutes_before'];
                                    setReminderPreferences(next);
                                }} /> 30 minutes before class</label>
                            </div>
                        </div>

                        <div className="flex justify-end">
                            <button className="btn-primary" onClick={handleSaveProfile} disabled={savingProfile}>
                                {savingProfile ? "Saving..." : "Save Contact Details"}
                            </button>
                        </div>
                    </div>
                )}
            </div>

            <div className="card space-y-6 p-6">
                <div>
                    <h2 className="text-xl font-semibold text-nictm-950">Password</h2>
                    <p className="text-sm text-nictm-600 mt-1">Change your account password. Your next login will use the new password.</p>
                </div>

                {passwordMessage ? (
                    <div className={`rounded-xl px-4 py-3 ${passwordMessage.startsWith("Password updated") ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
                        {passwordMessage}
                    </div>
                ) : null}

                <div className="space-y-4">
                    <div>
                        <label className="label">New Password</label>
                        <input type="password" className="input" value={password}
                            onChange={e => setPassword(e.target.value)} placeholder="Enter a new password" />
                    </div>
                    <div>
                        <label className="label">Confirm New Password</label>
                        <input type="password" className="input" value={confirmPassword}
                            onChange={e => setConfirmPassword(e.target.value)} placeholder="Repeat the new password" />
                    </div>
                    <div className="flex justify-end">
                        <button className="btn-primary" onClick={handleChangePassword} disabled={changingPassword}>
                            {changingPassword ? "Updating..." : "Change Password"}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
