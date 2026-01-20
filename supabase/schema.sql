-- =============================================
-- XOMPER SUPABASE SCHEMA
-- Sleeper Fantasy Football App
-- =============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================
-- 1. PROFILES TABLE
-- Extends Supabase auth.users with Sleeper data
-- =============================================
CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT NOT NULL,
  sleeper_user_id TEXT,
  sleeper_username TEXT,
  sleeper_avatar TEXT,
  display_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (NEW.id, NEW.email);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =============================================
-- 2. WHITELISTED LEAGUES TABLE
-- Leagues with full feature access
-- =============================================
CREATE TABLE public.whitelisted_leagues (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  league_id TEXT NOT NULL UNIQUE,
  league_name TEXT NOT NULL,
  season TEXT NOT NULL DEFAULT '2025',
  is_active BOOLEAN DEFAULT true,
  is_dynasty BOOLEAN DEFAULT false,
  has_taxi BOOLEAN DEFAULT false,
  divisions INTEGER DEFAULT 0,
  size INTEGER DEFAULT 12,
  features JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert your CLT Dynasty league
INSERT INTO public.whitelisted_leagues (league_id, league_name, is_dynasty, divisions, size, has_taxi)
VALUES ('1181789700187090944', 'CLT DYNASTY', true, 3, 12, true);

-- =============================================
-- 3. LEAGUE CONFIGS TABLE
-- Flexible config for custom features per league
-- =============================================
CREATE TABLE public.league_configs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  league_id TEXT NOT NULL REFERENCES whitelisted_leagues(league_id) ON DELETE CASCADE,
  config_key TEXT NOT NULL,
  config_value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(league_id, config_key)
);

-- =============================================
-- 4. USER LEAGUE ACCESS TABLE
-- Controls which users can access whitelisted features
-- =============================================
CREATE TABLE public.user_league_access (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  league_id TEXT NOT NULL REFERENCES whitelisted_leagues(league_id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member' CHECK (role IN ('member', 'admin', 'owner')),
  granted_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, league_id)
);

-- =============================================
-- 5. WORLD CUP STANDINGS TABLE
-- 4-year historical division records for tournament seeding
-- =============================================
CREATE TABLE public.world_cup_standings (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  league_id TEXT NOT NULL REFERENCES whitelisted_leagues(league_id) ON DELETE CASCADE,
  roster_id INTEGER NOT NULL,
  sleeper_user_id TEXT,
  team_name TEXT,
  division TEXT,
  
  -- 4-year historical data
  year_2021_wins INTEGER DEFAULT 0,
  year_2021_losses INTEGER DEFAULT 0,
  year_2022_wins INTEGER DEFAULT 0,
  year_2022_losses INTEGER DEFAULT 0,
  year_2023_wins INTEGER DEFAULT 0,
  year_2023_losses INTEGER DEFAULT 0,
  year_2024_wins INTEGER DEFAULT 0,
  year_2024_losses INTEGER DEFAULT 0,
  
  -- Computed total
  total_division_wins INTEGER GENERATED ALWAYS AS (
    year_2021_wins + year_2022_wins + year_2023_wins + year_2024_wins
  ) STORED,
  
  seed INTEGER,
  eliminated BOOLEAN DEFAULT false,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(league_id, roster_id)
);

-- =============================================
-- 6. WORLD CUP BRACKETS TABLE
-- Tournament bracket tracking
-- =============================================
CREATE TABLE public.world_cup_brackets (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  league_id TEXT NOT NULL REFERENCES whitelisted_leagues(league_id) ON DELETE CASCADE,
  season TEXT NOT NULL DEFAULT '2025',
  round INTEGER NOT NULL,
  match_id INTEGER NOT NULL,
  team1_roster_id INTEGER,
  team2_roster_id INTEGER,
  team1_score DECIMAL(10,2),
  team2_score DECIMAL(10,2),
  winner_roster_id INTEGER,
  match_week INTEGER,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'complete')),
  
  UNIQUE(league_id, season, round, match_id)
);

-- =============================================
-- ROW LEVEL SECURITY POLICIES
-- =============================================

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whitelisted_leagues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.league_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_league_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.world_cup_standings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.world_cup_brackets ENABLE ROW LEVEL SECURITY;

-- PROFILES: Users can read/update their own profile
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- WHITELISTED LEAGUES: Public read (anyone can see which leagues exist)
CREATE POLICY "Anyone can view whitelisted leagues"
  ON public.whitelisted_leagues FOR SELECT
  USING (true);

-- USER LEAGUE ACCESS: Users can see their own access
CREATE POLICY "Users can view own league access"
  ON public.user_league_access FOR SELECT
  USING (auth.uid() = user_id);

-- LEAGUE CONFIGS: Only for users with access to that league
CREATE POLICY "Users can view configs for their leagues"
  ON public.league_configs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_league_access ula
      WHERE ula.user_id = auth.uid()
      AND ula.league_id = league_configs.league_id
    )
  );

-- WORLD CUP STANDINGS: Only for users with access to that league
CREATE POLICY "Users can view World Cup standings for their leagues"
  ON public.world_cup_standings FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_league_access ula
      WHERE ula.user_id = auth.uid()
      AND ula.league_id = world_cup_standings.league_id
    )
  );

-- WORLD CUP BRACKETS: Only for users with access to that league
CREATE POLICY "Users can view World Cup brackets for their leagues"
  ON public.world_cup_brackets FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_league_access ula
      WHERE ula.user_id = auth.uid()
      AND ula.league_id = world_cup_brackets.league_id
    )
  );

-- =============================================
-- INDEXES FOR PERFORMANCE
-- =============================================
CREATE INDEX idx_profiles_sleeper_user_id ON public.profiles(sleeper_user_id);
CREATE INDEX idx_user_league_access_user_id ON public.user_league_access(user_id);
CREATE INDEX idx_user_league_access_league_id ON public.user_league_access(league_id);
CREATE INDEX idx_world_cup_standings_league_id ON public.world_cup_standings(league_id);
CREATE INDEX idx_world_cup_brackets_league_id ON public.world_cup_brackets(league_id);

-- =============================================
-- UPDATED_AT TRIGGER
-- =============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_whitelisted_leagues_updated_at
  BEFORE UPDATE ON public.whitelisted_leagues
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_league_configs_updated_at
  BEFORE UPDATE ON public.league_configs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_world_cup_standings_updated_at
  BEFORE UPDATE ON public.world_cup_standings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
