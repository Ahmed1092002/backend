# Microservices, Docker Compose, Networks, and API Gateway

‏هذا المستند يشرح كيف تنتقل من مشروعنا الحالي إلى نظام فيه services مستقلة، وكيف يستطيع الـAPI Gateway الوصول إليها حتى لو لم تكن داخل ملف Docker Compose واحد.

## ‏1. ما عندنا الآن: Modular Monolith

‏مشروعنا الحالي هو تطبيق واحد يحتوي modules مثل ⁦`orders`⁩ و⁦`products`⁩ و⁦`auth`⁩.

```text
Mini ERP API
├── Orders module
├── Products module
├── Users module
└── Auth module
```

‏كلها تعمل في نفس الـAPI process ونفس deployment. هذا يسمى **Modular Monolith**، وهو اختيار جيد جدًا في هذه المرحلة.

‏وجود كل شيء داخل ⁦`docker-compose.yml`⁩ واحد في التطوير المحلي طبيعي ومفيد:

```text
Nginx + API + PostgreSQL + Redis + Worker + Monitoring
```

‏نشغله كله بأمر واحد:

```powershell
docker compose up -d --build
```

## ‏2. ما هي Microservice فعليًا؟

‏الـmicroservice ليست مجرد folder منقول إلى container. لكي تكون service مستقلة بشكل صحي، يجب أن يكون لها:

- ‏مسؤولية business واضحة، مثل Orders أو Inventory أو Notifications.
- ‏كود وتشغيل وdeploy مستقلون.
- ‏القدرة على عمل scaling مستقل.
- ‏ownership واضح للبيانات التي تملكها.
- ‏API أو events للتواصل بدل قراءة جداول service أخرى مباشرة.

‏مثال مستقبلي:

```text
orders-service        مسؤول عن orders
inventory-service     مسؤول عن stock
notifications-service مسؤول عن email and notifications
```

## ‏3. API-2 ليست Microservice جديدة

‏إذا شغّلنا نسختين من نفس الـAPI:

```text
api-1
api-2
```

‏فهما ليسا خدمتين مختلفتين. هما **replicas** من نفس الخدمة والكود والصورة Docker image.

```text
Nginx
 ├── api-1  (same API image)
 └── api-2  (same API image)
```

‏نزيد replicas عندما نحتاج requests أكثر، وليس لأننا أنشأنا business service جديدة.

## ‏4. ما دور Nginx / API Gateway؟

‏الـGateway هو الباب الذي يدخله الـfrontend أو العميل إلى النظام.

```text
Client
  ↓
API Gateway / Nginx
  ├── Orders API
  ├── Products API
  └── Users API
```

‏لا يكتب الـGateway business logic مثل إنشاء order أو خصم stock. مسؤولياته الشائعة:

- ‏توجيه الـrequest إلى service صحيحة حسب path.
- ‏Load balancing بين replicas من نفس الخدمة.
- ‏HTTPS/TLS وCORS وrate limits.
- ‏request IDs وlogs.
- ‏أحيانًا التحقق المبدئي من authentication.

‏مثال Nginx بعد فصل خدمات مستقبلًا:

```nginx
upstream orders_api {
  server orders-api-1:3000;
  server orders-api-2:3000;
}

upstream products_api {
  server products-api:3000;
}

server {
  listen 80;

  location /api/orders/ {
    proxy_pass http://orders_api/;
  }

  location /api/products/ {
    proxy_pass http://products_api/;
  }
}
```

‏لا نحتاج Nginx خاصًا داخل كل service. عادة يوجد Gateway واحد أمام عدة services.

## ‏5. هل كل Service تحتاج Docker Compose خاصًا بها؟

‏ليس بالضرورة. الاختيار يتغير حسب البيئة وحجم الفريق.

### Local development

‏ملف Compose واحد هو أسهل طريقة لتشغيل النظام كله محليًا.

```text
docker-compose.yml
  ├── gateway
  ├── orders API
  ├── products API
  ├── database
  ├── redis
  └── rabbitmq
```

### Small production / VPS

‏يمكن أن تملك كل service repository وCompose خاصين بها، مع Compose منفصل للـinfrastructure أو للـGateway.

```text
repositories/
├── gateway-infrastructure/
├── orders-service/
├── products-service/
└── notifications-service/
```

### Kubernetes / Cloud

‏غالبًا لن تستخدم Docker Compose لتشغيل production. ستستخدم Kubernetes manifests أو Helm أو منصة cloud. الفكرة نفسها تبقى موجودة: container لكل service، شبكة داخلية، وGateway/Ingress أمامها.

## ‏6. كيف تتواصل Compose files مختلفة على نفس server؟

‏ملف Compose ليس ما يجعل الخدمات تتصل. الذي يسمح بالتواصل هو **network**.

‏يمكن إنشاء Docker network مشتركة مرة واحدة:

```powershell
docker network create platform-network
```

‏ثم يضيف كل Compose هذه الشبكة كشبكة خارجية موجودة بالفعل:

```yaml
networks:
  platform:
    external: true
    name: platform-network
```

### Gateway Compose

```yaml
services:
  gateway:
    image: nginx:alpine
    ports:
      - "80:80"
    networks:
      - platform

networks:
  platform:
    external: true
    name: platform-network
```

### Orders Compose

```yaml
services:
  orders-api:
    build: .
    expose:
      - "3000"
    networks:
      - platform

networks:
  platform:
    external: true
    name: platform-network
```

‏الآن الـGateway يستطيع توجيه traffic إلى:

```nginx
proxy_pass http://orders-api:3000;
```

‏لأن ⁦`orders-api`⁩ اسم ظاهر داخل نفس Docker network.

> ‏لا نستخدم ⁦`localhost`⁩ داخل container للوصول إلى container آخر. ⁦`localhost`⁩ يعني نفس الـcontainer فقط.

## ‏7. إذا كانت الخدمات على Servers مختلفة

‏Docker network المحلية لا تعمل بين servers مختلفة. نحتاج:

```text
Gateway server
   ↓ private network / VPC
Orders server       → orders.internal.company
Products server     → products.internal.company
```

‏وقتها إعداد الـGateway يستخدم DNS داخلي ثابت:

```nginx
proxy_pass http://orders.internal.company:3000;
```

‏لا نعتمد على IP ثابت لأن IP قد يتغير. DNS أو service discovery هو العنوان المستقر.

## ‏8. ماذا يقدّم Kubernetes هنا؟

‏Kubernetes لا يحتاج أن تكون لديك microservices كي تستخدمه. يمكنه تشغيل تطبيقنا الحالي كـAPI واحدة مع عدة replicas.

‏عندما توجد microservices، Kubernetes يوفّر لكل service عنوانًا داخليًا وDNS تلقائيًا:

```text
orders-api.default.svc.cluster.local
products-api.default.svc.cluster.local
```

‏ويقوم أيضًا بـ:

- ‏تشغيل عدد replicas المطلوب.
- ‏استبدال container/POD وقع أو فشل.
- health checks.
- rolling deployments.
- internal service discovery.

‏كلمة ⁦`Service`⁩ في Kubernetes تعني عنوان شبكة ثابت لمجموعة Pods، وليست بالضرورة business microservice.

```text
Orders business service
  └── Kubernetes Service named orders-api
       └── routes to Orders Pods
```

## ‏9. البيانات وShared Infrastructure

‏ليس من الصحي أن تقرأ كل service جداول الخدمات الأخرى مباشرة.

```text
Orders service      owns orders data
Inventory service   owns stock data
Users service       owns users data
```

‏عندما يؤكد Orders service طلبًا، يمكنه نشر event:

```text
OrderConfirmed
```

‏ثم Inventory service يستهلكه ويحدّث stock الذي يملكه.

```text
Orders DB
  ↓ Outbox
Outbox Publisher
  ↓
RabbitMQ
  ├── Inventory consumer
  └── Notifications consumer
```

‏RabbitMQ يحتفظ بالرسالة داخل queue. الـconsumer/worker الخاص بالخدمة هو الذي يسحب الرسالة ويعالجها.

‏الـinfrastructure الآتية غالبًا تكون مشتركة أو managed، وليست نسخة داخل كل service:

- RabbitMQ
- ‏Redis (حسب الاستخدام)
- Prometheus
- Grafana
- Alertmanager

‏أما PostgreSQL، فالهدف المعماري الأفضل أن تملك كل service بياناتها، وليس أن تقرأ كل services نفس الجداول. التطبيق التدريجي قد يبدأ بقاعدة واحدة مع ownership واضح ثم يتطور لاحقًا.

## ‏10. Migrate وSeed

‏⁦`migrate`⁩ و⁦`seed`⁩ ليسا services تعمل باستمرار:

```text
migrate = job يعمل migration ثم ينتهي
seed    = job اختياري لبيانات demo/development ثم ينتهي
```

‏في production غالبًا نشغّل migration controlled مع deployment. أما seed فلا نشغّله عادة لأنه يضيف بيانات تدريبية.

## ‏11. الخلاصة

```text
Compose = أداة لتشغيل containers، وليست الطريقة الوحيدة لاكتشاف الخدمات.

Gateway = يحتاج عنوان شبكة ثابت للخدمة.

Same Compose file      → service name مثل orders-api.
Different Compose files on one server → external Docker network.
Different servers      → private network + internal DNS.
Kubernetes             → Kubernetes Service + internal DNS.
```

‏المسار التعليمي للمشروع:

```text
Modular Monolith
→ multiple API replicas + Nginx load balancing
→ sticky sessions for Socket.IO
→ RabbitMQ/event-driven communication
→ extract one small service as a real experiment
→ Kubernetes after understanding the underlying problems
```

## ‏تجربة ذهنية قبل استخراج service

‏لا تبدأ بنقل folder إلى container وتسميته microservice. خذ module مثل notifications واسأل بالترتيب:

```text
1. ما data التي تملكها وحدها؟
2. ما API أو event contract الذي تحتاجه باقي الخدمات؟
3. هل ستملك database/schema خاصًا بها؟
4. كيف تتعامل مع retry، duplicate event، ووقت توقفها؟
5. كيف تنشرها وتراقبها وتعمل لها rollback مستقلة؟
```

‏إذا الإجابات ما زالت "ستقرأ نفس tables مباشرة" و"سأناديها HTTP من كل مكان"، فابقَ Modular Monolith. ابدأ extraction صغيرة مثل email/notification consumer عبر event؛ لا تبدأ Orders أو Auth لأنهما يملكان business consistency حساسة.
