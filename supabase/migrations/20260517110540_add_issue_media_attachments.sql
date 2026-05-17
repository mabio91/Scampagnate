ALTER TABLE public.issues
  ADD COLUMN IF NOT EXISTS media_attachments jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.issues.media_attachments IS
  'Array of media attachment metadata for issue reports. Objects store private Storage paths plus media type, MIME type, original name, and size.';

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'issue-media',
  'issue-media',
  false,
  52428800,
  ARRAY[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'video/mp4',
    'video/quicktime',
    'video/webm'
  ]
)
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Users can upload own issue media'
  ) THEN
    CREATE POLICY "Users can upload own issue media"
    ON storage.objects
    FOR INSERT
    TO authenticated
    WITH CHECK (
      bucket_id = 'issue-media'
      AND (storage.foldername(name))[1] = auth.uid()::text
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Users and admins can view issue media'
  ) THEN
    CREATE POLICY "Users and admins can view issue media"
    ON storage.objects
    FOR SELECT
    TO authenticated
    USING (
      bucket_id = 'issue-media'
      AND (
        (storage.foldername(name))[1] = auth.uid()::text
        OR public.has_role(auth.uid(), 'admin'::public.app_role)
      )
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Users can delete own issue media'
  ) THEN
    CREATE POLICY "Users can delete own issue media"
    ON storage.objects
    FOR DELETE
    TO authenticated
    USING (
      bucket_id = 'issue-media'
      AND (storage.foldername(name))[1] = auth.uid()::text
    );
  END IF;
END $$;
