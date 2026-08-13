import type { CardProgress, ReviewRating } from '@/src/types/models';

const MINUTES_PER_DAY = 24 * 60;

export interface ScheduleResult {
  repetitions: number;
  consecutiveCorrect: number;
  intervalMinutes: number;
  nextReviewAt: Date;
  mastered: boolean;
}

export function calculateNextReview(
  current: CardProgress | undefined,
  rating: ReviewRating,
  now = new Date(),
): ScheduleResult {
  const previousInterval = current?.intervalMinutes ?? 0;
  const previousCorrect = current?.consecutiveCorrect ?? 0;
  const repetitions = (current?.repetitions ?? 0) + 1;

  let intervalMinutes: number;
  let consecutiveCorrect: number;

  if (rating === 'again') {
    intervalMinutes = 10;
    consecutiveCorrect = 0;
  } else if (rating === 'hard') {
    intervalMinutes = Math.max(MINUTES_PER_DAY, Math.round(previousInterval * 1.5));
    consecutiveCorrect = previousCorrect + 1;
  } else {
    intervalMinutes = previousInterval === 0
      ? 3 * MINUTES_PER_DAY
      : Math.max(3 * MINUTES_PER_DAY, Math.round(previousInterval * 2.5));
    consecutiveCorrect = previousCorrect + 1;
  }

  return {
    repetitions,
    consecutiveCorrect,
    intervalMinutes,
    nextReviewAt: new Date(now.getTime() + intervalMinutes * 60_000),
    mastered: consecutiveCorrect >= 3 && intervalMinutes >= 7 * MINUTES_PER_DAY,
  };
}

export function isDue(progress: CardProgress | undefined, now = new Date()) {
  if (!progress?.nextReviewAt) return true;
  const value = progress.nextReviewAt;
  const date = value instanceof Date ? value : value.toDate();
  return date.getTime() <= now.getTime();
}
