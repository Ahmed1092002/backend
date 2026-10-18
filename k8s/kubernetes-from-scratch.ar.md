# Kubernetes من الصفر في مشروع Mini ERP

هذا الدليل يشرح Kubernetes ببطء، وعلاقة الملفات الموجودة في هذا المجلد بمشروعنا الحالي.

## 1. ما هي Kubernetes؟

Kubernetes، أو اختصارًا `K8s`، هي منصة تدير containers بدل أن نديرها يدويًا.

Docker Compose تستطيع تشغيل containers. لكن عند الحاجة إلى عدة نسخ من التطبيق، health checks، replacement تلقائي، أو تحديث تدريجي بدون إيقاف كل النظام، نحتاج مديرًا أعلى.

Kubernetes تقول لها الحالة المطلوبة:

```text
أريد دائمًا نسختين من الـAPI.
```

وهي تحاول أن تجعل الواقع يطابق هذا الطلب:

```text
Pod تقع       → تشغّل بديلة.
Image تتغير   → تحدث الـPods تدريجيًا.
Pod ليست ready → لا ترسل لها traffic.
```

## 2. Cluster وNode

```text
Kubernetes Cluster
├── Node 1 = machine تشغّل containers/Pods
├── Node 2 = machine إضافية، اختيارية
└── Kubernetes control plane = يدير الحالة المطلوبة
```

في Docker Desktop، يمكن تشغيل cluster محلية على جهازك للتعلم. هذا ليس AWS أو Azure؛ هو Kubernetes تعمل محليًا.

Node واحدة تكفي حاليًا لتعلم Pods وDeployments وServices وrolling updates. نضيف Nodes لاحقًا عندما نريد فهم توزيع Pods على machines مختلفة.

## 3. كيف نفهم YAML في Kubernetes؟

كل YAML تعرّف **Resource** أو كائنًا يفهمه Kubernetes.

الشكل العام:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: mini-erp-api
spec:
  # الحالة التي نريد من Kubernetes الحفاظ عليها
```

| الحقل | المعنى |
| --- | --- |
| `apiVersion` | إصدار Kubernetes API الذي يعرف هذا النوع من الموارد. |
| `kind` | نوع الـResource، مثل Deployment أو Service. |
| `metadata` | الاسم، namespace، وlabels. |
| `spec` | الحالة المطلوبة وتفاصيل التشغيل. |

Kubernetes أسلوبها declarative:

```text
لا نقول: شغّل container واحدة الآن.
نقول: أريد دائمًا حالتي أن تحتوي Podين من هذه الـimage.
```

## 4. Pod

Pod هي أصغر وحدة تشغيل يديرها Kubernetes. في حالتنا غالبًا تحتوي API container واحدة:

```text
Pod
└── Node.js API container
```

لا ننشئ Pods يدويًا عادةً، لأن Pod وحدها لا تعرف كيف تعيد تشغيل نفسها أو تحافظ على العدد المطلوب. نستخدم Deployment فوقها.

## 5. Deployment

ملفنا [api-deployment.yaml](api-deployment.yaml) هو Deployment.

```yaml
kind: Deployment
spec:
  replicas: 2
```

معناه:

```text
Kubernetes، أريد دائمًا Podين من Mini ERP API.
```

```text
Deployment
├── Pod 1 → API container
└── Pod 2 → API container
```

إذا وقعت Pod:

```text
Pod 1 crashes
      ↓
Deployment ترى أن المتاح Pod واحدة فقط
      ↓
تنشئ Pod جديدة
      ↓
يعود العدد إلى 2
```

في Docker Compose كتبنا `api` و`api-2` يدويًا للتعلم. في Kubernetes نكتب فقط:

```yaml
replicas: 2
```

والـDeployment تنشئ أسماء Pods بنفسها، مثل:

```text
mini-erp-api-7cf86c7bdf-abc12
mini-erp-api-7cf86c7bdf-xyz89
```

## 6. Service في Kubernetes

Kubernetes `Service` ليست business service مثل Orders service.

Kubernetes Service هي عنوان شبكة ثابت لمجموعة Pods.

الـPods قد تموت أو تتغير IPs الخاصة بها:

```text
Pod 1 IP = 10.1.0.5
Pod 2 IP = 10.1.0.9
```

لذلك لا نربط أي تطبيق بهذه IPs. نعرّف [api-service.yaml](api-service.yaml):

```yaml
kind: Service
metadata:
  name: mini-erp-api
```

فيصبح لدينا عنوان ثابت:

```text
mini-erp-api
```

والـService توزّع traffic على الـPods الجاهزة:

```text
Other Pod
   ↓
mini-erp-api Service
   ├── API Pod 1
   └── API Pod 2
```

داخل cluster، الاسم الكامل يكون مثل:

```text
mini-erp-api.mini-erp.svc.cluster.local
```

## 7. Namespace

الـNamespace مثل مساحة منظمة أو folder منطقية داخل cluster.

ملف [namespace.yaml](namespace.yaml) ينشئ:

```text
mini-erp namespace
```

وبداخلها مواردنا:

```text
mini-erp
├── Deployment
├── Service
├── ConfigMap
└── Secret
```

لاحقًا يمكن وجود namespaces منفصلة:

```text
development
staging
production
```

## 8. ConfigMap وSecret

### ConfigMap

[api-configmap.yaml](api-configmap.yaml) يحتوي configuration عادية غير حساسة:

```yaml
data:
  MAIL_HOST: mailpit
  REDIS_URL: redis://redis:6379
  LOW_STOCK_THRESHOLD: "5"
```

يشبه `environment` في Docker Compose.

### Secret

Secrets للقيم الحساسة:

```text
DATABASE_URL
JWT_SECRET
```

[api-secret.example.yaml](api-secret.example.yaml) مجرد template. لا تطبقه بالقيم المكتوبة فيه، ولا تضع القيم الحقيقية في Git.

الطريقة:

```text
api-secret.example.yaml
        ↓ copy locally
api-secret.yaml
        ↓ put real local values
apply it, but do not commit it
```

## 9. Probes: Readiness وLiveness

لدينا endpointين في Express:

```text
GET /health       = Node.js process تعمل
GET /health/ready = Node.js process تعمل وPostgreSQL متصلة
```

### Readiness Probe

```yaml
readinessProbe:
  httpGet:
    path: /health/ready
```

معناها:

```text
هل هذه Pod جاهزة لاستقبال traffic؟
```

إذا PostgreSQL غير متصلة، `/health/ready` ترجع `503`. Kubernetes Service لا ترسل traffic إلى هذه الـPod حتى تصبح ready.

### Liveness Probe

```yaml
livenessProbe:
  httpGet:
    path: /health
```

معناها:

```text
هل Node.js process نفسها ما زالت حية؟
```

إذا فشلت عدة مرات، Kubernetes تعيد تشغيل الـPod.

الفرق:

```text
readiness = لا تستقبل traffic الآن.
liveness = process غالبًا عالقة، أعد تشغيلها.
```

لا نستخدم `/health/ready` كـliveness probe؛ database outage لا يعني بالضرورة أن Node.js process يجب قتلها.

## 10. Rolling Update

في Deployment كتبنا:

```yaml
strategy:
  type: RollingUpdate
  rollingUpdate:
    maxUnavailable: 0
    maxSurge: 1
```

عند وجود image جديدة و`replicas: 2`، الفكرة:

```text
old-1, old-2 running
        ↓
new-1 starts (surge +1)
        ↓
new-1 readiness succeeds
        ↓
old-1 gets SIGTERM and graceful shutdown
        ↓
new-2 starts and becomes ready
        ↓
old-2 shuts down
```

```text
maxUnavailable: 0
= لا نقلل عدد الـready replicas أثناء update.

maxSurge: 1
= نسمح Pod إضافية مؤقتًا حتى تبدأ الجديدة قبل إيقاف القديمة.
```

`terminationGracePeriodSeconds: 20` يعطي Node.js الوقت الذي تحتاجه graceful shutdown. التطبيق نفسه لديه timeout داخلي 10 ثوانٍ.

## 11. هل يجب أن يكون كل Resource في ملف وحده؟

لا. يمكن وضع كل الموارد في ملف واحد باستخدام `---`:

```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: mini-erp
---
apiVersion: v1
kind: ConfigMap
metadata:
  name: mini-erp-api-config
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: mini-erp-api
---
apiVersion: v1
kind: Service
metadata:
  name: mini-erp-api
```

`---` تعني نهاية YAML document وبداية Resource أخرى.

إذًا هذا صحيح أيضًا:

```text
ملف واحد فيه عدة resources
```

وقسمناها هنا إلى ملفات فقط للتنظيم:

```text
namespace.yaml          = مساحة المشروع
api-configmap.yaml      = configuration العادية
api-secret.example.yaml = template للـcredentials
api-deployment.yaml     = Pods/replicas/probes/update strategy
api-service.yaml        = network address والـload balancing الداخلي
```

هذا يشبه تقسيم classes إلى ملفات منفصلة: ليس ضروريًا تقنيًا، لكنه أسهل للقراءة والصيانة.

فصل Secret له سبب أمان مهم: لا نريد Secret حقيقية أن تختلط بملف deployment سهل رفعه إلى Git بالخطأ.

في مشروع صغير، ملف واحد مثل `k8s/mini-erp.yaml` طبيعي. وفي مشاريع كبيرة قد نرى:

```text
k8s/
├── base/
│   ├── deployment.yaml
│   ├── service.yaml
│   └── configmap.yaml
└── overlays/
    ├── development/
    ├── staging/
    └── production/
```

## 12. مقارنة سريعة مع Docker Compose

| Docker Compose | Kubernetes | المعنى |
| --- | --- | --- |
| `api` container | Pod | نسخة شغالة من الـAPI. |
| `api` و`api-2` | Deployment مع `replicas: 2` | مدير يحافظ على نسختين. |
| service name في Compose | Kubernetes Service DNS | عنوان ثابت بدل IP متغير. |
| `healthcheck` | readiness/liveness probes | جاهزية الـPod وصحة process. |
| manual rolling deploy | `RollingUpdate` | تحديث تدريجي يديره Kubernetes. |

## 13. قبل التطبيق فعليًا

وجود ملفات YAML لا يعني أن التطبيق جاهز للتشغيل داخل cluster. قبل التطبيق نحتاج:

1. cluster محلية، مثل Docker Desktop Kubernetes أو Kind/Minikube.
2. API image متاحة للـcluster أو في container registry.
3. PostgreSQL وRedis يمكن للـPods الوصول إليهما.
4. Secret حقيقية محلية غير محفوظة في Git.

حاليًا `kubectl` موجود على الجهاز، لكن لم يوجد current cluster context. لذلك لا يمكن تنفيذ `kubectl apply` أو اختبار manifests ضد cluster حتى تنتهي من إنشاء cluster.

## 14. الخلاصة

```text
YAML file ≠ service.

YAML file يحتوي Kubernetes resources.

Deployment = يدير Pods.
Pod = نسخة فعلية تعمل من الـAPI.
Service = عنوان شبكة ثابت للـPods.
ConfigMap = إعدادات عادية.
Secret = قيم حساسة.
Namespace = مساحة منظمة داخل cluster.
```

بعد تشغيل cluster، الخطوة التالية هي فحص context، ثم تجهيز PostgreSQL وRedis، ثم تطبيق الـAPI Deployment ومشاهدة الـPods والـrolling update عمليًا.
