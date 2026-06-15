-- ==========================================================
-- Optional seed data for development/testing
-- Run AFTER schema.sql and AFTER creating your admin user
-- ==========================================================

-- Step 1: Create your admin user via Supabase Auth dashboard first
-- Step 2: Run this to set their role:
-- UPDATE public.profiles SET role = 'admin', full_name = 'Administrator'
-- WHERE email = 'admin@nictm.edu.ng';

-- Step 3: Create test lecturer accounts via the app (Admin > Lecturers > Add Lecturer)
-- Then manually insert a few timetable entries to test the cron:

-- Example data (replace lecturer UUIDs with real ones from your profiles table):
/*
INSERT INTO public.timetable (course_code, course_name, lecturer_id, day_of_week, start_time, end_time, venue)
VALUES
  ('COM 111', 'Computer Programming I',       '<lecturer-uuid-1>', 'Monday',    '08:00', '10:00', 'Lab A'),
  ('MTH 111', 'Mathematics for Computing I',  '<lecturer-uuid-2>', 'Monday',    '10:00', '12:00', 'LT 1'),
  ('COM 201', 'Data Structures & Algorithms', '<lecturer-uuid-3>', 'Tuesday',   '08:00', '10:00', 'LT 2'),
  ('COM 211', 'Database Management Systems',  '<lecturer-uuid-4>', 'Tuesday',   '11:00', '13:00', 'Lab B'),
  ('COM 221', 'Operating Systems',            '<lecturer-uuid-5>', 'Wednesday', '09:00', '11:00', 'LT 3'),
  ('COM 231', 'Computer Networks',            '<lecturer-uuid-6>', 'Wednesday', '13:00', '15:00', 'LT 1'),
  ('COM 121', 'Computer Programming II',      '<lecturer-uuid-1>', 'Thursday',  '08:00', '10:00', 'Lab A'),
  ('STA 111', 'Statistics for Computing',     '<lecturer-uuid-2>', 'Thursday',  '10:00', '12:00', 'LT 2'),
  ('MTH 121', 'Mathematics for Computing II', '<lecturer-uuid-3>', 'Friday',    '09:00', '11:00', 'LT 1'),
  ('COM 201', 'Data Structures & Algorithms', '<lecturer-uuid-4>', 'Friday',    '11:00', '13:00', 'Lab B');
*/
