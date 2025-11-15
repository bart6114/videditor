-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Projects table
create table public.projects (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users not null,
  title text not null,
  video_url text not null,
  thumbnail_url text,
  duration numeric not null,
  file_size bigint not null,
  status text not null check (status in ('uploading', 'processing', 'transcribing', 'analyzing', 'completed', 'error')),
  error_message text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Transcriptions table
create table public.transcriptions (
  id uuid default uuid_generate_v4() primary key,
  project_id uuid references public.projects on delete cascade not null,
  text text not null,
  segments jsonb not null,
  language text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Shorts table
create table public.shorts (
  id uuid default uuid_generate_v4() primary key,
  project_id uuid references public.projects on delete cascade not null,
  title text not null,
  description text not null,
  start_time numeric not null,
  end_time numeric not null,
  video_url text,
  thumbnail_url text,
  status text not null check (status in ('pending', 'processing', 'completed', 'error')),
  error_message text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Processing jobs table
create table public.processing_jobs (
  id uuid default uuid_generate_v4() primary key,
  project_id uuid references public.projects on delete cascade not null,
  type text not null check (type in ('transcription', 'analysis', 'video_cut')),
  status text not null check (status in ('pending', 'processing', 'completed', 'error')),
  progress numeric default 0,
  error_message text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable Row Level Security
alter table public.projects enable row level security;
alter table public.transcriptions enable row level security;
alter table public.shorts enable row level security;
alter table public.processing_jobs enable row level security;

-- RLS Policies for projects
create policy "Users can view their own projects"
  on public.projects for select
  using (auth.uid() = user_id);

create policy "Users can insert their own projects"
  on public.projects for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own projects"
  on public.projects for update
  using (auth.uid() = user_id);

create policy "Users can delete their own projects"
  on public.projects for delete
  using (auth.uid() = user_id);

-- RLS Policies for transcriptions
create policy "Users can view transcriptions of their projects"
  on public.transcriptions for select
  using (exists (
    select 1 from public.projects
    where projects.id = transcriptions.project_id
    and projects.user_id = auth.uid()
  ));

create policy "Service role can insert transcriptions"
  on public.transcriptions for insert
  with check (true);

-- RLS Policies for shorts
create policy "Users can view shorts of their projects"
  on public.shorts for select
  using (exists (
    select 1 from public.projects
    where projects.id = shorts.project_id
    and projects.user_id = auth.uid()
  ));

create policy "Users can insert shorts for their projects"
  on public.shorts for insert
  with check (exists (
    select 1 from public.projects
    where projects.id = shorts.project_id
    and projects.user_id = auth.uid()
  ));

create policy "Users can update shorts of their projects"
  on public.shorts for update
  using (exists (
    select 1 from public.projects
    where projects.id = shorts.project_id
    and projects.user_id = auth.uid()
  ));

create policy "Users can delete shorts of their projects"
  on public.shorts for delete
  using (exists (
    select 1 from public.projects
    where projects.id = shorts.project_id
    and projects.user_id = auth.uid()
  ));

-- RLS Policies for processing_jobs
create policy "Users can view processing jobs of their projects"
  on public.processing_jobs for select
  using (exists (
    select 1 from public.projects
    where projects.id = processing_jobs.project_id
    and projects.user_id = auth.uid()
  ));

create policy "Service role can manage processing jobs"
  on public.processing_jobs for all
  using (true);

-- Indexes for better performance
create index projects_user_id_idx on public.projects(user_id);
create index projects_status_idx on public.projects(status);
create index transcriptions_project_id_idx on public.transcriptions(project_id);
create index shorts_project_id_idx on public.shorts(project_id);
create index shorts_status_idx on public.shorts(status);
create index processing_jobs_project_id_idx on public.processing_jobs(project_id);
create index processing_jobs_status_idx on public.processing_jobs(status);

-- Function to update updated_at timestamp
create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$ language plpgsql;

-- Triggers for updated_at
create trigger update_projects_updated_at before update on public.projects
  for each row execute function update_updated_at_column();

create trigger update_shorts_updated_at before update on public.shorts
  for each row execute function update_updated_at_column();

create trigger update_processing_jobs_updated_at before update on public.processing_jobs
  for each row execute function update_updated_at_column();
