# Outbox Pattern: لماذا أضفناه وكيف يعمل هنا؟

## المشكلة الحقيقية أولاً

عند تأكيد order نريد تنفيذ أشياء متعددة:

1. خصم stock.
2. حفظ `InventoryMovement`.
3. جعل order حالته `CONFIRMED`.
4. مسح product cache.
5. إرسال Socket.IO notification.
6. إرسال low-stock email في background إذا وصل المنتج لحد منخفض.

أول ثلاثة تغييرات هي بيانات أساسية، ويجب أن تنجح أو تفشل معاً داخل PostgreSQL transaction. آخر ثلاثة هي side effects خارج قاعدة البيانات.

لو كتبنا هذا بعد الـtransaction مباشرة:

```ts
await prisma.$transaction(confirmOrderInDatabase);
publishOrderConfirmed(event);
```

ففيه نافذة خطرة: database نجحت، ثم الـserver وقع قبل `publishOrderConfirmed`. صار order confirmed وstock نقص، لكن cache/socket/email لم يعرفوا أبداً.

لا نريد أيضاً أن نرسل email داخل transaction؛ لأن الشبكة بطيئة أو قد تفشل، ولا يجب أن تبقي DB transaction مفتوحة بسبب SMTP.

## الفكرة في سطر واحد

داخل **نفس transaction** التي تحفظ الـbusiness data، نكتب record صغيراً يقول: “بعد commit، يوجد event يجب نشره”. هذا record هو الـ**outbox event**.

```text
transaction commits
  order + stock changes + inventory movements + outbox event
```

لو التطبيق وقع بعد الـcommit، الـevent موجود بأمان في PostgreSQL. عندما يعود processor يقرأه وينفذ side effects.

## قبل الـOutbox: event/listener داخل الذاكرة

عند startup، `src/server.ts` ينادي `registerOrderEventListeners()` مرة واحدة. هذه الدالة تضيف functions إلى `Set` داخل `orders.events.ts`:

```ts
onOrderConfirmed(clearCacheWhenOrderConfirmed);
onOrderConfirmed(emitRealtimeWhenOrderConfirmed);
onOrderConfirmed(queueLowStockEmailWhenOrderConfirmed);
```

الـ`Set` لا يختفي بعد أول event. يظل في ذاكرة الـNode process طول ما الـserver شغال. وعندما ننادي:

```ts
await publishOrderConfirmed(event);
```

فالـpublisher يلف على كل functions المحفوظة في الـSet ويناديها. وجود `registered` في listener module يمنع تسجيل نفس callbacks مرتين عند استدعاء registration بالخطأ.

هذه الآلية ممتازة لفصل الـorder service عن تفاصيل cache/socket/email، لكنها وحدها ليست durable: إذا مات الـprocess، الذاكرة تموت معها. الـOutbox لا يبدل listeners؛ هو يجعل **الحدث الذي سيصل إلى listeners محفوظاً في DB**.

## Data model

### `OutboxEvent`

الـtable في `prisma/schema.prisma` يحمل event واحداً ينتظر المعالجة أو تمت معالجته:

| عمود | المعنى |
| --- | --- |
| `id` | UUID ثابت للـevent؛ نستخدمه أيضاً في idempotency للـconsumer |
| `type` | نوع الحدث، حالياً `order.confirmed` |
| `payload` | JSON فيه order وstock changes اللازمة للlisteners |
| `createdAt` | وقت كتابة الحدث داخل transaction |
| `availableAt` | أقرب وقت يسمح فيه بإعادة المحاولة |
| `processedAt` | وقت النجاح؛ `null` يعني لم ينجح بعد |
| `failedAt` | وقت دخوله dead letter بعد استنفاد retries |
| `lockedAt`, `lockedBy` | lease للـprocessor الذي claim الحدث |
| `attempts` | عدد محاولات النشر |
| `lastError` | آخر error مختصر للفحص السريع |

هناك index مركب على حقول البحث المهمة (`processedAt`, `failedAt`, `availableAt`, `lockedAt`, `createdAt`) لأن processor يبحث باستمرار عن event جاهز للعمل.

### `OutboxEventAttempt`

عندما يفشل event، نضيف صفاً في هذا الجدول:

```text
OutboxEvent 1 ---- * OutboxEventAttempt
```

يحفظ رقم المحاولة، error، ووقت المحاولة. هذا سجل تاريخي append-only؛ حتى لو عملنا manual replay ومسحنا `lastError` من الـevent، يبقى التاريخ القديم موجوداً للتشخيص.

### لماذا لا يوجد FK من OutboxEvent إلى Order؟

الـOutbox generic. اليوم نستعمل `order.confirmed`، غداً قد نستعمل `user.registered` أو `product.created`. ربطه مباشرة بـOrder يجعله table خاصاً بالـorders. الـorder ID موجود في `payload` لهذا النوع من الأحداث.

### لا تخلط بين Outbox وIdempotencyKey

| الشيء | يحل أي تكرار؟ |
| --- | --- |
| `IdempotencyKey` | نفس HTTP create-order request وصل مرتين من frontend/network |
| `OutboxEvent` | side effects بعد حفظ order يجب ألا تضيع إذا التطبيق وقع |

`IdempotencyKey` مربوط بـ`Order` فعلاً (`orderId` FK وunique). أما Outbox فهو رسالة business مستقلة تنتظر delivery.

## كيف يتكون event عند confirm order؟

في `src/modules/orders/orders.service.ts`، `confirmOrder` ينفذ transaction واحدة:

```text
load draft order
  -> lock/update stock safely
  -> create InventoryMovement rows
  -> mark order CONFIRMED
  -> create OutboxEvent(type = order.confirmed)
commit
```

الجزء المبسط:

```ts
await tx.outboxEvent.create({
  data: {
    type: "order.confirmed",
    payload: event,
  },
});
```

طالما transaction لم تعمل commit، لا يوجد order مؤكد ولا outbox event. لو فشلت transaction يتراجع الاثنان. لو نجحت، الاثنان موجودان. هذه هي الفائدة الأساسية.

## Processor: من يقرأ الجدول؟

`src/jobs/outbox.service.ts` يبدأ من `startOutboxProcessor()` عند تشغيل الـserver. كل ثانية تقريباً يحاول العثور على event جاهز، ويستمر في draining backlog طالما توجد events جاهزة.

في النسخة التعليمية الحالية الـprocessor داخل API process، لأن Socket.IO server موجود فيه. هذا قرار بسيط للتعلم، وليس شرطاً دائماً. لو فصلناه لاحقاً إلى worker مستقل، يجب أن نصمم كيف يصل الـworker إلى Socket.IO (مثل Redis adapter) أو نجعل realtime consumer مستقلاً.

## Claiming: لماذا لا يعالج workerان نفس event؟

الـprocessor يستخدم PostgreSQL query فيها:

```sql
FOR UPDATE SKIP LOCKED
```

المعنى: worker يختار صفاً واحداً ويقفله داخل transaction. worker آخر يتخطى الصف المقفول ويبحث عن صف آخر، بدلاً من الانتظار أو تنفيذ نفس العمل.

بعد الاختيار، الـquery تزيد `attempts` وتملأ `lockedAt` و`lockedBy`. هذا يسمى **claim** أو **lease**.

لو worker مات وهو ماسك event، الـlease لا يبقى للأبد: بعد مهلة، يمكن لworker آخر أن يلتقط event. لذلك لا ندّعي exactly-once delivery.

## نجاح أو فشل النشر

عند event من نوع `order.confirmed`، processor يفعل تقريباً:

```ts
await publishOrderConfirmed({
  ...storedPayload,
  outboxEventId: event.id,
});

await markProcessed(event.id);
```

والـlisteners الثلاثة يقومون بـ:

```text
order.confirmed
  ├─ clear product cache
  ├─ emit Socket.IO product/user notifications
  └─ queue low-stock email job, when threshold was crossed
```

لو كل ذلك نجح، نكتب `processedAt` ونحرر lease.

لو حدث error:

1. نحفظ `OutboxEventAttempt`.
2. نحفظ `lastError`.
3. نحرر lease.
4. نؤخر `availableAt` بـexponential backoff: 1s، 2s، 4s… حتى 60s.
5. بعد 10 محاولات، نضع `failedAt` ولا يعاد تلقائياً.

هذا هو الـdead letter state، وليس حذفاً للحدث. لا نحذف الأدلة لأننا نحتاج معرفة لماذا فشل.

## Manual replay

لدينا endpoints للـADMIN تحت `/api/outbox-events`:

- `GET /failed`: قائمة الـdead-letter events بدون payload.
- `GET /:id`: تفاصيل event ومحاولاته.
- `POST /:id/replay`: يعيد event الفاشل إلى ready state.

الـreplay يمسح `failedAt` ويعيد attempts للصفر ويجعل `availableAt` الآن. لا يمسح `OutboxEventAttempt` history، لذلك تستطيع رؤية failures السابقة.

## هل هو exactly once؟ لا

افترض أن listener أرسل email، ثم الـprocess وقع قبل `markProcessed`. عند العودة سيعيد processor event. هذا هو **at-least-once delivery**: قد يصل event أكثر من مرة، لكنه لا ينبغي أن يضيع بسهولة.

لهذا كل consumer يجب أن يتحمل التكرار:

| Consumer | لماذا التكرار مقبول أو كيف نقلله؟ |
| --- | --- |
| cache invalidation | حذف نفس key مرتين آمن |
| Socket.IO | frontend يجب أن يكون قادراً على deduplicate باستخدام event ID عند الحاجة |
| low-stock queue | job ID مبني على `outboxEventId` والـproduct ID، فيقل احتمال وضع نفس job مرتين |
| stock deduction | لا يحدث في listener أصلاً؛ حدث داخل transaction مرة واحدة |

حتى BullMQ/email لا يعطيان “email exactly once” السحري؛ crash في لحظة معينة قد يسبب duplicate. الهدف العملي هو idempotency وobservability، وليس وعد مستحيل.

## Flow كامل

```text
Client confirms order
        |
        v
Order service transaction
  ├─ decrement stock safely
  ├─ insert inventory movements
  ├─ update order = CONFIRMED
  └─ insert OutboxEvent(order.confirmed)
        |
      COMMIT
        |
        v
Outbox processor claims event (lease)
        |
        v
publishOrderConfirmed
  ├─ clear Redis cache
  ├─ Socket.IO notifications
  └─ BullMQ low-stock email job
        |
        +-- success -> processedAt set
        |
        +-- failure -> attempt history + retry later
                              |
                              +-- exhausted -> failedAt (dead letter)
                                              |
                                              +-- ADMIN replay
```

## لماذا ليس Redis بدلاً من Outbox table؟

يمكن أن تضع event في Redis، لكن السؤال الصعب: كيف تضمن أن database transaction وRedis write ينجحان أو يفشلان معاً؟ عادة لا يوجد transaction واحد atomic بين PostgreSQL وRedis.

لو حفظت order أولاً ثم كتبت Redis ووقع التطبيق بينهما، عدنا لنفس مشكلة فقد الحدث. الـOutbox table تستخدم نفس PostgreSQL transaction التي تحفظ order، لذلك الاتساق هنا سهل وقوي.

Redis ممتاز للـcache والqueues، لكنه ليس بديلاً عن الـoutbox في هذه المشكلة.

## متى أستخدمه ومتى لا؟

استخدم Outbox عندما يوجد business write مهم وبعده side effects أو events لا يجب فقدها: billing، email، inventory، Kafka publish، audit، integrations.

لا تضفه لكل `console.log` أو لكل feature صغيرة. له تكلفة: tables، polling، retries، monitoring، وidempotency. في مشروع CRUD بسيط بلا side effects مهمة قد يكون أكثر من المطلوب.

## Checklist عند إضافة event جديد

1. عرّف event type وpayload صغير وواضح.
2. اكتب الـOutboxEvent داخل نفس transaction الخاصة بالـbusiness data.
3. أضف handler/listener واضحاً.
4. اجعل الـhandler idempotent.
5. فكر في retry وdead letter وmanual replay.
6. أضف logs وmetric/alert مناسبين إذا كان event مهمّاً.

الخلاصة: الـOutbox Pattern لا يجعل الـsystem معصوماً من الفشل؛ هو يحوّل فشل “الحدث ضاع ولا نعرف” إلى record محفوظ يمكن retry ومراقبته وإصلاحه.

## تجربة عملية: كيف تتبع event من البداية للنهاية؟

```text
1. أنشئ order ثم confirm لها.
2. transaction تحفظ Order + InventoryMovement + OutboxEvent معًا.
3. بعد commit، راقب process الـoutbox في logs.
4. handler يمسح cache ويرسل Socket event ويضيف low-stock job إذا لزم.
5. worker تعالج job لاحقًا.
```

شغّل النظام ثم راقب logs منفصلة:

```powershell
docker compose up -d postgres redis api worker
docker compose logs -f api
docker compose logs -f worker
```

إذا فشل side effect، لا تعِد confirm order يدويًا؛ order اكتملت بالفعل. افحص OutboxEvent وحالة retry/last error، ثم أصلح السبب ودع processor تعيد المحاولة أو أعد تشغيل الحدث بطريقة مضبوطة. هذه بالضبط فائدة الـOutbox.
