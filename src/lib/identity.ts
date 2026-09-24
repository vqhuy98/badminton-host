import type { Player } from '../types';

/**
 * Chuan hoa link Facebook de so sanh. Vanity url doi duoc bat cu luc nao,
 * nen luon co gang lay ID so truoc.
 */
export function parseFacebook(raw: string): { url?: string; id?: string } {
  const s = raw.trim();
  if (!s) return {};
  let u: URL;
  try {
    u = new URL(s.startsWith('http') ? s : `https://${s}`);
  } catch {
    return { url: s.toLowerCase() };
  }
  const host = u.hostname.replace(/^(m|www|web)\./, '');
  if (!host.endsWith('facebook.com') && !host.endsWith('fb.com')) return { url: s.toLowerCase() };

  const numeric = u.searchParams.get('id');
  if (numeric && /^\d+$/.test(numeric)) {
    return { url: `facebook.com/profile.php?id=${numeric}`, id: numeric };
  }
  const seg = u.pathname.split('/').filter(Boolean);
  const vanity = seg[0] === 'profile.php' ? seg[1] : seg[0];
  if (!vanity) return { url: 'facebook.com' };
  if (/^\d+$/.test(vanity)) return { url: `facebook.com/profile.php?id=${vanity}`, id: vanity };
  return { url: `facebook.com/${vanity.toLowerCase()}` };
}

export type MatchConfidence = 'exact' | 'probable' | 'none';

export interface IdentityMatch {
  player: Player;
  confidence: MatchConfidence;
  reason: string;
}

/**
 * Tim nguoi trung trong thu vien. Chi 'exact' moi duoc gop tu dong;
 * 'probable' phai hoi host, vi gop nham 2 nguoi la hong rating ca hai.
 */
export function findIdentity(
  candidate: { name: string; gender: string; facebookUrl?: string; phone?: string },
  library: Player[],
): IdentityMatch | null {
  const fb = candidate.facebookUrl ? parseFacebook(candidate.facebookUrl) : {};
  if (fb.id) {
    const hit = library.find((p) => p.facebookId && p.facebookId === fb.id);
    if (hit) return { player: hit, confidence: 'exact', reason: 'trùng Facebook ID' };
  }
  if (fb.url) {
    const hit = library.find((p) => p.facebookUrl === fb.url);
    if (hit) return { player: hit, confidence: 'exact', reason: 'trùng link Facebook' };
  }
  const phone = candidate.phone?.replace(/\D/g, '');
  if (phone && phone.length >= 9) {
    const hit = library.find((p) => p.phone?.replace(/\D/g, '') === phone);
    if (hit) return { player: hit, confidence: 'exact', reason: 'trùng số điện thoại' };
  }
  const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');
  const hit = library.find(
    (p) => norm(p.name) === norm(candidate.name) && p.gender === candidate.gender,
  );
  if (hit) return { player: hit, confidence: 'probable', reason: 'trùng tên và giới tính' };
  return null;
}
