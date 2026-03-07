
-- Create event-images storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('event-images', 'event-images', true);

-- Allow authenticated users to upload event images
CREATE POLICY "Authenticated users can upload event images"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'event-images');

-- Allow anyone to view event images
CREATE POLICY "Anyone can view event images"
ON storage.objects FOR SELECT
USING (bucket_id = 'event-images');

-- Allow users to update their own uploads
CREATE POLICY "Users can update own event images"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'event-images' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Allow users to delete their own uploads
CREATE POLICY "Users can delete own event images"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'event-images' AND (storage.foldername(name))[1] = auth.uid()::text);
