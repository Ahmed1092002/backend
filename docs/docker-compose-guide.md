# Docker Compose في Mini ERP

هذا الدليل يشرح كيف شغّلنا كل أجزاء المشروع محلياً من ملف واحد: `docker-compose.yml`.

## الفكرة

بدون Compose ستشغّل PostgreSQL وRedis والـAPI والـworker وmonitoring واحدة واحدة، وتضبط ports وenvironment variables والشبكات يدوياً. Compose يجمعهم في تعريف واحد قابل للتشغيل عند أي شخص.

```text
docker-compose.yml
  ├─ postgres       البيانات الأساسية
  ├─ redis          cache وBullMQ queues
  ├─ migrate        Prisma migrations مرة واحدة
  ├─ seed           بيانات تعليمية مرة واحدة
  ├─ api            Express وSocket.IO
  ├─ worker         email jobs
  ├─ mailpit        inbox محلي للبريد
  ├─ prometheus     جمع metrics
  ├─ alertmanager   إرسال alerts إلى Mailpit
  └─ grafana        dashboards
```

Compose ينشئ default network تلقائياً. لذلك container الـAPI يصل للـdatabase باسم `postgres` ولـRedis باسم `redis`. لا نكتب `localhost` بين containers.

## 1. الصورة المشتركة: Dockerfile

الملف في root اسمه `dockerfile`، وهو صورة مشتركة تستخدمها services: `api` و`worker` و`migrate` و`seed`.

```dockerfile
from node:22-alpine

workdir /app
copy package.json package-lock.json ./
run npm ci
copy . .
RUN npx prisma generate
expose 3000
CMD ["npm", "run", "dev:server"]
```

| السطر | لماذا كتبناه؟ |
| --- | --- |
| `from node:22-alpine` | Node 22 في image صغيرة. |
| `workdir /app` | يحدد folder العمل داخل الـcontainer. |
| نسخ package files ثم `npm ci` | يثبت lockfile بدقة ويسمح لـDocker أن يعمل cache لهذه layer. |
| `copy . .` | ينسخ source بعد تثبيت dependencies. |
| `prisma generate` | Prisma Client generated code ويجب أن يوجد داخل الصورة. |
| `expose 3000` | توثيق port للـAPI؛ لا ينشره على Windows وحده. |
| `CMD` | default command، ويمكن لكل service استبداله بـ`command`. |

`.dockerignore` يستثني `node_modules` و`.git` و`.env` و`dist`. هذا يصغّر الصورة ويحمي من إدخال `.env` في image.

## 2. PostgreSQL وdata volume

```yaml
postgres:
  image: postgres:16-alpine
  ports:
    - "5433:5432"
  volumes:
    - postgres_data:/var/lib/postgresql/data
```

- `5432` هو port PostgreSQL داخل container.
- `5433` هو port على Windows، لذلك نتصل من جهازنا بـ`localhost:5433`.
- `postgres_data` named volume: data تبقى بعد إعادة إنشاء container.
- من services الأخرى نستخدم `postgres:5432`، لأن `postgres` اسم service.

أضفنا healthcheck:

```yaml
healthcheck:
  test: ["CMD-SHELL", "pg_isready -U $$POSTGRES_USER -d $$POSTGRES_DB"]
  interval: 5s
  timeout: 5s
  retries: 10
```

container بدأ لا يعني أن database جاهزة. `pg_isready` يثبت أنها تقبل connections. و`$$` يجعل Compose يرسل `$POSTGRES_USER` للـshell داخل container، بدلاً من قراءته من Windows.

## 3. Redis وpersistence

```yaml
redis:
  image: redis:7-alpine
  command: ["redis-server", "--appendonly", "yes"]
  volumes:
    - redis_data:/data
```

Redis عندنا للـcache وBullMQ. `--appendonly yes` يجعل Redis يكتب operations إلى disk في `/data`، و`redis_data` يبقيها بين restarts. هذا مفيد للـqueues، لكنه لا يستبدل PostgreSQL كمصدر البيانات الأساسي.

## 4. لماذا migrate وseed services منفصلان؟

```yaml
migrate:
  build: .
  command: npx prisma migrate deploy
  depends_on:
    postgres:
      condition: service_healthy
  restart: "no"

seed:
  build: .
  command: npm run db:seed
  depends_on:
    migrate:
      condition: service_completed_successfully
  restart: "no"
```

- `build: .` يبني من Dockerfile في root.
- `command` يبدل `CMD` الافتراضي لهذه service فقط.
- migration تنتظر PostgreSQL `healthy`.
- seed تنتظر migration تنتهي بنجاح، فلا تضيف data إلى schema قديم.
- `restart: "no"` لأنهما jobs مرة واحدة، وليسا servers دائمة.

## 5. API وworker

الـAPI يترك `CMD` الافتراضي ويعرّض port 3000. من variables المهمة:

```yaml
DATABASE_URL: postgresql://erp_user:erp_password@postgres:5432/mini_erp?schema=public
REDIS_URL: redis://redis:6379
MAIL_HOST: mailpit
MAIL_PORT: 1025
```

هذه أسماء services داخل الشبكة، وليست `localhost`.

الـworker يستخدم نفس image، لكنه يبدل command:

```yaml
worker:
  build: .
  command: npx tsx src/workers/email.worker.ts
```

هكذا API يستقبل HTTP وworker يستهلك email jobs من Redis في process منفصل. وvolume `upload_images:/app/uploads` يحفظ صور المنتجات عند إعادة إنشاء API container.

## 6. Monitoring services

Prometheus يقرأ `api:3000/metrics`، Grafana يقرأ Prometheus، وAlertmanager يرسل alerts إلى Mailpit. لكل service config files من المشروع وdata volume منفصل:

```text
Git config files                 Docker runtime data
prometheus.yml                   prometheus_data
Grafana dashboard JSON           grafana_data
alertmanager.yml                 alertmanager_data
```

راجع [دليل الـmetrics](observability-monitoring.md) للتفاصيل.

## 7. الأوامر العملية

### بناء وتشغيل كل شيء

```powershell
docker compose up -d --build
```

`up` ينشئ ويشغّل services، و`-d` يشغّلها بالخلفية، و`--build` يبني image جديدة من source الحالي.

### حالة الخدمات والـlogs

```powershell
docker compose ps
docker compose logs -f api
docker compose logs -f worker
docker compose logs -f prometheus
```

### فحص YAML من دون تشغيل containers

```powershell
docker compose config --quiet
```

### التحكم في service

```powershell
docker compose stop api
docker compose start api
docker compose restart prometheus
```

### إيقاف المشروع

```powershell
docker compose down
```

لا تستخدم `docker compose down -v` إلا إذا كنت تريد مسح PostgreSQL وRedis وGrafana data المحلية عن قصد.

## 8. ترتيب البداية

```text
postgres healthy
     -> migrate finishes
     -> seed finishes
     -> api starts
     -> Prometheus scrapes API
     -> Grafana reads Prometheus
```

`depends_on` يرتب startup فقط. لا يصلح failure لاحقاً وحده؛ لذلك نحتاج health checks وreadiness وlogs.

## 9. مشاكل متكررة

| المشكلة | السبب | الحل |
| --- | --- | --- |
| `port is already allocated` | service أخرى تستخدم port مثل 3000 | أوقفها أو غيّر host port. |
| API لا يصل للـDB | `localhost` داخل Compose | استخدم `postgres:5432`. |
| data اختفت | `down -v` | لا تستخدمه إلا لبداية نظيفة. |
| code تغير لكن container قديم | لم تستخدم `--build` | شغّل `docker compose up -d --build`. |
| seed لم تبدأ | migration فشلت | راجع `docker compose logs migrate`. |

## 10. الخلاصة

Docker Compose ليس production deployment بنفسه. هو طريقة repeatable لتشغيل services متعددة مع network وvolumes وconfig. هذه المفاهيم ستقابلها لاحقاً في Kubernetes أو cloud، حتى لو الأدوات اختلفت.
