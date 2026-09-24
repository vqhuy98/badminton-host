# Badminton Host

Quản lý buổi cầu lông vãng lai: xếp lịch đánh, ghi kết quả, tính lời/lỗ.
Web PWA offline-first — mở bằng Chrome trên điện thoại ngay tại sân, không cần mạng.

**Dùng ngay: https://vqhuy98.github.io/badminton-host/**
(mở bằng Chrome trên điện thoại → menu → *Thêm vào màn hình chính*)

## Chạy

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # bản production trong dist/
npm test         # 23 test
```

Trên điện thoại: mở link → menu Chrome → **Thêm vào màn hình chính**.

## Bảo đảm của thuật toán xếp lịch

Với 14 người / 2 sân / tối thiểu 6 tối đa 7 trận, app sinh **24 trận**:

| | |
|---|---|
| Trận 1–21 (**bắt buộc**) | đánh hết là cả 14 người **đúng 6 trận** |
| Trận 22–24 (**thưởng**) | 12 người lên 7 trận, 2 người dừng ở 6 |
| Khoảng cách | không ai đánh 2 trận liên tiếp, không ai bị xếp vào 2 sân cùng lúc |

`14 × 7 = 98` không chia hết cho 4, nên **luôn có đúng 2 người dừng ở 6 trận**. App chỉ
rõ 2 người đó ngay từ đầu buổi và gắn cờ ưu tiên cho buổi sau.

Bảo đảm "tối thiểu 6" chỉ đúng **nếu đánh hết 21 trận** — vì vậy có đồng hồ tiến độ đo
tốc độ thật và cảnh báo khi sắp không kịp vạch.


## Cách tính tiền

Nữ đóng ít hơn nam một khoản cố định do host đặt (mặc định **20.000đ**, chỉnh được,
đặt về 0 là thu đều). App giải ngược từ tổng chi:

```
nam × giá_nam + nữ × giá_nữ = tổng chi        với  giá_nam = giá_nữ + chênh lệch
```

Cả hai mức đều là bội của 5.000 và khoảng cách đúng bằng mức chênh host đặt, nên tổng thu
**không bao giờ hụt tiền sân** — phần dư do làm tròn được hiện thẳng ra để host biết.

Trường hợp biên đã xử lý: toàn nam hoặc toàn nữ thì thu đều; quá ít nam để gánh mức giảm
thì app tự kéo mức giảm xuống thay vì để nữ đóng số âm.

## Cấu trúc

```
src/lib/scheduler.ts   sinh lịch: quota + khoảng cách + local search cân trình
src/lib/rating.ts      Elo có K giảm dần, nhân theo cách biệt điểm
src/lib/pacing.ts      đồng hồ tiến độ, chiếu số trận kịp đánh
src/lib/money.ts       chi phí, mức thu theo giới tính, lời/lỗ
src/lib/identity.ts    nhận dạng người chơi xuyên buổi qua link Facebook
src/lib/actions.ts     thao tác nghiệp vụ trên DB
src/db.ts              IndexedDB (Dexie) + sao lưu / nhập lại JSON
src/screens/           Buổi · Người · Sân · Tiền · Thư viện
```

## Hàm chi phí khi ghép cặp

| Thành phần | Trọng số |
|---|---|
| Lệch trình hai đội, `0.6 × người mạnh + 0.4 × người yếu` | 1.0 |
| Trùng đồng đội | 60 × (số lần)² |
| Trùng đối thủ | 20 × số lần |
| Một đội 2 nữ đấu đội 2 nam | +80 |
| Hai đội đều đôi nam–nữ | −40 (thưởng) |

Thực đo với 14 người: lệch trình trung bình **30 điểm** (≈ 1/3 bậc trình), **1 cặp đồng đội
bị lặp** trên 42 lượt ghép.

## Sao lưu

IndexedDB bị xoá khi người dùng clear cache Chrome. **Bấm "Sao lưu" cuối mỗi buổi** —
file JSON chứa toàn bộ thư viện người chơi và lịch sử rating.

Khi nhập lại, app gộp tự động nếu trùng **Facebook ID / link / số điện thoại**. Chỉ trùng
tên thì app **hỏi** chứ không tự gộp — gộp nhầm hai người là hỏng rating của cả hai.
