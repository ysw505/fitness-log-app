// 운동 가이드 데이터
// 운동별 설명, 팁, 영상 가이드 링크

export interface ExerciseGuide {
  description: string;       // 운동 설명
  targetMuscles: string;     // 타겟 근육
  tips: string[];            // 수행 팁 (3-5개)
  commonMistakes: string[];  // 흔한 실수
  videoUrl?: string;         // YouTube 영상 링크
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  homeAlternative?: string;  // 홈트레이닝 대안
}

export const EXERCISE_GUIDES: Record<string, ExerciseGuide> = {
  // === 가슴 ===
  default_bench_press: {
    description: '바벨을 사용하여 가슴, 삼두, 전면 어깨를 자극하는 대표적인 상체 운동입니다.',
    targetMuscles: '대흉근 (가슴), 삼두근, 전면 삼각근',
    tips: [
      '어깨를 벤치에 밀착시키고 자연스러운 아치를 유지하세요',
      '바벨을 내릴 때 가슴 하단(유두 라인)에 닿게 하세요',
      '팔꿈치는 45-75도 각도를 유지하세요',
      '발은 바닥에 단단히 고정하세요',
      '호흡: 내릴 때 들이쉬고, 밀 때 내쉬세요',
    ],
    commonMistakes: [
      '어깨가 앞으로 말리는 것',
      '엉덩이가 벤치에서 떨어지는 것',
      '바벨을 목 쪽으로 내리는 것',
      '손목이 꺾이는 것',
    ],
    videoUrl: 'https://www.youtube.com/watch?v=rT7DgCr-3pg',
    difficulty: 'intermediate',
    homeAlternative: '푸쉬업, 덤벨 프레스 (바닥)',
  },

  default_incline_bench_press: {
    description: '벤치를 30-45도 기울여서 수행하며, 상부 가슴과 전면 어깨를 집중 자극합니다.',
    targetMuscles: '상부 대흉근, 전면 삼각근, 삼두근',
    tips: [
      '벤치 각도는 30-45도가 적당합니다 (너무 높으면 어깨 운동이 됨)',
      '바벨을 쇄골 쪽으로 내리세요',
      '어깨 뒤로 조이고 견갑골 고정하세요',
      '플랫 벤치프레스보다 무게를 10-20% 낮추세요',
    ],
    commonMistakes: [
      '벤치 각도가 너무 가파른 것',
      '바벨을 복부 쪽으로 내리는 것',
      '어깨가 들리는 것',
    ],
    videoUrl: 'https://www.youtube.com/watch?v=SrqOu55lrYU',
    difficulty: 'intermediate',
    homeAlternative: '발을 높이 올린 푸쉬업, 인클라인 덤벨 프레스',
  },

  default_dumbbell_press: {
    description: '덤벨을 사용하여 가슴을 자극하며, 바벨보다 가동범위가 넓고 좌우 균형 발달에 좋습니다.',
    targetMuscles: '대흉근, 삼두근, 전면 삼각근',
    tips: [
      '덤벨을 가슴 옆에서 시작해 위로 밀어올리세요',
      '팔꿈치는 약간 구부린 상태로 유지하세요',
      '정점에서 덤벨을 살짝 모아주면 수축감이 좋습니다',
      '덤벨이 흔들리지 않게 코어에 힘을 주세요',
    ],
    commonMistakes: [
      '덤벨을 너무 넓게 벌리는 것',
      '손목이 뒤로 꺾이는 것',
      '정점에서 덤벨을 부딪히는 것',
    ],
    videoUrl: 'https://www.youtube.com/watch?v=VmB1G1K7v94',
    difficulty: 'beginner',
    homeAlternative: '물병이나 백팩 활용',
  },

  default_chest_fly: {
    description: '덤벨을 양옆으로 벌렸다 모으는 동작으로 가슴을 집중적으로 자극하는 고립 운동입니다.',
    targetMuscles: '대흉근 (안쪽, 바깥쪽)',
    tips: [
      '팔꿈치는 약간 구부린 상태로 고정하세요',
      '가슴이 늘어나는 느낌까지만 내리세요',
      '가슴 근육을 조이며 덤벨을 모아올리세요',
      '프레스보다 가벼운 무게로 천천히 수행하세요',
    ],
    commonMistakes: [
      '팔꿈치를 완전히 펴는 것',
      '덤벨을 너무 깊게 내리는 것 (어깨 부상 위험)',
      '빠른 속도로 수행하는 것',
    ],
    videoUrl: 'https://www.youtube.com/watch?v=eozdVDA78K0',
    difficulty: 'beginner',
  },

  default_push_up: {
    description: '가장 기본적인 맨몸 상체 운동으로, 가슴, 삼두, 어깨, 코어를 함께 자극합니다.',
    targetMuscles: '대흉근, 삼두근, 전면 삼각근, 코어',
    tips: [
      '손은 어깨너비보다 약간 넓게 짚으세요',
      '몸 전체를 일직선으로 유지하세요',
      '가슴이 바닥에 닿을 정도로 내려가세요',
      '코어에 힘을 주고 엉덩이가 처지지 않게 하세요',
      '초보자는 무릎 푸쉬업부터 시작하세요',
    ],
    commonMistakes: [
      '엉덩이가 위로 올라가거나 처지는 것',
      '목이 앞으로 빠지는 것',
      '팔꿈치가 너무 옆으로 벌어지는 것',
    ],
    videoUrl: 'https://www.youtube.com/watch?v=IODxDxX7oi4',
    difficulty: 'beginner',
  },

  default_cable_crossover: {
    description: '케이블 머신을 사용하여 가슴 안쪽을 집중 자극하는 운동입니다.',
    targetMuscles: '대흉근 (특히 안쪽)',
    tips: [
      '케이블을 위에서 아래로 교차하며 당기세요',
      '팔꿈치는 살짝 굽힌 상태로 유지하세요',
      '손이 교차할 때 가슴을 쥐어짜듯 수축하세요',
      '케이블 높이에 따라 자극 부위가 달라집니다',
    ],
    commonMistakes: [
      '팔로 당기는 것 (가슴 수축 부족)',
      '상체를 너무 숙이는 것',
      '케이블 장력을 잃는 것',
    ],
    videoUrl: 'https://www.youtube.com/watch?v=taI4XduLpTk',
    difficulty: 'intermediate',
    homeAlternative: '밴드 크로스오버',
  },

  // === 등 ===
  default_deadlift: {
    description: '바벨을 바닥에서 들어올리는 전신 운동으로, 후면 사슬(등, 둔근, 햄스트링)을 강화합니다.',
    targetMuscles: '광배근, 기립근, 둔근, 햄스트링, 승모근',
    tips: [
      '바벨은 정강이 가까이, 어깨 바로 아래에 위치시키세요',
      '등을 곧게 펴고 코어에 힘을 주세요',
      '다리로 바닥을 밀면서 일어나세요',
      '바벨은 몸에 최대한 가깝게 유지하세요',
      '정점에서 둔근을 조이며 골반을 앞으로 미세요',
    ],
    commonMistakes: [
      '등이 둥글게 말리는 것 (허리 부상 위험)',
      '바벨이 몸에서 멀어지는 것',
      '목을 과하게 젖히는 것',
      '무릎이 안쪽으로 모이는 것',
    ],
    videoUrl: 'https://www.youtube.com/watch?v=op9kVnSso6Q',
    difficulty: 'advanced',
    homeAlternative: '덤벨 데드리프트, 싱글레그 데드리프트',
  },

  default_lat_pulldown: {
    description: '케이블 머신에서 바를 아래로 당기며 광배근을 자극하는 등 운동입니다.',
    targetMuscles: '광배근, 이두근, 후면 삼각근',
    tips: [
      '그립은 어깨너비의 1.5배 정도로 잡으세요',
      '가슴을 펴고 어깨를 뒤로 당기며 시작하세요',
      '바를 쇄골 쪽으로 당기세요',
      '등을 사용해 당기고, 이두근에만 의존하지 마세요',
    ],
    commonMistakes: [
      '상체를 뒤로 과하게 젖히는 것',
      '바를 목 뒤로 당기는 것 (어깨 부상 위험)',
      '팔꿈치가 뒤로 가지 않는 것',
    ],
    videoUrl: 'https://www.youtube.com/watch?v=CAwf7n6Luuc',
    difficulty: 'beginner',
    homeAlternative: '풀업, 밴드 풀다운',
  },

  default_barbell_row: {
    description: '상체를 숙인 상태에서 바벨을 당겨 등 전체를 자극하는 복합 운동입니다.',
    targetMuscles: '광배근, 승모근, 후면 삼각근, 이두근',
    tips: [
      '상체를 45-60도 정도 숙이세요',
      '바벨을 배꼽 쪽으로 당기세요',
      '팔꿈치를 몸 가까이 유지하며 뒤로 당기세요',
      '정점에서 견갑골을 쥐어짜세요',
    ],
    commonMistakes: [
      '등이 둥글게 말리는 것',
      '상체를 과하게 일으키는 것 (치팅)',
      '팔로만 당기는 것',
    ],
    videoUrl: 'https://www.youtube.com/watch?v=FWJR5Ve8bnQ',
    difficulty: 'intermediate',
    homeAlternative: '덤벨 로우, 인버티드 로우',
  },

  default_dumbbell_row: {
    description: '한 손으로 덤벨을 당겨 광배근을 집중 자극하는 운동입니다.',
    targetMuscles: '광배근, 이두근, 후면 삼각근',
    tips: [
      '반대쪽 손과 무릎을 벤치에 대고 지지하세요',
      '등은 바닥과 평행하게 유지하세요',
      '덤벨을 골반 쪽으로 당기세요',
      '팔꿈치가 몸 옆을 스치도록 하세요',
    ],
    commonMistakes: [
      '등이 회전하는 것',
      '어깨가 올라가는 것',
      '덤벨을 어깨 쪽으로 당기는 것',
    ],
    videoUrl: 'https://www.youtube.com/watch?v=pYcpY20QaE8',
    difficulty: 'beginner',
  },

  default_pull_up: {
    description: '매달린 상태에서 몸을 끌어올리는 대표적인 등 운동으로, 상체 전체를 발달시킵니다.',
    targetMuscles: '광배근, 이두근, 전완근, 코어',
    tips: [
      '손바닥이 앞을 향하게 어깨너비로 잡으세요',
      '데드행(완전히 늘어진 상태)에서 시작하세요',
      '가슴을 바에 가깝게 당기세요',
      '천천히 내려오며 근육 통제를 유지하세요',
      '못 하면 밴드 보조나 네거티브 풀업부터 시작하세요',
    ],
    commonMistakes: [
      '몸을 흔들며 반동 사용하는 것',
      '턱만 바 위로 넘기는 것',
      '팔만 사용하는 것',
    ],
    videoUrl: 'https://www.youtube.com/watch?v=eGo4IYlbE5g',
    difficulty: 'intermediate',
  },

  default_seated_row: {
    description: '앉은 자세에서 케이블을 당겨 등 중앙부를 자극하는 운동입니다.',
    targetMuscles: '광배근, 승모근 중부, 능형근, 이두근',
    tips: [
      '등을 곧게 펴고 가슴을 내밀어 시작하세요',
      '핸들을 배꼽 쪽으로 당기세요',
      '팔꿈치를 뒤로 당기며 견갑골을 모으세요',
      '천천히 풀어주며 스트레칭 느끼세요',
    ],
    commonMistakes: [
      '상체를 앞뒤로 흔드는 것',
      '어깨가 앞으로 말리는 것',
      '등 수축 없이 팔로만 당기는 것',
    ],
    videoUrl: 'https://www.youtube.com/watch?v=GZbfZ033f74',
    difficulty: 'beginner',
    homeAlternative: '밴드 시티드 로우',
  },

  // === 어깨 ===
  default_overhead_press: {
    description: '바벨을 머리 위로 밀어올리는 어깨 운동의 기본이 되는 복합 운동입니다.',
    targetMuscles: '전면/측면 삼각근, 삼두근, 상부 가슴',
    tips: [
      '발은 어깨너비로 벌리고 코어에 힘을 주세요',
      '바벨은 쇄골 높이에서 시작하세요',
      '머리를 살짝 뒤로 빼며 바벨이 수직으로 올라가게 하세요',
      '정점에서 어깨를 으쓱하듯 밀어올리세요',
    ],
    commonMistakes: [
      '허리를 과하게 젖히는 것',
      '바벨이 앞으로 빠지는 것',
      '팔꿈치가 바깥으로 벌어지는 것',
    ],
    videoUrl: 'https://www.youtube.com/watch?v=2yjwXTZQDDI',
    difficulty: 'intermediate',
    homeAlternative: '덤벨 숄더 프레스, 파이크 푸쉬업',
  },

  default_dumbbell_shoulder_press: {
    description: '덤벨을 사용한 어깨 프레스로, 좌우 균형 발달과 안정성 향상에 효과적입니다.',
    targetMuscles: '삼각근, 삼두근',
    tips: [
      '덤벨을 어깨 높이에서 손바닥이 앞을 향하게 잡으세요',
      '코어에 힘을 주고 등을 벤치에 밀착하세요',
      '팔꿈치는 약간 앞으로 향하게 유지하세요',
      '정점에서 덤벨이 살짝 모이게 하세요',
    ],
    commonMistakes: [
      '허리를 과하게 젖히는 것',
      '팔꿈치가 너무 옆으로 벌어지는 것',
      '덤벨을 흔드는 것',
    ],
    videoUrl: 'https://www.youtube.com/watch?v=qEwKCR5JCog',
    difficulty: 'beginner',
  },

  default_lateral_raise: {
    description: '덤벨을 옆으로 들어올려 측면 삼각근을 고립시키는 운동입니다.',
    targetMuscles: '측면 삼각근',
    tips: [
      '가벼운 무게로 시작하세요 (어깨 근육은 작습니다)',
      '팔꿈치를 약간 굽힌 상태로 유지하세요',
      '어깨 높이까지만 들어올리세요',
      '새끼손가락이 위로 가듯이 살짝 비틀어 올리세요',
    ],
    commonMistakes: [
      '무게가 너무 무거운 것',
      '상체를 흔들며 치팅하는 것',
      '어깨 위로 너무 높이 드는 것',
      '승모근 개입이 많은 것',
    ],
    videoUrl: 'https://www.youtube.com/watch?v=3VcKaXpzqRo',
    difficulty: 'beginner',
  },

  default_front_raise: {
    description: '덤벨을 앞으로 들어올려 전면 삼각근을 자극하는 고립 운동입니다.',
    targetMuscles: '전면 삼각근',
    tips: [
      '팔꿈치를 살짝 굽힌 상태로 유지하세요',
      '어깨 높이까지만 들어올리세요',
      '한 번에 한 팔씩 수행하면 집중도가 높아집니다',
      '천천히 내리며 컨트롤하세요',
    ],
    commonMistakes: [
      '반동을 사용하는 것',
      '어깨 위로 너무 높이 드는 것',
      '등이 뒤로 젖혀지는 것',
    ],
    videoUrl: 'https://www.youtube.com/watch?v=-t7fuZ0KhDA',
    difficulty: 'beginner',
  },

  default_rear_delt_fly: {
    description: '상체를 숙인 상태에서 덤벨을 옆으로 들어올려 후면 삼각근을 자극합니다.',
    targetMuscles: '후면 삼각근, 승모근',
    tips: [
      '상체를 거의 수평이 되게 숙이세요',
      '팔꿈치를 약간 굽힌 상태로 유지하세요',
      '어깨 뒤쪽 근육으로 당긴다고 생각하세요',
      '정점에서 1초 정지하세요',
    ],
    commonMistakes: [
      '상체를 일으키며 수행하는 것',
      '등 근육을 사용하는 것',
      '무게가 너무 무거운 것',
    ],
    videoUrl: 'https://www.youtube.com/watch?v=EA7u4Q_8HQ0',
    difficulty: 'beginner',
  },

  // === 하체 ===
  default_squat: {
    description: '하체 운동의 왕으로 불리며, 대퇴사두근, 둔근, 햄스트링을 모두 자극합니다.',
    targetMuscles: '대퇴사두근, 둔근, 햄스트링, 코어',
    tips: [
      '발은 어깨너비보다 약간 넓게, 발끝은 약간 바깥으로',
      '무릎은 발끝 방향으로 향하게 하세요',
      '가슴을 펴고 시선은 정면을 유지하세요',
      '엉덩이를 뒤로 빼며 앉으세요',
      '최소 허벅지가 바닥과 평행할 때까지 내려가세요',
    ],
    commonMistakes: [
      '무릎이 안쪽으로 모이는 것',
      '발뒤꿈치가 들리는 것',
      '등이 둥글게 말리는 것',
      '앞으로 쏠리는 것',
    ],
    videoUrl: 'https://www.youtube.com/watch?v=ultWZbUMPL8',
    difficulty: 'intermediate',
    homeAlternative: '맨몸 스쿼트, 고블렛 스쿼트',
  },

  default_leg_press: {
    description: '머신에서 다리로 플랫폼을 밀어내며 대퇴사두근과 둔근을 자극합니다.',
    targetMuscles: '대퇴사두근, 둔근',
    tips: [
      '등과 엉덩이를 시트에 밀착하세요',
      '발은 플랫폼 중앙에 어깨너비로 놓으세요',
      '무릎이 완전히 펴지기 직전에 멈추세요',
      '천천히 내릴 때 무릎이 가슴까지 오게 하세요',
    ],
    commonMistakes: [
      '엉덩이가 시트에서 떨어지는 것',
      '무릎을 완전히 잠그는 것',
      '무릎이 안쪽으로 모이는 것',
    ],
    videoUrl: 'https://www.youtube.com/watch?v=IZxyjW7MPJQ',
    difficulty: 'beginner',
  },

  default_leg_extension: {
    description: '대퇴사두근을 고립시켜 자극하는 머신 운동입니다.',
    targetMuscles: '대퇴사두근',
    tips: [
      '패드가 발목 바로 위에 오게 조절하세요',
      '등을 시트에 밀착하세요',
      '무릎이 완전히 펴지도록 수축하세요',
      '정점에서 1-2초 유지하세요',
    ],
    commonMistakes: [
      '엉덩이가 시트에서 뜨는 것',
      '반동을 사용하는 것',
      '너무 빠르게 수행하는 것',
    ],
    videoUrl: 'https://www.youtube.com/watch?v=YyvSfVjQeL0',
    difficulty: 'beginner',
  },

  default_leg_curl: {
    description: '햄스트링을 고립시켜 자극하는 머신 운동입니다.',
    targetMuscles: '햄스트링',
    tips: [
      '패드가 아킬레스건 바로 위에 오게 조절하세요',
      '골반을 패드에 밀착하세요',
      '발꿈치를 엉덩이 쪽으로 당기세요',
      '정점에서 햄스트링 수축을 느끼세요',
    ],
    commonMistakes: [
      '골반이 들리는 것',
      '반동을 사용하는 것',
      '가동범위가 부족한 것',
    ],
    videoUrl: 'https://www.youtube.com/watch?v=1Tq3QdYUuHs',
    difficulty: 'beginner',
  },

  default_lunge: {
    description: '한 발씩 앞으로 내딛으며 하체 전체를 자극하는 기능성 운동입니다.',
    targetMuscles: '대퇴사두근, 둔근, 햄스트링',
    tips: [
      '발걸음은 어깨너비보다 약간 넓게 하세요',
      '뒷무릎이 바닥에 거의 닿을 때까지 내려가세요',
      '상체는 수직으로 유지하세요',
      '앞 무릎이 발끝을 넘지 않게 하세요',
    ],
    commonMistakes: [
      '보폭이 너무 좁은 것',
      '무릎이 안쪽으로 쏠리는 것',
      '상체가 앞으로 기우는 것',
    ],
    videoUrl: 'https://www.youtube.com/watch?v=QOVaHwm-Q6U',
    difficulty: 'beginner',
  },

  default_calf_raise: {
    description: '발뒤꿈치를 들어올려 종아리 근육을 자극하는 운동입니다.',
    targetMuscles: '비복근, 가자미근',
    tips: [
      '발 앞쪽만 플랫폼에 올리세요',
      '최대한 높이 올라가세요',
      '정점에서 1-2초 유지하세요',
      '천천히 내려 스트레칭하세요',
    ],
    commonMistakes: [
      '가동범위가 부족한 것',
      '무릎을 굽히는 것',
      '반동을 사용하는 것',
    ],
    videoUrl: 'https://www.youtube.com/watch?v=-M4-G8p8fmc',
    difficulty: 'beginner',
  },

  // === 팔 ===
  default_barbell_curl: {
    description: '바벨을 사용하여 이두근을 자극하는 기본 팔 운동입니다.',
    targetMuscles: '이두근',
    tips: [
      '팔꿈치를 몸에 고정하세요',
      '손목을 굽히지 마세요',
      '정점에서 이두근을 쥐어짜세요',
      '천천히 내리며 컨트롤하세요',
    ],
    commonMistakes: [
      '몸을 흔들며 치팅하는 것',
      '팔꿈치가 앞뒤로 움직이는 것',
      '손목을 말아올리는 것',
    ],
    videoUrl: 'https://www.youtube.com/watch?v=kwG2ipFRgfo',
    difficulty: 'beginner',
  },

  default_dumbbell_curl: {
    description: '덤벨을 사용한 이두 운동으로, 손목 회전을 통해 더 강한 수축이 가능합니다.',
    targetMuscles: '이두근',
    tips: [
      '손바닥이 앞을 향하게 시작하세요',
      '팔꿈치를 몸에 고정하세요',
      '올리면서 손목을 바깥으로 회전하세요',
      '교대로 하거나 동시에 수행하세요',
    ],
    commonMistakes: [
      '어깨가 들리는 것',
      '몸을 흔드는 것',
      '팔꿈치가 움직이는 것',
    ],
    videoUrl: 'https://www.youtube.com/watch?v=sAq_ocpRh_I',
    difficulty: 'beginner',
  },

  default_hammer_curl: {
    description: '중립 그립으로 수행하는 이두 운동으로, 상완근과 전완근도 함께 자극합니다.',
    targetMuscles: '이두근, 상완근, 전완근',
    tips: [
      '손바닥이 서로 마주보게 잡으세요',
      '팔꿈치를 몸에 고정하세요',
      '손목을 회전하지 마세요',
      '컨트롤하며 천천히 수행하세요',
    ],
    commonMistakes: [
      '손목이 회전하는 것',
      '몸을 흔드는 것',
      '무게가 너무 무거운 것',
    ],
    videoUrl: 'https://www.youtube.com/watch?v=zC3nLlEvin4',
    difficulty: 'beginner',
  },

  default_tricep_pushdown: {
    description: '케이블 머신에서 바를 아래로 밀어내며 삼두근을 자극합니다.',
    targetMuscles: '삼두근',
    tips: [
      '팔꿈치를 몸에 고정하세요',
      '팔이 완전히 펴질 때까지 밀어내세요',
      '정점에서 삼두근을 수축하세요',
      '천천히 올리며 저항을 유지하세요',
    ],
    commonMistakes: [
      '팔꿈치가 움직이는 것',
      '상체를 숙이는 것',
      '무게가 너무 무거운 것',
    ],
    videoUrl: 'https://www.youtube.com/watch?v=2-LAMcpzODU',
    difficulty: 'beginner',
    homeAlternative: '밴드 푸쉬다운, 다이아몬드 푸쉬업',
  },

  default_tricep_dip: {
    description: '평행봉이나 벤치에서 몸을 내렸다 올리며 삼두근을 자극합니다.',
    targetMuscles: '삼두근, 가슴, 전면 삼각근',
    tips: [
      '몸을 수직으로 유지하면 삼두에 집중됩니다',
      '팔꿈치는 뒤를 향하게 하세요',
      '90도까지 내려간 후 밀어올리세요',
      '초보자는 벤치 딥부터 시작하세요',
    ],
    commonMistakes: [
      '어깨가 들리는 것',
      '너무 깊게 내려가는 것',
      '몸이 앞으로 기우는 것',
    ],
    videoUrl: 'https://www.youtube.com/watch?v=6kALZikXxLc',
    difficulty: 'intermediate',
  },

  default_skull_crusher: {
    description: '누운 상태에서 바벨을 이마 쪽으로 내렸다 올리며 삼두근을 자극합니다.',
    targetMuscles: '삼두근 (장두)',
    tips: [
      '팔꿈치를 천장을 향해 고정하세요',
      '바벨을 이마나 머리 뒤쪽으로 내리세요',
      '팔꿈치만 움직여 수행하세요',
      'EZ바를 사용하면 손목 부담이 줄어듭니다',
    ],
    commonMistakes: [
      '팔꿈치가 벌어지는 것',
      '어깨가 움직이는 것',
      '무게가 너무 무거운 것',
    ],
    videoUrl: 'https://www.youtube.com/watch?v=d_KZxkY_0cM',
    difficulty: 'intermediate',
  },

  // === 코어 ===
  default_plank: {
    description: '엎드린 자세에서 몸을 일직선으로 유지하며 코어를 자극하는 정적 운동입니다.',
    targetMuscles: '복직근, 복횡근, 기립근',
    tips: [
      '팔꿈치를 어깨 아래에 놓으세요',
      '몸 전체를 일직선으로 유지하세요',
      '복근에 힘을 주고 호흡을 유지하세요',
      '엉덩이가 올라가거나 처지지 않게 하세요',
    ],
    commonMistakes: [
      '엉덩이가 올라가는 것',
      '허리가 처지는 것',
      '목이 꺾이는 것',
    ],
    videoUrl: 'https://www.youtube.com/watch?v=ASdvN_XEl_c',
    difficulty: 'beginner',
  },

  default_crunch: {
    description: '누운 상태에서 상체를 말아올리며 복직근 상부를 자극합니다.',
    targetMuscles: '복직근 상부',
    tips: [
      '손을 머리 뒤에 가볍게 대세요 (당기지 마세요)',
      '어깨가 바닥에서 떨어질 정도로만 올리세요',
      '복근으로 몸을 말아올린다고 생각하세요',
      '내려갈 때 천천히 컨트롤하세요',
    ],
    commonMistakes: [
      '손으로 목을 당기는 것',
      '너무 높이 올라가는 것',
      '반동을 사용하는 것',
    ],
    videoUrl: 'https://www.youtube.com/watch?v=Xyd_fa5zoEU',
    difficulty: 'beginner',
  },

  default_leg_raise: {
    description: '누운 상태에서 다리를 들어올려 복직근 하부를 자극합니다.',
    targetMuscles: '복직근 하부, 고관절 굴곡근',
    tips: [
      '허리를 바닥에 밀착하세요',
      '다리를 곧게 펴거나 무릎을 약간 굽히세요',
      '복근으로 골반을 들어올린다고 생각하세요',
      '천천히 내리며 허리가 뜨지 않게 하세요',
    ],
    commonMistakes: [
      '허리가 바닥에서 뜨는 것',
      '반동을 사용하는 것',
      '다리가 흔들리는 것',
    ],
    videoUrl: 'https://www.youtube.com/watch?v=JB2oyawG9KI',
    difficulty: 'beginner',
  },

  default_russian_twist: {
    description: '앉은 자세에서 상체를 좌우로 비틀며 복사근을 자극합니다.',
    targetMuscles: '복사근, 복직근',
    tips: [
      '무릎을 굽히고 발을 바닥에서 살짝 들어올리세요',
      '상체를 45도 정도 뒤로 기울이세요',
      '손을 모으고 좌우로 천천히 비트세요',
      '시선은 손을 따라가세요',
    ],
    commonMistakes: [
      '엉덩이로 회전하는 것',
      '등이 둥글게 말리는 것',
      '너무 빠르게 수행하는 것',
    ],
    videoUrl: 'https://www.youtube.com/watch?v=wkD8rjkodUI',
    difficulty: 'beginner',
  },

  // === HIIT ===
  default_burpee: {
    description: '스쿼트, 플랭크, 점프를 결합한 전신 고강도 운동입니다.',
    targetMuscles: '전신, 심폐지구력',
    tips: [
      '스쿼트 자세로 시작하세요',
      '손을 바닥에 짚고 다리를 뒤로 차 플랭크 자세로',
      '푸쉬업 후 다리를 앞으로 당기세요',
      '점프하며 팔을 위로 뻗으세요',
    ],
    commonMistakes: [
      '허리가 처지는 것',
      '점프를 생략하는 것',
      '폼이 무너지는 것',
    ],
    videoUrl: 'https://www.youtube.com/watch?v=dZgVxmf6jkA',
    difficulty: 'intermediate',
  },

  default_mountain_climber: {
    description: '플랭크 자세에서 다리를 번갈아 당기는 전신 유산소 운동입니다.',
    targetMuscles: '코어, 어깨, 심폐지구력',
    tips: [
      '플랭크 자세를 유지하세요',
      '무릎을 가슴 쪽으로 번갈아 당기세요',
      '엉덩이가 올라가지 않게 하세요',
      '빠르게 하되 폼을 유지하세요',
    ],
    commonMistakes: [
      '엉덩이가 올라가는 것',
      '어깨가 앞으로 빠지는 것',
      '발이 완전히 착지하는 것',
    ],
    videoUrl: 'https://www.youtube.com/watch?v=nmwgirgXLYM',
    difficulty: 'beginner',
  },

  default_kettlebell_swing: {
    description: '케틀벨을 스윙하여 후면 사슬과 심폐 지구력을 동시에 자극합니다.',
    targetMuscles: '둔근, 햄스트링, 코어, 어깨',
    tips: [
      '힙 힌지(엉덩이 뒤로 빼기)가 핵심입니다',
      '팔이 아닌 엉덩이 힘으로 스윙하세요',
      '케틀벨이 눈높이까지 올라가면 됩니다',
      '코어에 힘을 주고 등을 곧게 유지하세요',
    ],
    commonMistakes: [
      '팔로 들어올리는 것',
      '스쿼트처럼 수행하는 것',
      '등이 둥글게 말리는 것',
    ],
    videoUrl: 'https://www.youtube.com/watch?v=YSxHifyI6s8',
    difficulty: 'intermediate',
  },
};

// 운동 가이드 조회 헬퍼
export const getExerciseGuide = (exerciseId: string): ExerciseGuide | null => {
  return EXERCISE_GUIDES[exerciseId] || null;
};

// 난이도별 필터
export const getExercisesByDifficulty = (difficulty: ExerciseGuide['difficulty']): string[] => {
  return Object.entries(EXERCISE_GUIDES)
    .filter(([_, guide]) => guide.difficulty === difficulty)
    .map(([id]) => id);
};

// 홈트레이닝 가능 운동 필터
export const getHomeWorkoutExercises = (): string[] => {
  return Object.entries(EXERCISE_GUIDES)
    .filter(([_, guide]) => guide.homeAlternative)
    .map(([id]) => id);
};
