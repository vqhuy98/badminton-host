import { describe, expect, it } from 'vitest';
import { findIdentity, parseFacebook } from './identity';
import type { Player } from '../types';

const base: Player = {
  id: 'p1', name: 'Nguyen Van A', gender: 'M', levelLabel: 'TB', rating: 1300,
  ratingDeviation: 200, matchesPlayed: 12, wins: 6, owedBonus: false, createdAt: 0,
};

describe('chuan hoa link facebook', () => {
  it('bo m./www. va query thua', () => {
    expect(parseFacebook('https://m.facebook.com/Hoang.Anh/?ref=x').url).toBe('facebook.com/hoang.anh');
    expect(parseFacebook('www.facebook.com/Hoang.Anh').url).toBe('facebook.com/hoang.anh');
  });

  it('lay ID so tu profile.php', () => {
    const r = parseFacebook('https://facebook.com/profile.php?id=100012345678');
    expect(r.id).toBe('100012345678');
    expect(r.url).toBe('facebook.com/profile.php?id=100012345678');
  });

  it('khong nhan link ngoai facebook', () => {
    expect(parseFacebook('https://zalo.me/abc').id).toBeUndefined();
  });
});

describe('nhan dang nguoi choi', () => {
  it('trung ID Facebook -> gop tu dong', () => {
    const lib = [{ ...base, facebookId: '999', facebookUrl: 'facebook.com/profile.php?id=999' }];
    const hit = findIdentity({ name: 'Ten Khac Han', gender: 'M', facebookUrl: 'm.facebook.com/profile.php?id=999' }, lib);
    expect(hit?.confidence).toBe('exact');
  });

  it('chi trung ten -> phai hoi host, khong tu gop', () => {
    const hit = findIdentity({ name: 'nguyen  van a', gender: 'M' }, [base]);
    expect(hit?.confidence).toBe('probable');
  });

  it('trung ten nhung khac gioi tinh -> khong phai mot nguoi', () => {
    expect(findIdentity({ name: 'Nguyen Van A', gender: 'F' }, [base])).toBeNull();
  });
});
