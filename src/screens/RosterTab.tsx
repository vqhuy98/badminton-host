import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Banner, Button, Card, Chip, Field, IconFemale, IconMale, IconMore, IconPencil, IconTrash,
  IconButton, Select, Sheet, TextInput, toast,
} from '../components/ui';
import { db } from '../db';
import {
  addAttendee,
  createPlayer,
  generateForSession,
  markAllArrived,
  replanFromNow,
  notSchedulable,
  removeAttendee,
  schedulablePlayerIds,
  setAttendStatus,
  substitute,
  undoSubstitute,
  syncScheduleWithRoster,
  updatePlayer,
} from '../lib/actions';
import { findIdentity, parseFacebook, type IdentityMatch } from '../lib/identity';
import { LEVEL_LABELS, type AttendStatus, type Gender, type LevelLabel, type Player, type Session } from '../types';

const STATUS: Record<AttendStatus, { label: string; chip: string; box: string }> = {
  pending: { label: 'Chưa tới', chip: 'slate', box: 'border-line bg-panel2 text-slate-300' },
  arrived: { label: 'Đã tới', chip: 'teal', box: 'border-teal-600 bg-teal-900/50 text-teal-200' },
  resting: { label: 'Đang nghỉ', chip: 'amber', box: 'border-amber-600 bg-amber-900/40 text-amber-200' },
  left: { label: 'Về rồi', chip: 'slate', box: 'border-line bg-panel2 text-slate-400' },
  absent: { label: 'Vắng', chip: 'rose', box: 'border-rose-700 bg-rose-900/40 text-rose-200' },
};
const ALL_STATUS: AttendStatus[] = ['pending', 'arrived', 'resting', 'left', 'absent'];

type Notice = { tone: 'ok' | 'warn' | 'danger' | 'info'; text: string };

export default function RosterTab({ session }: { session: Session }) {
  const library = useLiveQuery(() => db.players.orderBy('name').toArray(), []) ?? [];
  const matches = useLiveQuery(() => db.matches.where('sessionId').equals(session.id).toArray(), [session.id]);
  const [q, setQ] = useState('');
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Player | null>(null);
  const [picking, setPicking] = useState<string | null>(null);
  const [swapping, setSwapping] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const formRef = useRef<HTMLDivElement>(null);

  const started = !!matches?.some((m) => m.state !== 'queued');
  const hasSchedule = !!matches?.length;

  useEffect(() => {
    if (adding) formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [adding]);

  const inSession = useMemo(() => new Set(session.attendees.map((a) => a.playerId)), [session]);
  const byId = useMemo(() => new Map(library.map((p) => [p.id, p])), [library]);
  const suggestions = library.filter(
    (p) => !inSession.has(p.id) && p.name.toLowerCase().includes(q.trim().toLowerCase()),
  );

  async function afterRosterChange(prefix: string) {
    if (!hasSchedule) {
      setNotice({ tone: 'ok', text: prefix });
      return;
    }
    const r = await syncScheduleWithRoster(session.id);
    if (!r.changed) {
      setNotice({ tone: 'ok', text: prefix });
      return;
    }
    const bits = [prefix, `giữ nguyên ${r.kept} trận đã đánh`];
    if (r.added) bits.push(`thêm ${r.added} trận để đủ suất`);
    if (r.removed) bits.push(`bỏ ${r.removed} trận thừa`);
    if (r.unmetNeed) bits.push(`vẫn thiếu ${r.unmetNeed} suất để ai cũng đủ ${session.minPerPlayer} trận`);
    bits.push(`vạch ở trận ${r.coreCount}`);
    setNotice({ tone: r.unmetNeed ? 'warn' : 'ok', text: bits.join(' — ') + '.' });
  }

  async function addFromLibrary(p: Player) {
    const r = await addAttendee(session.id, p.id);
    setQ('');
    if (r === 'already') {
      setNotice({ tone: 'warn', text: `${p.name} đã có trong danh sách rồi.` });
      return;
    }
    await afterRosterChange(`Đã thêm ${p.name} (chưa tới)`);
  }

  async function onRemove(playerId: string) {
    const nm = byId.get(playerId)?.name ?? 'người này';
    // Nho lai trang thai cu de hoan tac dung y — bo nguoi la thao tac mat du lieu.
    const truoc = session.attendees.find((a) => a.playerId === playerId);
    setPicking(null);
    await removeAttendee(session.id, playerId);
    await afterRosterChange(`Đã bỏ ${nm} khỏi buổi`);
    toast(`Đã bỏ ${nm} khỏi buổi.`, {
      tone: 'warn',
      undo: async () => {
        await addAttendee(session.id, playerId, { status: truoc?.status, fee: truoc?.fee });
        await afterRosterChange(`Đã thêm lại ${nm}`);
      },
    });
  }

  async function onStatus(playerId: string, status: AttendStatus) {
    setPicking(null);
    await setAttendStatus(session.id, playerId, status);
    const nm = byId.get(playerId)?.name ?? '';
    await afterRosterChange(`${nm}: ${STATUS[status].label.toLowerCase()}`);
  }

  async function onGenerate() {
    try {
      if (started) {
        // Buoi dang chay -> xep lai tu diem hien tai, khong duoc dong vao ket qua da ghi.
        const r = await replanFromNow(session.id);
        const bits = [
          `Đã xếp lại cho ${arrived} người — giữ nguyên ${r.kept} trận đã đánh`,
          `còn ${r.tailCount} trận`,
          `vạch ở trận ${r.coreCount}`,
        ];
        if (r.added) bits.splice(1, 0, `thêm ${r.added} trận`);
        if (r.removed) bits.splice(1, 0, `bỏ ${r.removed} trận`);
        if (r.unmetNeed) bits.push(`thiếu ${r.unmetNeed} suất để ai cũng đủ ${session.minPerPlayer} trận`);
        setNotice({ tone: r.unmetNeed ? 'warn' : 'ok', text: bits.join(' — ') + '.' });
        return;
      }
      const r = await generateForSession(session.id);
      const short = r.shortChanged.map((id) => byId.get(id)?.name ?? '?').join(', ');
      setNotice({
        tone: 'ok',
        text:
          `Đã xếp ${r.totalCount} trận — ${r.coreCount} bắt buộc (vạch), ${r.totalCount - r.coreCount} thưởng. ` +
          `Lệch trình trung bình ${Math.round(r.avgImbalance)} điểm.` +
          (short ? ` Chỉ được ${session.minPerPlayer} trận: ${short}.` : ''),
      });
    } catch (e) {
      setNotice({ tone: 'danger', text: `Không xếp được: ${(e as Error).message}` });
    }
  }

  const counted = session.attendees.filter((a) => a.status !== 'absent').length;
  const arrived = schedulablePlayerIds(session).length;
  const waiting = notSchedulable(session).map((w) => byId.get(w.playerId)?.name ?? '?');
  const pendingCount = session.attendees.filter((a) => a.status === 'pending').length;

  return (
    <div className="space-y-4 pb-6">
      <Card className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 className="font-semibold">
            Danh sách ({counted}) · <span className="text-teal-300">{arrived} đã tới</span>
          </h2>
          {pendingCount > 1 && (
            <button
              className="text-xs font-semibold text-teal-300"
              onClick={async () => setNotice({ tone: 'ok', text: `Đã điểm danh ${await markAllArrived(session.id)} người.` })}
            >
              Điểm danh tất cả
            </button>
          )}
        </div>
        <TextInput value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm trong thư viện…" />
        {!!q && (
          <div className="space-y-1">
            {suggestions.slice(0, 6).map((p) => (
              <button
                key={p.id}
                onClick={() => addFromLibrary(p)}
                className="flex w-full items-center gap-2 rounded-xl bg-panel2 px-4 py-4 text-left active:bg-line"
              >
                <span className="flex-1 truncate">{p.name}</span>
                <Chip tone="slate">{p.levelLabel}</Chip>
                <span className="font-semibold text-teal-300">Thêm</span>
              </button>
            ))}
            {!suggestions.length && <p className="text-sm text-slate-400">Không có ai khớp — dùng “Thêm người mới”.</p>}
          </div>
        )}
      </Card>

      <div className="space-y-2">
        {session.attendees.map((a) => {
          const p = byId.get(a.playerId);
          const st = STATUS[a.status];
          const nu = p?.gender === 'F';
          return (
            <div key={a.playerId}
                 className="flex items-center gap-2 rounded-2xl border border-line bg-panel py-1.5 pr-1.5 pl-3">
              <span className={nu ? 'shrink-0 text-pink-400' : 'shrink-0 text-sky-400'}
                    aria-label={nu ? 'Nữ' : 'Nam'} title={nu ? 'Nữ' : 'Nam'}>
                {nu ? <IconFemale className="h-4 w-4" /> : <IconMale className="h-4 w-4" />}
              </span>
              <span className="min-w-0 flex-1 truncate font-semibold">{p?.name ?? '???'}</span>
              <Chip tone="teal">{p?.levelLabel ?? '?'}</Chip>
              {/* Bam lan 1 = diem danh. Cac trang thai khac nam trong menu ⋯. */}
              <button
                onClick={() => onStatus(a.playerId, a.status === 'arrived' ? 'pending' : 'arrived')}
                className={`h-11 shrink-0 rounded-xl border px-3 text-sm font-bold active:opacity-80 ${st.box}`}
              >
                {st.label}
              </button>
              <IconButton label={`Tuỳ chọn cho ${p?.name ?? 'người này'}`} onClick={() => setPicking(a.playerId)}>
                <IconMore />
              </IconButton>
            </div>
          );
        })}
        {!session.attendees.length && (
          <Card className="text-center text-sm text-slate-400">Chưa có ai. Tìm trong thư viện hoặc thêm người mới.</Card>
        )}
      </div>

      <div ref={formRef}>
        {adding ? (
          <NewPlayerForm
            library={library}
            onCancel={() => setAdding(false)}
            onResolved={async (playerId, label) => {
              const r = await addAttendee(session.id, playerId);
              setAdding(false);
              if (r === 'already') {
                setNotice({ tone: 'warn', text: `${label} đã có trong danh sách rồi.` });
                return;
              }
              await afterRosterChange(`Đã thêm ${label} (chưa tới)`);
            }}
          />
        ) : (
          <Button variant="subtle" className="w-full py-6 text-lg" onClick={() => setAdding(true)}>
            + Thêm người mới
          </Button>
        )}
      </div>

      {!!waiting.length && (
        <Banner level="info">
          Chỉ người <b>đã tới</b> mới được xếp lịch. Chưa tính: {waiting.join(', ')}.
        </Banner>
      )}

      {notice && <Banner level={notice.tone}>{notice.text}</Banner>}

      <Button className="w-full py-6 text-lg" disabled={arrived < 4} onClick={onGenerate}>
        {started ? 'Xếp lại lịch còn lại' : session.scheduleVersion ? 'Xếp lại lịch' : 'Xếp lịch'}
        {arrived >= 4 ? ` cho ${arrived} người` : ''}
      </Button>
      {arrived < 4 && (
        <p className="text-center text-xs text-slate-400">Cần ít nhất 4 người đã tới mới xếp được lịch.</p>
      )}
      {started && (
        <p className="text-center text-xs text-slate-400">
          Các trận đã đánh và tỉ số được <b>giữ nguyên</b>. App chỉ tính lại phần chưa đánh, và thêm trận nếu
          đông người hơn.
        </p>
      )}

      {picking && (() => {
        const p = byId.get(picking);
        return (
          <Sheet title={p?.name ?? 'Tuỳ chọn'} onClose={() => setPicking(null)}>
            <div className="space-y-2">
              {ALL_STATUS.map((st) => (
                <button key={st} onClick={() => onStatus(picking, st)}
                        className={`w-full rounded-xl border py-4 text-base font-bold ${STATUS[st].box}`}>
                  {STATUS[st].label}
                </button>
              ))}
            </div>
            <p className="my-3 text-center text-xs text-slate-400">
              “Đang nghỉ” và “Về rồi” đều bị gỡ khỏi các trận chưa đánh.
            </p>
            {hasSchedule && (
              <Button variant="subtle" className="mb-2 w-full"
                      onClick={() => { setSwapping(picking); setPicking(null); }}>
                Đổi người này trong các trận chưa đánh
              </Button>
            )}
            <div className="grid grid-cols-2 gap-2 border-t border-line pt-3">
              <Button variant="ghost" className="flex items-center justify-center gap-2"
                      onClick={() => { setPicking(null); if (p) setEditing(p); }}>
                <IconPencil className="h-4 w-4" /> Sửa thông tin
              </Button>
              <Button variant="danger" className="flex items-center justify-center gap-2"
                      onClick={() => onRemove(picking)}>
                <IconTrash className="h-4 w-4" /> Bỏ khỏi buổi
              </Button>
            </div>
          </Sheet>
        );
      })()}

      {swapping && (() => {
        const ra = byId.get(swapping);
        // Chi doi duoc sang nguoi DA TOI va chua co trong buoi truot cua nguoi kia.
        const ungVien = session.attendees
          .filter((a) => a.status === 'arrived' && a.playerId !== swapping)
          .map((a) => byId.get(a.playerId))
          .filter((p): p is Player => !!p);
        return (
          <Sheet title={`Đổi ${ra?.name ?? ''} sang ai?`} onClose={() => setSwapping(null)}>
            <p className="mb-3 text-sm text-slate-400">
              Chỉ đổi ở những trận <b>chưa đánh</b>. Trận đã có tỉ số giữ nguyên.
              App bỏ qua trận nào mà người được chọn đã có mặt.
            </p>
            <div className="space-y-2">
              {ungVien.map((v) => (
                <button key={v.id}
                  onClick={async () => {
                    setSwapping(null);
                    const r = await substitute(session.id, swapping, v.id);
                    if (!r.changed) {
                      toast(`Không có trận chưa đánh nào để đổi ${ra?.name} sang ${v.name}.`, { tone: 'warn' });
                      return;
                    }
                    toast(`Đã đổi ${ra?.name} → ${v.name} ở ${r.changed} trận.`, {
                      undo: async () => {
                        await undoSubstitute(r.before);
                        toast(`Đã trả lại đội hình cũ ở ${r.before.length} trận.`);
                      },
                    });
                  }}
                  className="flex w-full items-center gap-2 rounded-xl bg-panel2 px-4 py-4 text-left active:bg-line">
                  <span className="min-w-0 flex-1 truncate font-semibold">{v.name}</span>
                  <Chip tone="teal">{v.levelLabel}</Chip>
                </button>
              ))}
              {!ungVien.length && <p className="text-sm text-slate-400">Chưa có ai khác đã tới để đổi.</p>}
            </div>
          </Sheet>
        );
      })()}

      {editing && (
        <EditPlayerSheet
          player={editing}
          onClose={() => setEditing(null)}
          onSaved={(msg) => {
            setEditing(null);
            setNotice({ tone: 'ok', text: msg });
            if (hasSchedule) syncScheduleWithRoster(session.id);
          }}
        />
      )}
    </div>
  );
}

type Draft = { name: string; gender: Gender; level: LevelLabel; fb: string; phone: string };

function DraftFields({ d, set }: { d: Draft; set: (patch: Partial<Draft>) => void }) {
  return (
    <>
      <Field label="Tên">
        <TextInput value={d.name} onChange={(e) => set({ name: e.target.value })} placeholder="Nguyễn Văn A" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Giới tính">
          <Select
            value={d.gender}
            onChange={(gender) => set({ gender })}
            options={[
              { value: 'M', label: 'Nam' },
              { value: 'F', label: 'Nữ' },
            ]}
          />
        </Field>
        <Field label="Trình độ">
          <Select
            value={d.level}
            onChange={(level) => set({ level })}
            options={LEVEL_LABELS.map((l) => ({ value: l, label: l }))}
          />
        </Field>
      </div>
      <Field label="Link Facebook" hint="Dùng để nhận ra đúng người này ở những buổi sau.">
        <TextInput value={d.fb} onChange={(e) => set({ fb: e.target.value })} placeholder="facebook.com/..." />
      </Field>
      <Field label="Số điện thoại">
        <TextInput value={d.phone} onChange={(e) => set({ phone: e.target.value })} inputMode="tel" placeholder="09..." />
      </Field>
    </>
  );
}

function EditPlayerSheet({
  player,
  onClose,
  onSaved,
}: {
  player: Player;
  onClose: () => void;
  onSaved: (msg: string) => void;
}) {
  const [d, setD] = useState<Draft>({
    name: player.name,
    gender: player.gender,
    level: player.levelLabel,
    fb: player.facebookUrl ?? '',
    phone: player.phone ?? '',
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (patch: Partial<Draft>) => setD((v) => ({ ...v, ...patch }));
  const levelChanged = d.level !== player.levelLabel;

  async function save() {
    if (!d.name.trim()) {
      setError('Chưa nhập tên.');
      return;
    }
    setBusy(true);
    try {
      const parsed = d.fb ? parseFacebook(d.fb) : {};
      const r = await updatePlayer(player.id, {
        name: d.name,
        gender: d.gender,
        levelLabel: d.level,
        facebookUrl: parsed.url,
        facebookId: parsed.id,
        phone: d.phone || undefined,
      });
      onSaved(r.levelChanged ? `Đã sửa ${d.name} — rating đặt lại theo trình ${d.level}.` : `Đã sửa ${d.name}.`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <Sheet title={`Sửa ${player.name}`} onClose={onClose}>
      <div className="flex justify-center gap-2 text-sm text-slate-400">
        <Chip tone="teal">{player.levelLabel}</Chip>
        <span>rating {player.rating}</span>
        <span>·</span>
        <span>
          {player.matchesPlayed} trận · thắng{' '}
          {player.matchesPlayed ? Math.round((player.wins / player.matchesPlayed) * 100) : 0}%
        </span>
      </div>
      <DraftFields d={d} set={set} />
      {levelChanged && player.matchesPlayed > 0 && (
        <Banner level="warn">
          {player.name} đã đánh {player.matchesPlayed} trận, rating hiện tại <b>{player.rating}</b>. Đổi trình độ sẽ
          <b> xoá kết quả đã tích luỹ</b> và đặt lại rating theo mốc của trình {d.level}.
        </Banner>
      )}
      {error && <Banner level="danger">{error}</Banner>}
      <Button className="w-full py-5 text-lg" onClick={save} disabled={busy}>
        {busy ? 'Đang lưu…' : 'Lưu'}
      </Button>
    </Sheet>
  );
}

function NewPlayerForm({
  library,
  onCancel,
  onResolved,
}: {
  library: Player[];
  onCancel: () => void;
  onResolved: (playerId: string, label: string) => Promise<void>;
}) {
  const [d, setD] = useState<Draft>({ name: '', gender: 'M', level: 'TB', fb: '', phone: '' });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [ask, setAsk] = useState<IdentityMatch | null>(null);
  const set = (patch: Partial<Draft>) => setD((v) => ({ ...v, ...patch }));

  async function createFresh() {
    const parsed = d.fb ? parseFacebook(d.fb) : {};
    return createPlayer({
      name: d.name,
      gender: d.gender,
      levelLabel: d.level,
      facebookUrl: parsed.url,
      facebookId: parsed.id,
      phone: d.phone || undefined,
    });
  }

  async function submit() {
    if (busy) return;
    if (!d.name.trim()) {
      setError('Chưa nhập tên.');
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const hit = findIdentity({ name: d.name, gender: d.gender, facebookUrl: d.fb, phone: d.phone }, library);
      if (hit?.confidence === 'probable') {
        setAsk(hit);
        return;
      }
      if (hit?.confidence === 'exact') {
        const parsed = d.fb ? parseFacebook(d.fb) : {};
        await db.players.update(hit.player.id, {
          facebookUrl: parsed.url ?? hit.player.facebookUrl,
          facebookId: parsed.id ?? hit.player.facebookId,
          phone: d.phone || hit.player.phone,
        });
        await onResolved(hit.player.id, hit.player.name);
        return;
      }
      const p = await createFresh();
      await onResolved(p.id, p.name);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (ask) {
    return (
      <Card className="space-y-3">
        <h2 className="font-semibold">Có phải cùng một người?</h2>
        <Banner level="warn">
          Thư viện đã có <b>{ask.player.name}</b> ({ask.reason}) — {ask.player.matchesPlayed} trận, trình{' '}
          {ask.player.levelLabel}, rating {ask.player.rating}.
        </Banner>
        <Button
          className="w-full py-5"
          onClick={async () => {
            setBusy(true);
            const parsed = d.fb ? parseFacebook(d.fb) : {};
            if (parsed.url) await db.players.update(ask.player.id, { facebookUrl: parsed.url, facebookId: parsed.id });
            if (d.phone) await db.players.update(ask.player.id, { phone: d.phone });
            await onResolved(ask.player.id, ask.player.name);
          }}
        >
          Đúng người này — dùng lại rating cũ
        </Button>
        <Button
          variant="subtle"
          className="w-full py-5"
          onClick={async () => {
            setBusy(true);
            const p = await createFresh();
            await onResolved(p.id, p.name);
          }}
        >
          Người khác — tạo hồ sơ mới
        </Button>
        <Button variant="ghost" className="w-full" onClick={() => setAsk(null)} disabled={busy}>
          Quay lại sửa
        </Button>
      </Card>
    );
  }

  return (
    <Card className="space-y-3">
      <DraftFields d={d} set={set} />
      {error && <Banner level="danger">{error}</Banner>}
      <div className="grid grid-cols-2 gap-2">
        <Button variant="ghost" className="py-5" onClick={onCancel} disabled={busy}>
          Huỷ
        </Button>
        <Button className="py-5 text-lg" onClick={submit} disabled={busy}>
          {busy ? 'Đang lưu…' : 'Thêm vào buổi'}
        </Button>
      </div>
    </Card>
  );
}
