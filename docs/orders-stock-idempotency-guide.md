# Orders, Stock, Transactions, and Idempotency

هذا الدليل يشرح لماذا Orders في المشروع ليست مجرد `INSERT`، وكيف نحمي stock من التزامن والـduplicate requests.

## 1. دورة حياة Order

```text
Create order  → status DRAFT
Confirm order → status CONFIRMED + stock decreases + inventory history + outbox event
Invoice       → متاحة فقط بعد CONFIRMED
```

لا نخصم stock عند create order؛ draft قد تتغير أو لا تكتمل. الخصم يحصل عند confirm فقط.

## 2. Create Order

الـclient يرسل product IDs وquantities فقط. لا يرسل price أو product name كحقيقة موثوقة.

السيرفر:

```text
1. يقرأ products من database.
2. يتأكد أن كل products موجودة.
3. يأخذ price/name من server.
4. ينشئ OrderItem snapshots.
5. يحسب total من server prices.
6. ينشئ Order DRAFT وIdempotency record في transaction واحدة.
```

Order item يحتفظ بـ`productName` و`unitPrice` snapshot. إذا تغير سعر المنتج غدًا، order القديمة لا تتغير.

## 3. Confirm Order داخل Transaction

`confirmOrder` تعمل داخل Prisma transaction واحدة:

```text
read DRAFT order + items
→ decrement stock safely
→ write InventoryMovement rows
→ read final product stock in batch
→ mark order CONFIRMED
→ write OutboxEvent
→ commit all or rollback all
```

إذًا لا يحدث هذا الوضع السيئ:

```text
stock decreased
لكن order بقيت DRAFT
```

أو:

```text
order CONFIRMED
لكن outbox event ضاعت
```

## 4. منع stock السالبة

لكل item نستخدم atomic update بالشكل المنطقي التالي:

```text
UPDATE product
SET stock = stock - quantity
WHERE id = productId AND stock >= quantity
```

إذا `updated.count === 0`، لا يوجد stock كافٍ ونرجع `409`.

هذا أفضل من:

```text
read stock → if enough → update later
```

لأن requestين متزامنتين قد تقرآن نفس stock قبل التحديث.

نرتب items حسب product ID قبل التحديث. هذا يقلل احتمال deadlock عندما orderين تؤكدان نفس المنتجات بترتيب مختلف.

## 5. InventoryMovement

`Product.stock` يجيب سؤال:

```text
كم القطعة المتاحة الآن؟
```

`InventoryMovement` يجيب سؤال:

```text
لماذا تغير stock؟ من فعل ذلك؟ ومتى؟
```

مثال:

```text
productId: P1
delta: -3
note: Order O1 confirmed
actorId: user who confirmed it
```

هذه audit trail، وليست بديلًا عن current stock.

## 6. Order وInvoice وReceipt

```text
Order   = طلب العميل للمنتجات؛ قد يكون DRAFT أو CONFIRMED.
Invoice = مستند مالي بالمبلغ والـitems، عادة بعد confirm.
Receipt = إثبات أن دفعًا استُلم؛ ليس موجودًا كـpayment module كامل في هذا المشروع.
```

Invoice PDF لا تصبح متاحة إلا للـconfirmed order؛ لا نريد invoice لطلب لم يخصم stock أو قد يتغير.

### Invoice PDF Flow

endpoint الحالي:

```text
GET /api/orders/:id/invoice
→ authenticate
→ require ADMIN or MANAGER
→ find confirmed order
→ writeInvoicePdf(order, response stream)
→ browser downloads PDF
```

`invoice.service.ts` تستخدم PDFKit. لا تحفظ PDF في database أو disk في هذا المثال؛ تبني document في الذاكرة وتعمل pipe مباشرة إلى HTTP response:

```text
Confirmed Order DTO
→ PDFDocument
→ response Writable stream
→ browser file download
```

الـPDF تستخدم immutable order item snapshots، لذلك تعرض اسم المنتج وسعره وقت إنشاء order، لا السعر الحالي في Product table.

## 7. Idempotency Key

network قد تفشل بعد أن السيرفر حفظ order لكن قبل أن العميل يرى response. الـclient قد يعيد نفس POST.

لذلك `POST /orders` تتطلب:

```http
Idempotency-Key: unique-random-value
```

السيرفر ينشئ scope:

```text
orders.create:<userId>
```

ويخزن:

```text
scope
key
requestHash
orderId
createdAt
```

## 8. لماذا `requestHash`؟

نحسب SHA-256 من input. إذا استُخدمت نفس key مع نفس body، نفترض أنها retry ونرجع order السابقة.

```text
same scope + same key + same hash
→ return original order, replayed = true
```

لكن نفس key مع body مختلفة ليست retry آمنة:

```text
same scope + same key + different hash
→ 409 conflict
```

الـfrontend يجب أن تنشئ UUID جديدة لكل محاولة business جديدة. لو user يريد order مشابهة ثانية عن قصد، تستخدم key جديدة.

## 9. Unique Constraint والتزامن

هناك unique constraint على `[scope, key]`. إذا وصل requestان بنفس key في نفس الوقت:

```text
الأولى تنشئ order + idempotency record.
الثانية تضرب unique conflict.
الثانية تقرأ record الموجودة ثم تعيد نفس order.
```

وهذا هو سبب وضع idempotency record وorder في نفس database transaction: لا نريد key بدون order أو order بلا key.

### Foreign Keys والعلاقات

المخطط يفرض علاقات مهمة:

```text
User 1 ─── many Orders
Order 1 ── many OrderItems
Order 1 ── one IdempotencyKey
Product 1 ─ many OrderItems
Product 1 ─ many InventoryMovements
```

أمثلة من Prisma schema:

```text
Order.createdById     → User.id
OrderItem.orderId     → Order.id (onDelete: Cascade)
OrderItem.productId   → Product.id
IdempotencyKey.orderId → Order.id (unique + onDelete: Cascade)
```

`@unique` على `IdempotencyKey.orderId` تعني أن order واحدة لها idempotency record واحدة فقط في التصميم الحالي. و`@@unique([scope, key])` هي الحماية الفعلية من إنشاء نفس order مرتين لنفس user/scope.

`onDelete: Cascade` يعني أنه عند حذف parent المحدد، database تحذف child rows المرتبطة بدل ترك rows تشير إلى record لم تعد موجودة. لا نضيف Cascade بلا تفكير؛ هي مناسبة فقط عندما child بلا معنى بدون parent.

## 10. Outbox بعد Confirm

عند confirm، نحفظ `OutboxEvent` في نفس transaction. بعد commit، processor يعالجها لتشغيل side effects مثل:

```text
clear product cache
emit realtime stock events
queue low-stock email
```

تفاصيل الـOutbox موجودة في [outbox-pattern.md](outbox-pattern.md).

## 11. أهم قواعد المراجعة

- لا تثق في price أو name من client.
- لا تخصم stock خارج transaction.
- لا تنشئ invoice قبل confirmed order.
- لا تعمل `read then write` للـstock عندما يوجد concurrency.
- لا تعيد POST create order بلا idempotency key.
- لا تعتبر outbox event "مرة واحدة فقط"؛ consumers يجب أن تكون idempotent.
