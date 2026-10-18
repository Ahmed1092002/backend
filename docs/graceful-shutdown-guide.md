# Graceful Shutdown: إيقاف الـAPI بدون قطع النظام

هذا المستند يشرح ما يحدث عندما نوقف أو نحدّث API instance مثل `api-1`، ولماذا أضفنا graceful shutdown بعد تشغيل أكثر من instance خلف Nginx.

## 1. المشكلة قبل Graceful Shutdown

قبل إضافة shutdown منظّم، إيقاف container قد ينهي Node.js process فجأة:

```text
Docker يوقف api-1
        ↓
Node.js process ينتهي فورًا
        ↓
request جارية قد تنقطع
Socket.IO clients تنقطع
Outbox event قد تكون في منتصف المعالجة
```

وجود `api-2` خلف Nginx يقلل downtime، لكنه لا يحل وحده مشكلة العمل الجاري داخل `api-1`.

## 2. ما هي `SIGTERM` و`SIGINT`؟

عند تنفيذ:

```powershell
docker compose stop api
```

Docker يرسل إلى التطبيق signal اسمها `SIGTERM`. معناها:

```text
"استعد للإغلاق. حاول أن تنهي عملك بشكل منظم."
```

وعند الضغط على `Ctrl + C` أثناء تشغيل Node.js محليًا، تصل غالبًا signal اسمها `SIGINT`.

في [server.ts](../src/server.ts) سجلنا الاثنتين:

```ts
process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
```

إذن flow البداية:

```text
Docker stop / Ctrl + C
        ↓
SIGTERM أو SIGINT
        ↓
shutdown()
```

## 3. منع shutdown مرتين

يوجد flag:

```ts
let shuttingDown = false;
```

وفي بداية function:

```ts
if (shuttingDown) return;
shuttingDown = true;
```

قد تصل signal ثانية أثناء الإغلاق. لا نريد إغلاق Prisma أو Redis مرتين، لذلك أول signal فقط تبدأ العملية.

```text
أول signal  → يبدأ shutdown
ثاني signal → يتجاهلها التطبيق
```

## 4. إغلاق HTTP Server بطريقة صحيحة

لدينا Node HTTP server:

```ts
const server = createServer(app);
```

ودالة الإغلاق:

```ts
function closeHttpServer() {
  return new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}
```

`server.close()` لا يعني قتل كل request مباشرة. معناه:

```text
لا تقبل HTTP connections جديدة
لكن اترك requests الحالية تنتهي
```

مثال:

```text
Client بدأ Create Order على api-1
        ↓
Docker يرسل SIGTERM إلى api-1
        ↓
api-1 لا تستقبل request جديدة
لكن تحاول إنهاء Create Order الجاري
        ↓
Nginx يرسل requests الجديدة إلى api-2
```

## 5. إيقاف Outbox Processor

Outbox processor يسأل database كل ثانية تقريبًا عن events جاهزة:

```text
كل ثانية:
  هل توجد Outbox event؟
  نعم → عالجها
```

قديمًا كان عندنا `setInterval` فقط. لم تكن توجد طريقة منظمة لقول:

```text
"لا تأخذ events جديدة، واستعد للإغلاق."
```

الآن `startOutboxProcessor()` ترجع object يحتوي:

```ts
{
  stop()
}
```

وعند shutdown:

```ts
await outboxProcessor?.stop();
```

ما الذي تفعله `stop()`؟

```text
1. تجعل stopping = true.
2. تلغي setInterval.
3. تمنع claim لأي Outbox event جديدة.
4. تنتظر الـtick التي تعمل الآن كي تنتهي.
5. بعدها تسمح لباقي shutdown أن يكمل.
```

هذا مهم لأن event مثل `OrderConfirmed` قد تكون الآن في مرحلة إرسال notification. لا نريد قتل process بلا ترتيب في منتصف عمل database أو side effect.

Outbox pattern ما زال طبقة أمان: إذا وقع التطبيق فعلًا قبل إنهاء event، الحدث يبقى في database ويمكن instance أخرى التعامل معه لاحقًا.

## 6. لماذا نقفل Socket.IO connections؟

Socket.IO/WebSocket connections طويلة. HTTP request عادية تنتهي خلال milliseconds أو seconds، لكن socket قد تبقى مفتوحة مدة طويلة.

لو تركنا socket مفتوحة:

```text
server.close()
        ↓
قد ينتظر connections طويلة جدًا
        ↓
shutdown قد لا ينتهي
```

لذلك في [socket.ts](../src/realtime/socket.ts):

```ts
io?.disconnectSockets(true);
```

هذا يفصل clients المتصلة بهذه الـAPI instance فقط.

الـclient لا يظل ميتًا؛ flow المتوقع:

```text
api-1 تبدأ shutdown
        ↓
Socket client تنقطع
        ↓
Socket.IO client يعمل reconnect
        ↓
Nginx يرسلها إلى api-2
        ↓
Redis Adapter يظل ينقل events بين instances
```

هذا ليس zero-disconnect للـSocket، بل reconnect قصير ومنظم. للحصول على تجربة أكثر تعقيدًا يمكن لاحقًا استخدام connection state recovery أو إشعار client قبل الإغلاق، لكنهما خارج نطاق هذا المشروع الآن.

بعد فصل sockets، نقفل Redis Pub/Sub clients الخاصة بـSocket.IO Redis Adapter:

```ts
await Promise.all(clients.map((client) => client.quit()));
```

هذه ليست Redis client الخاصة بالكاش أو BullMQ؛ هي الاتصالات التي أُنشئت خصيصًا لنشر واستقبال Socket.IO events بين الـAPI instances.

## 7. لماذا Prisma تُغلق في النهاية؟

في النهاية:

```ts
await prisma.$disconnect();
```

Prisma تمسك PostgreSQL connection pool. لا نغلقها في البداية، لأن request أو outbox event جارية قد تحتاج database.

ترتيبنا الحالي:

```text
1. server.close()     → لا connections HTTP جديدة.
2. outbox.stop()      → لا events جديدة، وانتظار العمل الجاري.
3. disconnectSockets  → إغلاق Socket.IO الطويلة.
4. Redis Pub/Sub quit → إنهاء Socket.IO adapter connections.
5. انتظار HTTP server → requests الحالية تنتهي.
6. prisma.$disconnect → إغلاق PostgreSQL pool.
7. process.exit(0)    → خروج ناجح.
```

## 8. لماذا يوجد timeout؟

لدينا timeout عشر ثوانٍ:

```ts
const forceExit = setTimeout(() => {
  process.exit(1);
}, 10_000);
```

بدونه قد تتعطل عملية deploy إذا علقت request أو خدمة خارجية للأبد:

```text
shutdown يبدأ
        ↓
عملية معلقة بلا نهاية
        ↓
container لا تقفل
        ↓
Docker أو Kubernetes لا يستطيعان استبدالها
```

لذلك:

```text
إغلاق منظم قبل 10 ثوانٍ → process.exit(0)
عملية عالقة أكثر من 10 ثوانٍ → process.exit(1)
```

القيمة المناسبة في production تعتمد على زمن requests، background jobs، وسياسة الـload balancer/Orchestrator.

## 9. الشكل الكامل

```text
docker compose restart api
          ↓
Docker sends SIGTERM
          ↓
shutdown()
          ↓
No new HTTP connections
          ↓
Finish current Outbox work
          ↓
Disconnect Socket.IO clients
          ↓
Close Redis adapter clients
          ↓
Finish active HTTP requests
          ↓
Close Prisma/PostgreSQL pool
          ↓
API exits safely
          ↓
Nginx continues using api-2
```

## 10. تجربة محلية

شغّل النظام:

```powershell
docker compose up -d --build
```

ثم أعد تشغيل نسخة واحدة:

```powershell
docker compose restart api
docker compose logs api
```

يجب أن ترى structured logs تشبه:

```text
server_shutdown_started
server_shutdown_completed
```

وأثناء ذلك، اختبر Nginx:

```powershell
Invoke-RestMethod http://localhost:8080/health
```

وجود `api-2` يتيح لـNginx الاستمرار في خدمة traffic عندما `api-1` تتوقف أو تبدأ مرة أخرى.

## 11. ما الذي لا يفعله هذا؟

- لا يضمن أن WebSocket لن تنقطع؛ العميل يحتاج reconnect.
- لا يضمن active health checks من Nginx Open Source.
- لا يحل distributed transactions؛ Outbox وidempotency هما الحماية المناسبة هناك.
- لا يحول المشروع إلى Kubernetes أو microservices.

هدف هذه الخطوة محدود وواضح: إخراج API instance من الخدمة بطريقة منظمة وآمنة قدر الإمكان قبل استبدالها.
