# Database Performance Guide

‏هذا الدليل يجمع قرارات الأداء التي أضفناها حول PostgreSQL وPrisma وProducts وInventoryMovement.

## ‏1. لا تبدأ بالـOptimization عمياء

‏قاعدة العمل:

```text
Observe → measure → find bottleneck → change smallest correct thing → measure again
```

‏أدواتنا:

```text
Prometheus metrics     = هل HTTP/database behavior تغير؟
Structured logs        = ما endpoint البطيئة أو كثيرة الأخطاء؟
EXPLAIN ANALYZE        = كيف PostgreSQL تنفذ query فعلًا؟
```

## 2. Indexes

‏لدينا index لحركات المخزون:

```text
InventoryMovement(productId, createdAt, id)
```

‏وهو يخدم query مثل:

```text
all movements for one product
ordered by newest first
cursor pagination
```

‏بدون index، PostgreSQL قد تقرأ صفوفًا كثيرة ثم ترتبها. مع index مناسب يمكنها الوصول للجزء المطلوب بسرعة أكبر.

‏وجود index ليس مجانيًا:

```text
faster reads
لكن
slower writes قليلًا + disk space إضافية
```

‏لذلك نضيف index لخدمة query حقيقية، لا لكل column.

## 3. `EXPLAIN ANALYZE`

‏لا نخمن أن index مستخدم. نطلب من PostgreSQL الخطة الحقيقية:

```sql
EXPLAIN ANALYZE
SELECT ...
```

‏نبحث عن أشياء مثل:

```text
Index Scan / Bitmap Index Scan
actual rows
actual time
Sort expensive
Sequential Scan على table كبيرة
```

‏وجود ⁦`Seq Scan`⁩ ليس خطأ دائمًا؛ table صغيرة قد يكون هذا أسرع. المهم حجم البيانات والزمن الحقيقي.

## ‏4. Offset Pagination مقابل Cursor Pagination

Offset pagination:

```text
GET ?page=20&limit=20
→ OFFSET 380 LIMIT 20
```

‏سهلة للـUI التي تعرض page numbers، لكن database قد تتخطى صفوفًا كثيرة مع pages المتأخرة. كما أن insert جديد قد يسبب duplicate/missing rows بين الصفحات.

Cursor pagination:

```text
GET ?limit=20&cursor=<last-item-marker>
```

‏cursor هي bookmark تحمل ⁦`createdAt`⁩ و⁦`id`⁩ لآخر item من الصفحة السابقة.

```text
Give me the next 20 movements after this exact movement.
```

‏مناسبة للـactivity feeds والحركة التاريخية الطويلة. لا تعطي page number بسهولة، لكنها أكثر ثباتًا وكفاءة في السير المتتابع.

## ‏5. ترتيب ثابت مهم للـCursor

‏نرتب:

```text
createdAt DESC, id DESC
```

‏⁦`id`⁩ تكسر التعادل إذا حدثت rows لها نفس ⁦`createdAt`⁩. بدون tie-breaker قد تتكرر row أو تضيع بين صفحات cursor.

## 6. N+1 Query Problem

‏المشكلة:

```text
read order items
for every item → query product
```

‏لو order فيها 20 item، تصبح 21 query تقريبًا.

‏في confirm order نقرأ products النهائية في batch واحدة بعد stock updates:

```text
one findMany({ id: { in: [...] } })
→ Map by productId
→ build stock changes
```

‏هذا يقلل database round trips ويحافظ على transaction أوضح.

## ‏7. Over-fetching وDTO Select

‏لا نطلب كل columns من database إذا response تحتاج جزءًا فقط.

‏Products repository تستخدم select مناسب لـresponse fields، ثم mapper تحول Decimal إلى number.

```text
database select
→ small safe shape
→ DTO mapper
→ HTTP JSON
```

‏هذا يقلل data transfer وmemory ويمنع تسريب fields بالخطأ.

## 8. Prisma Connection Pool

‏⁦`src/database/prisma.ts`⁩ ينشئ PrismaClient واحدة لكل Node.js process.

```text
one Node.js process
→ one PrismaClient
→ one database connection pool
```

‏إنشاء PrismaClient داخل كل request سيخلق pools كثيرة وقد يستهلك PostgreSQL connections بسرعة.

‏مع replicas:

```text
2 API replicas × pool لكل replica
= connections أكثر إلى PostgreSQL
```

‏عند scale كبير أو serverless، ندرس connection limits وPgBouncer. لا نضيفه قبل وجود دليل أن connections هي bottleneck.

## ‏9. Defaults للـProducts List

‏List endpoint يجب أن تملك defaults واضحة عندما client لا ترسل sorting:

```text
sortBy = id
sortOrder = asc
```

‏ثم نتحقق من query values بـZod ولا نمرر column name عشوائية إلى database.

## 10. Checklist

- ‏أضف index بناءً على query وEXPLAIN ANALYZE.
- ‏استخدم cursor للـfeeds الكبيرة المتتابعة، offset للـpage UI البسيطة.
- ‏اجعل ordering ثابتة.
- ‏ابحث عن N+1 في loops التي تعمل database queries.
- ‏اختر fields المطلوبة فقط.
- ‏PrismaClient واحدة لكل process.
- ‏راقب metrics قبل وبعد optimization.

## ‏11. طبّق قياس الأداء بنفسك

‏لا تضف index لأننا "نظن" أنها مفيدة. خذ query حقيقية، مثل movements لمنتج واحد:

```sql
EXPLAIN ANALYZE
SELECT id, product_id, delta, created_at
FROM "InventoryMovement"
WHERE product_id = 'PUT_PRODUCT_UUID_HERE'
ORDER BY created_at DESC, id DESC
LIMIT 20;
```

‏شغّلها من PostgreSQL client أو Prisma Studio/SQL tool متصل بقاعدة البيانات. قارن ⁦`actual time`⁩ ووجود ⁦`Index Scan`⁩ قبل وبعد index المناسبة. لا تنسخ index عشوائيًا: يجب أن تخدم ترتيب وفلترة query نفسها.

‏ثم جرّب cursor endpoint: اطلب ⁦`limit=2`⁩، خذ cursor من response، وأرسلها في الطلب التالي. قارن ذلك مع offset في table فيها بيانات كثيرة؛ cursor لا تجعل database تعد الصفوف التي قبل الصفحة في كل مرة.

‏وأخيرًا راقب metrics/logs قبل وبعد التعديل. إذا لم يتحسن زمن أو عدد queries، ارجع التغيير بدل إضافة تعقيد بلا فائدة.
