/**
 * RPE 추천 알고리즘 단위 테스트
 */

import {
  estimate1RMWithRPE,
  getNextSetRecommendations,
  formatRecommendation,
} from '../rpeRecommendation';

describe('RPE Recommendation Utilities', () => {
  describe('estimate1RMWithRPE', () => {
    it('should estimate 1RM correctly for RPE 10 (0 RIR)', () => {
      // 100kg × 1회 @ RPE 10 = 100kg 1RM
      const result = estimate1RMWithRPE(100, 1, 10);
      expect(result).toBeCloseTo(100, 1);
    });

    it('should estimate 1RM correctly for RPE 8 (2 RIR)', () => {
      // 80kg × 8회 @ RPE 8 = 실제로는 10회 가능
      // 1RM = 80 × (1 + 10/30) = 80 × 1.333 = 106.67kg
      const result = estimate1RMWithRPE(80, 8, 8);
      expect(result).toBeCloseTo(106.67, 1);
    });

    it('should estimate 1RM correctly for RPE 7 (3 RIR)', () => {
      // 60kg × 5회 @ RPE 7 = 실제로는 8회 가능
      // 1RM = 60 × (1 + 8/30) = 60 × 1.267 = 76kg
      const result = estimate1RMWithRPE(60, 5, 7);
      expect(result).toBeCloseTo(76, 1);
    });
  });

  describe('getNextSetRecommendations for RPE 6-7 (여유)', () => {
    it('should recommend weight increase for RPE 6', () => {
      const recommendations = getNextSetRecommendations(50, 10, 6);

      expect(recommendations).toHaveLength(3);

      // 옵션 1: 무게 2.5kg 증가
      expect(recommendations[0].weight).toBe(52.5);
      expect(recommendations[0].reps).toBe(10);
      expect(recommendations[0].reason).toContain('2.5kg');

      // 옵션 2: 무게 5kg 증가 (50kg >= 20kg이므로 포함됨)
      expect(recommendations[1].weight).toBe(55);
      expect(recommendations[1].reps).toBe(10);
      expect(recommendations[1].reason).toContain('5kg');

      // 옵션 3: 횟수 증가
      expect(recommendations[2].weight).toBe(50);
      expect(recommendations[2].reps).toBe(12);
      expect(recommendations[2].reason).toContain('횟수 증가');
    });

    it('should not recommend 5kg increase for light weights', () => {
      const recommendations = getNextSetRecommendations(15, 12, 7);

      // 15kg < 20kg이므로 5kg 증가 옵션 없음
      expect(recommendations).toHaveLength(2);
      expect(recommendations.every((r) => !r.reason.includes('5kg'))).toBe(true);
    });
  });

  describe('getNextSetRecommendations for RPE 8 (적당)', () => {
    it('should recommend maintaining or slight decrease for RPE 8', () => {
      const recommendations = getNextSetRecommendations(60, 8, 8);

      expect(recommendations).toHaveLength(3);

      // 옵션 1: 동일 유지
      expect(recommendations[0].weight).toBe(60);
      expect(recommendations[0].reps).toBe(8);
      expect(recommendations[0].reason).toContain('동일 유지');

      // 옵션 2: 횟수 감소
      expect(recommendations[1].weight).toBe(60);
      expect(recommendations[1].reps).toBe(7);
      expect(recommendations[1].reason).toContain('횟수 감소');

      // 옵션 3: 무게 증가, 횟수 감소
      expect(recommendations[2].weight).toBe(62.5);
      expect(recommendations[2].reps).toBe(6);
      expect(recommendations[2].reason).toContain('무게 증가, 횟수 감소');
    });

    it('should limit recommendations for low rep ranges', () => {
      const recommendations = getNextSetRecommendations(100, 3, 8);

      // 3회는 5회 이하이므로 옵션 3 없음
      expect(recommendations).toHaveLength(2);
    });
  });

  describe('getNextSetRecommendations for RPE 9-10 (힘듦/한계)', () => {
    it('should recommend weight decrease for RPE 9', () => {
      const recommendations = getNextSetRecommendations(80, 5, 9);

      expect(recommendations).toHaveLength(3);

      // 옵션 1: 무게 5% 감소
      const expected5Percent = Math.round((80 * 0.95) / 2.5) * 2.5;
      expect(recommendations[0].weight).toBe(expected5Percent);
      expect(recommendations[0].reps).toBe(5);
      expect(recommendations[0].reason).toContain('5%');

      // 옵션 2: 무게 10% 감소
      const expected10Percent = Math.round((80 * 0.9) / 2.5) * 2.5;
      expect(recommendations[1].weight).toBe(expected10Percent);
      expect(recommendations[1].reps).toBe(5);
      expect(recommendations[1].reason).toContain('10%');

      // 옵션 3: 횟수 감소
      expect(recommendations[2].weight).toBe(80);
      expect(recommendations[2].reps).toBe(3);
      expect(recommendations[2].reason).toContain('횟수 감소');
    });

    it('should not go below 2.5kg', () => {
      const recommendations = getNextSetRecommendations(5, 10, 10);

      // 5kg × 0.9 = 4.5kg, 반올림하면 5kg
      // 5kg × 0.95 = 4.75kg, 반올림하면 5kg
      recommendations.forEach((rec) => {
        expect(rec.weight).toBeGreaterThanOrEqual(2.5);
      });
    });
  });

  describe('formatRecommendation', () => {
    it('should format recommendation correctly', () => {
      const recommendation = {
        weight: 50,
        reps: 10,
        reason: '무게 증가 (2.5kg ↑)',
      };

      const formatted = formatRecommendation(recommendation);
      expect(formatted).toBe('50kg × 10회 (무게 증가 (2.5kg ↑))');
    });

    it('should handle decimal weights', () => {
      const recommendation = {
        weight: 52.5,
        reps: 8,
        reason: '무게 증가',
      };

      const formatted = formatRecommendation(recommendation);
      expect(formatted).toBe('52.5kg × 8회 (무게 증가)');
    });
  });

  describe('Edge cases', () => {
    it('should handle very high RPE (10)', () => {
      const recommendations = getNextSetRecommendations(100, 1, 10);

      expect(recommendations).toHaveLength(2); // 횟수 감소 옵션 없음 (1회 이하)
      expect(recommendations[0].weight).toBeLessThan(100);
      expect(recommendations[1].weight).toBeLessThan(100);
    });

    it('should handle very low RPE (6)', () => {
      const recommendations = getNextSetRecommendations(40, 12, 6);

      expect(recommendations).toHaveLength(3);
      expect(recommendations[0].weight).toBeGreaterThan(40);
      expect(recommendations[2].reps).toBeGreaterThan(12);
    });

    it('should round weights to 2.5kg increments', () => {
      const recommendations = getNextSetRecommendations(47, 8, 8);

      recommendations.forEach((rec) => {
        expect(rec.weight % 2.5).toBeCloseTo(0, 1);
      });
    });
  });
});
