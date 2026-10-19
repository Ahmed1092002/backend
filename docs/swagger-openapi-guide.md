# Swagger and OpenAPI Guide

Swagger UI هي الواجهة الموجودة على:

```text
/api-docs
```

أما OpenAPI فهي specification تصف endpoints بطريقة machine-readable.

```text
OpenAPI document
        ↓
Swagger UI
        ↓
واجهة تعرض وتجرب API
```

## 1. أين نكتب التوثيق؟

في المشروع:

```text
src/docs/openapi.ts        = document الرئيسي
src/docs/auth.docs.ts      = Auth paths
src/docs/products.docs.ts  = Products paths
src/docs/orders.docs.ts    = Orders paths
src/docs/users.docs.ts     = Users paths
```

لا نريد ملف Swagger واحد ضخم لا يمكن قراءته. كل module تملك documentation الخاصة بها، ثم `openapi.ts` تجمعها.

## 2. ماذا يجب أن يوثق endpoint؟

لكل endpoint مهم نوضح:

```text
HTTP method + path
purpose
authentication/roles
path/query parameters
request body
success response
common error responses
```

مثال ذهني:

```text
POST /api/orders
requires Bearer token
requires Idempotency-Key header
body contains items
returns 201 or replayed order
returns 400/401/404/409 when appropriate
```

## 3. لماذا Swagger ليست بديلًا عن Validation؟

```text
Zod validation = enforcement وقت تشغيل السيرفر.
OpenAPI        = contract/documentation للـclients.
```

Swagger يمكن أن تقول إن quantity يجب أن تكون positive، لكن Zod هي التي تمنع request غير الصالحة فعليًا.

## 4. Authentication في Swagger

OpenAPI document تعرف Bearer security scheme. في Swagger UI نضغط Authorize ونضع access token، وبعدها Swagger ترسل Authorization header للـprotected endpoints.

Refresh cookie تختلف: browser يحتفظ بها عبر login/refresh flow، لكنها ليست قيمة نعرضها أو نطلب من user لصقها في Swagger.

## 5. متى نحدّث Swagger؟

أي تعديل في public API يستحق تعديلًا متزامنًا:

```text
new endpoint
changed request DTO
new query filter
new required header
changed response shape
new status code
```

قاعدة جيدة: لا تعتبر endpoint مكتملة حتى validation وcontroller وOpenAPI متفقين.

## 6. حدود Swagger

Swagger لا تشرح كل business rule العميقة، مثل transaction وOutbox. هذه مكانها docs architecture. Swagger تشرح كيف يستهلك client الـAPI.
