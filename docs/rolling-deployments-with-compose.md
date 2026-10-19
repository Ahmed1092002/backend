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

## 2. اقرأ الكود الموجود في المشروع أولًا

الـrolling deployment لا تبدأ من command. تبدأ من أن `docker-compose.yml` فيه نسختان من نفس API:

```yaml
api:
  build:
    context: .
  environment:
    INSTANCE_NAME: api-1
  healthcheck:
    test: ["CMD", "node", "-e", "fetch('http://127.0.0.1:3000/health/ready')..."]

api-2:
  build:
    context: .
  environment:
    INSTANCE_NAME: api-2
  healthcheck:
    test: ["CMD", "node", "-e", "fetch('http://127.0.0.1:3000/health/ready')..."]
```

اشرحه سطرًا بسطر:

- `api` و`api-2` اسما خدمتين مختلفتين في Docker network؛ هما ليسا مشروعين مختلفين.
- `build.context: .` في الاثنين يعني: ابنِ نفس `Dockerfile` من نفس folder. لذلك code والـimage منطقيًا نفسهما.
- الاختلاف الوحيد المفيد هنا هو `INSTANCE_NAME`. الـAPI تعرضه في health/logs حتى تعرف أي نسخة ردت عليك.
- `healthcheck` لا تسأل "هل Node process موجودة؟" فقط. هي تطلب `/health/ready` من داخل container. لو endpoint رجعت non-2xx، Docker تعتبر instance غير healthy.
- `api-2` لا تملك host port `3000:3000`؛ لا نحتاجها مباشرة من Windows. Nginx تصل لها باسم `api-2:3000` داخل شبكة Compose.

والـNginx لا تعرف containers بالـIP، بل تعرّف upstream بالأسماء:

```nginx
upstream mini_erp_api {
  ip_hash;
  server api:3000 resolve max_fails=1 fail_timeout=10s;
  server api-2:3000 resolve max_fails=1 fail_timeout=10s;
}
```

- `upstream mini_erp_api` = قائمة backends التي سترسل لها Nginx requests.
- `server api:3000` و`server api-2:3000` = عنوانا النسختين داخل Docker network.
- `resolve` = لا تحفظ IP قديم بعد container recreate؛ اسأل Docker DNS مرة أخرى.
- `max_fails=1 fail_timeout=10s` = لو فشل اتصال واحد، تجنب تلك النسخة 10 ثوانٍ.
- `ip_hash` = نفس IP العميل تميل للذهاب لنفس النسخة، مهم للـSocket.IO polling. ليس هو load balancing ذكي ولا health check.

## 3. لماذا لا نستخدم `docker compose up -d --build` فقط؟

في local learning setup قد يعمل، لكنه ليس أمر rolling deployment واضحًا. قد يعيد Compose إنشاء أكثر من service خلال نفس العملية. هنا نريد التحكم في نسخة واحدة كل مرة.

## 4. مشكلة IP بعد Container Recreate

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

## 5. قبل أول Deployment

شغّل النظام وتأكد أن النسختين healthy:

```powershell
docker compose up -d --build
docker compose ps
```

يجب أن ترى `api` و`api-2` بحالة `healthy` بعد انتهاء health checks.

## 6. Update النسخة الأولى

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

## 7. Update النسخة الثانية

بعد أن تكون `api` healthy:

```powershell
docker compose build api-2
docker compose up -d --no-deps --force-recreate api-2
docker compose ps
```

أثناء إعادة إنشاء `api-2`، النسخة `api` الجديدة تخدم traffic.

## 8. ما الذي يحمي كل مرحلة؟

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

## 9. حدود هذا الـCompose Lab

هذا تدريب جيد على الأفكار، لكنه ليس orchestrator كاملًا:

- Docker Compose لا يقرر تلقائيًا متى يبدأ rolling update.
- Docker health status وحده لا يجعل Nginx Open Source تعمل active health checks.
- لا يوجد auto-scaling أو auto-replacement policy متقدمة هنا.

Kubernetes أو ECS/containers platform لاحقًا تجعل هذه العملية declarative: تقول العدد المطلوب من replicas وسياسة update، والمنصة تنفذها وتراقبها.

## 10. الفكرة النهائية

```text
لا نحدّث النظام كله دفعة واحدة.

نحدّث instance واحدة
→ نتحقق أنها ready
→ نحدّث التالية
→ يبقى traffic لديه دائمًا instance أخرى.
```

## 11. طبّقها يدويًا خطوة بخطوة

نفّذ هذه الأوامر من مجلد المشروع على نفس server الذي يشغّل Docker Compose:

```powershell
# 1) تأكد أن النسختين القديمتين تعملان
docker compose ps

# 2) ابنِ image من code الجديد مرة واحدة
docker compose build api

# 3) بدّل instance الأولى فقط
docker compose up -d --no-deps --force-recreate api

# 4) انتظر ثم افحص readiness من داخل الشبكة
docker compose ps
docker compose exec api node -e "fetch('http://localhost:3000/health/ready').then(r => r.text()).then(console.log)"

# 5) بعد نجاح api، بدّل الثانية بنفس الـimage
docker compose up -d --no-deps --force-recreate api-2
docker compose ps
```

لا نحتاج `docker compose build api-2` في الخطوة الأخيرة إذا كان `api` و`api-2` يستخدمان نفس `build` ونفس source code؛ الاسم المختلف للـservice لا يعني image مختلفة بالضرورة. المهم أن تكون image الجديدة بُنيت قبل إعادة إنشاء كل instance.

**علامة النجاح:** `docker compose ps` تعرض `api` و`api-2` بحالة `healthy`، وrequest إلى Nginx على `http://localhost:8080/health` ينجح أثناء تحديث واحدة منهما.

## 12. كيف يدخل ذلك في CI/CD؟

GitHub Actions ليست هي الـorchestrator. هي تشغّل commands على server النشر. الترتيب داخل job واحدة مهم لأن كل خطوة تعتمد على نجاح الخطوة السابقة:

**مهم:** ملف `.github/workflows/ci.yml` الحالي لا يعمل deploy؛ فيه job اسمها `check` وjob اسمها `docker` فقط. الـYAML التالية مثال للـjob التي نضيفها لاحقًا، بعد وجود server حقيقي وself-hosted runner أو SSH deployment.

```yaml
deploy:
  runs-on: self-hosted # runner موجود على server الذي عليه Docker
  needs: [check, docker]
  steps:
    - uses: actions/checkout@v4

    - name: Build the new API image
      run: docker compose build api

    - name: Replace API instance one
      run: docker compose up -d --no-deps --force-recreate api

    - name: Wait until instance one is ready
      run: |
        # هنا نضيف script يعيد المحاولة حتى readiness تنجح أو timeout
        docker compose ps

    - name: Replace API instance two
      run: docker compose up -d --no-deps --force-recreate api-2
```

`needs: [check, docker]` تعني لا يبدأ deploy إلا بعد نجاح typecheck/tests وDocker build. أما `steps` داخل `deploy` فتعمل بالترتيب. لا ننشئ job مستقلة لـ`api` وjob مستقلة لـ`api-2` إلا إذا كان لدينا طريقة آمنة لمشاركة نفس server state والانتظار بينهما؛ هنا job واحدة أوضح وأقل خطورة.

في Kubernetes لن نكتب هذه الخطوات لكل replica. نحدّث image في `Deployment`، وKubernetes controller ينفذ التسلسل تلقائيًا حسب `maxUnavailable` و`maxSurge`.

اقرأ YAML المقترحة هكذا:

- `runs-on: self-hosted`: لأن Docker Compose التي نريد تحديثها موجودة على server النشر، لا على GitHub VM المؤقتة.
- `needs: [check, docker]`: gate؛ deploy لا تبدأ إذا فشل typecheck/test أو image build.
- `steps`: داخل job واحدة تعمل بالتسلسل، لذلك step الثانية لا تبدأ قبل نجاح الأولى.
- `docker compose build api`: تصنع image الجديدة من Git revision الذي عمل checkout.
- `up ... api`: تستبدل service واحدة فقط.
- Step الانتظار ليست شكلية؛ يجب أن تعيد طلب readiness حتى تنجح أو تنتهي timeout. لو فشلت، تتوقف job ولا نلمس `api-2`.

## 13. أخطاء شائعة

- تشغيل `docker compose up -d --build` لكل services في deploy: قد يعيد إنشاء أكثر من شيء، فلا يكون rollout متحكمًا فيه.
- تحديث `api-2` قبل أن `api` تصبح ready: قد ينتهي بك الأمر بلا instance سليمة.
- اعتبار `container running` = التطبيق جاهز: نحتاج `/health/ready`، لا مجرد أن Node process بدأت.
- تشغيل هذا من GitHub-hosted runner: هذا runner ليس server الإنتاج ولا يرى Docker Compose الموجودة هناك. نحتاج self-hosted runner أو SSH deployment مضبوطًا.
