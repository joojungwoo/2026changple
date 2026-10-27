-- =========================================================================
-- 한걸음 · 수파베이스 표와 보안 규칙
--
--  수파베이스 대시보드 → SQL Editor → 이 파일 전체를 붙여 넣고 Run.
--  여러 번 실행해도 괜찮아요.
--
--  표
--   profiles          로그인한 사람에게 보여도 되는 것: 아이디 · 이름 · 역할 · 학년 · 운동 기능
--   profile_private   나와 내 지도자만: 생년월일 · 동의 시각
--   leader_students   지도자 ↔ 학생 연결
--   learning_data     학생의 학습 기록 · 복습 · 텃밭 (JSON 하나)
--   inquiries         지도자 문의
--   messages          학생끼리 1대1 채팅
--   chat_reads        친구마다 어디까지 읽었는지
--
--  아이디 로그인: 아이디를 "아이디@<도메인>" 모양의 가짜 이메일로 바꿔 수파베이스 Auth에 가입해요.
--  메일은 보내지 않으니 Authentication → Sign In / Providers → Email 에서 "Confirm email"을 꺼 주세요.
-- =========================================================================

-- ------------------------------ 표 ------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  login_id text not null unique check (login_id ~ '^[a-z0-9_]{4,20}$'),
  role text not null check (role in ('student', 'leader')),
  name text not null check (char_length(name) between 1 and 20),
  grade int not null default 1 check (grade between 1 and 3),
  motion boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.profile_private (
  id uuid primary key references public.profiles (id) on delete cascade,
  birth date,
  agreed_at timestamptz not null default now()
);

create table if not exists public.leader_students (
  leader_id uuid not null references public.profiles (id) on delete cascade,
  student_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (leader_id, student_id)
);

create table if not exists public.learning_data (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.inquiries (
  id bigint generated always as identity primary key,
  leader_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  text text not null check (char_length(text) between 1 and 500),
  created_at timestamptz not null default now()
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  text text not null check (char_length(text) between 1 and 60),
  created_at timestamptz not null default now(),
  check (sender_id <> recipient_id)
);
create index if not exists messages_sender_idx on public.messages (sender_id, created_at desc);
create index if not exists messages_recipient_idx on public.messages (recipient_id, created_at desc);

create table if not exists public.chat_reads (
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  friend_id uuid not null references public.profiles (id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (user_id, friend_id)
);

-- ------------------------------ 도우미 함수 ------------------------------
create or replace function public.my_role() returns text
language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid()
$$;

create or replace function public.is_my_student(sid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.leader_students where leader_id = auth.uid() and student_id = sid)
$$;

create or replace function public.is_student(uid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = uid and role = 'student')
$$;

-- 가입할 때 넘긴 정보(아이디 · 이름 · 역할 · 생년월일)로 프로필을 만들어요.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  m jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  r text := coalesce(m ->> 'role', 'student');
  b date := nullif(m ->> 'birth', '')::date;
  g int := 1;
begin
  if b is not null then
    g := least(3, greatest(1, extract(year from now())::int - extract(year from b)::int - 6));
  end if;
  insert into public.profiles (id, login_id, role, name, grade)
  values (new.id, lower(m ->> 'login_id'), r, left(trim(m ->> 'name'), 20), g);
  insert into public.profile_private (id, birth) values (new.id, b);
  if r = 'student' then
    insert into public.learning_data (user_id) values (new.id);
  end if;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- 지도자: 학생 아이디로 내 학생 목록에 추가
create or replace function public.add_student(lid text) returns public.profiles
language plpgsql security definer set search_path = public as $$
declare s public.profiles;
begin
  if public.my_role() is distinct from 'leader' then raise exception 'not-leader'; end if;
  select * into s from public.profiles where login_id = lower(trim(lid)) and role = 'student';
  if s.id is null then raise exception 'no-student'; end if;
  if public.is_my_student(s.id) then raise exception 'already'; end if;
  insert into public.leader_students (leader_id, student_id) values (auth.uid(), s.id);
  return s;
end $$;

-- 지도자: 내 학생의 집중력 환기(운동) 기능 켜고 끄기
create or replace function public.set_student_motion(sid uuid, on_ boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_my_student(sid) then raise exception 'not-my-student'; end if;
  update public.profiles set motion = on_ where id = sid;
end $$;

-- 너무 빨리 보내지 못하게 서버에서도 막아요. (1초에 한 번) 보낸 시각은 서버 시계로 정해요.
create or replace function public.messages_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from public.messages where sender_id = new.sender_id and created_at > now() - interval '1 second') then
    raise exception 'too-fast';
  end if;
  new.created_at := now();
  return new;
end $$;
drop trigger if exists messages_guard on public.messages;
create trigger messages_guard before insert on public.messages
  for each row execute function public.messages_guard();

-- 학습 기록을 저장한 시각도 서버 시계로 정해요.
create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$ begin new.updated_at := now(); return new; end $$;
drop trigger if exists learning_data_touch on public.learning_data;
create trigger learning_data_touch before insert or update on public.learning_data
  for each row execute function public.touch_updated_at();

-- ------------------------------ 보안 규칙 (RLS) ------------------------------
alter table public.profiles enable row level security;
alter table public.profile_private enable row level security;
alter table public.leader_students enable row level security;
alter table public.learning_data enable row level security;
alter table public.inquiries enable row level security;
alter table public.messages enable row level security;
alter table public.chat_reads enable row level security;

-- 로그인한 사람만 이름 · 아이디를 볼 수 있어요. (채팅 친구 목록) 바꾸기는 위 함수로만 해요.
drop policy if exists "profiles read" on public.profiles;
create policy "profiles read" on public.profiles for select to authenticated using (true);

drop policy if exists "private read" on public.profile_private;
create policy "private read" on public.profile_private for select to authenticated
  using (id = auth.uid() or public.is_my_student(id));

drop policy if exists "links read" on public.leader_students;
create policy "links read" on public.leader_students for select to authenticated
  using (leader_id = auth.uid() or student_id = auth.uid());
drop policy if exists "links delete" on public.leader_students;
create policy "links delete" on public.leader_students for delete to authenticated
  using (leader_id = auth.uid());

drop policy if exists "data read" on public.learning_data;
create policy "data read" on public.learning_data for select to authenticated
  using (user_id = auth.uid() or public.is_my_student(user_id));
drop policy if exists "data insert" on public.learning_data;
create policy "data insert" on public.learning_data for insert to authenticated
  with check (user_id = auth.uid());
drop policy if exists "data update" on public.learning_data;
create policy "data update" on public.learning_data for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "inquiries read" on public.inquiries;
create policy "inquiries read" on public.inquiries for select to authenticated
  using (leader_id = auth.uid());
drop policy if exists "inquiries insert" on public.inquiries;
create policy "inquiries insert" on public.inquiries for insert to authenticated
  with check (leader_id = auth.uid() and public.my_role() = 'leader');

-- 채팅: 주고받은 두 사람만 읽어요. 학생끼리만, 내 이름으로만 보낼 수 있어요. 고치기 · 지우기는 없어요.
drop policy if exists "messages read" on public.messages;
create policy "messages read" on public.messages for select to authenticated
  using (sender_id = auth.uid() or recipient_id = auth.uid());
drop policy if exists "messages insert" on public.messages;
create policy "messages insert" on public.messages for insert to authenticated
  with check (sender_id = auth.uid() and public.my_role() = 'student' and public.is_student(recipient_id));

drop policy if exists "reads all" on public.chat_reads;
create policy "reads all" on public.chat_reads for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ------------------------------ 권한 ------------------------------
revoke all on all tables in schema public from anon;
revoke all on public.profiles, public.profile_private, public.leader_students, public.learning_data,
  public.inquiries, public.messages, public.chat_reads from authenticated;
grant select on public.profiles to authenticated;
grant select on public.profile_private to authenticated;
grant select, delete on public.leader_students to authenticated;
grant select, insert, update on public.learning_data to authenticated;
grant select, insert on public.inquiries to authenticated;
grant select, insert on public.messages to authenticated;
grant select, insert, update, delete on public.chat_reads to authenticated;

revoke execute on function public.add_student(text), public.set_student_motion(uuid, boolean) from anon, public;
grant execute on function public.add_student(text), public.set_student_motion(uuid, boolean) to authenticated;

-- ------------------------------ 실시간 ------------------------------
-- 새 메시지를 바로 받아요. (RLS가 적용돼서 내 메시지만 와요)
do $$ begin
  alter publication supabase_realtime add table public.messages;
exception when duplicate_object then null; end $$;

-- 접속 중인 친구(Presence)는 로그인한 사람만 "online" 채널에서 볼 수 있어요.
drop policy if exists "online presence read" on realtime.messages;
create policy "online presence read" on realtime.messages for select to authenticated
  using (realtime.topic() = 'online');
drop policy if exists "online presence write" on realtime.messages;
create policy "online presence write" on realtime.messages for insert to authenticated
  with check (realtime.topic() = 'online');
