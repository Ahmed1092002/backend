# Redis, BullMQ, Jobs, and Realtime Guide

‏Redis في هذا المشروع تستخدم بثلاث طرق مختلفة. نفس Redis server، لكن كل استخدام له معنى مختلف.

```text
1. Cache       → تسريع reads.
2. BullMQ      → queues وbackground jobs.
3. Socket.IO   → Pub/Sub بين API instances.
```

## 1. Redis Cache

‏ملف ⁦`src/cache/redis.ts`⁩ يوفر functions مثل:

```text
getCache(key)
setCache(key, value, seconds)
deleteCache(key)
clearProductCache()
```

‏Products list/details يمكن تخزينها مؤقتًا تحت keys مثل:

```text
products:...
```

Flow:

```text
Request products
→ try Redis cache
→ cache hit: return cached JSON
→ cache miss: read PostgreSQL
→ save JSON in Redis with TTL
→ return result
```

‏إذا Redis غير متاحة، cache functions تسجل warning وترجع إلى database بدل أن تسقط الـAPI. هذا يسمى cache as an optimization، وليس source of truth.

## 2. Cache Invalidation

‏بعد create/update/delete product أو confirm order الذي يغير stock، cached products قد تصبح قديمة.

‏لذلك نحتاج clear/invalidate keys الخاصة بالمنتجات.

```text
Database changes
→ clear product cache
→ next read gets fresh database data
→ caches it again
```

‏المشكلة الأساسية في caching ليست ⁦`set`⁩؛ هي معرفة متى تمسح value القديمة. لهذا لا نخزن stock أو prices في cache بلا invalidation plan.

## ‏3. BullMQ: Queue وJob وWorker

```text
Queue  = مكان دائم نسبيًا في Redis للـjobs المنتظرة.
Job    = رسالة عمل واحدة، مثل send welcome email.
Worker = process منفصلة تسحب jobs وتعالجها.
```

‏مثال register:

```text
User registers
→ API saves user and returns response
→ API adds welcome-email job
→ Worker later sends email
```

‏لا نرسل email داخل HTTP request لأن SMTP قد تكون بطيئة أو تقع. نجاح registration لا يجب أن ينتظر البريد.

## ‏4. Queues الحالية

‏لدينا queue منفصلة لكل نوع عمل:

```text
welcome-emails
low-stock-alerts
```

‏والـworker في ⁦`src/workers/email.worker.ts`⁩ تشغّل Workers لهما.

‏الـjob لديها:

```text
attempts: 3
backoff: exponential, delay 1000ms
```

‏مثال retry:

```text
failure 1 → retry after ~1s
failure 2 → retry after ~2s
failure 3 → retry after ~4s
```

‏الفكرة من exponential backoff: لا نضرب SMTP أو dependency واقعة بطلبات سريعة متكررة.

### ‏شرح code إضافة job

‏من ⁦`src/jobs/email.queue.ts`⁩:

```ts
return getWelcomeQueue().add(
  "welcome",
  { userId, name, email },
  {
    jobId: `welcome:${userId}`,
    attempts: 3,
    backoff: { type: "exponential", delay: 1000 },
  },
);
```

- ‏⁦`getWelcomeQueue()`⁩ تنشئ/تعيد Queue اسمها ⁦`welcome-emails`⁩. استخدام ⁦`??=`⁩ يعني: أنشئها مرة واحدة فقط عند أول job، لا عند كل register request.
- ‏⁦`add("welcome", data, options)`⁩ تكتب job في Redis؛ لا ترسل email الآن.
- ‏⁦`data`⁩ تحتوي أقل معلومات يحتاجها worker؛ لا نضع password أو access token.
- ‏⁦`jobId: welcome:<userId>`⁩ يمنع job ثانية لنفس welcome email عند retry أو تكرار event.
- ‏⁦`attempts: 3`⁩ يعني المحاولة الأصلية + محاولات BullMQ حتى الحد المحدد.
- ‏⁦`exponential`⁩ يبدأ بـ1000ms ثم يطول بين المحاولات؛ لا نعمل loop سريع يرهق mail server.

## ‏5. Idempotency للـJobs

‏Welcome email تستخدم job ID مثل:

```text
welcome:<userId>
```

‏Low stock email تستخدم outbox event ID:

```text
outbox-<outboxEventId>-low-stock-<productId>
```

‏هذا مهم لأن Outbox delivery at least once. إذا أعيد تشغيل نفس event، BullMQ لا تضيف low-stock job ثانية بنفس job ID.

## 6. Socket.IO

‏Socket.IO تجعل السيرفر يدفع events إلى frontend بدون أن frontend تعمل polling دائمًا.

‏عند فتح socket، frontend ترسل access token:

```text
socket.handshake.auth.token
```

‏السيرفر يتحقق منها مثل HTTP JWT، ثم يضع المستخدم في room خاصة:

```text
user:<userId>
```

‏وبعدها notification لمستخدم محدد:

```ts
io.to(`user:${userId}`).emit("notification:new", notification);
```

‏أما product events فهي broadcast:

```text
product:created
product:updated
product:deleted
```

### ‏الحدث ليس request جديدًا

‏عندما يؤكد backend order أو يعدّل product، ينفذ code العملية أولًا ثم يطلب من Socket.IO أن يرسل event:

```text
confirm order
→ database stock تغيرت
→ outbox/event handler يقرر أن هناك تحديثًا مهمًا
→ io.emit("product:updated", payload)
→ كل frontend متصلة تسمع event وتحدث الشاشة
```

‏⁦`emit`⁩ لا ينفذ controller ثانية ولا يعيد تشغيل order. هو فقط رسالة من server إلى clients. أما notification الخاصة بمستخدم واحد فتذهب إلى room ⁦`user:<id>`⁩، لذلك لا يراها باقي المستخدمين.

## ‏7. لماذا Redis Adapter؟

‏مع API واحدة، Socket.IO memory وحدها تكفي:

```text
API 1 → sockets المتصلة بـAPI 1
```

‏مع API-1 وAPI-2:

```text
API 1 emits event
لكن user socket قد تكون متصلة بـAPI 2
```

‏Redis adapter تحل ذلك:

```text
API 1 emit
→ Redis Pub/Sub
→ API 2 receives
→ API 2 delivers to its socket clients
```

‏لهذا لدينا Redis publisher وRedis subscriber منفصلين في ⁦`socket.ts`⁩. هذه connections ليست Redis cache client ولا BullMQ connection.

### ‏شرح تهيئة Socket.IO من code

```ts
const nextPubClient = new Redis(env.redisUrl, { lazyConnect: true });
const nextSubClient = nextPubClient.duplicate();
await Promise.all([nextPubClient.connect(), nextSubClient.connect()]);

const socketServer = new Server(server, {
  cors: { origin: env.clientOrigin, credentials: true },
});
socketServer.adapter(createAdapter(nextPubClient, nextSubClient));
```

- ‏⁦`pubClient`⁩ تنشر event إلى Redis؛ ⁦`subClient`⁩ تسمع events المنشورة. Pub/Sub يحتاج اتصالين مستقلين لأن connection التي دخلت وضع subscribe لا تستخدم كـconnection عادية.
- ‏⁦`lazyConnect: true`⁩ يمنع فتح الاتصال بمجرد import للملف؛ نتحكم في وقت الاتصال داخل ⁦`initializeSocket`⁩.
- ‏⁦`Promise.all`⁩ تجعل API لا تعلن Socket.IO جاهزة قبل اتصال الاثنين.
- ‏⁦`new Server(server, ...)`⁩ تربط Socket.IO بنفس HTTP server الخاصة بـExpress، فلا نفتح port جديد.
- ‏⁦`createAdapter(...)`⁩ هو السطر الذي يجعل ⁦`io.emit`⁩ من API-1 يصل إلى clients المتصلين بـAPI-2.

‏ثم authentication:

```ts
const token = socket.handshake.auth.token;
const decoded = jwt.verify(token, env.jwtSecret);
socket.data.user = { id: decoded.sub, role: decoded.role as UserRole };
socket.join(`user:${decoded.sub}`);
```

‏نفس access JWT المستخدمة في HTTP تتحقق هنا. لا نقبل ⁦`userId`⁩ يرسلها browser كحقيقة. بعد ⁦`join`⁩، ⁦`io.to("user:<id>").emit(...)`⁩ تذهب فقط لمستخدم ذلك الـroom.

## ‏8. Sticky Sessions وRealtime

‏Redis adapter تنقل events بين instances، لكنها لا تكفي وحدها لـSocket.IO polling.

```text
Sticky session = requests لنفس client تبقى على نفس API instance.
Redis adapter  = events تنتقل بين instances.
```

‏Nginx تستخدم ⁦`ip_hash`⁩ في learning setup. راجع [nginx-reverse-proxy-guide.md](nginx-reverse-proxy-guide.md).

## ‏9. ماذا يحدث في Shutdown؟

‏عند graceful shutdown:

```text
1. API تقطع Socket.IO connections المحلية.
2. Browser Socket.IO client تعمل reconnect.
3. Nginx ترسلها إلى healthy API أخرى.
4. API تقفل Redis Pub/Sub connections.
```

‏راجع [graceful-shutdown-guide.md](graceful-shutdown-guide.md).

## ‏10. قواعد مهمة

- ‏Redis cache ليست database source of truth.
- ‏Job يجب أن تكون retryable وidempotent.
- ‏Worker process منفصلة عن API HTTP process.
- ‏لا تضع business data الحساسة بلا حاجة داخل job payload أو realtime event.
- ‏لا تفترض exactly-once delivery؛ صمم consumers لتتحمل التكرار.

## ‏11. نفس Redis، ثلاث مسؤوليات مختلفة

‏لا تخلط هذه الاستخدامات عند المراجعة:

| الاستخدام | ما الذي يخزنه/ينقله؟ | إذا اختفى؟ |
| --- | --- | --- |
| Cache | نسخة مؤقتة من products | API تقرأ PostgreSQL، لكن أبطأ. |
| BullMQ | jobs منتظرة وحالة retries | emails/background work تتأخر أو تفشل حتى يعود Redis. |
| Pub/Sub adapter | رسائل Socket.IO اللحظية بين instances | event لحظي قد لا يصل أثناء الانقطاع؛ لا نعتمد عليه كـdatabase. |

‏قد يكون Redis server واحدًا في التعلم، لكن clients/connections منفصلة لأن protocols والمسؤوليات مختلفة. في production يمكن فصلها حسب الحمل والاعتمادية.

## ‏12. طبّق Redis وWorker وRealtime بنفسك

```powershell
# شغّل Redis وAPI والـworker من compose
docker compose up -d redis api worker

# راقب log الـworker في terminal منفصلة
docker compose logs -f worker

# افحص أن Redis متاحة
docker compose exec redis redis-cli ping
```

‏نفّذ register لمستخدم جديد. الـAPI يجب أن ترجع response أولًا، ثم ترى في worker log أن welcome-email job عولجت. هذا هو الدليل أن HTTP request لم تنتظر email.

‏لـcache، اطلب products مرتين ثم راقب API logs/Redis keys حسب أدواتك. أول request تعمل database read ثم cache set؛ الثانية ينبغي أن تكون cache hit. عدّل product ثم اطلبها مجددًا: يجب أن ترى القيمة الجديدة لأن invalidation أزالت القيمة القديمة.

‏لـSocket.IO، شغّل frontend أو client Socket.IO، أرسل access token في ⁦`auth.token`⁩، ثم عدّل product. client تستقبل ⁦`product:updated`⁩. لو شغّلت API-1 وAPI-2، Redis adapter تسمح بوصول event حتى لو client متصلة بالنسخة الأخرى.
