export type Gender = 'M' | 'F';

/** Thang trinh do phong trao VN -> diem khoi tao. */
export const LEVELS = {
  Y: 1000,
  TBY: 1100,
  'TB-': 1200,
  TB: 1300,
  'TB+': 1400,
  K: 1500,
  'K+': 1600,
  TT: 1700,
} as const;

export type LevelLabel = keyof typeof LEVELS;
export const LEVEL_LABELS = Object.keys(LEVELS) as LevelLabel[];

/** Nguoi choi trong thu vien, ton tai xuyen buoi. */
export interface Player {
  id: string;
  name: string;
  nickname?: string;
  gender: Gender;
  levelLabel: LevelLabel;
  rating: number;
  /** Do bat dinh cua rating: cao = chua ro trinh, cho phep nhay manh. */
  ratingDeviation: number;
  matchesPlayed: number;
  wins: number;
  /** Khoa nhan dang xuyen buoi. */
  facebookUrl?: string;
  facebookId?: string;
  phone?: string;
  /** Duoc uu tien nhan tran thuong o buoi sau (vi buoi truoc chi duoc 6 tran). */
  owedBonus: boolean;
  createdAt: number;
}

export type AttendStatus = 'pending' | 'arrived' | 'resting' | 'left' | 'absent';

/** Ban ghi mot nguoi trong mot buoi cu the. */
export interface Attendee {
  playerId: string;
  status: AttendStatus;
  arrivedAt?: number;
  leftAt?: number;
  fee: number;
  paid: boolean;
}

export type MatchFormat = { type: 'points'; target: 15 | 21 } | { type: 'timed'; minutes: number };

export interface CostItem {
  label: string;
  amount: number;
}

export interface Session {
  id: string;
  date: string;
  venue: string;
  courtCount: number;
  startAt: number;
  durationMin: number;
  format: MatchFormat;
  minPerPlayer: number;
  maxPerPlayer: number;
  courtPricePerHour: number;
  shuttlePrice: number;
  shuttlesOut: number;
  shuttlesBack: number;
  otherCosts: CostItem[];
  /** Muc thu mac dinh cho nam (nu = muc nay tru femaleDiscount). */
  defaultFee: number;
  /** Nu dong it hon nam bao nhieu dong. Buoi cu khong co truong nay -> DEFAULT_FEMALE_DISCOUNT. */
  femaleDiscount?: number;
  /** Cach chia tien: deu / theo so tran / theo thoi gian co mat. Mac dinh 'even'. */
  feeMode?: 'even' | 'matches' | 'time';
  attendees: Attendee[];
  /** Danh sach nguoi chi duoc minPerPlayer tran (khong du cho len max). */
  shortChanged: string[];
  scheduleVersion: number;
  createdAt: number;
  closedAt?: number;
}

export type MatchState = 'queued' | 'playing' | 'done' | 'cancelled';

export interface Match {
  id: string;
  sessionId: string;
  /** Thu tu co dinh trong lich, bat dau tu 1. */
  order: number;
  /** True neu tran nam truoc vach 6 tran (bat buoc phai danh). */
  mandatory: boolean;
  courtIndex?: number;
  teamA: [string, string];
  teamB: [string, string];
  scoreA?: number;
  scoreB?: number;
  state: MatchState;
  startedAt?: number;
  endedAt?: number;
}

export interface RatingEvent {
  id?: number;
  matchId: string;
  playerId: string;
  before: number;
  after: number;
  delta: number;
  at: number;
}

/** Cai dat chung cua host, dung chung cho moi buoi. */
export interface HostSettings {
  /** Khoa co dinh — chi co mot ban ghi. */
  key: 'host';
  /** Ma BIN ngan hang nhan tien (6 so). */
  bankBin?: string;
  accountNumber?: string;
  accountName?: string;
}
