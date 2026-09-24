import { useEffect, useMemo, useRef, useState } from 'react';
import { Banner, Button, Sheet, toast } from '../components/ui';
import { drawPoster, posterBlob } from '../lib/poster';
import { DEFAULT_SHARE, shareText, type ShareData, type ShareOptions } from '../lib/share';

const MUC: { key: keyof ShareOptions; nhan: string; phu?: string }[] = [
  { key: 'money', nhan: 'Tiền từng người' },
  { key: 'results', nhan: 'Kết quả các trận' },
  { key: 'bank', nhan: 'Số tài khoản' },
  { key: 'profit', nhan: 'Lãi/lỗ của bạn', phu: 'cả nhóm sẽ thấy' },
];

export default function ShareSheet({ data, onClose }: { data: ShareData; onClose: () => void }) {
  const [opt, setOpt] = useState<ShareOptions>(DEFAULT_SHARE);
  const [busy, setBusy] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  const canvas = useMemo(() => drawPoster(data, opt), [data, opt]);
  const text = useMemo(() => shareText(data, opt), [data, opt]);

  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    box.replaceChildren(canvas);
    canvas.style.width = '100%';
    canvas.style.height = 'auto';
    canvas.className = 'rounded-xl border border-line';
  }, [canvas]);

  const ten = `caulong-${data.session.date}${data.session.venue ? '-' + data.session.venue.replace(/\s+/g, '') : ''}.png`;

  async function guiAnh() {
    setBusy(true);
    try {
      const blob = await posterBlob(canvas);
      const file = new File([blob], ten, { type: 'image/png' });
      // Tren dien thoai: mo thang bang chia se cua he dieu hanh -> chon Zalo.
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], text });
        return;
      }
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = ten;
      a.click();
      URL.revokeObjectURL(a.href);
      toast('Máy này không mở được bảng chia sẻ — đã tải ảnh về.');
    } catch (e) {
      if ((e as Error).name !== 'AbortError') toast(`Không gửi được: ${(e as Error).message}`, { tone: 'danger' });
    } finally {
      setBusy(false);
    }
  }

  async function chepChu() {
    try {
      await navigator.clipboard.writeText(text);
      toast('Đã chép. Dán vào Zalo là xong.');
    } catch {
      toast('Máy không cho chép tự động — bạn tự bôi đen phần chữ bên dưới.', { tone: 'warn' });
    }
  }

  return (
    <Sheet title="Gửi lên Zalo" onClose={onClose}>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          {MUC.map((m) => (
            <button key={m.key} onClick={() => setOpt((o) => ({ ...o, [m.key]: !o[m.key] }))}
              className={`rounded-xl border px-3 py-3 text-left text-sm font-semibold ${
                opt[m.key] ? 'border-teal-500 bg-teal-900/50 text-teal-200' : 'border-line bg-panel2 text-slate-400'
              }`}>
              {m.nhan}
              {m.phu && <span className="block text-xs font-normal opacity-70">{m.phu}</span>}
            </button>
          ))}
        </div>

        {opt.profit && (
          <Banner level="warn">Lãi/lỗ đang bật — ai nhận ảnh cũng thấy bạn lời hay lỗ bao nhiêu.</Banner>
        )}

        <div ref={boxRef} className="max-h-[46vh] overflow-y-auto" />

        <div className="grid grid-cols-2 gap-2">
          <Button variant="ghost" onClick={chepChu}>Chép dạng chữ</Button>
          <Button disabled={busy} onClick={guiAnh}>{busy ? 'Đang tạo…' : 'Gửi ảnh'}</Button>
        </div>
        <p className="text-center text-xs text-slate-400">
          Trên điện thoại, “Gửi ảnh” mở thẳng bảng chia sẻ để chọn Zalo. Trên máy tính thì tải ảnh về.
        </p>
      </div>
    </Sheet>
  );
}
