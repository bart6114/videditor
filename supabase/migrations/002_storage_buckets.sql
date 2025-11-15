-- Create storage buckets for videos and shorts
insert into storage.buckets (id, name, public)
values
  ('videos', 'videos', false),
  ('shorts', 'shorts', false),
  ('thumbnails', 'thumbnails', true);

-- Storage policies for videos bucket
create policy "Users can upload their own videos"
  on storage.objects for insert
  with check (
    bucket_id = 'videos'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Users can view their own videos"
  on storage.objects for select
  using (
    bucket_id = 'videos'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Users can update their own videos"
  on storage.objects for update
  using (
    bucket_id = 'videos'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Users can delete their own videos"
  on storage.objects for delete
  using (
    bucket_id = 'videos'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- Storage policies for shorts bucket
create policy "Users can view their own shorts"
  on storage.objects for select
  using (
    bucket_id = 'shorts'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Service role can manage shorts"
  on storage.objects for all
  using (bucket_id = 'shorts');

-- Storage policies for thumbnails bucket (public)
create policy "Anyone can view thumbnails"
  on storage.objects for select
  using (bucket_id = 'thumbnails');

create policy "Service role can manage thumbnails"
  on storage.objects for all
  using (bucket_id = 'thumbnails');
