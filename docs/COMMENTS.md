# Assignment comments

Comments are stored in the Supabase `task_comments` table and are intentionally not included in the Google Sheets mirror.

Apply `supabase/migrations/20260914000000_create_task_comments.sql` to the Supabase project before using the feature in API mode. Each comment stores the assignment ID, author type, selected consultant/programmer ID, text, and creation time.

Because the MVP does not have login yet, the author is selected by name in the assignment detail screen. This is convenient for the current workflow, but it is not identity verification. The migration therefore allows anonymous reads and inserts; authentication and stricter RLS should be added before exposing the app outside the trusted internal environment.

The detail screen refreshes comments every 15 seconds while open. Multiline text is preserved in the timeline.
