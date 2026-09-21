create table if not exists public.task_comments (
  comment_id text primary key default ('CMT-' || replace(gen_random_uuid()::text, '-', '')),
  task_id text not null references public.tasks(task_id) on delete cascade,
  author_type text not null check (author_type in ('Consultant', 'Programmer')),
  author_id text not null,
  comment_text text not null check (length(btrim(comment_text)) > 0),
  created_at timestamptz not null default now()
);

create index if not exists task_comments_task_created_idx
  on public.task_comments (task_id, created_at);

alter table public.task_comments enable row level security;

drop policy if exists "Anonymous users can read task comments" on public.task_comments;
create policy "Anonymous users can read task comments"
  on public.task_comments for select using (true);

drop policy if exists "Anonymous users can add task comments" on public.task_comments;
create policy "Anonymous users can add task comments"
  on public.task_comments for insert with check (true);
