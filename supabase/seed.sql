-- 기본 운동 종목 데이터
INSERT INTO exercises (name, name_ko, category, muscle_group, equipment, is_custom) VALUES
-- 가슴 (Chest)
('Bench Press', '벤치프레스', 'chest', ARRAY['대흉근', '삼두근', '전면삼각근'], 'barbell', FALSE),
('Incline Bench Press', '인클라인 벤치프레스', 'chest', ARRAY['상부 대흉근', '삼두근', '전면삼각근'], 'barbell', FALSE),
('Dumbbell Bench Press', '덤벨 벤치프레스', 'chest', ARRAY['대흉근', '삼두근'], 'dumbbell', FALSE),
('Dumbbell Fly', '덤벨 플라이', 'chest', ARRAY['대흉근'], 'dumbbell', FALSE),
('Cable Crossover', '케이블 크로스오버', 'chest', ARRAY['대흉근'], 'cable', FALSE),
('Push Up', '푸쉬업', 'chest', ARRAY['대흉근', '삼두근', '전면삼각근'], 'bodyweight', FALSE),
('Chest Press Machine', '체스트 프레스 머신', 'chest', ARRAY['대흉근', '삼두근'], 'machine', FALSE),
('Pec Deck Fly', '펙덱 플라이', 'chest', ARRAY['대흉근'], 'machine', FALSE),

-- 등 (Back)
('Deadlift', '데드리프트', 'back', ARRAY['척추기립근', '광배근', '승모근', '둔근'], 'barbell', FALSE),
('Barbell Row', '바벨 로우', 'back', ARRAY['광배근', '승모근', '후면삼각근'], 'barbell', FALSE),
('Pull Up', '풀업', 'back', ARRAY['광배근', '이두근'], 'bodyweight', FALSE),
('Lat Pulldown', '랫 풀다운', 'back', ARRAY['광배근', '이두근'], 'cable', FALSE),
('Seated Cable Row', '시티드 케이블 로우', 'back', ARRAY['광배근', '승모근'], 'cable', FALSE),
('Dumbbell Row', '덤벨 로우', 'back', ARRAY['광배근', '승모근'], 'dumbbell', FALSE),
('T-Bar Row', '티바 로우', 'back', ARRAY['광배근', '승모근'], 'barbell', FALSE),

-- 어깨 (Shoulders)
('Overhead Press', '오버헤드 프레스', 'shoulders', ARRAY['전면삼각근', '측면삼각근', '삼두근'], 'barbell', FALSE),
('Dumbbell Shoulder Press', '덤벨 숄더 프레스', 'shoulders', ARRAY['전면삼각근', '측면삼각근'], 'dumbbell', FALSE),
('Lateral Raise', '레터럴 레이즈', 'shoulders', ARRAY['측면삼각근'], 'dumbbell', FALSE),
('Front Raise', '프론트 레이즈', 'shoulders', ARRAY['전면삼각근'], 'dumbbell', FALSE),
('Rear Delt Fly', '리어 델트 플라이', 'shoulders', ARRAY['후면삼각근'], 'dumbbell', FALSE),
('Face Pull', '페이스 풀', 'shoulders', ARRAY['후면삼각근', '승모근'], 'cable', FALSE),
('Upright Row', '업라이트 로우', 'shoulders', ARRAY['측면삼각근', '승모근'], 'barbell', FALSE),

-- 하체 (Legs)
('Squat', '스쿼트', 'legs', ARRAY['대퇴사두근', '둔근', '햄스트링'], 'barbell', FALSE),
('Leg Press', '레그 프레스', 'legs', ARRAY['대퇴사두근', '둔근'], 'machine', FALSE),
('Leg Extension', '레그 익스텐션', 'legs', ARRAY['대퇴사두근'], 'machine', FALSE),
('Leg Curl', '레그 컬', 'legs', ARRAY['햄스트링'], 'machine', FALSE),
('Romanian Deadlift', '루마니안 데드리프트', 'legs', ARRAY['햄스트링', '둔근', '척추기립근'], 'barbell', FALSE),
('Lunge', '런지', 'legs', ARRAY['대퇴사두근', '둔근'], 'dumbbell', FALSE),
('Calf Raise', '카프 레이즈', 'legs', ARRAY['비복근', '가자미근'], 'machine', FALSE),
('Hip Thrust', '힙 쓰러스트', 'legs', ARRAY['둔근', '햄스트링'], 'barbell', FALSE),

-- 팔 (Arms)
('Barbell Curl', '바벨 컬', 'arms', ARRAY['이두근'], 'barbell', FALSE),
('Dumbbell Curl', '덤벨 컬', 'arms', ARRAY['이두근'], 'dumbbell', FALSE),
('Hammer Curl', '해머 컬', 'arms', ARRAY['이두근', '상완근'], 'dumbbell', FALSE),
('Preacher Curl', '프리처 컬', 'arms', ARRAY['이두근'], 'barbell', FALSE),
('Tricep Pushdown', '트라이셉 푸쉬다운', 'arms', ARRAY['삼두근'], 'cable', FALSE),
('Skull Crusher', '스컬 크러셔', 'arms', ARRAY['삼두근'], 'barbell', FALSE),
('Tricep Dip', '트라이셉 딥', 'arms', ARRAY['삼두근', '대흉근'], 'bodyweight', FALSE),
('Overhead Tricep Extension', '오버헤드 트라이셉 익스텐션', 'arms', ARRAY['삼두근'], 'dumbbell', FALSE),

-- 코어 (Core)
('Plank', '플랭크', 'core', ARRAY['복직근', '복횡근', '척추기립근'], 'bodyweight', FALSE),
('Crunch', '크런치', 'core', ARRAY['복직근'], 'bodyweight', FALSE),
('Leg Raise', '레그 레이즈', 'core', ARRAY['하복부', '고관절굴곡근'], 'bodyweight', FALSE),
('Russian Twist', '러시안 트위스트', 'core', ARRAY['복사근', '복직근'], 'bodyweight', FALSE),
('Ab Wheel Rollout', '에브휠 롤아웃', 'core', ARRAY['복직근', '복횡근'], 'other', FALSE),
('Cable Crunch', '케이블 크런치', 'core', ARRAY['복직근'], 'cable', FALSE),

-- 유산소 (Cardio)
('Treadmill Running', '트레드밀 런닝', 'cardio', ARRAY['심폐지구력', '하체'], 'machine', FALSE),
('Stationary Bike', '고정식 자전거', 'cardio', ARRAY['심폐지구력', '대퇴사두근'], 'machine', FALSE),
('Rowing Machine', '로잉 머신', 'cardio', ARRAY['심폐지구력', '등', '팔'], 'machine', FALSE),
('Elliptical', '일립티컬', 'cardio', ARRAY['심폐지구력', '전신'], 'machine', FALSE),
('Jump Rope', '줄넘기', 'cardio', ARRAY['심폐지구력', '종아리'], 'other', FALSE);
