/**
 * Character limits shown by the Character Counter.
 * Platforms change these; review them periodically and update LIMITS_REVIEWED.
 * SMS is computed separately (it is a protocol rule, not a platform choice).
 */
export const LIMITS_REVIEWED = 'October 2026';

export interface CharLimit {
  id: string;
  name: string;
  max: number;
  /** guideline: a widely used recommendation, not a hard cut-off. */
  kind: 'limit' | 'guideline';
  note?: string;
}

export const CHAR_LIMITS: CharLimit[] = [
  { id: 'title', name: 'Page title (search results)', max: 60, kind: 'guideline', note: 'Search engines cut titles by width; about 60 characters usually fits.' },
  { id: 'meta', name: 'Meta description', max: 155, kind: 'guideline', note: 'Longer descriptions are usually shortened in search results.' },
  { id: 'x', name: 'X (Twitter) post', max: 280, kind: 'limit', note: 'X counts some characters, such as emoji and CJK, as two, and links as 23.' },
  { id: 'youtube-title', name: 'YouTube title', max: 100, kind: 'limit' },
  { id: 'instagram', name: 'Instagram caption', max: 2200, kind: 'limit' },
  { id: 'linkedin', name: 'LinkedIn post', max: 3000, kind: 'limit' },
];
