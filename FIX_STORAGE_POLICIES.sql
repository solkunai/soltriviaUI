-- Fix Storage Bucket RLS Policies for Avatars
-- ⚠️ IMPORTANT: Storage policies CANNOT be created via SQL in Supabase
-- You MUST use the Supabase Dashboard UI to create storage bucket policies
-- This file contains the policy definitions for reference

-- ============================================
-- STEP 1: Create the 'avatars' bucket (via Dashboard)
-- ============================================
-- 1. Go to Supabase Dashboard -> Storage -> Buckets
-- 2. Click "New bucket"
-- 3. Configure:
--    - Name: avatars
--    - Public bucket: ✅ CHECKED (important!)
--    - File size limit: 2MB
--    - Allowed MIME types: image/*
-- 4. Click "Create bucket"

-- ============================================
-- STEP 2: Create Storage Policies (via Dashboard)
-- ============================================
-- After creating the bucket, go to Storage -> Policies
-- Or click on the 'avatars' bucket -> Policies tab
-- Then create these policies one by one:

-- POLICY 1: Public can view avatars
-- Policy Name: "Public can view avatars"
-- Allowed operation: SELECT
-- Policy definition:
--   USING: bucket_id = 'avatars'

-- POLICY 2: Anyone can upload avatars
-- Policy Name: "Anyone can upload avatars"
-- Allowed operation: INSERT
-- Policy definition:
--   WITH CHECK: bucket_id = 'avatars'

-- POLICY 3: Users can update avatars
-- Policy Name: "Users can update avatars"
-- Allowed operation: UPDATE
-- Policy definition:
--   USING: bucket_id = 'avatars'
--   WITH CHECK: bucket_id = 'avatars'

-- POLICY 4: Users can delete avatars
-- Policy Name: "Users can delete avatars"
-- Allowed operation: DELETE
-- Policy definition:
--   USING: bucket_id = 'avatars'

-- ============================================
-- ALTERNATIVE: Use Supabase CLI (if you have access)
-- ============================================
-- If you have Supabase CLI with proper permissions, you can use:
-- supabase storage create avatars --public
-- But policies still need to be set via Dashboard or API

-- ============================================
-- Verification
-- ============================================
-- After running this script, verify the policies:
-- SELECT * FROM pg_policies WHERE tablename = 'objects' AND schemaname = 'storage';

-- Test the bucket:
-- 1. Go to Storage -> avatars bucket
-- 2. Try uploading a test image
-- 3. Check if it appears in the bucket
