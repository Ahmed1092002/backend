# ‏Nginx: Web Server, Reverse Proxy, وLoad Balancer

‏هذا الدليل يشرح Nginx في مشروع Mini ERP من البداية، ثم يشرح ملف الإعداد الحالي سطراً بسطر.

## ‏1. ما هو Nginx؟

‏Nginx برنامج يستقبل HTTP requests. يستطيع أن يعمل بأكثر من دور:

| الدور | ماذا يفعل؟ |
| --- | --- |
| Web Server | يرسل ملفات جاهزة مثل HTML وCSS وJavaScript والصور مباشرة للمتصفح. |
| Reverse Proxy | يستقبل request ثم يمررها إلى application أخرى مثل Node.js API. |
| Load Balancer | يوزع requests على أكثر من API instance. |

## ‏2. Nginx كـWeb Server

‏عندما تبني frontend:

```text
React / Angular / Vue
        |
        v
npm run build
        |
        v
index.html + JavaScript + CSS + images
```

‏Nginx يستطيع إرسال هذه الملفات مباشرة:

```text
Browser -> Nginx -> index.html / JS / CSS / images
```

‏هنا Nginx لا يحتاج Node.js ولا database؛ الملف موجود وجاهز، فيرسله للـbrowser.

‏هذا سريع لأنه لا ينفذ business logic مثل login أو orders أو database queries.

## ‏3. Nginx كـReverse Proxy

‏في مشروعنا، Nginx لا ينفذ API code. هو بوابة أمام Node.js:

```text
Client
  |
  | http://localhost:8080/api/products
  v
Nginx
  |
  | داخلياً: http://api:3000/api/products
  v
Node.js / Express API
  |
  v
PostgreSQL / Redis / business logic
```

‏Nginx لا يعرف معنى product أو order أو JWT. Node.js هي التي تتحقق من request، تنفذ business logic، وتقرأ database.

## ‏4. لماذا نضع Nginx أمام الـAPI؟

‏لأنها نقطة واحدة عامة تستطيع أن تعمل أشياء لا يجب أن نكررها داخل كل Node.js application:

- ‏تقديم frontend static files بسرعة.
- ‏HTTPS/SSL لاحقاً.
- ‏تمرير requests إلى API.
- ‏حد لحجم upload قبل وصوله لـNode.js.
- ‏تمرير WebSocket/Socket.IO connections.
- ‏rate limiting أو IP rules لاحقاً.
- ‏load balancing عند وجود أكثر من API instance.

## ‏5. الملف الحالي في المشروع

‏الملف هو [nginx.conf](../nginx/nginx.conf).

```nginx
events {}

http {
  map $http_upgrade $connection_upgrade {
    default upgrade;
    "" close;
  }

  upstream mini_erp_api {
    server api:3000;
    server api-2:3000;
  }

  server {
    listen 80;
    client_max_body_size 5m;

    location / {
      proxy_pass http://mini_erp_api;
      proxy_http_version 1.1;
      proxy_set_header Host $host;
      proxy_set_header X-Real-IP $remote_addr;
      proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
      proxy_set_header X-Forwarded-Proto $scheme;
      proxy_set_header Upgrade $http_upgrade;
      proxy_set_header Connection $connection_upgrade;
    }
  }
}
```

## 6. `events {}`

```nginx
events {}
```

‏هذا قسم إعداد connections الكثيرة في Nginx. كتبناه فارغاً لأننا نريد استخدام القيم الافتراضية في local learning setup.

## 7. `http {}`

```nginx
http {
  # HTTP configuration is written here.
}
```

‏داخل هذا القسم نكتب settings الخاصة بـHTTP requests: routes، headers، proxy، وservers.

## ‏8. Socket.IO وWebSocket

```nginx
map $http_upgrade $connection_upgrade {
  default upgrade;
  "" close;
}
```

‏Socket.IO يبدأ أحياناً كـHTTP ثم يطلب تحويل الاتصال إلى WebSocket. هذا الجزء يقول:

```text
لو request طلبت upgrade -> اسمح بالـWebSocket upgrade
لو request عادية       -> استعمل close الطبيعي
```

‏وفي ⁦`location`⁩ نمرر headers المطلوبة:

```nginx
proxy_set_header Upgrade $http_upgrade;
proxy_set_header Connection $connection_upgrade;
```

‏بدونهم قد تعمل REST API لكن Socket.IO/WebSocket تفشل خلف Nginx.

## ‏9. ⁦`upstream`⁩: إلى أين نرسل requests؟

```nginx
upstream mini_erp_api {
  server api:3000;
}
```

‏⁦`upstream`⁩ اسم لمجموعة API servers.

‏حالياً فيها API instances متطابقة:

```text
mini_erp_api -> api:3000 و api-2:3000
```

‏⁦`api`⁩ هو اسم service في ⁦`docker-compose.yml`⁩. Docker Compose يوفر DNS داخلياً، لذلك Nginx تستطيع الوصول إلى service بهذا الاسم.

## ‏10. ⁦`server`⁩ و⁦`listen`⁩

```nginx
server {
  listen 80;
}
```

‏Nginx داخل container تستقبل على port ⁦`80`⁩.

‏وفي ⁦`docker-compose.yml`⁩ كتبنا:

```yaml
nginx:
  ports:
    - "8080:80"
```

‏لذلك flow هو:

```text
Windows localhost:8080 -> Nginx container:80
```

## ‏11. حد رفع الملفات

```nginx
client_max_body_size 5m;
```

‏أكبر HTTP request body مسموح هو 5 MB. لو حاول user رفع صورة 20 MB، Nginx ترفض request قبل أن تصل لـNode.js. وضعنا نفس الحد تقريباً الذي يدعمه upload في API.

## ‏12. ⁦`location /`⁩ و⁦`proxy_pass`⁩

```nginx
location / {
  proxy_pass http://mini_erp_api;
}
```

‏⁦`location /`⁩ تعني: أي path يبدأ بـ⁦`/`⁩.

‏⁦`proxy_pass`⁩ تعني: مرّر request إلى upstream اسمها ⁦`mini_erp_api`⁩.

‏مثال:

```text
GET http://localhost:8080/api/products
              |
              v
Nginx -> http://api:3000/api/products
```

‏Nginx ترجع نفس response التي حصلت عليها من Express إلى المستخدم.

## 13. Proxy headers

```nginx
proxy_set_header Host $host;
proxy_set_header X-Real-IP $remote_addr;
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
proxy_set_header X-Forwarded-Proto $scheme;
```

‏بعد وجود Nginx، Node.js ترى أن Nginx هي المتصل المباشر. هذه headers تنقل معلومات المستخدم الأصلي:

| Header | المعنى |
| --- | --- |
| `Host` | domain الذي طلبه المستخدم. |
| `X-Real-IP` | IP المستخدم الأصلي. |
| `X-Forwarded-For` | سلسلة IPs التي مرّ بها request. |
| `X-Forwarded-Proto` | هل request الأصلية كانت HTTP أم HTTPS. |

‏هذه مهمة للـlogs، rate limits، وإجبار HTTPS لاحقاً.

## ‏14. متى يصبح Nginx Load Balancer؟

‏عندما توجد أكثر من API instance، Nginx يعمل load balancing أيضاً:

```text
Client -> Nginx -> API 1 أو API 2
```

‏لو أصبح عندنا APIs كثيرة:

```nginx
upstream mini_erp_api {
  server api_1:3000;
  server api_2:3000;
  server api_3:3000;
}
```

‏تصبح Nginx reverse proxy وload balancer معاً:

```text
Request 1 -> API 1
Request 2 -> API 2
Request 3 -> API 3
Request 4 -> API 1
```

‏Nginx يستخدم round-robin افتراضياً عندما يوجد أكثر من server في upstream.

## ‏15. Sticky Sessions ولماذا أضفنا ⁦`ip_hash`⁩

‏Socket.IO قد يبدأ الاتصال باستخدام HTTP polling قبل أن يتحول إلى WebSocket. إذا وصل request أول إلى ⁦`api-1`⁩ ثم وصل request polling التالي إلى ⁦`api-2`⁩، قد لا تعرف النسخة الثانية الـSocket.IO session نفسها وينتج خطأ مثل ⁦`400 Session ID unknown`⁩.

‏لدينا الآن:

```nginx
upstream mini_erp_api {
  ip_hash;
  server api:3000;
  server api-2:3000;
}
```

‏⁦`ip_hash`⁩ يجعل Nginx يحسب اختيار الـAPI من IP العميل. لذلك requests من نفس العميل تذهب غالباً إلى نفس API instance:

```text
Client A -> api-1 دائماً تقريباً
Client B -> api-2 دائماً تقريباً
```

‏هذا يسمى **sticky session** أو **session affinity**.

‏Redis Adapter الذي أضفناه سابقاً له وظيفة مختلفة: إذا event صدر من ⁦`api-1`⁩ وsocket العميل متصل بـ⁦`api-2`⁩، Redis ينقل event بين النسختين. نحتاج الاثنين عند وجود Socket.IO مع أكثر من instance:

```text
Sticky session = requests لنفس socket تصل لنفس instance.
Redis adapter  = events تنتقل بين instances.
```

‏في local development، كل requests من جهازك تأتي غالباً من نفس IP، لذلك سترى instance واحدة ثابتة. هذا سلوك صحيح بعد إضافة ⁦`ip_hash`⁩.

‏في production خلف CDN أو proxy آخر يجب ضبط trusted proxy/real client IP بصورة صحيحة. أحياناً تستخدم الشركات cookie-based affinity بدلاً من IP affinity. لا نضيف ذلك الآن لأنه يحتاج معرفة الـdeployment الحقيقي.

## ‏16. Health Checks وFailover

‏لدينا endpoint جاهز في Express:

```text
GET /health        = process يعمل
GET /health/ready  = process يعمل وPostgreSQL متصل
```

‏Docker Compose يشغّل health check داخل كل API container على ⁦`/health/ready`⁩. بعد ثلاث محاولات فاشلة يظهر container كـ⁦`unhealthy`⁩ في ⁦`docker compose ps`⁩.

```yaml
healthcheck:
  test: ["CMD", "node", "-e", "..."]
  interval: 10s
  timeout: 5s
  retries: 3
```

‏هذا مهم، لكنه لا يعني أن Nginx Open Source يطلب ⁦`/health/ready`⁩ باستمرار. هذا النوع يسمى **active health check**، وهو يحتاج Nginx Plus أو health-check component/monitor منفصل في إعدادات production.

‏Nginx عندنا يستخدم **passive failover**:

```nginx
server api:3000 max_fails=1 fail_timeout=10s;
server api-2:3000 max_fails=1 fail_timeout=10s;

proxy_next_upstream error timeout http_502 http_503 http_504;
proxy_next_upstream_tries 2;
```

‏معناه:

```text
1. Nginx يرسل request إلى api-1.
2. الاتصال يفشل أو api-1 ترجع 502/503/504.
3. Nginx يجرب api-2 في نفس request عندما يكون ذلك آمناً.
4. api-1 تعتبر غير متاحة مدة 10 ثوانٍ.
```

‏لا نضيف ⁦`non_idempotent`⁩؛ لذلك لا يعيد Nginx POST بشكل أعمى إذا كان ممكن أن الـAPI الأولى استقبلت الطلب بالفعل. الـidempotency key الذي بنيناه في Orders حماية إضافية، لكنه ليس سببًا لجعل retry التلقائي افتراضيًا لكل POST.

## ‏17. ما هو ⁦`worker_connections`⁩؟

‏تخيّل:

```text
worker     = موظف داخل Nginx
connection = خط مفتوح بين Nginx وclient
```

‏مثال إعداد:

```nginx
worker_processes 2;

events {
  worker_connections 1024;
}
```

‏⁦`worker_connections 1024`⁩ تعني تقريباً: كل worker يسمح له التعامل مع 1024 connection مفتوحة في نفس الوقت.

‏هذا لا يعني “1024 request في اليوم” أو “1024 user مسجل”. السؤال هو:

```text
كم connection مفتوحة الآن في نفس اللحظة؟
```

‏الحد النظري التقريبي:

```text
worker_processes × worker_connections
2 × 1024 = 2048 connections
```

‏لكن في reverse proxy لا تعتبرها 2048 users بالضبط:

```text
User <-> Nginx <-> Node.js API
```

‏Nginx قد تحتاج connection مع المستخدم وconnection أخرى مع upstream API. وهناك limits نظام التشغيل مثل file descriptors، لذلك الحد الحقيقي أقل أحياناً.

‏WebSocket مهم هنا: HTTP request عادية تنتهي سريعاً، لكن chat/Socket.IO connection قد تظل مفتوحة مدة طويلة، فتستهلك connection من الحد.

## ‏18. كيف نختار القيمة؟

‏لا نختارها حسب عدد users المسجلين. نختارها حسب:

- ‏عدد simultaneous open connections المتوقع.
- ‏هل يوجد WebSockets كثيرة وطويلة؟
- ‏CPU وRAM المتاحان.
- OS file descriptor limits.
- ‏load testing وmetrics الحقيقية.

‏حالياً لم نضفها عمداً:

```nginx
events {}
```

‏لأننا في local learning setup. في production نبدأ عادةً بقيمة معقولة مثل ⁦`1024`⁩ ثم نراقب ونضبط وفق بيانات حقيقية، وليس تخميناً.

## ‏19. تشغيل وتجربة Nginx محلياً

‏بعد تشغيل Docker Desktop:

```powershell
docker compose up -d --build nginx
```

‏اختبر:

```powershell
Invoke-WebRequest -UseBasicParsing http://localhost:8080/health
```

‏يجب أن تحصل على نفس response من:

```text
http://localhost:3000/health
```

‏لكن الطريق مختلف:

```text
3000: Client -> Express مباشرة
8080: Client -> Nginx -> Express
```

‏في production عادة نغلق port API العام ونترك Nginx فقط أمام المستخدمين. أبقينا port ⁦`3000`⁩ مفتوحاً الآن للتعلّم والمقارنة.

## ‏تجربة عملية: Proxy وLoad Balancing

```powershell
docker compose up -d --build nginx api api-2
docker compose exec nginx nginx -t
Invoke-WebRequest -UseBasicParsing http://localhost:8080/health
```

‏الطلب على ⁦`8080`⁩ لا يصل إلى Express مباشرة؛ Nginx تقرأ ⁦`upstream mini_erp_api`⁩ ثم تمرّره إلى ⁦`api`⁩ أو ⁦`api-2`⁩. أوقف نسخة واحدة كتجربة محلية:

```powershell
docker compose stop api
Invoke-WebRequest -UseBasicParsing http://localhost:8080/health
docker compose start api
```

‏إذا نجح الطلب والنسخة الثانية healthy، فقد رأيت failover عمليًا. لا تترك instance متوقفة بعد التجربة، ولا تعتبر ذلك اختبارًا كاملًا للـproduction.
