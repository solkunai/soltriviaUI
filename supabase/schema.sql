-- SOL Trivia Database Schema
-- Run this in your Supabase SQL editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ══════════════════════════════════════════════════════════════════════════════
-- PLAYERS TABLE
-- Stores player profiles linked to wallet addresses
-- ══════════════════════════════════════════════════════════════════════════════
CREATE TABLE players (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  wallet_address TEXT UNIQUE NOT NULL,
  display_name TEXT,
  avatar TEXT DEFAULT '🎮',
  avatar_bg_color TEXT DEFAULT '#9945FF',
  avatar_image_url TEXT,
  total_winnings_lamports BIGINT DEFAULT 0,
  games_played INTEGER DEFAULT 0,
  games_won INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_players_wallet ON players(wallet_address);

-- ══════════════════════════════════════════════════════════════════════════════
-- ROUNDS TABLE
-- Each round is a 6-hour trivia game
-- ══════════════════════════════════════════════════════════════════════════════
CREATE TABLE rounds (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  round_number INTEGER NOT NULL,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  pot_lamports BIGINT DEFAULT 0,
  entry_count INTEGER DEFAULT 0,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'ended', 'paid_out', 'refunded')),
  min_players INTEGER DEFAULT 5,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_rounds_status ON rounds(status);
CREATE INDEX idx_rounds_ends_at ON rounds(ends_at);

-- ══════════════════════════════════════════════════════════════════════════════
-- GAME SESSIONS TABLE
-- Each entry into a round by a player
-- ══════════════════════════════════════════════════════════════════════════════
CREATE TABLE game_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  round_id UUID REFERENCES rounds(id) ON DELETE CASCADE,
  player_id UUID REFERENCES players(id) ON DELETE CASCADE,
  wallet_address TEXT NOT NULL,
  entry_tx_signature TEXT NOT NULL,
  score INTEGER DEFAULT 0,
  correct_count INTEGER DEFAULT 0,
  total_questions INTEGER DEFAULT 10,
  time_taken_ms INTEGER DEFAULT 0,
  rank INTEGER,
  current_question_index INTEGER DEFAULT 0,
  current_question_token TEXT,
  current_question_issued_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ, -- When quiz was finished (for anti-cheat)
  UNIQUE(round_id, wallet_address)
);

CREATE INDEX idx_game_sessions_round ON game_sessions(round_id);
CREATE INDEX idx_game_sessions_player ON game_sessions(player_id);
CREATE INDEX idx_game_sessions_score ON game_sessions(round_id, score DESC);

-- ══════════════════════════════════════════════════════════════════════════════
-- QUESTIONS TABLE
-- Question bank for trivia
-- ══════════════════════════════════════════════════════════════════════════════
CREATE TABLE questions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  category TEXT NOT NULL,
  question TEXT NOT NULL,
  answers JSONB NOT NULL, -- Array of 4 answer options
  correct_index INTEGER NOT NULL CHECK (correct_index >= 0 AND correct_index <= 3),
  difficulty TEXT DEFAULT 'medium' CHECK (difficulty IN ('easy', 'medium', 'hard')),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_questions_category ON questions(category);
CREATE INDEX idx_questions_active ON questions(is_active);

-- ══════════════════════════════════════════════════════════════════════════════
-- ANSWERS TABLE
-- Individual question answers within a game session
-- ══════════════════════════════════════════════════════════════════════════════
CREATE TABLE answers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID REFERENCES game_sessions(id) ON DELETE CASCADE,
  question_id UUID REFERENCES questions(id),
  question_index INTEGER NOT NULL,
  selected_index INTEGER,
  is_correct BOOLEAN,
  points_earned INTEGER DEFAULT 0,
  time_taken_ms INTEGER,
  token TEXT, -- Anti-cheat: token used for this answer
  issued_at TIMESTAMPTZ, -- Anti-cheat: when question was issued
  answered_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_answers_session ON answers(session_id);

-- ══════════════════════════════════════════════════════════════════════════════
-- PAYOUTS TABLE
-- Track winnings and claim status
-- ══════════════════════════════════════════════════════════════════════════════
CREATE TABLE payouts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  round_id UUID REFERENCES rounds(id) ON DELETE CASCADE,
  player_id UUID REFERENCES players(id) ON DELETE CASCADE,
  wallet_address TEXT NOT NULL,
  rank INTEGER NOT NULL,
  amount_lamports BIGINT NOT NULL,
  percentage DECIMAL(5,2) NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'claimed', 'failed')),
  claim_tx_signature TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  claimed_at TIMESTAMPTZ,
  UNIQUE(round_id, player_id)
);

CREATE INDEX idx_payouts_player ON payouts(player_id);
CREATE INDEX idx_payouts_status ON payouts(status);
CREATE INDEX idx_payouts_wallet ON payouts(wallet_address);
CREATE INDEX idx_payouts_pending ON payouts(wallet_address, status) WHERE status = 'pending';

-- Additional indexes for performance
CREATE INDEX idx_game_sessions_wallet ON game_sessions(wallet_address);
CREATE INDEX idx_game_sessions_completed ON game_sessions(round_id, completed_at) WHERE completed_at IS NOT NULL;

-- ══════════════════════════════════════════════════════════════════════════════
-- PLAYER STATS TABLE
-- Track player statistics and streaks
-- ══════════════════════════════════════════════════════════════════════════════
CREATE TABLE player_stats (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  wallet_address TEXT UNIQUE NOT NULL REFERENCES players(wallet_address),
  games_played INTEGER DEFAULT 0,
  total_score BIGINT DEFAULT 0,
  best_score INTEGER DEFAULT 0,
  current_streak INTEGER DEFAULT 0,
  longest_streak INTEGER DEFAULT 0,
  last_played_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_player_stats_wallet ON player_stats(wallet_address);
CREATE INDEX idx_player_stats_best_score ON player_stats(best_score DESC);
CREATE INDEX idx_player_stats_total_score ON player_stats(total_score DESC);

-- ══════════════════════════════════════════════════════════════════════════════
-- TREASURY TRANSACTIONS TABLE
-- Track all treasury movements
-- ══════════════════════════════════════════════════════════════════════════════
CREATE TABLE treasury_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  round_id UUID REFERENCES rounds(id),
  type TEXT NOT NULL CHECK (type IN ('entry_fee', 'platform_fee', 'payout')),
  amount_lamports BIGINT NOT NULL,
  wallet_address TEXT,
  tx_signature TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ══════════════════════════════════════════════════════════════════════════════
-- FUNCTIONS
-- ══════════════════════════════════════════════════════════════════════════════

-- Function to get current active round
CREATE OR REPLACE FUNCTION get_current_round()
RETURNS TABLE (
  id UUID,
  round_number INTEGER,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  pot_lamports BIGINT,
  entry_count INTEGER,
  status TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT r.id, r.round_number, r.starts_at, r.ends_at, r.pot_lamports, r.entry_count, r.status
  FROM rounds r
  WHERE r.status = 'active' AND NOW() BETWEEN r.starts_at AND r.ends_at
  ORDER BY r.starts_at DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate and update rankings for a round
CREATE OR REPLACE FUNCTION calculate_rankings(p_round_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE game_sessions gs
  SET rank = ranked.rank
  FROM (
    SELECT
      id,
      ROW_NUMBER() OVER (ORDER BY score DESC, time_taken_ms ASC) as rank
    FROM game_sessions
    WHERE round_id = p_round_id AND completed_at IS NOT NULL
  ) ranked
  WHERE gs.id = ranked.id;
END;
$$ LANGUAGE plpgsql;

-- Function to get leaderboard for a round
CREATE OR REPLACE FUNCTION get_round_leaderboard(p_round_id UUID, p_limit INTEGER DEFAULT 50)
RETURNS TABLE (
  rank INTEGER,
  wallet_address TEXT,
  display_name TEXT,
  avatar TEXT,
  avatar_bg_color TEXT,
  score INTEGER,
  correct_count INTEGER,
  time_taken_ms INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    gs.rank,
    gs.wallet_address,
    p.display_name,
    p.avatar,
    p.avatar_bg_color,
    gs.score,
    gs.correct_count,
    gs.time_taken_ms
  FROM game_sessions gs
  LEFT JOIN players p ON gs.player_id = p.id
  WHERE gs.round_id = p_round_id AND gs.completed_at IS NOT NULL
  ORDER BY gs.rank ASC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Function to get player's pending payouts
CREATE OR REPLACE FUNCTION get_pending_payouts(p_wallet_address TEXT)
RETURNS TABLE (
  payout_id UUID,
  round_id UUID,
  round_number INTEGER,
  rank INTEGER,
  amount_lamports BIGINT,
  percentage DECIMAL,
  ends_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    po.id as payout_id,
    po.round_id,
    r.round_number,
    po.rank,
    po.amount_lamports,
    po.percentage,
    r.ends_at
  FROM payouts po
  JOIN rounds r ON po.round_id = r.id
  WHERE po.wallet_address = p_wallet_address AND po.status = 'pending'
  ORDER BY r.ends_at DESC;
END;
$$ LANGUAGE plpgsql;

-- Function to get weekly leaderboard (aggregated across all rounds in the past 7 days)
CREATE OR REPLACE FUNCTION get_weekly_leaderboard(p_limit INTEGER DEFAULT 50)
RETURNS TABLE (
  rank BIGINT,
  wallet_address TEXT,
  display_name TEXT,
  avatar TEXT,
  avatar_bg_color TEXT,
  total_score BIGINT,
  total_correct BIGINT,
  games_played BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ROW_NUMBER() OVER (ORDER BY SUM(gs.score) DESC) as rank,
    gs.wallet_address,
    p.display_name,
    p.avatar,
    p.avatar_bg_color,
    SUM(gs.score)::BIGINT as total_score,
    SUM(gs.correct_count)::BIGINT as total_correct,
    COUNT(gs.id)::BIGINT as games_played
  FROM game_sessions gs
  JOIN rounds r ON gs.round_id = r.id
  LEFT JOIN players p ON gs.player_id = p.id
  WHERE gs.completed_at IS NOT NULL
    AND r.ends_at >= NOW() - INTERVAL '7 days'
  GROUP BY gs.wallet_address, p.display_name, p.avatar, p.avatar_bg_color
  ORDER BY total_score DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Function to get all-time leaderboard
CREATE OR REPLACE FUNCTION get_alltime_leaderboard(p_limit INTEGER DEFAULT 50)
RETURNS TABLE (
  rank BIGINT,
  wallet_address TEXT,
  display_name TEXT,
  avatar TEXT,
  avatar_bg_color TEXT,
  total_score BIGINT,
  total_correct BIGINT,
  games_played BIGINT,
  total_winnings BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ROW_NUMBER() OVER (ORDER BY SUM(gs.score) DESC) as rank,
    gs.wallet_address,
    p.display_name,
    p.avatar,
    p.avatar_bg_color,
    SUM(gs.score)::BIGINT as total_score,
    SUM(gs.correct_count)::BIGINT as total_correct,
    COUNT(gs.id)::BIGINT as games_played,
    COALESCE(p.total_winnings_lamports, 0)::BIGINT as total_winnings
  FROM game_sessions gs
  LEFT JOIN players p ON gs.player_id = p.id
  WHERE gs.completed_at IS NOT NULL
  GROUP BY gs.wallet_address, p.display_name, p.avatar, p.avatar_bg_color, p.total_winnings_lamports
  ORDER BY total_score DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Function to add winnings to a player
CREATE OR REPLACE FUNCTION add_player_winnings(p_wallet_address TEXT, p_amount BIGINT)
RETURNS void AS $$
BEGIN
  UPDATE players
  SET
    total_winnings_lamports = total_winnings_lamports + p_amount,
    games_won = games_won + 1,
    updated_at = NOW()
  WHERE wallet_address = p_wallet_address;
END;
$$ LANGUAGE plpgsql;

-- Function to increment player stats (used by end-round)
CREATE OR REPLACE FUNCTION increment_player_stats(p_player_id UUID, p_is_winner BOOLEAN)
RETURNS void AS $$
BEGIN
  UPDATE players
  SET
    games_played = games_played + 1,
    games_won = CASE WHEN p_is_winner THEN games_won + 1 ELSE games_won END,
    updated_at = NOW()
  WHERE id = p_player_id;
END;
$$ LANGUAGE plpgsql;

-- ══════════════════════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY
-- ══════════════════════════════════════════════════════════════════════════════

ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE rounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_stats ENABLE ROW LEVEL SECURITY;

-- Public read access for rounds
CREATE POLICY "Rounds are viewable by everyone" ON rounds FOR SELECT USING (true);

-- Public read access for leaderboard data
CREATE POLICY "Game sessions viewable by everyone" ON game_sessions FOR SELECT USING (true);

-- Players can view all profiles
CREATE POLICY "Profiles are viewable by everyone" ON players FOR SELECT USING (true);

-- Questions only accessible via edge functions (service role)
CREATE POLICY "Questions accessible via service role" ON questions FOR SELECT USING (false);

-- Answers only accessible via edge functions
CREATE POLICY "Answers accessible via service role" ON answers FOR SELECT USING (false);

-- Payouts viewable by the recipient
CREATE POLICY "Payouts viewable by recipient" ON payouts FOR SELECT USING (true);

-- Player stats viewable by everyone
CREATE POLICY "Player stats viewable by everyone" ON player_stats FOR SELECT USING (true);

-- ══════════════════════════════════════════════════════════════════════════════
-- SEED DATA: Sample Questions
-- ══════════════════════════════════════════════════════════════════════════════

INSERT INTO questions (category, question, answers, correct_index, difficulty) VALUES
-- Solana Questions
('Solana', 'What is the native token of the Solana blockchain?', '["SOL", "ETH", "BTC", "AVAX"]', 0, 'easy'),
('Solana', 'Who is the co-founder and CEO of Solana Labs?', '["Vitalik Buterin", "Anatoly Yakovenko", "Satoshi Nakamoto", "Charles Hoskinson"]', 1, 'medium'),
('Solana', 'What consensus mechanism does Solana use alongside Proof of Stake?', '["Proof of Work", "Proof of History", "Proof of Authority", "Delegated Proof of Stake"]', 1, 'medium'),
('Solana', 'What is the name of Solana''s mobile phone?', '["Saga", "Pixel", "Galaxy", "Nova"]', 0, 'easy'),
('Solana', 'What programming language are Solana smart contracts primarily written in?', '["JavaScript", "Python", "Rust", "Solidity"]', 2, 'medium'),

-- DeFi Questions
('DeFi', 'What does DeFi stand for?', '["Decentralized Finance", "Digital Finance", "Distributed Finance", "Direct Finance"]', 0, 'easy'),
('DeFi', 'What is an AMM in DeFi?', '["Automated Market Maker", "Advanced Money Manager", "Algorithmic Mining Machine", "Asset Management Module"]', 0, 'medium'),
('DeFi', 'What is impermanent loss?', '["A temporary price drop", "Loss from providing liquidity when prices change", "Network transaction fees", "Slippage on trades"]', 1, 'hard'),
('DeFi', 'What is the largest DEX on Solana by volume?', '["Uniswap", "Jupiter", "PancakeSwap", "SushiSwap"]', 1, 'medium'),
('DeFi', 'What does TVL stand for in DeFi?', '["Total Value Locked", "Token Value List", "Trading Volume Level", "Treasury Vault Limit"]', 0, 'easy'),

-- NFT Questions
('NFTs', 'What does NFT stand for?', '["Non-Fungible Token", "New Finance Technology", "Network File Transfer", "Node Funding Token"]', 0, 'easy'),
('NFTs', 'Which marketplace is known for Solana NFTs?', '["OpenSea", "Magic Eden", "Rarible", "Foundation"]', 1, 'easy'),
('NFTs', 'What token standard do Solana NFTs typically use?', '["ERC-721", "Metaplex", "BEP-721", "TRC-721"]', 1, 'medium'),
('NFTs', 'What is a PFP NFT?', '["Profile Picture NFT", "Pixel Format Picture", "Private File Protocol", "Public Finance Protocol"]', 0, 'easy'),
('NFTs', 'What is minting an NFT?', '["Creating a new NFT on the blockchain", "Selling an NFT", "Burning an NFT", "Trading an NFT"]', 0, 'easy'),

-- Bitcoin Questions
('Bitcoin', 'Who created Bitcoin?', '["Elon Musk", "Satoshi Nakamoto", "Vitalik Buterin", "Mark Zuckerberg"]', 1, 'easy'),
('Bitcoin', 'What is the maximum supply of Bitcoin?', '["21 million", "100 million", "1 billion", "Unlimited"]', 0, 'easy'),
('Bitcoin', 'What is a Bitcoin halving?', '["Block reward reduction by 50%", "Price dropping 50%", "Network speed increase", "Transaction fee reduction"]', 0, 'medium'),
('Bitcoin', 'In what year was Bitcoin created?', '["2007", "2008", "2009", "2010"]', 2, 'medium'),
('Bitcoin', 'What is the smallest unit of Bitcoin called?', '["Satoshi", "Wei", "Gwei", "Bit"]', 0, 'easy'),

-- Crypto General Questions
('Crypto', 'What is a blockchain?', '["A distributed ledger", "A type of cryptocurrency", "A mining hardware", "A trading platform"]', 0, 'easy'),
('Crypto', 'What does HODL mean?', '["Hold On for Dear Life", "High Order Digital Ledger", "Hash Output Data Link", "Hybrid Online Distribution Layer"]', 0, 'easy'),
('Crypto', 'What is a seed phrase?', '["A backup recovery phrase for wallets", "A mining algorithm", "A trading strategy", "A type of token"]', 0, 'medium'),
('Crypto', 'What is gas in crypto?', '["Transaction fees", "Mining power", "Token supply", "Network speed"]', 0, 'medium'),
('Crypto', 'What is a rug pull?', '["A scam where developers abandon a project", "A trading strategy", "A type of NFT", "A mining technique"]', 0, 'medium'),

-- Memecoins Questions
('Memecoins', 'What animal is associated with Dogecoin?', '["Cat", "Shiba Inu dog", "Frog", "Monkey"]', 1, 'easy'),
('Memecoins', 'Which memecoin on Solana features a dog with a hat?', '["BONK", "WIF", "SAMO", "DOGE"]', 1, 'easy'),
('Memecoins', 'What was the first major memecoin?', '["Shiba Inu", "Dogecoin", "Pepe", "Bonk"]', 1, 'easy'),
('Memecoins', 'Who is the mascot of BONK?', '["A cat", "A Shiba Inu", "A frog", "A bear"]', 1, 'easy'),
('Memecoins', 'What social platform helped popularize memecoins?', '["LinkedIn", "Twitter/X", "Facebook", "TikTok"]', 1, 'easy'),

-- Solana Basics and History (Additional Questions)
('Solana', 'In what year was Solana mainnet launched?', '["2018", "2019", "2020", "2021"]', 2, 'medium'),
('Solana', 'Solana was inspired by which California location?', '["Silicon Valley", "Solana Beach", "Los Angeles", "San Francisco"]', 1, 'medium'),
('Solana', 'What was Solana''s original project name?', '["Ethereum Killer", "Loom", "Phantom", "Raydium"]', 1, 'hard'),
('Solana', 'Solana''s theoretical max TPS is approximately:', '["1,000", "65,000", "100,000", "10,000"]', 1, 'medium'),
('Solana', 'Solana''s average transaction fee is roughly:', '["$0.01", "$0.00025", "$2.50", "$10"]', 1, 'easy'),
('Solana', 'Solana''s block time is approximately:', '["10 minutes", "400 milliseconds", "12 seconds", "1 second"]', 1, 'medium'),
('Solana', 'Who co-founded Solana alongside Anatoly Yakovenko?', '["Raj Gokal", "Elon Musk", "Sam Bankman-Fried", "Brian Armstrong"]', 0, 'medium'),
('Solana', 'Solana experienced major outages prominently in which period?', '["2019", "2021-2022", "2024", "2025"]', 1, 'medium'),
('Solana', 'Solana''s supply model is:', '["Fixed cap like Bitcoin", "Inflationary with decreasing rate", "Deflationary burns only", "Unlimited"]', 1, 'hard'),
('Solana', 'What company primarily develops Solana?', '["Solana Labs", "Ethereum Foundation", "Binance Labs", "Ripple"]', 0, 'easy'),
('Solana', 'Solana''s first major hype cycle peaked in:', '["2019", "2021", "2023", "2025"]', 1, 'medium'),
('Solana', 'Solana uses which runtime for parallel execution?', '["EVM", "Sealevel", "WebAssembly", "LLVM"]', 1, 'hard'),
('Solana', 'What inspired Proof-of-History?', '["Quantum computing", "Verifiable delay functions and time stamping", "Mining hardware", "Centralized clocks"]', 1, 'hard'),
('Solana', 'Solana''s validator count is in the range of:', '["Under 100", "Over 1,000", "Millions", "Exactly 21"]', 1, 'medium'),
('Solana', 'Solana''s inflation rate targets long-term:', '["0%", "1.5%", "10%", "50%"]', 1, 'hard'),
('Solana', 'Anatoly Yakovenko''s experience at which company inspired Solana''s design?', '["Qualcomm", "Google", "Apple", "Microsoft"]', 0, 'hard'),

-- Solana Influencers and Community
('Solana', 'What is Anatoly Yakovenko''s (Toly) X handle?', '["@aeyakovenko", "@toly", "@solana", "@rajgokal"]', 1, 'easy'),
('Solana', 'Who is known as a prominent Solana meme influencer for viral calls?', '["Mert Mumtaz", "Ansem", "Michael Saylor", "Vitalik Buterin"]', 1, 'medium'),
('Solana', 'Ansem''s X handle is:', '["@blknoiz06", "@mert", "@toly", "@rajgokal"]', 0, 'medium'),
('Solana', 'Mert Mumtaz, a top Solana advocate, runs which company?', '["Helius", "Jupiter", "Phantom", "Magic Eden"]', 0, 'medium'),
('Solana', 'Raj Gokal''s X handle is:', '["@toly", "@rajgokal", "@blknoiz06", "@solana"]', 1, 'easy');
