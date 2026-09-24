/**
 * Danh sach ngan hang ho tro chuyen khoan qua VietQR.
 *
 * Lay tu API chinh chu https://api.vietqr.io/v2/banks (loc transferSupported = 1)
 * roi dong goi vao app de van sinh duoc ma QR khi o san khong co song.
 * Ma BIN sai = tien vao nham ngan hang, nen KHONG tu go tay danh sach nay.
 */
export interface Bank {
  /** Ma BIN 6 so dung trong ma QR. */
  bin: string;
  ten: string;
  day: string;
}

export const BANKS: Bank[] = [
  { bin: '970425', ten: "ABBANK", day: "Ngân hàng TMCP An Bình" },
  { bin: '970416', ten: "ACB", day: "Ngân hàng TMCP Á Châu" },
  { bin: '970405', ten: "Agribank", day: "Ngân hàng Nông nghiệp và Phát triển Nông thôn Việt Nam" },
  { bin: '970409', ten: "BacABank", day: "Ngân hàng TMCP Bắc Á" },
  { bin: '970438', ten: "BaoVietBank", day: "Ngân hàng TMCP Bảo Việt" },
  { bin: '970418', ten: "BIDV", day: "Ngân hàng TMCP Đầu tư và Phát triển Việt Nam" },
  { bin: '546034', ten: "CAKE", day: "TMCP Việt Nam Thịnh Vượng - Ngân hàng số CAKE by VPBank" },
  { bin: '422589', ten: "CIMB", day: "Ngân hàng TNHH MTV CIMB Việt Nam" },
  { bin: '970446', ten: "COOPBANK", day: "Ngân hàng Hợp tác xã Việt Nam" },
  { bin: '970431', ten: "Eximbank", day: "Ngân hàng TMCP Xuất Nhập khẩu Việt Nam" },
  { bin: '970437', ten: "HDBank", day: "Ngân hàng TMCP Phát triển Thành phố Hồ Chí Minh" },
  { bin: '668888', ten: "KBank", day: "Ngân hàng Đại chúng TNHH Kasikornbank" },
  { bin: '970452', ten: "KienLongBank", day: "Ngân hàng TMCP Kiên Long" },
  { bin: '970449', ten: "LPBank", day: "Ngân hàng TMCP Lộc Phát Việt Nam" },
  { bin: '970422', ten: "MBBank", day: "Ngân hàng TMCP Quân đội" },
  { bin: '970414', ten: "MBV", day: "Ngân hàng TNHH MTV Việt Nam Hiện Đại" },
  { bin: '971025', ten: "MoMo", day: "CTCP Dịch Vụ Di Động Trực Tuyến" },
  { bin: '970426', ten: "MSB", day: "Ngân hàng TMCP Hàng Hải Việt Nam" },
  { bin: '970428', ten: "NamABank", day: "Ngân hàng TMCP Nam Á" },
  { bin: '970419', ten: "NCB", day: "Ngân hàng TMCP Quốc Dân" },
  { bin: '970448', ten: "OCB", day: "Ngân hàng TMCP Phương Đông" },
  { bin: '970430', ten: "PGBank", day: "Ngân hàng TMCP Thịnh vượng và Phát triển" },
  { bin: '970412', ten: "PVcomBank", day: "Ngân hàng TMCP Đại Chúng Việt Nam" },
  { bin: '971133', ten: "PVcomBank Pay", day: "Ngân hàng TMCP Đại Chúng Việt Nam Ngân hàng số" },
  { bin: '970403', ten: "Sacombank", day: "Ngân hàng TMCP Sài Gòn Thương Tín" },
  { bin: '970400', ten: "SaigonBank", day: "Ngân hàng TMCP Sài Gòn Công Thương" },
  { bin: '970429', ten: "SCB", day: "Ngân hàng TMCP Sài Gòn" },
  { bin: '970440', ten: "SeABank", day: "Ngân hàng TMCP Đông Nam Á" },
  { bin: '970443', ten: "SHB", day: "Ngân hàng TMCP Sài Gòn - Hà Nội" },
  { bin: '970424', ten: "ShinhanBank", day: "Ngân hàng TNHH MTV Shinhan Việt Nam" },
  { bin: '970407', ten: "Techcombank", day: "Ngân hàng TMCP Kỹ thương Việt Nam" },
  { bin: '963388', ten: "Timo", day: "Ngân hàng số Timo by Ban Viet Bank (Timo by Ban Viet Bank)" },
  { bin: '970423', ten: "TPBank", day: "Ngân hàng TMCP Tiên Phong" },
  { bin: '546035', ten: "Ubank", day: "TMCP Việt Nam Thịnh Vượng - Ngân hàng số Ubank by VPBank" },
  { bin: '970441', ten: "VIB", day: "Ngân hàng TMCP Quốc tế Việt Nam" },
  { bin: '970427', ten: "VietABank", day: "Ngân hàng TMCP Việt Á" },
  { bin: '970433', ten: "VietBank", day: "Ngân hàng TMCP Việt Nam Thương Tín" },
  { bin: '970454', ten: "VietCapitalBank", day: "Ngân hàng TMCP Bản Việt" },
  { bin: '970436', ten: "Vietcombank", day: "Ngân hàng TMCP Ngoại Thương Việt Nam" },
  { bin: '970415', ten: "VietinBank", day: "Ngân hàng TMCP Công thương Việt Nam" },
  { bin: '970432', ten: "VPBank", day: "Ngân hàng TMCP Việt Nam Thịnh Vượng" },
  { bin: '970457', ten: "Woori", day: "Ngân hàng TNHH MTV Woori Việt Nam" },
];

export const bankByBin = (bin: string) => BANKS.find((b) => b.bin === bin);
