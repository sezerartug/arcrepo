import type { ListingStatus } from '../../../db/schema.js';

// Listing state machine. Edits to a published or rejected listing send it back to review.
const TRANSITIONS: Record<ListingStatus, readonly ListingStatus[]> = {
  pending_review: ['published', 'rejected', 'removed'],
  published: ['pending_review', 'sold', 'removed'],
  rejected: ['pending_review', 'removed'],
  sold: [],
  removed: [],
};

export const canTransition = (from: ListingStatus, to: ListingStatus): boolean =>
  TRANSITIONS[from].includes(to);

export const LISTING_STATUSES = Object.keys(TRANSITIONS) as ListingStatus[];
