-- Seed practice_questions table with 250 questions
-- This data is separate from the paid game questions

-- Note: To insert this data, you'll need to run the practice-questions.json through a script
-- or manually insert via Supabase dashboard by importing the JSON file

-- For now, this file serves as documentation that the table should be seeded
-- with the questions from practice-questions.json

-- To seed from JSON:
-- 1. Go to Supabase Dashboard → Table Editor → practice_questions
-- 2. Click "Insert" → "Import data from CSV/JSON"
-- 3. Upload practice-questions.json
-- 4. Map columns: category, difficulty, text, options, correct_index

COMMENT ON TABLE practice_questions IS 'Seed this table with data from practice-questions.json (250 questions covering Solana ecosystem, memecoins, influencers, OG lore, DeFi, and degen culture)';
