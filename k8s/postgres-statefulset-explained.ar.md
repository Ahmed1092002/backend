# PostgreSQL داخل Kubernetes: StatefulSet وPVC

هذه أول database داخل cluster. لا نستخدم `Deployment` هنا لأن PostgreSQL لا تشبه API stateless.

```text
API Pod
  → Service اسمها postgres
  → PostgreSQL Pod اسمها postgres-0
  → PVC اسمها postgres-data-postgres-0
  → disk يحتفظ بالبيانات
```

## لماذا `StatefulSet`؟

في `postgres.yaml`:

```yaml
kind: StatefulSet
metadata:
  name: postgres
spec:
  serviceName: postgres-headless
  replicas: 1
```

- `StatefulSet` يدير Pods لها identity ثابتة. أول Pod اسمها دائمًا `postgres-0` بدل اسم عشوائي.
- `serviceName` تشير إلى headless Service؛ هذه تعطي DNS ثابتة للـStatefulSet.
- `replicas: 1` لأننا لم نبنِ PostgreSQL replication أو failover. لا ترفعها إلى 2؛ هذا لا يصنع HA database بل يخلق data corruption risk.

## كيف تبقى البيانات بعد إعادة تشغيل Pod؟

```yaml
volumeClaimTemplates:
  - metadata:
      name: postgres-data
    spec:
      accessModes: ["ReadWriteOnce"]
      resources:
        requests:
          storage: 1Gi
```

Kubernetes تنشئ PVC باسم قريب من `postgres-data-postgres-0`. الـPVC تطلب disk من storage class في Docker Desktop. ثم هذا الجزء يربطها داخل PostgreSQL:

```yaml
volumeMounts:
  - name: postgres-data
    mountPath: /var/lib/postgresql/data
```

`mountPath` هو المكان الذي تخزن PostgreSQL فيه files. لو Pod ماتت وأعاد StatefulSet إنشاء `postgres-0`، تربط نفس PVC فتجد نفس data.

## لماذا Service عادية وHeadless Service؟

لدينا خدمتان:

```yaml
postgres-headless: clusterIP: None
postgres:          port 5432 → targetPort postgres
```

الـheadless جزء من identity الخاصة بـStatefulSet. الـService العادية `postgres` هي العنوان الأبسط الذي تستعمله API:

```text
postgresql://erp_user:PASSWORD@postgres:5432/mini_erp?schema=public
```

لا نستعمل Pod IP لأنها تتغير. لا نستعمل `localhost` لأنها داخل API Pod تعني API نفسها.

## Secret وenv

```yaml
valueFrom:
  secretKeyRef:
    name: mini-erp-postgres-secrets
    key: POSTGRES_PASSWORD
```

Kubernetes تقرأ password من Secret وتضعها environment variable داخل PostgreSQL container. نبدأ من `postgres-secret.example.yaml`، ننسخه إلى `postgres-secret.yaml` محليًا ونستبدل placeholder. الملف الحقيقي لا يدخل Git.

## Probes

```yaml
readinessProbe:
  exec:
    command: ["sh", "-c", "pg_isready -U $POSTGRES_USER -d $POSTGRES_DB"]
```

`pg_isready` تسأل PostgreSQL هل تقبل connections. readiness تجعل Pod غير جاهزة للـService حتى تجيب database. liveness تعمل فحصًا دوريًا؛ لو بقيت تفشل، Kubernetes تعيد تشغيل container.

## نفّذها بنفسك

```powershell
# 1. اصنع secret محلية (لا تعمل apply للـexample كما هي)
Copy-Item k8s/postgres-secret.example.yaml k8s/postgres-secret.yaml
# عدّل password يدويًا، ثم:
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/postgres-secret.yaml
kubectl apply -f k8s/postgres.yaml

# 2. راقب الموارد
kubectl get pods,pvc,service -n mini-erp -w

# 3. عندما تصبح postgres-0 Running/Ready
kubectl logs statefulset/postgres -n mini-erp
```

علامة النجاح: Pod `postgres-0` تكون `1/1 Running` وPVC تكون `Bound`. لا نطبّق API بعد؛ الخطوة التالية Redis ثم migration job.
