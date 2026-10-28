import { describe, expect, it } from 'vitest';
import { LISTING_STATUSES, canTransition } from './listing-status.js';

describe('listing state machine', () => {
  it('allows the moderation and lifecycle paths', () => {
    expect(canTransition('pending_review', 'published')).toBe(true);
    expect(canTransition('pending_review', 'rejected')).toBe(true);
    expect(canTransition('published', 'removed')).toBe(true);
    expect(canTransition('published', 'pending_review')).toBe(true);
    expect(canTransition('rejected', 'pending_review')).toBe(true);
  });

  it('never publishes without review and never leaves a terminal state', () => {
    expect(canTransition('rejected', 'published')).toBe(false);
    expect(canTransition('removed', 'published')).toBe(false);
    for (const to of LISTING_STATUSES) {
      expect(canTransition('removed', to)).toBe(false);
      expect(canTransition('sold', to)).toBe(false);
    }
  });
});
