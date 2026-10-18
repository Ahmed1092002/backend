# Mini ERP on Kubernetes: First API Deployment

لشرح Kubernetes من الصفر والـsyntax بالتفصيل، اقرأ أيضًا [kubernetes-from-scratch.ar.md](kubernetes-from-scratch.ar.md). ولشرح ملف الـDeployment سطرًا بسطر، اقرأ [deployment-explained.ar.md](deployment-explained.ar.md). هذا الملف يركز على تشغيل manifests الموجودة هنا.

هذه الملفات هي أول ترجمة لما بنيناه في Docker Compose إلى Kubernetes. لا تطبقها الآن قبل توفر Kubernetes cluster وPostgreSQL وRedis يمكن للـPods الوصول إليهما.

## 1. ترجمة المصطلحات من Compose إلى Kubernetes

| Docker Compose | Kubernetes | المعنى |
| --- | --- | --- |
| `api` container | Pod | نسخة شغالة من الـAPI. |
| `api` + `api-2` | Deployment with `replicas: 2` | Kubernetes تنشئ وتحافظ على نسختين بدل كتابة service ثانية يدويًا. |
| اسم service في Compose | Kubernetes Service DNS | عنوان داخلي ثابت بدل IP الـPod المتغير. |
| `healthcheck` | readiness/liveness probes | يعرف Kubernetes هل الـPod تستقبل traffic وهل تحتاج restart. |
| manual rolling deploy | `strategy: RollingUpdate` | Kubernetes تحدث الـPods تدريجيًا. |

```text
Deployment: mini-erp-api
    ↓ creates and keeps
Pod api-abc123       Pod api-def456
    ↓                    ↓
Kubernetes Service: mini-erp-api
    ↓
mini-erp-api.mini-erp.svc.cluster.local
```

## 2. الملفات

```text
namespace.yaml          مساحة معزولة باسم mini-erp
api-configmap.yaml      إعدادات غير حساسة
api-secret.example.yaml مثال فقط للـcredentials
api-deployment.yaml     API replicas + probes + rolling update
api-service.yaml        عنوان داخلي ثابت للـAPI
```

## 3. لماذا يوجد Deployment وليس api وapi-2؟

في Compose كتبنا service ثانية يدويًا للتعلم:

```text
api
api-2
```

في Kubernetes نكتب المطلوب فقط:

```yaml
replicas: 2
```

والـDeployment تفعل الباقي:

```text
إذا Pod وقعت → تنشئ Pod بديلة.
إذا عدلت image → تبدأ RollingUpdate.
إذا طلبت 3 replicas → تنشئ الثالثة.
```

## 4. Readiness وLiveness

لدينا endpointين من التطبيق:

```text
/health       → التطبيق process تعمل
/health/ready → التطبيق + PostgreSQL جاهزان
```

لذلك:

```text
readinessProbe = /health/ready
```

طالما readiness تفشل، Kubernetes Service لا ترسل traffic إلى هذه الـPod.

```text
livenessProbe = /health
```

لو liveness تفشل عدة مرات، Kubernetes تفترض أن process غير سليمة وتعيد تشغيل الـPod.

لا نستخدم `/health/ready` كـliveness probe لأن database outage لا يعني بالضرورة أن Node process نفسها يجب قتلها وإعادة تشغيلها.

## 5. Rolling Update

```yaml
strategy:
  type: RollingUpdate
  rollingUpdate:
    maxUnavailable: 0
    maxSurge: 1
```

عند image جديدة ومع `replicas: 2`:

```text
old-1, old-2 running
        ↓
new-1 starts (surge +1)
        ↓
new-1 readiness succeeds
        ↓
old-1 receives SIGTERM and graceful shutdown
        ↓
new-2 starts and becomes ready
        ↓
old-2 shuts down
```

`maxUnavailable: 0` يعني لا نريد تقليل الـready replicas أثناء update. `maxSurge: 1` يسمح بPod إضافية مؤقتًا كي نبدأ الجديدة قبل إيقاف القديمة.

`terminationGracePeriodSeconds: 20` يعطي graceful shutdown في Node.js وقتًا كافيًا؛ التطبيق يفرض timeout داخليًا قدره 10 ثوانٍ.

## 6. Secret وConfigMap

```text
ConfigMap = قيم عادية مثل Redis URL وmail host.
Secret    = DATABASE_URL وJWT_SECRET.
```

لا تطبق `api-secret.example.yaml` كما هو. انسخه إلى `api-secret.yaml`، ضع قيمك الحقيقية، وأضف الاسم إلى `.gitignore`.

## 7. متطلبات قبل التطبيق

أمر `kubectl config current-context` عندنا الآن أعاد خطأ، وهذا يعني أنه لا يوجد cluster مفعّل بعد.

قبل تطبيق الـAPI نحتاج:

1. Kubernetes محلية، مثل Docker Desktop Kubernetes أو Kind/Minikube.
2. image `mini-erp-api:latest` متاحة للـcluster، أو image في registry.
3. PostgreSQL وRedis بأسماء يمكن للـPods الوصول إليها، أو تعديل `DATABASE_URL` و`REDIS_URL` لخدمات managed خارجية.
4. Secret حقيقية محلية غير محفوظة في Git.

## 8. أوامر التطبيق لاحقًا

بعد تجهيز المتطلبات:

```powershell
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/api-configmap.yaml
kubectl apply -f k8s/api-secret.yaml
kubectl apply -f k8s/api-deployment.yaml
kubectl apply -f k8s/api-service.yaml
```

ثم راقب:

```powershell
kubectl get pods -n mini-erp
kubectl get service -n mini-erp
kubectl rollout status deployment/mini-erp-api -n mini-erp
```

## 9. حدود هذه الخطوة

لم نضف هنا بعد:

- PostgreSQL وRedis manifests.
- Worker deployment.
- Ingress/API Gateway.
- RabbitMQ.
- persistent volumes.
- image registry أو CI/CD deployment.

هذه خطوة مقصودة: نفهم API Deployment وService وprobes وrolling update قبل توسيع النظام.
