update storage.buckets
set
  file_size_limit = case id
    when 'event-images' then 2097152
    when 'avatars' then 1048576
    else file_size_limit
  end,
  allowed_mime_types = array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/avif'
  ]
where id in ('event-images', 'avatars');
