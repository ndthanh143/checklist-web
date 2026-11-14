# Lawmans Smart Checklist — Cập nhật v2 (theo requirement-update.docx)

Nguồn: `requirement-update.docx` (24 mục, 29 hình). Kế hoạch gốc: [PLAN.md](PLAN.md).

## Quyết định đã chốt (2026-11-14)

| Câu hỏi | Quyết định |
|---|---|
| #11 — 3.2 Members follow the engineering plan | Thêm bảng member (Member · Size & grade · Location) + đính ảnh |
| Rule trên production | Chưa ai publish / sửa rule trong `/admin` → tăng version bundled rồi publish bản mới |
| #19 — mốc 1800 mm | Tính theo **stud opening width** (giữ như code hiện tại: > 1800 mới cần lintel) |
| #17 — Under girder | Wall frame chịu lực từ girder → cần critical stud, tính bằng **Autobeam**. Opening tick "Under girder" phải nhập **critical stud size** và **deflection** |
| Tên app / tab (#1, #3) | Đổi thành **Smart Check Wall** |
| Minh hoạ (#4) | Tự vẽ SVG cùng tông màu logo (gỗ + xanh lá). Không dùng hình mẫu trong docx (hình stock, có thể vướng bản quyền). Giữ xanh MiTek cho nút / action |
| Nog (#10) | Chỉ thêm 2600 → 1350 / 1350. Bảng "known heights" sửa được trong Content editor |
| Cavity sliding door (#17) | Chỉ cho internal opening |
| Cabinet opening (#21) | Allowance tạm 0 / 0 (như Other), sửa được ở tab Tables |
| Post (#13) | Caption "Case 1 / Case 2 — Plan / Detail" |

## Đối chiếu yêu cầu → thay đổi

### A. Branding (#1–#6)
1. Logo "Smart check wall" → `public/logos/smart-check-wall.png`; dùng ở TopBar, login, Home.
2. MiTek đứng trước, Lawmans sau, cùng khung (cùng height + max-width) ở login và TopBar.
3. Favicon = icon nhà + dấu tick từ logo mới. Tab title "Smart Check Wall".
4. Minh hoạ SVG: hero Home + login, hình nhỏ ở header mỗi stage, sơ đồ opening framing có chú thích (lintel / trimmer / jamb stud / prop stud).
5. Logo Ashmont → `public/logos/ashmont.png`.
6. PDF header: MiTek + Lawmans cùng khung, MiTek trước.

### B. Job Review & Job Setup (#7–#10)
7. `ceiling` (number) → `ceilingType` (text, "e.g. 13mm Plaster / direct to BC").
8. Item 1.2: tick "External walls are load-bearing" + ô "Internal load-bearing walls" (vd `I3, I7`). Stage 5: internal wall có label trong list → LB tick sẵn; lệch → cảnh báo.
9. Stud / top + ribbon plate / bottom plate: bảng "Other sizes (if any)": Size & grade · Where (walls / area) · Reason.
10. Nog: 2600 → 1350 / 1350.

### C. Wall Input (#11–#14)
11. Item 3.2: bảng member + đính ảnh.
12. Step-down: bảng Area · Wall labels · Depth · Frame height (tự tính từng dòng). File cũ → dòng đầu.
13. Input posts: 4 hình (Case 1 / Case 2 × Plan / Detail) trong Reference panel.
14. Beams: bảng Beam sizes (Beam · Size · Source); tick "Mid-wall pockets" → đính screenshot; tick "End-of-wall pockets" → bảng vị trí + đính screenshot.

### D. Wall Panels & Elevations (#15–#16)
15. LB mặc định: wall thuộc elevation → LB; Internal → không (trừ list ở 1.2). Ô nhập "E1-E8" lưu vào job data (.chck), giữ text sau khi Add, Add lại không tạo trùng.
16. Front façade chỉ cho builder có setting `usesFrontFacade` (Ashmont).

### E. Openings (#17–#21)
17. Under girder (critical stud size + deflection từ Autobeam); type lọc theo Internal / External; Ashmont: option "Front elevation brick veneer" (+130, floating studs), banner "Floating studs included in frame" · "No allowance for stack frames inside garage".
18. External: trimmer mặc định 90x35 (đổi được 90x45 / Other); lintel 90x35 / 140x35 1 ply → gợi ý 2 ply; lintel option (Designed / No suitable lintel / No lintel — ext NLB < 1800); Detailing method chọn nhiều + lời nhắc note.
19. Internal: bảng rule theo width (stud opening) và LB/NLB; Position thêm "90 / 70 mm from wall corner" (default theo builder).
20. WHH (6.2) hiện trên bảng openings.
21. Cabinet opening là opening type (Internal); bỏ item 6.9.

### F. Wall Adjustment & Elevation Check (#22–#23)
22. Bracing: đính screenshot (chọn file, kéo thả, Ctrl+V).
23. Critical stud: bảng Area · Level · Girder · Size · Deflection.

### G. Checker focus (#24)
- `checkerFocus` trên item (sửa được trong Content editor) → viền + badge ở role checker.
- Panel "Checker focus" đầu màn Summary: 16 điểm, mỗi điểm hiện data liên quan + tick "Verified" của checker (progress x/16). In trong PDF.

## Nền tảng
- Field kind `rows` (bảng nhiều dòng) và `photos` (đính ảnh), `showWhen` (field hiện khi một ô được tick).
- Opening model mở rộng (default cho mọi field mới → .chck cũ mở được).
- Builder settings: `usesFrontFacade`, `internalDoorCornerGap`. Bảng: nog known heights, opening framing sizes.
- Content version 1 → 2.

## Phase
| Phase | Nội dung | Mục |
|---|---|---|
| 1 | Branding + sửa nhanh | #1 #2 #3 #5 #6 #7 #10 #15 #16 #20 |
| 2 | Nền tảng `rows` / `photos` / `showWhen` | — |
| 3 | Input mới | #8 #9 #11 #12 #13 #14 #22 #23 |
| 4 | Openings | #17 #18 #19 #21 |
| 5 | Checker focus | #24 |
| 6 | Minh hoạ | #4 |
| 7 | Test + publish rule v2 + deploy | — |

## Sau khi deploy
Vào `/admin` → tab **Publish & history** → **Load built-in rules** (để chắc chắn không dùng draft cũ) → **Preview** kiểm tra → **Publish**.
