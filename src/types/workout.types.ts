import { Exercise, WorkoutSession, WorkoutExercise, WorkoutSet } from './database.types';

// 운동 세션에 연결된 운동들 (세트 포함)
export interface WorkoutExerciseWithSets extends WorkoutExercise {
  exercise: Exercise;
  sets: WorkoutSet[];
}

// 전체 운동 세션 데이터 (운동 + 세트 포함)
export interface WorkoutSessionWithDetails extends WorkoutSession {
  exercises: WorkoutExerciseWithSets[];
}

// 세트 입력 데이터
export interface SetInput {
  set_number: number;
  weight?: number;
  reps?: number;
  duration_seconds?: number;
  is_warmup?: boolean;
  is_dropset?: boolean;
  rpe?: number;
  profile_id?: string; // 누구의 세트인지 (같이 운동할 때)
  note?: string; // 세트별 메모 (예: "손목 통증 느낌", "그립 변경")
}

// 운동 카테고리
export type ExerciseCategory =
  | 'chest'      // 가슴
  | 'back'       // 등
  | 'shoulders'  // 어깨
  | 'legs'       // 하체
  | 'arms'       // 팔
  | 'core'       // 코어
  | 'cardio';    // 유산소

// 운동 장비
export type Equipment =
  | 'barbell'    // 바벨
  | 'dumbbell'   // 덤벨
  | 'machine'    // 머신
  | 'cable'      // 케이블
  | 'bodyweight' // 맨몸
  | 'kettlebell' // 케틀벨
  | 'band'       // 밴드
  | 'other';     // 기타

// 시간 분석 데이터 타입
export interface TimeBreakdown {
  totalSeconds: number;    // 총 운동 시간 (초)
  restSeconds: number;     // 휴식 시간 (초)
  activeSeconds: number;   // 실제 운동 시간 (초)
}

// 통계 데이터 타입
export interface ExerciseProgress {
  date: string;
  maxWeight: number;
  totalVolume: number;
  estimated1RM: number;
}

export interface WorkoutStats {
  totalWorkouts: number;
  totalVolume: number;
  totalDuration: number;
  averageDuration: number;
  workoutsByDay: Record<string, number>;
}
