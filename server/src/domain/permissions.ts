import type { AppUser } from './types.js';

export function isModerator(user: AppUser): boolean {
  return user.role === 'moderator' || user.role === 'admin';
}

/** Users may edit their own content only. Moderators do not get edit rights, only removal. */
export function canEdit(user: AppUser, authorId: string): boolean {
  return user.id === authorId;
}

/** Authors may remove their own content; moderators have explicit elevated removal rights. */
export function canRemove(user: AppUser, authorId: string): boolean {
  return user.id === authorId || isModerator(user);
}
