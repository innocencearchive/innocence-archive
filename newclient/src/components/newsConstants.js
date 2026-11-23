// src/components/newsConstants.js
// Shared News Category metadata, badges, and helpers across Homepage, News Hub, Profiles & Admin

export const NEWS_CATEGORIES = [
  {
    value: 'EXONERATION',
    label: 'Exoneration',
    plural: 'Exonerations',
    badgeClass: 'bg-emerald-950/80 text-emerald-300 border-emerald-700/70',
    dotClass: 'bg-emerald-400',
  },
  {
    value: 'CALL_FOR_ACTION',
    label: 'Call for Action',
    plural: 'Calls for Action',
    badgeClass: 'bg-orange-950/90 text-orange-300 border-orange-500/80',
    dotClass: 'bg-orange-400',
  },
  {
    value: 'CASE_UPDATE',
    label: 'Case Update',
    plural: 'Case Updates',
    badgeClass: 'bg-sky-950/80 text-sky-300 border-sky-700/70',
    dotClass: 'bg-sky-400',
  },
  {
    value: 'CASE_SETBACK',
    label: 'Case Setback',
    plural: 'Case Setbacks',
    badgeClass: 'bg-rose-950/80 text-rose-300 border-rose-700/70',
    dotClass: 'bg-rose-400',
  },
  {
    value: 'NEW_MEDIA',
    label: 'New Media',
    plural: 'New Media',
    badgeClass: 'bg-amber-950/80 text-amber-300 border-amber-700/70',
    dotClass: 'bg-amber-400',
  },
  {
    value: 'POLICY',
    label: 'Policy & Reform',
    plural: 'Policy & Reform',
    badgeClass: 'bg-violet-950/80 text-violet-300 border-violet-700/70',
    dotClass: 'bg-violet-400',
  },
  {
    value: 'GENERAL',
    label: 'General',
    plural: 'General',
    badgeClass: 'bg-gray-800 text-gray-300 border-gray-600',
    dotClass: 'bg-gray-400',
  },
];

export const NEWS_CATEGORY_MAP = Object.fromEntries(
  NEWS_CATEGORIES.map((c) => [c.value, c])
);

export function getNewsCategoryMeta(category) {
  return NEWS_CATEGORY_MAP[category] || NEWS_CATEGORY_MAP.GENERAL;
}

export function formatNewsDate(dateVal) {
  if (!dateVal) return null;
  const d = new Date(dateVal);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function getMediaWorkPath(mediaWork) {
  if (!mediaWork?.id) return null;
  if (mediaWork.workType === 'BOOK') return `/book/${mediaWork.id}`;
  if (mediaWork.workType === 'FILM' || mediaWork.workType === 'DOCUMENTARY') {
    return `/film/${mediaWork.id}`;
  }
  return `/media/${mediaWork.id}`;
}
