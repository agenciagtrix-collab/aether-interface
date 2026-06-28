CREATE POLICY "Users read own project files" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'projects' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users insert own project files" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'projects' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users update own project files" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'projects' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users delete own project files" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'projects' AND auth.uid()::text = (storage.foldername(name))[1]);