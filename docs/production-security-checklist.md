# Production Security Checklist

هذا المشروع تعليمي. قبل أي نشر حقيقي، راجع هذه القائمة مع threat model وdomain وcloud provider الفعليين.

## Secrets and Configuration

- [ ] `JWT_SECRET` عشوائية طويلة وفريدة لكل environment.
- [ ] كلمات مرور PostgreSQL وSMTP ليست قيم Docker التعليمية.
- [ ] لا توجد `.env` حقيقية أو `api-secret.yaml` حقيقية في Git.
- [ ] استخدم secrets manager في production عندما يتوفر.
- [ ] rotation للـsecrets عند التسرب أو تغير الفريق.

## Transport and Browser Security

- [ ] HTTPS فقط أمام Nginx/Gateway.
- [ ] `secure: true` للـcookies في production.
- [ ] `CLIENT_ORIGIN` محدد بالـfrontend domain الحقيقي.
- [ ] لا تستخدم CORS wildcard مع `credentials: true`.
- [ ] راجع `SameSite=None` مع `Secure` عندما frontend وAPI على origins مختلفة.
- [ ] لا تمرر tokens في URLs.

## Authentication and Authorization

- [ ] access token قصيرة العمر.
- [ ] refresh tokens hashed في database وrotated عند refresh.
- [ ] rate limiting على login وendpoints الحساسة.
- [ ] role checks على server، لا في frontend فقط.
- [ ] password policy وforgot-password/email verification عند الحاجة business-wise.
- [ ] audit logs للعمليات الإدارية المهمة.

## API and Input

- [ ] Zod validation للـbody/query/params.
- [ ] limit للـpagination وupload size.
- [ ] Idempotency-Key لعمليات create المالية أو المكلفة.
- [ ] error responses لا تسرب stack traces أو secrets.
- [ ] Swagger لا تعرض credentials أو internal endpoints بلا حماية.

## Database and Storage

- [ ] database ليست منشورة للإنترنت بلا سبب.
- [ ] backup واختبار restore، ليس backup فقط.
- [ ] migrations تعمل كـcontrolled job، لا من كل API replica عند startup.
- [ ] database user لها أقل permissions ممكنة.
- [ ] uploaded files لها type/size validation وstorage مناسب، ولا تعتمد على local container disk في production.

## Docker and Dependencies

- [ ] image tags محددة وليست `latest` في production.
- [ ] Docker images تعمل بمستخدم غير root عندما نجهز production image.
- [ ] لا تنشر API port مباشرة إذا Nginx/Gateway هي public entry.
- [ ] افحص `npm audit`، لكن لا تشغّل `npm audit fix --force` بدون مراجعة breaking changes.
- [ ] حدّث dependencies وbase images دوريًا.

## Operations

- [ ] health/readiness endpoints غير مكشوفة بشكل غير مناسب إن كانت تكشف تفاصيل.
- [ ] logs لا تحتوي passwords أو access/refresh tokens أو PII غير لازمة.
- [ ] Prometheus/Grafana/Alertmanager محمية وليست public بلا authentication.
- [ ] alerts تصل إلى قناة حقيقية، لا Mailpit فقط.
- [ ] graceful shutdown وrolling deployments مجربة.
- [ ] rate-limit storage shared عند وجود API replicas.

## Kubernetes لاحقًا

- [ ] Secrets عبر Kubernetes Secret أو external secret manager، مع RBAC محدود.
- [ ] `readinessProbe` و`livenessProbe` مضبوطة باختلاف واضح.
- [ ] resource requests/limits بعد قياس حقيقي.
- [ ] NetworkPolicies عندما يصبح هناك عدة services.
- [ ] image registry خاص أو موثوق، وimage tags immutable.

هذه ليست شهادة أن النظام آمن؛ هي checklist تساعدنا ألا ننسى الأساسيات عند الانتقال من local learning إلى production.
