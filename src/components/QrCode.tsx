import qrGen from 'qrcode-generator';
import { useMemo } from 'react';

/**
 * Ve ma QR bang SVG — net o moi kich thuoc va in ra giay van doc duoc.
 * Sinh ngay tren may, khong goi mang, nen o san khong song van dung duoc.
 */
export default function QrCode({ value, size = 200 }: { value: string; size?: number }) {
  const path = useMemo(() => {
    // 0 = tu chon phien ban nho nhat vua du. 'M' chiu duoc ~15% ho hong/loa sang.
    const qr = qrGen(0, 'M');
    qr.addData(value);
    qr.make();
    const n = qr.getModuleCount();
    let d = '';
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        if (qr.isDark(r, c)) d += `M${c},${r}h1v1h-1z`;
      }
    }
    return { d, n };
  }, [value]);

  // Vien trang 4 o quanh ma la bat buoc theo chuan, thieu la may quet kho bat.
  const pad = 4;
  const total = path.n + pad * 2;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${total} ${total}`}
         className="rounded-lg bg-white" shapeRendering="crispEdges" role="img" aria-label="Mã QR chuyển khoản">
      <path d={path.d} fill="#000" transform={`translate(${pad},${pad})`} />
    </svg>
  );
}
