-- 피트니스 프로필 (계정당 여러 개 가능)
-- 예: 본인 + 여자친구, PT 트레이너의 여러 회원 등
CREATE TABLE fitness_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  avatar_url TEXT,
  gender TEXT CHECK (gender IN ('male', 'female', 'other')),
  birth_year INT,
  height_cm DECIMAL(5,1),
  weight_kg DECIMAL(5,1),
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스
CREATE INDEX idx_fitness_profiles_user ON fitness_profiles(user_id);

-- 기존 테이블에 profile_id 컬럼 추가 (NULL 허용 - 마이그레이션 용)
ALTER TABLE workout_sessions ADD COLUMN profile_id UUID REFERENCES fitness_profiles(id) ON DELETE CASCADE;
ALTER TABLE exercises ADD COLUMN profile_id UUID REFERENCES fitness_profiles(id) ON DELETE CASCADE;
ALTER TABLE personal_records ADD COLUMN profile_id UUID REFERENCES fitness_profiles(id) ON DELETE CASCADE;

-- 인덱스 추가
CREATE INDEX idx_workout_sessions_profile ON workout_sessions(profile_id, started_at DESC);
CREATE INDEX idx_personal_records_profile ON personal_records(profile_id, exercise_id);

-- RLS 활성화
ALTER TABLE fitness_profiles ENABLE ROW LEVEL SECURITY;

-- 정책: 피트니스 프로필
CREATE POLICY "Users can view own fitness profiles" ON fitness_profiles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own fitness profiles" ON fitness_profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own fitness profiles" ON fitness_profiles
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own fitness profiles" ON fitness_profiles
  FOR DELETE USING (auth.uid() = user_id);

-- 기존 사용자를 위한 기본 프로필 생성 함수
CREATE OR REPLACE FUNCTION create_default_fitness_profile()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO fitness_profiles (user_id, name, is_default)
  VALUES (NEW.id, '나', TRUE);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 새 사용자 가입 시 기본 피트니스 프로필 자동 생성
CREATE TRIGGER on_profile_created
  AFTER INSERT ON profiles
  FOR EACH ROW EXECUTE FUNCTION create_default_fitness_profile();

-- 기존 사용자들에게 기본 프로필 생성
INSERT INTO fitness_profiles (user_id, name, is_default)
SELECT id, '나', TRUE FROM profiles
WHERE NOT EXISTS (
  SELECT 1 FROM fitness_profiles WHERE fitness_profiles.user_id = profiles.id
);

-- 기존 workout_sessions 데이터 마이그레이션 (기본 프로필로)
UPDATE workout_sessions ws
SET profile_id = (
  SELECT fp.id FROM fitness_profiles fp
  WHERE fp.user_id = ws.user_id AND fp.is_default = TRUE
  LIMIT 1
)
WHERE ws.profile_id IS NULL;

-- 기존 personal_records 데이터 마이그레이션
UPDATE personal_records pr
SET profile_id = (
  SELECT fp.id FROM fitness_profiles fp
  WHERE fp.user_id = pr.user_id AND fp.is_default = TRUE
  LIMIT 1
)
WHERE pr.profile_id IS NULL;

-- 기존 custom exercises 마이그레이션
UPDATE exercises e
SET profile_id = (
  SELECT fp.id FROM fitness_profiles fp
  WHERE fp.user_id = e.user_id AND fp.is_default = TRUE
  LIMIT 1
)
WHERE e.is_custom = TRUE AND e.profile_id IS NULL;

-- updated_at 트리거
CREATE TRIGGER update_fitness_profiles_updated_at
  BEFORE UPDATE ON fitness_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
