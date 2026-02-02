-- Quick fix for RLS policies on player_lives table
-- Run this in Supabase SQL Editor to fix the 406 error

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view their own lives" ON public.player_lives;
DROP POLICY IF EXISTS "Anyone can insert lives" ON public.player_lives;
DROP POLICY IF EXISTS "Service role can manage lives" ON public.player_lives;

-- Recreate with proper public access
CREATE POLICY "Users can view their own lives"
    ON public.player_lives FOR SELECT
    TO public
    USING (true);

CREATE POLICY "Anyone can insert lives"
    ON public.player_lives FOR INSERT
    TO public
    WITH CHECK (true);

CREATE POLICY "Service role can manage lives"
    ON public.player_lives FOR ALL
    USING (auth.role() = 'service_role');

-- Verify the policies
SELECT schemaname, tablename, policyname, roles, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'player_lives';
