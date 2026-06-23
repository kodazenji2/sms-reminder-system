export type UserRole = "admin" | "lecturer"
export type DayOfWeek = "Monday" | "Tuesday" | "Wednesday" | "Thursday" | "Friday"
export type Network = "MTN" | "Glo" | "Airtel" | "9Mobile"
export type RequestStatus = "pending" | "approved" | "rejected"
export type NotificationStatus = "delivered" | "failed" | "pending"
export type ChangeRequestType = "one_off" | "permanent"

export interface Profile {
  id: string
  full_name: string
  phone: string | null
  email: string | null
  role: UserRole
  active: boolean
  network: Network | null
  reminder_preferences?: string[]
  created_at: string
}

export interface TimetableEntry {
  id: string
  course_code: string
  course_name: string
  lecturer_id: string
  day_of_week: DayOfWeek
  start_time: string
  end_time: string
  venue: string | null
  active: boolean
  created_at: string
  updated_at: string
  lecturer?: Profile
}

export interface ChangeRequest {
  id: string
  lecturer_id: string
  timetable_id: string
  request_type: ChangeRequestType
  reason: string
  requested_date: string | null
  requested_day_of_week: DayOfWeek | null
  requested_start_time: string | null
  status: RequestStatus
  admin_note: string | null
  created_at: string
  lecturer?: Profile
  timetable_entry?: TimetableEntry
}

export interface Notification {
  id: string
  lecturer_id: string
  timetable_id: string | null
  phone: string
  message: string
  status: NotificationStatus
  reminder_type?: string
  termii_message_id: string | null
  sent_at: string
  class_date: string | null
  lecturer?: Profile
  timetable_entry?: TimetableEntry
}
