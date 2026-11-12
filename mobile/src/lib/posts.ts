/** Business posts: labels and the state a post is in right now. */
import type { BusinessPost, PostKind } from '@/services/business';

export const POST_KIND_LABEL: Record<PostKind, string> = { OFFER: 'Offer', DEAL: 'Deal', NEWS: 'News' };

const day = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

export function postState(post: Pick<BusinessPost, 'published' | 'hiddenByStaff' | 'startsAt' | 'endsAt'>, now = Date.now()) {
  const starts = post.startsAt ? new Date(post.startsAt).getTime() : null;
  const ends = post.endsAt ? new Date(post.endsAt).getTime() : null;
  const when = ends ? `Until ${day(post.endsAt!)}` : starts && starts > now ? `From ${day(post.startsAt!)}` : null;
  if (post.hiddenByStaff) return { label: 'Hidden by tazdan', tone: 'bad' as const, when };
  if (!post.published) return { label: 'Draft', tone: 'muted' as const, when };
  if (ends && ends < now) return { label: 'Ended', tone: 'muted' as const, when: `Ended ${day(post.endsAt!)}` };
  if (starts && starts > now) return { label: 'Scheduled', tone: 'muted' as const, when };
  return { label: 'Live', tone: 'live' as const, when };
}
