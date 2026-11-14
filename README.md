# Smart Check Wall

Website checklist wall frame (MiTek 20/20) cho detailer và checker làm job của Lawmans Frame & Truss. Kế hoạch và các quyết định đã chốt: [PLAN.md](PLAN.md). Bản cập nhật v2 theo `requirement-update.docx`: [PLAN-v2.md](PLAN-v2.md).

- **Giao diện:** 100% tiếng Anh, 9 stage theo blueprint, chỉ hiện item áp dụng cho builder / house type / job condition.
- **Dữ liệu job:** không lưu trên server. Job chỉ nằm trong tab trình duyệt và trong file `.chck` trên máy người dùng (refresh = mất phần chưa lưu, có cảnh báo).
- **Server (Cloudflare):** chỉ kiểm tra mật khẩu và lưu rule của checklist (Content editor).

## Cấu trúc thư mục

```
src/
  content/defaultContent.ts   Rule ban đầu (9 stage, 5 builder, allowance, bảng lintel)
  content/types.ts, schema.ts Kiểu dữ liệu + Zod schema (rule và file .chck)
  job/                        Kiểu dữ liệu job, tạo job mới
  lib/calc.ts                 Công cụ tính (nog, step-down, stud opening, deflection, tie-down…)
  lib/openings.ts             Gợi ý opening framing: lintel / trimmer / jamb / prop, lintel 2 ply, detailing method
  lib/focus.ts                Checker focus: các điểm checker cần xem khi review
  lib/rules.ts                Rules engine: item nào hiện, cảnh báo, summary, điều kiện Final PDF
  lib/fileio.ts               Đọc/ghi .chck (JSON hoặc zip khi có ảnh), fingerprint
  lib/pdf.ts                  Draft PDF / Final PDF (pdfmake, font Roboto hỗ trợ tiếng Việt)
  ui/                         Màn hình: Home, Wizard, Workspace, Summary, Guide…
  admin/                      Content editor (/admin)
functions/                    Cloudflare Pages Functions: login, session, /api/content, /api/admin/*
migrations/                   D1 schema
public/                       Logo, favicon, hình minh họa (illustrations/), hình spec, trang login
e2e/                          Playwright end-to-end tests
```

## Chạy local

Yêu cầu: Node 20+ (đã test với Node 24).

```bash
npm install
```

**Cách 1 — chỉ frontend (nhanh, không có login):**

```bash
npm run dev            # http://localhost:5173
```

Dùng rule có sẵn trong code. Content editor (`/admin`) mở ở chế độ offline: sửa được, nhưng chỉ lưu bằng "Export JSON".

**Cách 2 — đầy đủ như production (login + Content editor + D1 local):**

```bash
cp .dev.vars.example .dev.vars        # mật khẩu local: MitekVietnam
npm run cf:migrate:local              # tạo bảng D1 local (chạy một lần)
npm run cf:dev                        # build + http://127.0.0.1:8788
```

Trên localhost, `DEV_ADMIN_EMAIL` trong `.dev.vars` cho phép vào Content editor mà không cần Cloudflare Access. Biến này **không** có tác dụng trên domain thật.

## Test

```bash
npm test               # unit test: calculators, rules, file .chck, PDF, session cookie
npm run test:e2e       # Playwright: luồng detailer → review → checker → Final PDF
npm run typecheck      # TypeScript cho frontend và functions
```

Lần đầu chạy e2e: `npx playwright install chromium`.

## Deploy lên Vercel

Vercel tự build bằng `vercel.json` (Vite → `dist/`). Backend nằm ở `middleware.ts` (chặn mọi trang khi chưa login) và `api/*.ts` (Edge Functions), dùng chung code trong `server/`.

1. **Storage → Create Database → Neon (Postgres)**, rồi connect vào project. Vercel tự thêm `DATABASE_URL`. Bảng được tạo tự động lần đầu dùng.
2. **Settings → Environment Variables** (chọn Production + Preview):

   | Biến | Giá trị |
   |---|---|
   | `SITE_PASSWORD` | `MitekVietnam` |
   | `SESSION_SECRET` | chuỗi ngẫu nhiên dài (`openssl rand -hex 32`) |
   | `ADMIN_PASSWORD` | mật khẩu riêng cho Content editor (`/admin`) |
   | `ADMIN_EMAILS` | (tuỳ chọn) danh sách tên được phép sửa rule, cách nhau bằng dấu phẩy |

3. **Redeploy** (Deployments → ⋯ → Redeploy) để nhận biến mới.
4. Kiểm tra: mở site trong cửa sổ ẩn danh → phải thấy trang **Log in**. Vào `/admin` → đăng nhập bằng tên + `ADMIN_PASSWORD` → tab **Publish & history** → publish version 1.

Nếu vào site mà không bị hỏi mật khẩu: middleware chưa chạy — kiểm tra file `middleware.ts` có trong commit và log của deployment.

## Deploy lên Cloudflare Pages

1. Tạo database D1 và chép `database_id` vào `wrangler.toml`:
   ```bash
   npx wrangler d1 create lawmans-checklist
   npx wrangler d1 migrations apply lawmans-checklist --remote
   ```
2. Tạo project Pages và deploy:
   ```bash
   npx wrangler pages project create lawmans-smart-checklist
   npm run cf:deploy
   ```
3. Đặt secret (không commit vào repo):
   ```bash
   npx wrangler pages secret put SITE_PASSWORD      # MitekVietnam
   npx wrangler pages secret put SESSION_SECRET     # chuỗi ngẫu nhiên dài, vd: openssl rand -hex 32
   ```
4. Bảo vệ Content editor bằng **Cloudflare Access** (Zero Trust → Access → Applications → Self-hosted):
   - Path: `/admin*` và `/api/admin*` trên domain của site.
   - Policy: cho phép email của nhân viên được sửa rule (đăng nhập bằng mã gửi qua email).
   - Sau đó đặt thêm secret: `ACCESS_TEAM_DOMAIN` (vd `yourteam.cloudflareaccess.com`), `ACCESS_AUD` (AUD tag của application), và nếu muốn `ADMIN_EMAILS` (danh sách email, cách nhau bằng dấu phẩy).
5. Lần đầu: vào `/admin` → tab **Publish & history** → publish version 1 (rule ban đầu đã có sẵn trong editor).

## Cập nhật rule (cho nhân viên)

Vào **Content editor** (link ở cuối trang Home, hoặc `/admin`):

1. Sửa item, builder, allowance hoặc bảng lintel bằng form.
2. **Save draft** để lưu dở. Detailer chưa thấy gì.
3. **Preview** để xem checklist theo builder / house type / job condition.
4. Tab **Publish & history** → ghi chú thay đổi → **Publish**. Detailer nhận rule mới khi mở lại website.
5. Nếu publish nhầm: **Restore** version cũ trong History.

File `.chck` lưu theo rule cũ vẫn mở được. App liệt kê item mới / đã đổi, và item mới bắt đầu ở trạng thái Not started.

### Sau khi deploy bản có rule mới trong code (ví dụ v2)

Rule đang live nằm trong database, nên deploy code không tự đổi rule. Vào `/admin` → tab **Publish & history** → **Load built-in rules** → kiểm tra bằng **Preview** → **Publish**. Nếu đã có ai sửa rule trên production, nút này sẽ ghi đè các sửa đổi đó: export JSON trước để đối chiếu.

## Lưu ý bảo mật

- Mật khẩu chỉ được kiểm tra trên server. Toàn bộ app (JS, rule) yêu cầu cookie đăng nhập (HttpOnly, ký HMAC, hết hạn sau 12 giờ).
- Khóa read-only của checker và Final PDF "không sửa được" do app đảm bảo. File `.chck` có fingerprint (SHA-256), sửa bằng tay sẽ bị cảnh báo, nhưng không chống được người cố tình sửa (đã chốt là đủ ở giai đoạn này, xem PLAN.md §10).
- Logo builder lấy từ blueprint; logo Ashmont lấy từ `requirement-update.docx` (`public/logos/ashmont.png`). Thêm builder mới: thêm file vào `public/logos/` rồi điền đường dẫn trong Content editor.
