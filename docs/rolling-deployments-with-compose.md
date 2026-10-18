# Rolling Deployment مع Docker Compose وNginx

هذا الدليل يشرح كيف نحدّث الـAPI بوجود نسختين (`api` و`api-2`) بدون إيقاف النظام كله في نفس الوقت.

## 1. الفكرة

لدينا نسختان من نفس التطبيق:

```text
Nginx
├── api    = version 1
└── api-2  = version 1
```

عند وجود code جديد، لا نعيد إنشاء النسختين معًا. نحدّث واحدة، ننتظرها تصبح جاهزة، ثم نحدّث الثانية:

```text
api    = version 2
api-2  = version 1
        ↓
api    = version 2
api-2  = version 2
```

في الوقت الذي تتوقف فيه `api`، يمرّر Nginx requests الجديدة إلى `api-2`. ثم نعكس العملية عند تحديث `api-2`.

## 2. لماذا لا نستخدم `docker compose up -d --build` فقط؟

في local learning setup قد يعمل، لكنه ليس أمر rolling deployment واضحًا. قد يعيد Compose إنشاء أكثر من service خلال نفس العملية. هنا نريد التحكم في نسخة واحدة كل مرة.

## 3. مشكلة IP بعد Container Recreate

Docker Compose يحافظ على اسم service مثل `api`، لكنه قد يعطي container IP جديدًا عند recreate:

```text
api old container → 172.20.0.5
api new container → 172.20.0.9
```

لذلك لا نضع IP ثابت في Nginx. نستخدم اسم الخدمة وDocker DNS.

في [nginx.conf](../nginx/nginx.conf) أضفنا:

```nginx
zone mini_erp_api 64k;
resolver 127.0.0.11 valid=10s ipv6=off;
resolver_timeout 5s;

server api:3000 resolve;
server api-2:3000 resolve;
```

`127.0.0.11` هو Docker internal DNS داخل container. `resolve` يجعل Nginx تحدّث IP للـservice name، و`zone` يحفظ upstream state المشترك المطلوب لهذا التحديث.

> هذا الإعداد يحتاج Nginx 1.27.3 أو أحدث. `nginx:alpine` يجب أن يكون حديثًا عند سحب الصورة. يمكن التأكد لاحقًا بـ`docker compose exec nginx nginx -v`.

## 4. قبل أول Deployment

شغّل النظام وتأكد أن النسختين healthy:

```powershell
docker compose up -d --build
docker compose ps
```

يجب أن ترى `api` و`api-2` بحالة `healthy` بعد انتهاء health checks.

## 5. Update النسخة الأولى

بعد تعديل code:

```powershell
docker compose build api
docker compose up -d --no-deps --force-recreate api
```

المعنى:

```text
build api                         = بناء image جديدة
up api                            = إعادة إنشاء api فقط
--no-deps                         = لا تعيد PostgreSQL أو Redis أو migrate
--force-recreate                  = استبدل container القديمة حتى لو Compose لا ترى config changed
```

أثناء خروج `api`، graceful shutdown يوقفها بهدوء. Nginx يمرّر traffic إلى `api-2`.

انتظر حتى تصبح `api` healthy:

```powershell
docker compose ps
```

## 6. Update النسخة الثانية

بعد أن تكون `api` healthy:

```powershell
docker compose build api-2
docker compose up -d --no-deps --force-recreate api-2
docker compose ps
```

أثناء إعادة إنشاء `api-2`، النسخة `api` الجديدة تخدم traffic.

## 7. ما الذي يحمي كل مرحلة؟

```text
Graceful shutdown
→ النسخة القديمة تنهي requests والعمل الجاري قبل الخروج.

Nginx failover
→ إذا فشل upstream يحاول النسخة الثانية.

Nginx DNS re-resolution
→ يرى IP الجديد بعد recreate بدل الاحتفاظ بعنوان container القديم.

Docker health check
→ يبيّن أن API وPostgreSQL جاهزتان.

Redis Socket.IO adapter + sticky sessions
→ يدعمان realtime events عند وجود أكثر من API instance.
```

## 8. حدود هذا الـCompose Lab

هذا تدريب جيد على الأفكار، لكنه ليس orchestrator كاملًا:

- Docker Compose لا يقرر تلقائيًا متى يبدأ rolling update.
- Docker health status وحده لا يجعل Nginx Open Source تعمل active health checks.
- لا يوجد auto-scaling أو auto-replacement policy متقدمة هنا.

Kubernetes أو ECS/containers platform لاحقًا تجعل هذه العملية declarative: تقول العدد المطلوب من replicas وسياسة update، والمنصة تنفذها وتراقبها.

## 9. الفكرة النهائية

```text
لا نحدّث النظام كله دفعة واحدة.

نحدّث instance واحدة
→ نتحقق أنها ready
→ نحدّث التالية
→ يبقى traffic لديه دائمًا instance أخرى.
```
