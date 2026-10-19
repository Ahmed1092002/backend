# API Architecture Guide

المشروع Modular Monolith: application واحدة، لكن code مقسمة إلى modules مسؤولة بوضوح.

```text
src/modules/
├── auth
├── users
├── products
├── orders
└── outbox
```

## 1. طبقات الـModule

المسار النموذجي للـHTTP request:

```text
Router
→ Middleware
→ Controller
→ Service
→ Repository / Prisma
→ PostgreSQL
```

### Router

تحدد HTTP method وpath وترتيب middleware:

```ts
router.post("/", authenticate, validate(schema), asyncHandler(controller));
```

لا تضع business logic كبيرة في router.

### Middleware

تعمل قبل controller لأمور مشتركة:

```text
authenticate        = JWT verification
requireRole         = authorization
validate            = Zod input validation
asyncHandler        = forwards rejected promises to error handler
rate limiter        = abuse protection
idempotency key     = requires header before order create
```

Validation منفصلة للـbody/query/params لأن كل واحدة مصدر مختلف وشكل مختلف. يمكن endpoint استخدام أكثر من validation middleware:

```text
validate params
→ validate query
→ validate body
→ controller
```

هذا ليس duplication في business logic: كل schema تصف contract مختلفًا. مثال `POST /products/:id?dryRun=true` له ثلاثة inputs مستقلة:

```text
params: { id }
query:  { dryRun }
body:   { name, price, stock }
```

لو وضعنا schema واحدة بلا تحديد المصدر، لن نعرف هل `id` تُقرأ من URL أم body، وقد يقبل API input في مكان غير مقصود.

### Controller

Controller تتعامل مع HTTP فقط:

```text
req/res
status code
response JSON
calling service
```

لا تضع transaction أو Prisma queries المعقدة في controller.

### Service

Service تحتوي business rules:

```text
Can this order be confirmed?
Is stock enough?
What side effects must be recorded?
```

### Repository

Repository تحتوي database queries وتخفي Prisma details عن controller. ليست قاعدة جامدة؛ service قد تستخدم Prisma transaction مباشرة عندما العملية تحتاج عدة repositories في transaction واحدة، مثل confirm order.

## 2. DTO وMapper

Database model لا يجب أن تخرج تلقائيًا للـAPI. مثلًا User فيها `passwordHash` وRefreshToken relations لا يجب أن تظهر.

```text
Prisma model → Mapper → Response DTO → JSON
```

DTO تحدد contract الذي يراه frontend. Mapper تحول types مثل Prisma Decimal إلى number وتختار الحقول الآمنة.

## 3. Error Handling

`AppError` تمثل خطأ متوقعًا من business logic:

```text
404 Product not found
409 Insufficient stock
403 Insufficient permissions
```

`asyncHandler` تمنع تكرار `try/catch` في controllers async. أي error تصل إلى global `errorHandler` الذي يقرر response موحدًا ويسجل structured log.

المسار كاملًا:

```text
async controller throws/rejects
→ asyncHandler يمرر error إلى next(error)
→ Express يصل إلى errorHandler الأخير
→ errorHandler يختار status + JSON آمن + log
```

لذلك لا نكتب `try/catch` في كل controller فقط لإرسال error إلى middleware نفسها. نكتب catch محليًا فقط إذا كان لدينا recovery أو تحويل error محدد له معنى business.

## 4. Dependency Injection في Orders

`createOrdersService()` لا تستورد Prisma وenv وoutbox writer من داخل business logic. تستقبلهم كdependencies:

```text
prisma
lowStockThreshold
saveOrderConfirmedEvent
```

`orders.module.ts` هو composition root للموديول: يجمع real dependencies وينشئ `ordersService`.

الفائدة:

```text
Business logic أسهل للاختبار.
Dependencies واضحة.
يمكن لاحقًا تمرير fake database/event writer في test.
```

هذا ليس framework DI container؛ هو dependency injection بسيط وواضح بـTypeScript functions.

## 5. Modular Monolith مقابل Microservices

حاليًا:

```text
one codebase + one API deployment + one database
```

وهذا مناسب. modules ليست microservices لمجرد أنها folders.

Microservice حقيقية تحتاج ownership مستقل، deploy مستقل، وقناة تواصل واضحة، ولا تقرأ tables لخدمة أخرى مباشرة. راجع [microservices-deployment-architecture.md](microservices-deployment-architecture.md).

## 6. قواعد عملية

- Router وcontroller رفيعة؛ business rules في service.
- لا ترجع Prisma model كاملة بلا DTO.
- لا تجعل frontend يقرر authorization.
- transaction تبدأ في layer تملك العملية business كاملة.
- لا تستورد global infrastructure داخل pure business logic إذا كان dependency injection مناسبًا.
- لا تفصل microservices قبل أن يوجد سبب تشغيلي حقيقي.
