# Lawmans Smart Checklist — Kế hoạch xây dựng

**Trạng thái:** v3 — phase 1–4 đã code xong, chờ pilot (phase 5) · **Ngày:** 11/11/2026
**Tài liệu nguồn:** `Blueprint_Checklist_Website_Lawmans_MiTek 2.pdf` (yêu cầu, **là nguồn chính về thứ tự và rule**), `Spec - Update - 2nd.pdf` (quy tắc kỹ thuật), `Check list LAWMANS FRAME & TRUSS PTY LTD.xlsx` (checklist đang làm thủ công), `Live job 10_26-89.docx` và `Live Job 12_26-175.docx` (feedback của client trên job thực tế).

---

## 1. Chúng ta xây dựng gì

Một website để detailer mở job, chọn builder và house type, rồi đi qua từng stage của checklist wall frame trên MiTek 20/20.

- Checklist **chỉ hiển thị những item áp dụng** cho builder này, house type này và job này (step-down, raked wall, parapet, cầu thang, bath…).
- Mỗi item hiển thị **builder rule ngay bên cạnh**, kèm link tới mục tương ứng trong spec. Không ai phải lục tìm trong PDF.
- Website **tự tính các phép tính nhỏ** (nog height, internal wall height, stud opening, giới hạn frame, kiểm tra lintel deflection) và **cảnh báo** thay vì tự áp dụng giá trị khi chưa chắc chắn.
- Công việc được lưu thành **file `.chck` trên máy của detailer**. Checker mở file đó ở **review mode** để thêm flag, comment và hình ảnh, và có thể **xuất Draft PDF để review thủ công**. Sau khi sign-off, website xuất **Final PDF** gửi client.
- Rule của checklist do **nhân viên cập nhật qua trang Content editor** mỗi khi client gửi yêu cầu mới. Không cần developer.

---

## 2. Ai dùng và thế nào là "dễ dùng"

**Người dùng:**
- **Detailer và checker** của team Việt Nam, làm việc trên MiTek 20/20 bằng máy Windows (màn hình desktop, Chrome/Edge).
- **Nhân viên cập nhật rule** (cũng là agent, không rành kỹ thuật).

**Ngôn ngữ:** giao diện website **100% tiếng Anh**, dùng đúng thuật ngữ của MiTek 20/20 và tài liệu client.

**Nguyên tắc thiết kế cho người dùng không rành công nghệ**

| Nguyên tắc | Thể hiện trên màn hình |
|---|---|
| Mỗi lần một stage | Sidebar bên trái liệt kê 9 stage, mỗi stage có progress bar. Chỉ mở một stage tại một thời điểm. |
| Một item = một card | Card gồm: nội dung kiểm tra (một câu), nút status, ô nhập giá trị (nếu có), ô note, khung **builder rule**, link **"See spec"**. |
| Status rõ ràng, không chỉ dựa vào màu | ✓ Done · — N/A · ⚠ Needs confirmation · ⛔ Blocked · ○ Not started. Màu + icon + chữ. |
| Builder rule tự hiện ra | Khung màu trên item: *"Ashmont Homes: width +130 mm on front-façade brick veneer"*. Item không áp dụng sẽ bị ẩn (nút "Show hidden items"). |
| App gợi ý, người dùng xác nhận | Nhập wall height 2450 → app hiện "Nog height 1220, centres 1200 — **Use this**". Giá trị chưa rõ hoặc mâu thuẫn hiển thị ⚠, không bao giờ tự áp dụng (nguyên tắc của blueprint). |
| Không mất dữ liệu do vô ý | Trạng thái lưu luôn hiển thị trên top bar ("Saved 2 min ago" → vàng sau 10 phút → đỏ sau 20 phút). Trình duyệt hỏi "Leave without saving?" khi refresh hoặc đóng tab. |
| Học từ feedback của client | Item có thể kèm tip "**Common mistake**" lấy từ feedback của client, ghi rõ job number (vd: *"26-89: E11 over 6000 mm — break at junction"*). |

---

## 3. Các màn hình

```
Login ─► Home / Directory ─┬─► New job wizard ─► Checklist workspace ─► Summary & export
                           ├─► Open .chck file ─► workspace hoặc review mode (tùy giai đoạn ghi trong file)
                           ├─► User guide
                           └─► Content editor (đăng nhập riêng cho người sửa rule)
```

1. **Login** — một mật khẩu dùng chung, **server kiểm tra** (không nằm trong code của trang).
2. **Home / Directory** — 5 card builder kèm logo (Add Style / Your Storey Home Additions, Betterbuilt Homes, Transpire Constructions, Idyll House, Ashmont Homes); vùng kéo-thả lớn "Open a .chck file"; "User guide".
3. **New job wizard** (3 trang ngắn):
   - **Job:** Builder, Job No, Address dòng 1 (Lot + No + Street), Address dòng 2 (Suburb). Không ghi state, postcode hay số DP (quy định của client từ job 26-89).
   - **House type:** Single storey — standard / split-level; Double storey — standard / split-level; phần bổ sung: Granny Flat, Studio.
   - **Job conditions (Yes / No):** có step-down? raked / cathedral ceiling? parapet wall? cầu thang? bath / shower / niche? có wall cao hơn 3450 mm? post hoặc steel beam? sàn Posi-Strut? Các câu trả lời này bật/tắt item trong checklist và có thể thay đổi sau.
   - **Double storey = hai checklist riêng** (Ground Floor và First Floor), mỗi tầng lưu thành một file riêng, khớp với hai file MiTek mà client yêu cầu. Khi bắt đầu tầng thứ hai, người dùng có thể copy thông tin job từ file của tầng đầu.
4. **Checklist workspace** — bên trái: 9 stage + tiến độ; ở giữa: các card item; bên phải: reference panel (trích spec, builder rule, hình minh họa từ blueprint). Top bar: Job No · Builder · Floor · trạng thái lưu · **Save** · **Send for review** · **Draft PDF**.
5. **Summary & export** — số lượng item theo status; danh sách item chưa xong; tất cả item ⚠ và ⛔; **gom toàn bộ note về một chỗ**; các nút export tương ứng với giai đoạn công việc (§6).
6. **Review mode** — giống workspace; giá trị của detailer bị khóa (màu xám); checker thêm flag, comment, hình ảnh vào bất kỳ item nào, **xuất Draft PDF để review thủ công** và sign-off.
7. **User guide** — nội dung blueprint §5 (cảnh báo mất dữ liệu khi refresh, dùng file nào ở giai đoạn nào), kèm ảnh chụp màn hình.
8. **Content editor** — nơi nhân viên sửa rule (§8).

---

## 4. Cấu trúc checklist — 9 stage theo blueprint

Thứ tự đi theo blueprint. Item lấy từ blueprint, spec và checklist Excel. *[if …]* nghĩa là item chỉ hiện khi điều kiện đó đúng.

| # | Stage (tên trên web) | Blueprint |
|---|---|---|
| 1 | Job Review | §6.1 |
| 2 | Job Setup | §6.2 |
| 3 | Wall Input | §6.3, 4, 6, 7 |
| 4 | Elevations | §8 bước 1–2 |
| 5 | Wall Panels per Elevation | §8 bước 3 |
| 6 | Openings per Elevation | §9 |
| 7 | Wall Adjustment | §5, 11 |
| 8 | Elevation Check | §10, 12 |
| 9 | Labels & Notes | §13 |

**1. Job Review**
Builder · Job No · Address · House type · roof (metal sheet / concrete tile / khác) · pitch · truss spacing · ceiling · overhang · wind class (N2/N3) · xác định load-bearing wall (joist layout, floor beam layout, engineering / steel drawings; stair void hoặc Posi-Strut chưa rõ → ⚠ "Ask the Posi-Strut detailer", không tự đoán).

**2. Job Setup**
Default panel types + panel **Name** (Single Storey / Ground Floor / First Floor / Studio / Granny Flat; external wall dùng `90x35 600C EXTp12`) · thickness ext/int (90/70) · stud spacing (600cc) · **size & material của stud / top plate / ribbon plate / bottom plate: detailer tự nhập** theo tính toán của từng job (Hyne Design, engineering plan). App chỉ hiện giá trị đề xuất của builder bên cạnh, không điền sẵn · nogging (theo builder) · height (internal = external − 25 mm khi external dùng 2/35 top + ribbon plate và internal dùng top plate 45) · nog spacing (≈ nửa chiều cao frame) · other setups: special timber pieces (Over, Under, Sill, Block, Flat Block, Trimmer) để default và tick, hoặc ghi note nếu có yêu cầu riêng.

**3. Wall Input**
- **Wall:** load-bearing / non-load-bearing (kiểm tra truss bearing trên truss layout; wall quanh stair void) · kiểm tra kích thước wall.
- **Engineering plan** (mọi builder): member ghi trên engineering drawing của job (LVL stud, beam, post…) phải detail đúng theo engineering plan. Vd job 26-89: LVL stud → 90x45 WES DWE4T-D VL-LO (LVL13, không phải meyWALL).
- **Step-down** *[step-down]*: khu vực (garage, porch, alfresco…), label (E12, E13…), depth. Standard house: frame height = wall height + step-down depth. Split-level: giữ nguyên height, chỉnh elevation offset.
- **Raked wall / cathedral ceiling** *[raked]*: detail là internal non-load-bearing; top of frame thấp hơn underside of rafter 25 mm; ridge beam pocket 90 mm; bracing kéo lên top plate; cao > 3450 → break (vd tại apex).
- **Parapet wall** *[parapet]*: frame liên tục từ sàn lên đỉnh parapet; width ≈ ceiling height của nhà (vd 2450); split frame để vận chuyển (cạnh opening, beam pocket, hoặc chia đôi); split frame có single 35 mm top plate + full-length ribbon plate supplied loose; truss có restraint ở ceiling level.
  Mỗi special wall là một danh sách tình huống. **Còn mục chưa tick → cảnh báo** (blueprint 4.2.3).
- **Post:** input post, wall che post.
- **Beam:** beam capacity (Hyne / Autobeam); beam pocket (giữa wall: giữ top plate, bỏ tick *Trim Beam Pockets*; đầu wall: bỏ top plate).
- Wall frame dưới cầu thang + chiều cao *[stairs]* · bath frame + chiều cao *[bath]*.

**4. Elevations**
Số elevation (mặc định 4, có thể đổi) · kiểu tên cho từng elevation: N/S/E/W, Front/Rear/Far/Near, hoặc Elevation 1, 2… · đánh dấu elevation nào là **front façade** (giáp đường, nhập tên đường). Thông tin front façade dùng cho floating stud và width +130 của Ashmont.

**5. Wall Panels per Elevation**
Gán wall label vào từng elevation (vd Elevation 1: E1, E2). Internal wall (I…) nằm trong nhóm "Internal". Mỗi wall có **wall finish** (brick veneer / cladding), dùng để tính vị trí opening và áp rule Ashmont.
App cảnh báo khi một wall chưa được gán hoặc bị gán hai lần, và nhắc quy tắc đánh số (E1 ở góc dưới-trái, ngược chiều kim đồng hồ).

**6. Openings per Elevation** (chi tiết bảng ở §5)
- **Danh sách opening:** bảng opening theo từng elevation và nhóm Internal.
- **Window head height:** WHH thường bằng head height của external door, có thể khác nhau theo elevation. Lấy từ elevation drawing, window/door schedule hoặc plan note.
- **Kích thước opening:** opening dimension compensation (allowance chuẩn + builder override).
- **Vị trí opening:** middle, hoặc theo kích thước plan + Left/Right.
- **Opening stud:** load-bearing → Hyne / Autobeam. Non-load-bearing → jamb stud 45 mm; gần junction có thể dùng 2/35.
- **Trimmer:** load-bearing → tối thiểu 35 mm. Non-load-bearing → ≤ 1800 dùng 45 mm; > 1800 dùng lintel design + trimmer 35 mm.
- **Lintel capacity:** bảng lintel + kiểm tra deflection. Vượt bảng → hỏi truss detailer / client / engineer.
- **Item khác:** cabinet opening · corner door/window (lintel depth ≥ 300; note "Lintel flush this side", "Corner Window Lintel on Inside Extend … mm") · floating stud *[Ashmont, front façade brick veneer]* · opening note.

**7. Wall Adjustment**
- **Break wall:**
  - Chiều dài: **khuyến nghị ≤ 4.5 m**; > 5950 vượt giới hạn sản xuất.
  - Chiều cao: > 3450 phải break để vận chuyển.
  - Vị trí break: tại junction, cạnh opening, hoặc giữa wall. Nếu cả job > 3450: chọn base frame rộng 3.3–3.4 m, các frame khác nhỏ dần.
  - Kiểu break: mặc định Mid Junction Break; nếu conflict với opening / jamb stud / point load → Side Junction Break hoặc Break at Length. *Ashmont: luôn Side Junction Break.*
- **Bulkhead:** chọn loại theo depth: 150 → 150x45 LVL; 200 / 240 / 300 → HyJoist; size khác → detail như wall frame 70x35 MGP10 @600. *Ashmont: không cung cấp bulkhead material.*
- **Tie-down bolt:** thêm "x".
- **Extra nog** *[Betterbuilt]*: vanity, step-down, architrave.
- **Shower, niche** *[shower / niche]*: shower → double stud giữa shower screen, nog @600 & 1800; niche → critical stud ở rear wall.
- **Critical stud:** critical stud capacity · critical stud (girder / beam / steel post / stair wall / shower).

**8. Elevation Check**
- **Kiểm tra frame:** extra dimension · opening stud (jamb, prop) · extra stud · input extra nog *[Betterbuilt]*.
- **Bracing capacity:** theo direction A/B (detailed vs designed kN → hiện phần còn thiếu). Nhà vuông / chữ nhật → Hyne Design. Nhà phức tạp (L/U/C, split-level) → tính theo AS1684.2-2021.
- **Bracing type:**
  - Load-bearing wall: cross strap 1.5 kN / 3.0 kN, ply.
  - Non-load-bearing wall: angle 0.8 kN, strap 1.5 kN, ply.
  - Góc 45–60°. Không dùng cut-in angle brace cho load-bearing wall. Posi-Brace / MeyBRACE cần client hoặc engineer duyệt. Clad wall: thêm sheet.
- **Stud tie & stud screw:** internal load-bearing wall chỉ cần ở bracing wall. Ground floor đỡ upper floor: không cần. Ground floor đỡ trực tiếp roof truss: cần. Lintel không có top / ribbon plate phía trên: không cần.
- **Extra note:** "Cut in top plate", "+ infill", "+ packer", "steel post", "+ Head Straps".

**9. Labels & Notes**
- **Address & job no:** dòng "Job No – (Ground Floor)", tên builder, Lot + No + Street, Suburb; không ghi state / postcode.
- **Workline:**
  - Garage brick workline: 230 mm, line 45° cách nhau 50 mm @300cc.
  - Step-down workline *[step-down]*: chỉ vẽ ở cạnh trong garage, thickness 2, cách wall 30 mm. Màu theo thứ tự: garage Blue → Orange → Purple → Red.
- **Label:**
  - Bracing label: cross bracing mặt trong, ply mặt ngoài; double cross bracing xếp chồng.
  - Panel label: external đặt phía ngoài; internal đặt bên phải hoặc phía trên; bracing label đối diện panel label.
- **Đánh số:**
  - External wall và internal wall numbering.
  - Junction label: Reset Numbering, ngược chiều kim đồng hồ từ 1, đặt đối diện cross-bracing label.
  - Renumber opening khớp với panel (E1 → W1/D1).
  - Internal door label là D1, D2…; không dùng "720", "BIC", "LINEN".
- **Note:** nogging note (70 / 88 throughout; meyWALL LVL cho bản gửi factory) · tie-down note · ply brace sheet note · beam line/note · shower work line · tên house type · note khác (job info, AS1684.2:2021).
- **Hoàn tất:** resequence · tắt stud view.

**Bảng framing đề xuất theo builder** (blueprint; "2/" = top plate + ribbon plate; tất cả là "min, or to AS1684")
Bảng này **chỉ là đề xuất**, hiện bên cạnh ô nhập ở stage 2. Detailer tự nhập size thực tế cho từng job, vì giá trị phải tính lại theo load, tie-down và wind class. Riêng cột nogging là builder rule.

| Builder | Stud | Load-bearing top plate | Non-load-bearing top plate | Bottom plate | Nogging |
|---|---|---|---|---|---|
| Add Style / Your Storey | 90x35 MGP10 | 2/90x35 MGP10 | 90x45 MGP10 | 90x45 MGP10 | 88 mm throughout |
| Idyll House | như Add Style | như Add Style | như Add Style | như Add Style | 88 mm throughout |
| Betterbuilt | 90x35 MGP10 | 2/90x35 meyWALL LVL | 90x45 MGP10 | 90x35 MGP10 | 70 mm throughout |
| Ashmont | 90x35 meyWALL Red LVL | 2/90x35 meyWALL Red LVL | 90x45 meyWALL Red LVL | meyWALL Red LVL | 90 frame: 70 mm · 70 frame: on flat |
| Transpire | 90x35 MGP12 @600 (load-bearing) · 90x35 MGP10 (internal non-load-bearing FF) | 2/90x35 MGP10 | 90x45 MGP10 | 90x35 MGP10 | 70x35 |

**Item riêng theo builder** (tự động thêm vào đúng stage)

| Builder | Item bổ sung |
|---|---|
| Add Style / Your Storey & Idyll | Nib tối thiểu 90 mm · internal door cách góc 90 mm · header height: external door & window 2130, internal door 2110, BIC 2110 · external door stud opening rộng 880 · frame height 2450, eave overhang 450 · stud centres 600 |
| Betterbuilt | Architrave nog 90x45 tại floor step · vanity nog 2×90 @ 735 mm on edge · clad-wall window cách eave 80 mm · header height theo elevation · internal door cách góc 90 mm |
| Transpire | Kiểm tra slab step location · xác nhận garage step location trước khi sản xuất · window schedule đã được sign-off · kích thước front door lấy từ purchase order · kitchen window sill 890 mm (xác nhận vị trí nếu plan không ghi) · robe 2100 → trimmer/lintel ở 2140 · double stud ở door cạnh internal corner · tie-down bolt thể hiện trên layout · critical load: tối thiểu 2/90x35 MGP12 |
| Ashmont | External opening H+80, W+130 ở brick veneer mặt tiền · floating stud ở brick veneer mặt tiền · side junction break · không có bulkhead material · không có stack frame trong garage · internal wall 70 mm: toàn bộ cấu kiện 70x35 · không có vanity nog |

---

## 5. Chi tiết stage 4–6: elevation, wall panel, opening

Mỗi tầng (mỗi file) có một bộ dữ liệu riêng:

1. **Elevations** — số lượng (mặc định 4), tên, elevation nào là front façade.
2. **Wall panels** — wall nào thuộc elevation nào, wall finish của từng wall.
3. **Openings** — mỗi opening một dòng, nằm dưới elevation của nó:

| Trường | Cách hoạt động |
|---|---|
| Label | W1, D1… |
| Wall | Chọn trong danh sách wall của elevation đó (vd E1) |
| Type | Internal door · Cavity slider · Smart robe · Window (Alu / Timber) · External door (Alu / Timber) |
| Schedule size (H × W) | Lấy từ window/door schedule của client |
| **Stud opening** | Tự tính = schedule size + allowance theo type, **sau đó áp builder override** (hiện kèm lý do) |
| Head height | Mặc định theo builder; có thể khác nhau theo elevation |
| Position | Tick "Middle of wall", **hoặc** nhập kích thước từ plan; app tự trừ theo wall finish (brick veneer 150–160 mm, cladding 35 mm) + chọn Left/Right (hiện hình quy ước từ blueprint trang 30 bên cạnh) |
| Lintel | Kết quả Hyne / Autobeam (timber, deflection) → so với bảng deflection |
| Note | Ghi tự do |

**Allowance tiêu chuẩn (spec 14.2):** internal door W+60 / H+70 · cavity slider (2×W)+60 / H+110 · smart robe +15 / +15 · Alu window +60 / +60 · timber window +10 / +10 · Alu external door +60 / +30 · timber external door +10 / +10.
**Builder override:** Ashmont external H+80, W+130 ở brick veneer mặt tiền (60 clearance + 70 floating stud) · Add Style / Idyll external door stud opening rộng 880.

---

## 6. File và các giai đoạn công việc

Chỉ có **một loại file: `.chck`**. Trong file có ghi giai đoạn (in progress / review). Khi mở file, app tự vào đúng chế độ. Tên file được đặt sẵn, vd `26-175 Ground Floor.chck`, `26-175 Ground Floor - Review 2.chck`.

| Giai đoạn | Ai | Output | App cho phép |
|---|---|---|---|
| 1. In progress | Detailer | `.chck` (in progress) | Sửa mọi thứ. Mở lại bất cứ lúc nào để làm tiếp. |
| 2. Review | Checker lần 2 / lần 3 | `.chck` (review) + **Draft PDF** | Input của detailer bị khóa. Checker thêm flag, comment, hình ảnh rồi sign-off. Checker **xuất Draft PDF bất cứ lúc nào** để review offline hoặc in ra giấy. Bản PDF này có watermark "DRAFT", có flag/comment hiện tại và một cột trống để ghi tay. |
| 3. Final | Sau khi sign-off | **Final PDF** | Chỉ mở khi mọi item là Done hoặc N/A, không còn flag mở, và đã đủ sign-off. Không có watermark; có phần sign-off. |

**Nội dung trong file:**
- **Phiên bản:** version của format file · version của nội dung checklist (rule).
- **Dữ liệu job:** job info · floor · job conditions · status, giá trị và note của từng item · elevation, wall panel, opening, lintel.
- **Review:** các vòng review (tên checker, vòng, ngày, flag/comment/hình ảnh, sign-off).
- Khi có hình ảnh, file được lưu dạng zip (JSON + ảnh) nhưng vẫn dùng đuôi `.chck`.

**Khi rule đã thay đổi sau lúc lưu file:** app báo "Checklist rules were updated since this file was saved" và liệt kê item mới hoặc đã đổi. Item mới được thêm ở trạng thái Not started.

**Mức bảo vệ (đã chốt: đủ dùng ở giai đoạn này):**
- App khóa input khi ở review mode.
- File có lưu fingerprint của input do detailer nhập. Nếu file bị sửa bằng tay, app hiện "This file was changed outside the app".
- Final PDF được flatten, không có form field.
- Không chống được người cố tình sửa. Nếu sau này cần chống sửa tuyệt đối thì phải có tài khoản và server.

---

## 7. Kiểm tra và công cụ tính có sẵn

| Kiểm tra | Quy tắc | Nguồn |
|---|---|---|
| Internal wall height | = external − 25 mm | Blueprint 2.2.5 |
| Nog height & centres | 2450 → 1220 / 1200 · 2740 → 1350 / 1350 · chiều cao khác: ≈ một nửa, hiện ⚠ để xác nhận | Blueprint 2.2.6 |
| Step-down frame height | Standard house: wall height + step-down depth · split-level: giữ nguyên height, chỉ chỉnh offset | Blueprint 4.1 |
| Raked wall height | Top of frame = underside of rafter − 25 mm | Blueprint 4.2.1 |
| Frame length | ≤ 4500 OK · > 4500 ⚠ "Recommended max 4.5 m — consider a break" · > 5950 ⛔ vượt giới hạn sản xuất (max 6000) | Quyết định của team + blueprint §5 |
| Frame height | > 3450 ⛔ break để vận chuyển · > 6000 ⛔ cần engineering | Blueprint §5 |
| Non-load-bearing opening | > 1800 → lintel design + trimmer 35 · ≤ 1800 → trimmer tối thiểu 45 | Blueprint 8.6 |
| Lintel deflection | Opening width → dải deflection tối đa; ngoài dải → ⛔ "Consult truss detailer / client / engineer" | Blueprint 8.7 |
| Pine lintel lớn nhất | Pine lớn hơn 190x45 MGP10 → ⚠ (pine 240/290 bị cong vênh ngoài công trường) | Spec 8.1 |
| Stud screw | Theo các rule ở stage 8; stud ≤ 450 cc → không cần screw | Blueprint §12, spec 7.2 |
| Tie-down | RLW = span ÷ 2 + overhang · uplift = RLW × **hệ số (detailer tự nhập theo wind class, không có giá trị mặc định)** · mỗi stud = uplift × spacing | Spec 7.2 |
| Bracing shortfall | Designed − detailed, theo từng direction | Format của job 26-89 |
| Bulkhead timber | Plate = length × 2 · số stud ≈ length ÷ 600 · stud length = depth − 70 | Spec 15.2 |
| Wall mapping | Wall chưa gán elevation, hoặc gán hai lần → ⚠ | Blueprint §8 |
| Item chưa tick | Item chưa Done / N/A → liệt kê ở Summary; chặn Final PDF | Blueprint 4.2.3 |

---

## 8. Hướng kỹ thuật

**Nguyên tắc dữ liệu:** dữ liệu job **không bao giờ gửi lên server**. Job chỉ nằm trong trình duyệt và trong file `.chck`, đúng yêu cầu session-only của blueprint. Server chỉ làm hai việc: kiểm tra mật khẩu và lưu rule của checklist.

| Hạng mục | Lựa chọn | Lý do |
|---|---|---|
| App | Single-page app: **React + TypeScript + Vite** | Nhanh, chạy tốt trên Chrome/Edge, làm được offline sau khi đã tải trang. |
| Hosting + backend nhỏ | **Cloudflare Pages + Pages Functions + D1** (database) | Một chỗ cho cả website, kiểm tra mật khẩu và lưu rule. Chi phí thấp. |
| Login | Pages Function kiểm tra mật khẩu dùng chung, trả về cookie có chữ ký | Mật khẩu không nằm trong code của trang. |
| Content editor login | Đăng nhập theo từng người bằng email công việc + mã một lần (Cloudflare Access) | Biết ai đã sửa rule gì, không cần nhớ thêm mật khẩu. |
| Rules engine | Các hàm thuần (pure function) nhỏ: `(job conditions, builder, rules) → item hiển thị, giá trị mặc định, cảnh báo` | Dễ unit test mọi tổ hợp builder × house type. |
| State | Chỉ lưu trong bộ nhớ (Zustand). **Không dùng browser storage** | Đúng quy tắc bảo mật của blueprint. |
| File `.chck` | JSON (+ zip bằng JSZip khi có hình ảnh), validate bằng Zod khi mở | Báo lỗi rõ ràng nếu file hỏng hoặc thuộc version cũ. |
| Save | Chrome/Edge: "Save" ghi đè lại đúng file đang mở (File System Access API). Trình duyệt khác: tải file về. | Tránh có nhiều bản copy của cùng một job. |
| PDF | Tạo ngay trên trình duyệt (**pdfmake**, chỉ tải khi bấm xuất PDF) | Font Roboto đi kèm hiển thị đủ tiếng Việt (detailer có thể ghi note tiếng Việt), có sẵn watermark "DRAFT". |
| Brand | MiTek blue `#0033A0` (nav, heading, link) · Lawmans red `#790000` (logo, điểm nhấn nhỏ) · charcoal `#232323` (chữ) · light grey `#F3F5F7` (panel) · màu status xanh `#21865B` / vàng `#D98B16` / đỏ `#C43D3D` | Blueprint §2. Dùng file logo chính thức từ client, không vẽ lại. |
| Test | Vitest (rule, công cụ tính, save → open ra đúng dữ liệu) · Playwright (các luồng chính) | |

**Content editor — cách nhân viên cập nhật rule**

Quy trình: client gửi yêu cầu (spec mới, feedback trên live job) → nhân viên mở Content editor → sửa → xem thử → publish.

- **Sửa bằng form, không có code.** Mỗi item có các ô: stage, nội dung, áp dụng cho builder nào / house type nào / job condition nào (chọn bằng checkbox), field cần nhập, builder note, đoạn spec tham chiếu + hình, tip common mistake (kèm job number).
- **Sửa builder:** bảng framing, allowance của opening, item riêng.
- **Xem thử:** "Preview as Ashmont · Double storey · có step-down" trước khi publish.
- **Draft → Publish:** sửa xong chưa ảnh hưởng ai, chỉ khi bấm Publish mới áp dụng. Mỗi lần publish tạo một version mới.
- **History & rollback:** xem ai sửa gì, lúc nào; quay lại version cũ bằng một nút.
- **Backup:** export / import toàn bộ rule ra một file JSON.

Nội dung ban đầu được nhập từ blueprint, spec, checklist Excel và hai file live job.

---

## 9. Các phase triển khai

| Phase | Phạm vi | Hoàn thành khi |
|---|---|---|
| **1. Core checklist** | Login, directory, new job wizard, đủ 9 stage với builder rule và điều kiện, status / giá trị / note, save & open `.chck`, cảnh báo chưa lưu, trang summary, Draft PDF. Rule tạm để trong một file JSON đi kèm app (cùng format với phase 4). | Detailer chạy được một job thật từ đầu đến cuối và mở lại vào hôm sau |
| **2. Elevation & opening tools** | Stage 4–6 đầy đủ: elevation setup, wall mapping, bảng opening + công cụ tính allowance, bảng lintel + kiểm tra deflection, các công cụ tính khác, reference panel spec có hình minh họa | Kích thước opening trong app khớp với một job đã được check |
| **3. Review & final** | Review mode (khóa input, flag, comment, hình ảnh, các vòng review, sign-off), Draft PDF cho checker, Final PDF | Checker review được job và xuất PDF cho client |
| **4. Content editor** | Chuyển rule lên D1; Content editor với form, preview, draft/publish, history, rollback; xử lý file cũ khi rule thay đổi | Nhân viên tự thêm được một rule mới từ feedback của client mà không cần developer |
| **5. Pilot** | Trang user guide; 2–3 detailer dùng thử trên live job; nhân viên cập nhật rule theo feedback | Detailer thích dùng hơn file Excel |

**Tiến độ (11/11/2026):** phase 1–4 đã code xong, kể cả trang user guide. Đã có unit test (calculators, rules, file `.chck`, PDF, session cookie) và Playwright e2e cho luồng detailer → review → checker → Final PDF. Backend đã chạy thử local bằng `wrangler pages dev` (login, draft/publish/history/rollback). Còn lại: deploy lên Cloudflare (xem README), pilot với detailer, và câu hỏi về bảng lintel ở §10.

---

## 10. Quyết định đã chốt và câu hỏi còn mở

**Đã chốt**

| Chủ đề | Quyết định |
|---|---|
| Thứ tự checklist | 9 stage theo blueprint (§4) |
| Builder | 5 builder: Add Style / Your Storey, Betterbuilt, Transpire, Idyll, Ashmont. Bỏ Elysium. Idyll dùng rule như Add Style (theo blueprint). |
| Betterbuilt load-bearing top plate | 2/90x35 meyWALL LVL = top plate + ribbon plate. Không mâu thuẫn với spec. |
| Stud / top plate / ribbon plate / bottom plate | Detailer tự nhập theo từng job. App chỉ hiện đề xuất của builder, không điền sẵn. |
| Hệ số tie-down | Phụ thuộc wind class, detailer tự nhập |
| Member theo engineering plan (vd LVL stud) | Áp dụng cho mọi builder: detail theo engineering plan của từng job |
| Chiều dài wall | Khuyến nghị ≤ 4.5 m; > 5950 là vượt giới hạn sản xuất |
| Ashmont: side junction break, không có bulkhead material | Builder rule (client đã xác nhận trong job 26-89) |
| Plan note mâu thuẫn với elevation | Đánh dấu ⚠ Needs confirmation + đưa vào note khi submit; không tự chọn |
| Mật khẩu Login | Server kiểm tra |
| Refresh | Giữ session-only như blueprint + cảnh báo "Leave without saving?" + nhắc lưu |
| Đuôi file | `.chck` (một đuôi cho cả in progress và review) |
| Ngôn ngữ website | 100% tiếng Anh |
| Ai cập nhật rule | Client gửi yêu cầu, nhân viên sửa qua Content editor |
| Checker xuất PDF | Có, Draft PDF bất cứ lúc nào |
| Chống sửa file | Khóa trong app + fingerprint là đủ (tạm thời) |

**Còn mở — cần hỏi Lawmans**

| # | Chủ đề | Tài liệu nói gì | Cách xử lý tạm thời |
|---|---|---|---|
| 1 | Các dải trong bảng lintel | 3000 nằm trong hai dải; có khoảng trống giữa các dải (vd 1000–1100). | Dùng giới hạn chặt hơn và hiện ⚠ |
