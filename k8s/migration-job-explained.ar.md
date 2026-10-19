# Prisma Migration Job داخل Kubernetes

قبل أن API تعمل، PostgreSQL تحتاج tables مثل `Product` و`User` و`Order`. Prisma migrations هي الملفات التي تنشئ أو تعدّل هذه tables.

لا نضع migration داخل كل API Pod عند startup. عندنا API replicas = 2؛ لو كل واحدة نفذت migration، قد تتسابقان على تعديل database. لذلك نشغّل Job منفصلة مرة واحدة.

## الفرق بين Job وDeployment

```text
Deployment: "أريد API تظل شغالة دائمًا بعدد 2 Pods."
Job:        "نفّذ command مرة واحدة، وإذا نجحت انتهِ."
```

لذلك YAML تبدأ هكذا:

```yaml
apiVersion: batch/v1
kind: Job
metadata:
  name: mini-erp-migrate
```

`batch/v1` هو API group الخاصة بالـJobs. الاسم ثابت، لذلك لا يمكن تطبيق Job ناجحة بنفس الاسم مرة ثانية؛ لكل release لاحقًا نستخدم name جديدة أو نحذف Job القديمة بعد مراجعة النتيجة.

## ما الذي يشغله الـJob؟

```yaml
containers:
  - name: migrate
    image: mini-erp-api:latest
    command: ["npx", "prisma", "migrate", "deploy"]
```

- نستخدم **نفس image الخاصة بالـAPI** لأن فيها project code و`prisma/schema.prisma` وmigrations وPrisma Client.
- `command` تستبدل `CMD` الافتراضية في Dockerfile. بدل `npm run dev:server`، container تنفذ `npx prisma migrate deploy`.
- `migrate deploy` تطبق migrations الموجودة بالفعل في Git. لا تنشئ migration جديدة؛ `prisma migrate dev` هو الذي نستخدمه محليًا أثناء تطوير schema.

## لماذا `DATABASE_URL` فقط؟

```yaml
env:
  - name: DATABASE_URL
    valueFrom:
      secretKeyRef:
        name: mini-erp-api-secrets
        key: DATABASE_URL
```

Prisma تحتاج فقط database connection هنا. Kubernetes تقرأ القيمة من Secret وتضعها داخل Job container. يجب أن تحتوي على host `postgres`، لأن هذا اسم Service داخل namespace:

```text
postgresql://erp_user:PASSWORD@postgres:5432/mini_erp?schema=public
```

## ماذا لو فشلت؟

```yaml
restartPolicy: OnFailure
backoffLimit: 3
```

- لو command خرجت بخطأ، Kubernetes تعيد تشغيل Pod الخاصة بالـJob.
- `backoffLimit: 3` تحد المحاولات؛ بعدها Job تصبح `Failed` بدل retry للأبد.
- لو schema/migration خاطئة، لا "نجرّب ونأمل". نقرأ logs، نصلح migration، ثم ننشئ Job جديدة.

```yaml
ttlSecondsAfterFinished: 3600
```

يبقي Job وPod لمدة ساعة بعد النجاح لتقرأ logs، ثم Kubernetes تنظفها. لا يمسح migration من database.

## طبّقها بنفسك

بعد أن PostgreSQL هي `Running` وSecret API الحقيقية موجودة:

```powershell
kubectl apply -f k8s/migration-job.yaml
kubectl get jobs,pods -n mini-erp -w
kubectl logs job/mini-erp-migrate -n mini-erp
```

علامة النجاح:

```text
job/mini-erp-migrate   1/1   Complete
```

لو Job موجودة من تجربة قديمة، لا تعمل `apply` وتتوقع إعادة تشغيلها. احذف **Job هذه فقط** بعد قراءة logs، ثم طبقها مرة أخرى:

```powershell
kubectl delete job mini-erp-migrate -n mini-erp
kubectl apply -f k8s/migration-job.yaml
```

بعد `Complete` ننتقل إلى API Deployment؛ قبل ذلك لا.
