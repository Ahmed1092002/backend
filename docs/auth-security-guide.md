# Auth and Security Guide

هذا الدليل يشرح Authentication وAuthorization في Mini ERP، من التسجيل حتى logout، وما الذي يجب مراجعته قبل production.

## 1. الصورة الكاملة

```text
Register → password hash → User
Login    → access token + refresh token cookie
API call → Authorization: Bearer <access token>
Refresh  → rotate refresh token → new access token
Logout   → delete refresh session + clear cookie
```

## 2. Register

`POST /api/auth/register` يمر بالترتيب التالي:

```text
Zod validation
→ bcrypt.hash(password, 12)
→ create User
→ queue welcome-email job
→ return safe User DTO
```

لا نخزن password الأصلية. نخزن فقط `passwordHash`. ولو email موجودة بالفعل، Prisma unique constraint تتحول إلى `409 Email already exists`.

## 3. Login

`POST /api/auth/login` يأخذ email وpassword:

```text
find user by email
→ bcrypt.compare(password, passwordHash)
→ create access token
→ create refresh session
→ save refresh token hash in database
→ put raw refresh token in HTTP-only cookie
→ return user + access token in JSON
```

لو email أو password غير صحيحة، نعيد نفس رسالة `401 Invalid email or password`. هذا يمنع كشف هل email موجودة أم لا.

## 4. Access Token

الـaccess token JWT قصيرة العمر، حاليًا 15 دقيقة. تحتوي claims موقعة من السيرفر:

```json
{
  "sub": "user-id",
  "role": "ADMIN"
}
```

`sub` هي user id. `role` تأتي من user الموجودة في database وقت login، وليست من request body.

الـclient يرسلها في كل request محمية:

```http
Authorization: Bearer <access-token>
```

لا نضع access token في URL أو query string أو logs.

## 5. `authenticate` Middleware

`src/middleware/authnticate.ts`:

```text
1. يتأكد أن Authorization header موجودة.
2. يتأكد أن الصيغة Bearer token صحيحة.
3. يعمل jwt.verify باستخدام JWT_SECRET.
4. يتأكد أن payload فيها sub وrole صالحان.
5. يضع user في res.locals.user.
6. ينادي next().
```

بعد نجاح التحقق، أي controller لاحقة لا تثق في user id أو role قادمين من browser؛ تقرأ فقط:

```ts
res.locals.user.id
res.locals.user.role
```

## 6. Roles و`requireRole`

لدينا roles من Prisma:

```text
ADMIN
MANAGER
USER
```

استخدامها:

```ts
router.post("/", authenticate, requireRole("ADMIN", "MANAGER"), handler);
```

الترتيب ضروري:

```text
authenticate  → يثبت من المستخدم ويضع role
requireRole   → يقرر هل role مسموحة
handler       → ينفذ business logic
```

فرق status codes:

```text
401 Unauthorized = لا يوجد token صالحة أو لا يوجد login.
403 Forbidden    = المستخدم معروف، لكن لا يملك permission.
```

## 7. Refresh Token ولماذا توجد

لو access token طويلة جدًا، token مسروقة تبقى مفيدة وقتًا طويلًا. لو قصيرة جدًا، المستخدم يسجل دخول باستمرار.

الحل:

```text
Access token  = قصيرة، تستخدم لكل API request.
Refresh token = أطول، تستخدم فقط لإصدار access token جديدة.
```

الـrefresh token هنا ليست JWT؛ هي random bytes قوية:

```ts
randomBytes(48).toString("hex")
```

قاعدة البيانات لا تخزن raw token. تخزن SHA-256 hash منها:

```text
Browser cookie → raw refresh token
Database       → tokenHash فقط
```

لذلك لو database تسربت، لا يستطيع المهاجم استخدام hashes مباشرة كـcookies.

### ما الذي في جدول `RefreshToken`؟

كل row تمثل **جلسة login واحدة** في متصفح/جهاز واحد، وليست user نفسها:

| Field | معناه |
| --- | --- |
| `id` | معرف داخلي للـsession. |
| `tokenHash` | hash للـraw token الموجود في cookie؛ عليه unique index حتى نجد الجلسة بسرعة. |
| `userId` | foreign key إلى `User`؛ يخبرنا بمن تملك هذه الجلسة. |
| `expiresAt` | بعد هذا الوقت لا نقبل الجلسة حتى لو cookie ما زالت موجودة. |
| `createdAt` | وقت إنشائها، مفيد للتتبع وإدارة الجلسات. |

العلاقة هي: `User 1 → many RefreshToken`. يمكن لنفس المستخدم تسجيل الدخول من هاتف ولابتوب؛ لكل واحد row مختلفة. وعند حذف user، حذف sessions التابعة لها منطقي لأنها لم تعد صالحة.

### لماذا token عشوائية بدل refresh JWT؟

JWT موقعة، لكنها لا تصبح قابلة للإبطال وحدها: لو أردت logout أو rotation أو إغلاق جهاز معين، ستحتاج state في database/Redis على أي حال. لذلك اخترنا opaque random token:

```text
random raw token في cookie
→ hash في database
→ database تحدد هل session موجودة وصالحة
```

هذا يجعل revoke وrotation مباشرَين: نحذف أو نبدل row. Refresh JWT ممكنة، لكنها لا تعطي هنا ميزة تبرر تعقيدها؛ لا نحتاج claims داخل refresh token.

## 8. Refresh Token Rotation

`POST /api/auth/refresh`:

```text
Browser sends HTTP-only refresh cookie
→ hash cookie value
→ find matching database row
→ reject missing/expired token
→ atomically consume old row and save new token hash
→ return new access token
→ set new refresh cookie
```

الـrotation تعني أن old refresh token تصبح غير صالحة بعد الاستخدام. إذا وصل requestان بنفس token في نفس الوقت، واحدة فقط تنجح؛ الثانية تجد أن token استُهلكت.

بصيغة database، الـrepository لا يعمل "find ثم delete ثم insert" على ثلاث requests عادية؛ يحاول atomic update/delete على الـhash القديمة ويضيف الجلسة الجديدة. النتيجة تمنع أن requestين يستهلكان نفس refresh token بنجاح.

## 9. Logout

`POST /api/auth/logout`:

```text
1. يقرأ refresh token من cookie إن وجدت.
2. يحذف token hash المطابقة من database.
3. يمسح refreshToken cookie.
4. يرجع 204 No Content.
```

Logout لا تستطيع سحب access token الموجودة بالفعل من كل client؛ لهذا access token قصيرة العمر.

## 10. HTTP-only Cookie وCORS

خيارات refresh cookie الحالية:

```text
httpOnly = JavaScript في browser لا تقرأها.
secure   = true في production؛ لا ترسل عبر HTTP العادي.
sameSite = lax محليًا، none في production cross-site.
path     = /api/auth فقط.
```

لو frontend على origin مختلف، نحتاج الاثنين:

```text
Backend CORS: credentials: true + origin محدد
Frontend fetch: credentials: "include"
```

لا تستخدم `origin: "*"` مع cookies وcredentials.

## 11. Rate Limiting

`createRateLimiter()` factory تعطي rate limiter مخصصًا لكل endpoint. مثال login يحد المحاولات لكل IP داخل window محددة.

```text
Login rate limit يحمي من password guessing.
General rate limit يحمي API من abuse العادي.
```

في المشروع توجد طبقتان:

```text
router العام تحت /api
→ 100 request لكل IP في 60 ثانية.

POST /api/auth/login
→ limit أشد: 5 محاولات في 15 دقيقة.
```

الـlogin limiter يأتي قبل validation وcontroller، لذلك لا نصل إلى bcrypt/database بعد تجاوز الحد. كل limiter يرجع JSON موحدًا مثل:

```json
{ "error": "Too many login attempts from this IP, please try again after 15 minutes" }
```

في production متعدد instances، store الذاكرة الافتراضي لا يكفي؛ نحتاج shared store مثل Redis حتى لا يملك كل API عدادًا منفصلًا.

## 12. Security Checklist قبل Production

- استخدم `JWT_SECRET` عشوائية طويلة من secrets manager، لا قيمة `.env` التعليمية.
- فعّل HTTPS قبل `secure: true` cookies.
- حدد `CLIENT_ORIGIN` بدقة، لا wildcard مع credentials.
- استخدم Redis-backed rate limit store مع عدة replicas.
- أضف password policy وemail verification وforgot-password flow عند الحاجة.
- راقب failed login attempts، ولا تسجل passwords أو tokens أو cookies في logs.
- اجعل secrets خارج Git وغيّرها عند الاشتباه بتسرب.
- راجع CORS وcookie domain وSameSite بعد معرفة domain الحقيقي للـfrontend.
