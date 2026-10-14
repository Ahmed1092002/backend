# Mini ERP Backend

مشروع تعليمي عملي لبناء Backend بـ **Node.js + TypeScript**. المشروع عبارة عن Mini ERP بسيط: منتجات، مخزون، مستخدمون، طلبات، Auth، jobs، realtime، وطبقات تشغيل قريبة من الـproduction.

الفكرة ليست أن يكون ERP كاملاً؛ الفكرة أن ترى مفاهيم الـbackend وهي تعمل معاً داخل مشروع واحد.

## ماذا يحتوي المشروع؟

- Express 5 وTypeScript، بتقسيم Modules: `auth` و`products` و`orders` و`users`.
- PostgreSQL + Prisma للبيانات والمigrations.
- JWT access token وrefresh token محفوظ كـHTTP-only cookie، مع roles: `ADMIN` و`MANAGER` و`USER`.
- Products ومخزون وحركة مخزون `InventoryMovement`.
- Orders: إنشاء الطلب، تأكيده، وخصم المخزون بأمان داخل transaction واحدة.
- Idempotency key لمنع إنشاء نفس الطلب مرتين عند إعادة إرسال نفس HTTP request.
- Redis للكاش وBullMQ للـbackground jobs.
- Socket.IO لإشعارات المنتج/الطلب في الوقت الحقيقي.
- رفع صور المنتجات وInvoice PDF للطلب المؤكد.
- Swagger، validation بـZod، rate limiting، CORS، وerror handling موحّد.
- Structured JSON logs، health checks، Prometheus metrics، Grafana، وAlertmanager.
- Docker Compose لتشغيل كل الـstack محلياً.

## تشغيل المشروع بالكامل بـDocker

المطلوب: Docker Desktop يعمل.

```powershell
docker compose up -d --build
```

هذا الأمر يبني الـAPI والـworker، ثم يشغّل PostgreSQL وRedis وMailpit وPrometheus وGrafana وAlertmanager. خدمة `migrate` تطبّق migrations، ثم `seed` تضيف بيانات تعليمية، وبعدهما يبدأ الـAPI.

تابع الحالة والـlogs:

```powershell
docker compose ps
docker compose logs -f api
docker compose logs -f worker
```

لإيقاف الخدمات مع الاحتفاظ بالبيانات:

```powershell
docker compose down
```

`docker compose down -v` يحذف الـvolumes، وبالتالي يحذف PostgreSQL وRedis وGrafana data المحلية. استخدمه فقط عندما تريد بداية نظيفة فعلاً.

## الروابط بعد التشغيل

| الخدمة | الرابط |
| --- | --- |
| API | http://localhost:3000 |
| Swagger | http://localhost:3000/api-docs |
| Health | http://localhost:3000/health |
| Readiness (يفحص DB وRedis) | http://localhost:3000/health/ready |
| Prometheus metrics | http://localhost:3000/metrics |
| Mailpit (صندوق البريد المحلي) | http://localhost:8025 |
| Prometheus | http://localhost:9090 |
| Alertmanager | http://localhost:9093 |
| Grafana | http://localhost:3001 |

Grafana في التشغيل المحلي يبدأ عادةً بـ`admin` / `admin` ثم يطلب تغيير كلمة المرور.

PostgreSQL متاح من جهازك على `localhost:5433`، لكن من داخل Docker الخدمات تتصل بالاسم `postgres:5432`. هذا فرق مهم: داخل Compose نستخدم اسم الخدمة، ومن جهازك نستخدم الـport المنشور.

## تشغيل الـAPI خارج Docker (اختياري)

لو تريد تشغيل TypeScript بنفسك، ابدأ بالخدمات المساعدة أولاً أو شغّلها بـCompose. ثم:

```powershell
npm ci
Copy-Item .env.example .env
npx prisma generate
npx prisma migrate deploy
npm run db:seed
npm run dev:server
```

عدّل `.env` قبل التشغيل. لا تضع أسرار production في Git. عند تشغيل الـAPI خارج Docker، `DATABASE_URL` يجب أن يشير إلى `localhost:5433`؛ أما في Compose فهو يشير إلى `postgres:5432`.

## أوامر مفيدة

```powershell
npm run typecheck
npm test
npx prisma studio
npx prisma migrate dev --name describe_your_change
docker compose up -d --build
docker compose logs -f api
```

`prisma migrate dev` للتطوير المحلي عندما تغيّر `prisma/schema.prisma`. في Docker/CI نستخدم `prisma migrate deploy` لتطبيق migrations الموجودة فقط.

## خريطة سريعة للكود

```text
src/
  modules/          # business modules: auth, products, orders, users
  middleware/       # auth, validation, errors, request logging, rate limit
  jobs/             # BullMQ queues/workers + outbox processor
  observability/    # structured logger + Prometheus metrics
  realtime/         # Socket.IO setup and event emitters
prisma/             # schema + SQL migrations
prometheus/         # scrape config + alert rules
grafana/            # datasource/dashboard provisioning
alertmanager/       # routing local alerts to Mailpit
docs/               # learning notes
```

## مفاهيم مهمّة في المشروع

- تأكيد order لا يخصم stock فقط؛ يكتب حركة المخزون والـorder والـoutbox event في نفس transaction.
- الـOutbox Processor ينشر الحدث لاحقاً إلى listeners: يمسح cache، يرسل Socket.IO، ويضع low-stock email job في queue.
- هذا يجعل الحدث durable: لو الـAPI وقع بعد حفظ الطلب، لا يضيع الحدث.
- delivery هنا **at least once**، لذلك يجب أن تكون الـconsumers idempotent.

اقرأ التفاصيل في:

- [Observability and monitoring](docs/observability-monitoring.md)
- [Outbox pattern](docs/outbox-pattern.md)
- [Docker Compose guide](docs/docker-compose-guide.md)
- [GitHub Actions guide](docs/github-actions-guide.md)
- [Docker learning path](docs/docker-learning-path.md)
- [Learning roadmap](docs/learning-roadmap.md)

## ملاحظات أمنية قبل production

هذا مشروع تعليمي، وليس deployment production جاهزاً. قبل النشر الحقيقي: استخدم secrets manager، HTTPS، كلمات مرور قوية، SMTP حقيقي، storage مناسب للملفات، backup للـdatabase، وراقب alerts وlogs بشكل فعلي.
