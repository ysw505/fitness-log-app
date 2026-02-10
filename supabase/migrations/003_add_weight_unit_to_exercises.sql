-- 운동 종목별 무게 단위 추가
ALTER TABLE exercises
ADD COLUMN weight_unit TEXT DEFAULT 'kg' CHECK (weight_unit IN ('kg', 'lb'));

-- 기존 데이터는 기본값 kg 유지
UPDATE exercises SET weight_unit = 'kg' WHERE weight_unit IS NULL;
