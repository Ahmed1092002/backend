# ‏شرح ⁦`api-deployment.yaml`⁩ سطرًا بسطر

‏الملف [api-deployment.yaml](api-deployment.yaml) لا يشغّل الـAPI مباشرة مثل ⁦`docker run`⁩. هو يطلب من Kubernetes أن تحافظ دائمًا على الحالة المطلوبة لتطبيق Mini ERP API.

```text
أنا أريد نسختين من الـAPI.
كل نسخة تشغّل image معيّنة.
لا تستقبل traffic قبل أن تصبح جاهزة.
وعند update، بدّل النسخ تدريجيًا.
```

‏هذا هو الملف مع شرح الأجزاء:

```yaml
apiVersion: apps/v1
kind: Deployment
```

‏⁦`apiVersion: apps/v1`⁩ هو إصدار Kubernetes API الذي يحتوي نوع ⁦`Deployment`⁩.

‏⁦`kind: Deployment`⁩ يقول إن هذا الـresource هو مدير Pods، وليس Pod واحدة أو Service شبكة.

```yaml
metadata:
  name: mini-erp-api
  namespace: mini-erp
```

‏⁦`metadata`⁩ هي هوية الـresource:

```text
name      = اسم الـDeployment: mini-erp-api
namespace = المساحة التي تعيش فيها: mini-erp
```

‏يمكننا لاحقًا طلبها هكذا:

```powershell
kubectl get deployment mini-erp-api -n mini-erp
```

## ‏1. ⁦`spec`⁩: الحالة المطلوبة

```yaml
spec:
  replicas: 2
```

‏هذا أهم طلب للـDeployment:

```text
احتفظ دائمًا بـPodين من الـAPI.
```

‏إذا كانت واحدة فقط تعمل، Kubernetes تنشئ الثانية. إذا Pod وقعت، Kubernetes تنشئ replacement حتى يعود العدد 2.

‏هذا بديل كتابة ⁦`api`⁩ و⁦`api-2`⁩ يدويًا في Docker Compose.

## ‏2. استراتيجية الـupdate

```yaml
strategy:
  type: RollingUpdate
  rollingUpdate:
    maxUnavailable: 0
    maxSurge: 1
```

‏⁦`RollingUpdate`⁩ تعني: لا توقف الـPods القديمة كلها ثم تشغّل الجديدة. حدّث واحدة تلو الأخرى.

```text
maxUnavailable: 0
```

‏يعني لا تسمح بانخفاض عدد الـPods الجاهزة أثناء update.

```text
لدينا 2 ready Pods
→ يجب أن يبقى لدينا 2 ready Pods على الأقل
```

```text
maxSurge: 1
```

‏يعني Kubernetes مسموح لها أن تشغّل Pod إضافية مؤقتًا أثناء التحديث.

‏مثال:

```text
Old Pod 1 + Old Pod 2       = 2 Pods
New Pod 1 starts            = 3 Pods مؤقتًا
New Pod 1 تصبح Ready
Old Pod 1 تدخل graceful shutdown = 2 Pods
```

## ‏3. Selector وLabels

```yaml
selector:
  matchLabels:
    app: mini-erp-api
```

‏هذا يقول للـDeployment:

```text
أنا أدير فقط الـPods التي تحمل label:
app = mini-erp-api
```

‏ثم نضع نفس label في قالب الـPod:

```yaml
template:
  metadata:
    labels:
      app: mini-erp-api
```

‏يجب أن تتطابق القيمتان:

```text
selector.matchLabels.app = mini-erp-api
template.metadata.labels.app = mini-erp-api
```

‏وService الخاصة بنا تستخدم نفس label:

```yaml
selector:
  app: mini-erp-api
```

‏إذًا الربط الكامل:

```text
Deployment → تدير Pods بـlabel mini-erp-api
Service    → ترسل traffic إلى Pods بـlabel mini-erp-api
```

## 4. Pod Template

‏كل شيء داخل:

```yaml
template:
  spec:
```

‏هو وصف للـPod التي سينشئها الـDeployment.

```yaml
terminationGracePeriodSeconds: 20
```

‏عند update أو scale down، Kubernetes ترسل ⁦`SIGTERM`⁩ للـPod ثم تنتظر حتى 20 ثانية قبل القتل بالقوة.

‏تطبيقنا يستخدم graceful shutdown وله timeout داخلي قدره 10 ثوانٍ، لذلك 20 ثانية وقت منطقي:

```text
Kubernetes SIGTERM
        ↓
Node.js graceful shutdown
        ↓
إغلاق requests وOutbox وSocket.IO وPrisma
        ↓
خروج قبل انتهاء 20 ثانية
```

## ‏5. Container نفسها

```yaml
containers:
  - name: api
    image: mini-erp-api:latest
```

‏⁦`containers`⁩ قائمة containers داخل الـPod. عندنا container واحدة اسمها ⁦`api`⁩.

```text
name  = اسم داخلي تستخدمه Kubernetes في logs وcommands.
image = Docker image التي ستشغّل Node.js API.
```

```yaml
imagePullPolicy: IfNotPresent
```

‏يعني:

```text
إذا image موجودة داخل الـNode، استخدمها.
إذا غير موجودة، حاول pull من registry.
```

‏هذا مناسب للتجربة المحلية. في production نستخدم image tagged version مثل:

```text
registry.example.com/mini-erp-api:1.4.0
```

‏ولا نعتمد على ⁦`latest`⁩، لأن version محددة تجعل rollback وتتبع الـdeployment أسهل.

## 6. Port

```yaml
ports:
  - name: http
    containerPort: 3000
```

‏هذا لا يفتح port للإنترنت. هو فقط يصف أن التطبيق يستمع داخل الـcontainer على ⁦`3000`⁩ ويسميه ⁦`http`⁩.

‏هذه التسمية تسمح لنا باستخدام الاسم في أكثر من مكان:

```yaml
port: http
targetPort: http
```

‏بدل تكرار الرقم ⁦`3000`⁩ في كل ملف.

## 7. Environment Variables

```yaml
envFrom:
  - configMapRef:
      name: mini-erp-api-config
  - secretRef:
      name: mini-erp-api-secrets
```

‏هذا يحمل values من موردين داخل Kubernetes ويضعها كـenvironment variables داخل Node.js:

```text
ConfigMap → CLIENT_ORIGIN, REDIS_URL, MAIL_HOST...
Secret    → DATABASE_URL, JWT_SECRET
```

‏مثل هذا في Docker Compose:

```yaml
environment:
  REDIS_URL: redis://redis:6379
  JWT_SECRET: ...
```

‏لكن الفصل يجعل القيم الحساسة منفصلة عن الإعدادات العادية.

## ‏8. اسم الـPod كـInstance Name

```yaml
- name: POD_NAME
  valueFrom:
    fieldRef:
      fieldPath: metadata.name
```

‏هذه Downward API. Kubernetes تأخذ اسم الـPod التي أنشأتها وتضعه في environment variable اسمها ⁦`POD_NAME`⁩.

‏مثال:

```text
POD_NAME=mini-erp-api-7cf86c7bdf-abc12
```

‏بعدها:

```yaml
- name: INSTANCE_NAME
  value: $(POD_NAME)
```

‏فتصبح القيمة التي يظهرها ⁦`/health`⁩:

```json
{
  "instance": "mini-erp-api-7cf86c7bdf-abc12"
}
```

‏هذا للتعلّم والـlogs فقط، وليس identity أمنية أو authorization.

## 9. Readiness Probe

```yaml
readinessProbe:
  httpGet:
    path: /health/ready
    port: http
  initialDelaySeconds: 10
  periodSeconds: 5
  timeoutSeconds: 3
  failureThreshold: 3
```

‏Kubernetes تعمل request إلى:

```text
http://Pod:3000/health/ready
```

‏الإعدادات:

| الإعداد | المعنى |
| --- | --- |
| `initialDelaySeconds: 10` | انتظر 10 ثوانٍ بعد startup قبل أول فحص. |
| `periodSeconds: 5` | افحص كل 5 ثوانٍ. |
| `timeoutSeconds: 3` | اعتبر الفحص فاشلًا إذا لم يرد خلال 3 ثوانٍ. |
| `failureThreshold: 3` | بعد 3 failures متتالية، اعتبر الـPod غير ready. |

‏عندما لا تكون Pod ready، Kubernetes Service لا ترسل لها traffic. Pod ليست مقتولة بالضرورة؛ فقط removed مؤقتًا من load balancing.

## 10. Liveness Probe

```yaml
livenessProbe:
  httpGet:
    path: /health
    port: http
  initialDelaySeconds: 20
  periodSeconds: 10
  timeoutSeconds: 3
  failureThreshold: 3
```

‏Liveness تسأل:

```text
هل Node.js process نفسها حية أم عالقة؟
```

‏لو فشلت 3 مرات متتالية، Kubernetes تعيد تشغيل container.

‏نستخدم ⁦`/health`⁩ وليس ⁦`/health/ready`⁩ هنا، لأن مشكلة PostgreSQL لا تعني بالضرورة أن Node.js يجب قتلها. الفرق:

```text
Readiness fails → لا نرسل traffic للـPod مؤقتًا.
Liveness fails  → أعد تشغيل الـcontainer.
```

## ‏11. الصورة الكاملة

```text
Deployment mini-erp-api
        ↓ manages
Pod 1                         Pod 2
└── Node.js API               └── Node.js API
        ↑                         ↑
        └──── Kubernetes Service ─┘
                 mini-erp-api

ConfigMap + Secret
        ↓ environment variables
Pods
```

## ‏12. ملاحظة قبل التطبيق

‏هذا manifest لا يعمل وحده الآن، لأنه يحتاج:

```text
1. Kubernetes cluster.
2. image mini-erp-api متاحة للـcluster.
3. PostgreSQL وRedis يمكن الوصول إليهما.
4. Secret حقيقية محلية.
```

‏بعد اكتمال إنشاء cluster، الخطوة العملية هي:

```powershell
kubectl config current-context
kubectl get nodes
```

‏ثم نضيف dependencies ونطبق الـresources بهدوء.

## ‏13. كيف نختبر الـDeployment وrolling update لاحقًا؟

‏بعد أن تكون API Pods جاهزة، لا نعمل restart عشوائيًا. غيّر image tag فقط ثم راقب controller:

```powershell
kubectl set image deployment/mini-erp-api api=mini-erp-api:NEW_TAG -n mini-erp
kubectl rollout status deployment/mini-erp-api -n mini-erp
kubectl get pods -n mini-erp -w
```

‏الـDeployment في هذا المشروع تضبط:

```yaml
maxUnavailable: 0
maxSurge: 1
```

‏فالمتوقع عمليًا:

```text
Pod قديمة Ready
→ Kubernetes تنشئ Pod جديدة
→ readinessProbe تنجح
→ Service تبدأ إرسال traffic للـPod الجديدة
→ Kubernetes تنهي Pod قديمة
→ تكرر حتى كل Pods على NEW_TAG
```

‏لو الـreadinessProbe فشلت، Kubernetes لا تعتبر Pod الجديدة جاهزة ولا تسحب القديمة بسبب ⁦`maxUnavailable: 0`⁩. هذا هو الجزء الذي كان يدويًا في Docker Compose وصار controller داخلي في Kubernetes.
