import { supabase } from './supabase';
import { CompletedWorkout, CompletedExercise } from '@/stores/historyStore';
import { DEFAULT_EXERCISES } from '@/data/defaultExercises';

// 운동 데이터가 Supabase에 존재하는지 확인하고 없으면 추가
const ensureExercisesExist = async (exercises: CompletedExercise[]): Promise<void> => {
  const exerciseIds = [...new Set(exercises.map((e) => e.exercise_id))];

  for (const exerciseId of exerciseIds) {
    // 기본 운동인 경우 (default_로 시작)
    if (exerciseId.startsWith('default_')) {
      const defaultExercise = DEFAULT_EXERCISES.find((e) => e.id === exerciseId);
      if (defaultExercise) {
        try {
          // upsert로 이미 있으면 무시, 없으면 추가
          const { error } = await supabase
            .from('exercises')
            .upsert({
              id: defaultExercise.id,
              name: defaultExercise.name,
              name_ko: defaultExercise.name_ko,
              category: defaultExercise.category,
              muscle_group: defaultExercise.muscle_group,
              equipment: defaultExercise.equipment,
              is_custom: false,
              user_id: null,
            }, { onConflict: 'id' });

          if (error) {
            console.error(`Failed to ensure exercise ${exerciseId}:`, error);
          }
        } catch (e) {
          console.error(`Error ensuring exercise ${exerciseId}:`, e);
        }
      }
    }
  }
};

// 운동 기록을 Supabase에 저장
export const saveWorkoutToCloud = async (
  userId: string,
  workout: CompletedWorkout
): Promise<boolean> => {
  try {
    // 0. 운동 데이터가 Supabase에 존재하는지 먼저 확인
    await ensureExercisesExist(workout.exercises);

    // 1. workout_sessions 저장
    const { data: session, error: sessionError } = await supabase
      .from('workout_sessions')
      .upsert({
        id: workout.id,
        user_id: userId,
        name: workout.name,
        started_at: workout.started_at,
        finished_at: workout.finished_at,
        duration_minutes: workout.duration_minutes,
        notes: null,
      })
      .select()
      .single();

    if (sessionError) {
      console.error('Error saving workout session:', sessionError);
      return false;
    }

    // 2. 각 운동에 대해 workout_exercises와 workout_sets 저장
    for (let i = 0; i < workout.exercises.length; i++) {
      const exercise = workout.exercises[i];

      // workout_exercises 저장
      const { data: workoutExercise, error: exerciseError } = await supabase
        .from('workout_exercises')
        .upsert({
          id: exercise.id,
          session_id: workout.id,
          exercise_id: exercise.exercise_id,
          order_index: i,
          notes: null,
        })
        .select()
        .single();

      if (exerciseError) {
        console.error('Error saving workout exercise:', exerciseError);
        continue;
      }

      // workout_sets 저장
      for (let j = 0; j < exercise.sets.length; j++) {
        const set = exercise.sets[j];
        const { error: setError } = await supabase
          .from('workout_sets')
          .upsert({
            id: set.id,
            workout_exercise_id: exercise.id,
            set_number: j + 1,
            weight: set.weight,
            reps: set.reps,
            is_warmup: set.is_warmup || false,
            is_dropset: set.is_dropset || false,
            rpe: set.rpe,
            completed_at: set.completed_at || workout.finished_at,
          });

        if (setError) {
          console.error('Error saving workout set:', setError);
        }
      }
    }

    console.log('Workout saved to cloud:', workout.id);
    return true;
  } catch (error) {
    console.error('Error in saveWorkoutToCloud:', error);
    return false;
  }
};

// Supabase에서 운동 기록 가져오기
export const fetchWorkoutsFromCloud = async (
  userId: string
): Promise<CompletedWorkout[]> => {
  try {
    // 1. workout_sessions 가져오기
    const { data: sessions, error: sessionsError } = await supabase
      .from('workout_sessions')
      .select('*')
      .eq('user_id', userId)
      .not('finished_at', 'is', null)
      .order('finished_at', { ascending: false });

    if (sessionsError) {
      console.error('Error fetching workout sessions:', sessionsError);
      return [];
    }

    if (!sessions || sessions.length === 0) {
      return [];
    }

    const completedWorkouts: CompletedWorkout[] = [];

    for (const session of sessions) {
      // 2. 각 세션의 운동들 가져오기
      const { data: exercises, error: exercisesError } = await supabase
        .from('workout_exercises')
        .select(`
          *,
          exercises (
            id,
            name,
            name_ko,
            category
          )
        `)
        .eq('session_id', session.id)
        .order('order_index');

      if (exercisesError) {
        console.error('Error fetching workout exercises:', exercisesError);
        continue;
      }

      const completedExercises: CompletedExercise[] = [];
      let totalSets = 0;
      let totalVolume = 0;

      for (const exercise of exercises || []) {
        // 3. 각 운동의 세트들 가져오기
        const { data: sets, error: setsError } = await supabase
          .from('workout_sets')
          .select('*')
          .eq('workout_exercise_id', exercise.id)
          .order('set_number');

        if (setsError) {
          console.error('Error fetching workout sets:', setsError);
          continue;
        }

        const exerciseData = exercise.exercises as any;
        
        const mappedSets = (sets || []).map((set) => ({
          id: set.id,
          workout_exercise_id: set.workout_exercise_id,
          set_number: set.set_number,
          weight: set.weight,
          reps: set.reps,
          duration_seconds: set.duration_seconds,
          distance_meters: set.distance_meters,
          is_warmup: set.is_warmup,
          is_dropset: set.is_dropset,
          rpe: set.rpe,
          completed_at: set.completed_at,
          created_at: set.created_at,
        }));

        totalSets += mappedSets.length;
        totalVolume += mappedSets.reduce(
          (sum, s) => sum + (s.weight || 0) * (s.reps || 0),
          0
        );

        completedExercises.push({
          id: exercise.id,
          exercise_id: exerciseData?.id || exercise.exercise_id,
          exercise_name: exerciseData?.name || 'Unknown',
          exercise_name_ko: exerciseData?.name_ko || null,
          category: exerciseData?.category || 'other',
          sets: mappedSets,
        });
      }

      completedWorkouts.push({
        id: session.id,
        name: session.name || '운동',
        started_at: session.started_at,
        finished_at: session.finished_at!,
        duration_minutes: session.duration_minutes || 0,
        exercises: completedExercises,
        total_sets: totalSets,
        total_volume: totalVolume,
      });
    }

    console.log(`Fetched ${completedWorkouts.length} workouts from cloud`);
    return completedWorkouts;
  } catch (error) {
    console.error('Error in fetchWorkoutsFromCloud:', error);
    return [];
  }
};

// 클라우드에서 운동 기록 삭제
export const deleteWorkoutFromCloud = async (
  workoutId: string
): Promise<boolean> => {
  try {
    // workout_sessions 삭제 (CASCADE로 관련 데이터도 삭제됨)
    const { error } = await supabase
      .from('workout_sessions')
      .delete()
      .eq('id', workoutId);

    if (error) {
      console.error('Error deleting workout from cloud:', error);
      return false;
    }

    console.log('Workout deleted from cloud:', workoutId);
    return true;
  } catch (error) {
    console.error('Error in deleteWorkoutFromCloud:', error);
    return false;
  }
};

// 로컬과 클라우드 데이터 병합 (더 완전한 데이터 우선)
export const mergeWorkouts = (
  localWorkouts: CompletedWorkout[],
  cloudWorkouts: CompletedWorkout[]
): CompletedWorkout[] => {
  const workoutMap = new Map<string, CompletedWorkout>();

  // 로컬 데이터 먼저 추가
  localWorkouts.forEach((w) => workoutMap.set(w.id, w));

  // 클라우드 데이터 - 더 많은 세트가 있거나 같은 경우에만 덮어씀
  // 이렇게 하면 클라우드 저장이 완료되기 전에 sync가 실행되어도
  // 로컬의 완전한 데이터가 유지됨
  cloudWorkouts.forEach((w) => {
    const existing = workoutMap.get(w.id);
    if (!existing) {
      // 로컬에 없으면 클라우드 데이터 추가
      workoutMap.set(w.id, w);
    } else if (w.total_sets >= existing.total_sets) {
      // 클라우드가 더 많거나 같은 세트를 가지면 클라우드 데이터 사용
      workoutMap.set(w.id, w);
    }
    // 클라우드 세트가 더 적으면 로컬 데이터 유지
  });

  // 날짜 순으로 정렬
  return Array.from(workoutMap.values()).sort(
    (a, b) => new Date(b.finished_at).getTime() - new Date(a.finished_at).getTime()
  );
};
