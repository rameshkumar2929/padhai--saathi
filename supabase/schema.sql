create extension if not exists pgcrypto;

create table if not exists public.student_doubts (
  id uuid primary key default gen_random_uuid(),
  nickname text not null default 'Student' check (char_length(nickname) <= 24),
  grade text not null check (grade in ('8', '9', '10')),
  subject text not null check (subject in ('math', 'science')),
  question text not null check (char_length(question) <= 1200),
  answer text not null check (char_length(answer) <= 2400),
  status text not null default 'new' check (status in ('new', 'answered')),
  created_at timestamptz not null default now()
);

alter table public.student_doubts enable row level security;
