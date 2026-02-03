-- 사용자 프로필 (Supabase Auth와 연동)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE,
  display_name TEXT,
  avatar_url TEXT,
  unit_system TEXT DEFAULT 'metric' CHECK (unit_system IN ('metric', 'imperial')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 운동 종목 마스터
CREATE TABLE exercises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  name_ko TEXT,
  category TEXT NOT NULL CHECK (category IN ('chest', 'back', 'shoulders', 'legs', 'arms', 'core', 'cardio')),
  muscle_group TEXT[] DEFAULT '{}',
  equipment TEXT CHECK (equipment IN ('barbell', 'dumbbell', 'machine', 'cable', 'bodyweight', 'kettlebell', 'band', 'other')),
  is_custom BOOLEAN DEFAULT FALSE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 운동 세션 (하루의 운동)
CREATE TABLE workout_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  duration_minutes INT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 운동 세션 내 수행한 운동들
CREATE TABLE workout_exercises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES workout_sessions(id) ON DELETE CASCADE,
  exercise_id UUID NOT NULL REFERENCES exercises(id),
  order_index INT NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 세트 기록
CREATE TABLE workout_sets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workout_exercise_id UUID NOT NULL REFERENCES workout_exercises(id) ON DELETE CASCADE,
  set_number INT NOT NULL,
  weight DECIMAL(6,2),
  reps INT,
  duration_seconds INT,
  distance_meters DECIMAL(10,2),
  is_warmup BOOLEAN DEFAULT FALSE,
  is_dropset BOOLEAN DEFAULT FALSE,
  rpe DECIMAL(3,1) CHECK (rpe >= 1 AND rpe <= 10),
  completed_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 개인 기록 (PR)
CREATE TABLE personal_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  exercise_id UUID NOT NULL REFERENCES exercises(id),
  record_type TEXT NOT NULL CHECK (record_type IN ('max_weight', 'max_reps', 'max_volume')),
  value DECIMAL(10,2) NOT NULL,
  achieved_at TIMESTAMPTZ NOT NULL,
  workout_set_id UUID REFERENCES workout_sets(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, exercise_id, record_type)
);

-- 인덱스
CREATE INDEX idx_workout_sessions_user_date ON workout_sessions(user_id, started_at DESC);
CREATE INDEX idx_workout_exercises_session ON workout_exercises(session_id);
CREATE INDEX idx_workout_sets_exercise ON workout_sets(workout_exercise_id);
CREATE INDEX idx_personal_records_user ON personal_records(user_id, exercise_id);
CREATE INDEX idx_exercises_category ON exercises(category);

-- Row Level Security 활성화
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE personal_records ENABLE ROW LEVEL SECURITY;

-- 정책: 프로필
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- 정책: 운동 종목 (기본 운동은 모두 볼 수 있음, 커스텀 운동은 본인만)
CREATE POLICY "Users can view all default exercises" ON exercises
  FOR SELECT USING (is_custom = FALSE OR user_id = auth.uid());

CREATE POLICY "Users can manage own custom exercises" ON exercises
  FOR ALL USING (is_custom = TRUE AND user_id = auth.uid());

-- 정책: 운동 세션
CREATE POLICY "Users can manage own workout sessions" ON workout_sessions
  FOR ALL USING (auth.uid() = user_id);

-- 정책: 운동 세션 내 운동
CREATE POLICY "Users can manage own workout exercises" ON workout_exercises
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM workout_sessions
      WHERE workout_sessions.id = workout_exercises.session_id
      AND workout_sessions.user_id = auth.uid()
    )
  );

-- 정책: 세트 기록
CREATE POLICY "Users can manage own workout sets" ON workout_sets
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM workout_exercises
      JOIN workout_sessions ON workout_sessions.id = workout_exercises.session_id
      WHERE workout_exercises.id = workout_sets.workout_exercise_id
      AND workout_sessions.user_id = auth.uid()
    )
  );

-- 정책: 개인 기록
CREATE POLICY "Users can manage own personal records" ON personal_records
  FOR ALL USING (auth.uid() = user_id);

-- 트리거: 프로필 자동 생성
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 트리거: updated_at 자동 갱신
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
