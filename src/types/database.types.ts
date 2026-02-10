export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      fitness_profiles: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          avatar_url: string | null;
          gender: 'male' | 'female' | 'other' | null;
          birth_year: number | null;
          height_cm: number | null;
          weight_kg: number | null;
          is_default: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          avatar_url?: string | null;
          gender?: 'male' | 'female' | 'other' | null;
          birth_year?: number | null;
          height_cm?: number | null;
          weight_kg?: number | null;
          is_default?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          avatar_url?: string | null;
          gender?: 'male' | 'female' | 'other' | null;
          birth_year?: number | null;
          height_cm?: number | null;
          weight_kg?: number | null;
          is_default?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'fitness_profiles_user_id_fkey';
            columns: ['user_id'];
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          }
        ];
      };
      profiles: {
        Row: {
          id: string;
          username: string | null;
          display_name: string | null;
          avatar_url: string | null;
          unit_system: 'metric' | 'imperial';
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          username?: string | null;
          display_name?: string | null;
          avatar_url?: string | null;
          unit_system?: 'metric' | 'imperial';
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          username?: string | null;
          display_name?: string | null;
          avatar_url?: string | null;
          unit_system?: 'metric' | 'imperial';
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      exercises: {
        Row: {
          id: string;
          name: string;
          name_ko: string | null;
          category: string;
          muscle_group: string[];
          equipment: string | null;
          is_custom: boolean;
          user_id: string | null;
          profile_id: string | null;
          weight_unit: 'kg' | 'lb';
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          name_ko?: string | null;
          category: string;
          muscle_group?: string[];
          equipment?: string | null;
          is_custom?: boolean;
          user_id?: string | null;
          profile_id?: string | null;
          weight_unit?: 'kg' | 'lb';
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          name_ko?: string | null;
          category?: string;
          muscle_group?: string[];
          equipment?: string | null;
          is_custom?: boolean;
          user_id?: string | null;
          profile_id?: string | null;
          weight_unit?: 'kg' | 'lb';
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'exercises_user_id_fkey';
            columns: ['user_id'];
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          }
        ];
      };
      workout_sessions: {
        Row: {
          id: string;
          user_id: string;
          profile_id: string | null;
          name: string | null;
          started_at: string;
          finished_at: string | null;
          duration_minutes: number | null;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          profile_id?: string | null;
          name?: string | null;
          started_at?: string;
          finished_at?: string | null;
          duration_minutes?: number | null;
          notes?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          profile_id?: string | null;
          name?: string | null;
          started_at?: string;
          finished_at?: string | null;
          duration_minutes?: number | null;
          notes?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'workout_sessions_user_id_fkey';
            columns: ['user_id'];
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          }
        ];
      };
      workout_exercises: {
        Row: {
          id: string;
          session_id: string;
          exercise_id: string;
          order_index: number;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          session_id: string;
          exercise_id: string;
          order_index: number;
          notes?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          session_id?: string;
          exercise_id?: string;
          order_index?: number;
          notes?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'workout_exercises_session_id_fkey';
            columns: ['session_id'];
            referencedRelation: 'workout_sessions';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'workout_exercises_exercise_id_fkey';
            columns: ['exercise_id'];
            referencedRelation: 'exercises';
            referencedColumns: ['id'];
          }
        ];
      };
      workout_sets: {
        Row: {
          id: string;
          workout_exercise_id: string;
          set_number: number;
          weight: number | null;
          reps: number | null;
          duration_seconds: number | null;
          distance_meters: number | null;
          is_warmup: boolean;
          is_dropset: boolean;
          rpe: number | null;
          note: string | null;
          completed_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          workout_exercise_id: string;
          set_number: number;
          weight?: number | null;
          reps?: number | null;
          duration_seconds?: number | null;
          distance_meters?: number | null;
          is_warmup?: boolean;
          is_dropset?: boolean;
          rpe?: number | null;
          note?: string | null;
          completed_at?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          workout_exercise_id?: string;
          set_number?: number;
          weight?: number | null;
          reps?: number | null;
          duration_seconds?: number | null;
          distance_meters?: number | null;
          is_warmup?: boolean;
          is_dropset?: boolean;
          rpe?: number | null;
          note?: string | null;
          completed_at?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'workout_sets_workout_exercise_id_fkey';
            columns: ['workout_exercise_id'];
            referencedRelation: 'workout_exercises';
            referencedColumns: ['id'];
          }
        ];
      };
      personal_records: {
        Row: {
          id: string;
          user_id: string;
          profile_id: string | null;
          exercise_id: string;
          record_type: 'max_weight' | 'max_reps' | 'max_volume';
          value: number;
          achieved_at: string;
          workout_set_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          profile_id?: string | null;
          exercise_id: string;
          record_type: 'max_weight' | 'max_reps' | 'max_volume';
          value: number;
          achieved_at: string;
          workout_set_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          profile_id?: string | null;
          exercise_id?: string;
          record_type?: 'max_weight' | 'max_reps' | 'max_volume';
          value?: number;
          achieved_at?: string;
          workout_set_id?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'personal_records_user_id_fkey';
            columns: ['user_id'];
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'personal_records_exercise_id_fkey';
            columns: ['exercise_id'];
            referencedRelation: 'exercises';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'personal_records_workout_set_id_fkey';
            columns: ['workout_set_id'];
            referencedRelation: 'workout_sets';
            referencedColumns: ['id'];
          }
        ];
      };
    };
    Views: {};
    Functions: {};
    Enums: {};
  };
}

// 편의를 위한 타입 별칭
export type Profile = Database['public']['Tables']['profiles']['Row'];
export type FitnessProfile = Database['public']['Tables']['fitness_profiles']['Row'];
export type FitnessProfileInsert = Database['public']['Tables']['fitness_profiles']['Insert'];
export type FitnessProfileUpdate = Database['public']['Tables']['fitness_profiles']['Update'];
export type Exercise = Database['public']['Tables']['exercises']['Row'];
export type WorkoutSession = Database['public']['Tables']['workout_sessions']['Row'];
export type WorkoutExercise = Database['public']['Tables']['workout_exercises']['Row'];
export type WorkoutSet = Database['public']['Tables']['workout_sets']['Row'];
export type PersonalRecord = Database['public']['Tables']['personal_records']['Row'];

// Insert 타입
export type WorkoutSessionInsert = Database['public']['Tables']['workout_sessions']['Insert'];
export type WorkoutExerciseInsert = Database['public']['Tables']['workout_exercises']['Insert'];
export type WorkoutSetInsert = Database['public']['Tables']['workout_sets']['Insert'];
