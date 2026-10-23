# ‏Redis داخل Kubernetes

‏Redis في مشروعنا لا تستخدم كبديل لـPostgreSQL. لها ثلاث وظائف مختلفة:

```text
Cache             → تسريع product reads
BullMQ            → jobs وretries
Socket.IO adapter → تمرير realtime events بين API replicas
```

## ‏الكود ولماذا استخدمنا StatefulSet

```yaml
kind: StatefulSet
metadata:
  name: redis
spec:
  serviceName: redis-headless
  replicas: 1
```

‏نحتاج Redis واحدة فقط في هذا الـlab. ⁦`StatefulSet`⁩ تعطيها Pod اسمها ⁦`redis-0`⁩ وPVC ثابتة. هذا لا يجعلها highly available؛ إذا Redis-0 وقعت، Kubernetes تعيدها، لكن لا توجد replica أخرى تخدم مكانها.

## ‏persistence: ما معنى ⁦`appendonly yes`⁩؟

```yaml
args: ["redis-server", "--appendonly", "yes"]
volumeMounts:
  - name: redis-data
    mountPath: /data
```

- ‏⁦`args`⁩ تضاف إلى command الخاصة بـRedis image.
- ‏⁦`--appendonly yes`⁩ تفعّل AOF: Redis تسجل التغييرات في file بدل الاعتماد على memory فقط.
- ‏⁦`mountPath: /data`⁩ هو المكان الافتراضي الذي تكتب Redis فيه AOF file.
- ‏⁦`volumeClaimTemplates`⁩ تطلب PVC، لذلك container recreate لا تمسح هذا الملف.

‏هذا مفيد لـBullMQ jobs لأننا لا نريد أن تختفي queued jobs عند restart بسيطة. لكنه ليس backup ولا HA ولا ضمان أن Redis لا تفقد آخر writes عند crash شديد.

## ‏كيف تصل API إلى Redis؟

‏في ⁦`api-configmap.yaml`⁩:

```yaml
REDIS_URL: redis://redis:6379
```

‏أول ⁦`redis`⁩ هو service name داخل namespace ⁦`mini-erp`⁩، والثاني ⁦`6379`⁩ هو Redis port. API Pod لا ترى ⁦`localhost`⁩ كـRedis؛ localhost تعني API Pod نفسها.

## health checks

```yaml
readinessProbe:
  exec:
    command: ["redis-cli", "ping"]
```

‏Kubernetes تنفذ command داخل Redis container. ⁦`PONG`⁩ = Redis جاهزة. readiness تمنع اعتبار Pod جاهزة قبل ذلك، وliveness تطلب restart عند استمرار الفشل.

## ‏طبّقها بنفسك

```powershell
kubectl apply -f k8s/redis.yaml
kubectl get pods,pvc,service -n mini-erp -w
```

‏بعد أن تصبح ⁦`redis-0`⁩ بـ⁦`1/1 Running`⁩:

```powershell
kubectl exec -n mini-erp redis-0 -- redis-cli ping
```

‏المتوقع ⁦`PONG`⁩. بعدها Redis جاهزة، لكن لا نشغّل API بعد: الخطوة التالية migration Job حتى Prisma schema تتطبق في PostgreSQL.
