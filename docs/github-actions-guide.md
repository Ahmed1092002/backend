# ‏GitHub Actions في Mini ERP

‏هذا الدليل يشرح ⁦`.github/workflows/ci.yml`⁩: متى يعمل، كيف يُقرأ، وماذا يفحص قبل قبول code جديد.

## ‏الفكرة

‏CI يمنع الاعتماد على الذاكرة: بدلاً من أن تتذكر تشغيل tests وTypeScript وDocker build قبل كل push، GitHub يشغّلها في جهاز Linux نظيف.

```text
push أو pull request
       |
       v
temporary Ubuntu runner
       |
       +--> check: install -> Prisma -> typecheck -> test
       |
       +--> docker: build image -> validate compose YAML
```

‏الـCI الحالي لا يعمل deployment ولا يتصل بـAWS/Azure. هو verification فقط.

## ‏1. مكان الملف والـtriggers

‏GitHub يقرأ workflow files من:

```text
.github/workflows/
```

‏بداية ملفنا:

```yaml
name: CI

on:
  push:
  pull_request:
```

- ‏⁦`name`⁩ الاسم الظاهر في GitHub UI.
- ‏⁦`on`⁩ متى workflow يشتغل.
- ‏⁦`push`⁩ يعني أي push لأي branch.
- ‏⁦`pull_request`⁩ يعني عند فتح أو تحديث PR.

## ‏2. Job مقابل Step

```yaml
jobs:
  check:
    runs-on: ubuntu-latest
  docker:
    runs-on: ubuntu-latest
```

‏Job مجموعة steps تعمل على runner واحد. ⁦`check`⁩ و⁦`docker`⁩ لا يعتمد أحدهما على الآخر، لذلك يعملان غالباً بالتوازي. كل job يبدأ من جهاز نظيف؛ لا يرى files أو ⁦`node_modules`⁩ التي أنشأها job آخر.

## ‏3. check job خطوة بخطوة

```yaml
env:
  DATABASE_URL: postgresql://erp_user:erp_password@localhost:5432/mini_erp?schema=public
  JWT_SECRET: ci-only-secret-not-for-production
```

‏هذه variables متاحة لكل steps داخل ⁦`check`⁩. الـtests حالياً لا تتصل بقاعدة فعلية، لكن Prisma/config يحتاجان ⁦`DATABASE_URL`⁩ شكله صحيح. هذه ليست production credentials.

### Checkout

```yaml
- name: Get the project code
  uses: actions/checkout@v4
```

‏الـrunner يبدأ فارغاً. ⁦`actions/checkout@v4`⁩ action جاهز من GitHub ينسخ repository والـcommit الحالي.

### Node.js

```yaml
- name: Set up Node.js
  uses: actions/setup-node@v4
  with:
    node-version: 22
    cache: npm
```

‏يثبت Node 22، نفس major version في Dockerfile. ⁦`cache: npm`⁩ يخزن downloaded packages لتسريع run القادم، لكن ⁦`npm ci`⁩ يظل يعمل installation نظيف.

### ‏Dependencies وPrisma

```yaml
- run: npm ci
- run: npx prisma generate
```

‏⁦`npm ci`⁩ يثبت versions بالضبط من ⁦`package-lock.json`⁩ ويفشل لو lockfile لا يطابق ⁦`package.json`⁩. Prisma Client generated code، لذلك يجب ⁦`prisma generate`⁩ قبل typecheck وtests.

### ‏Typecheck وtests

```yaml
- run: npm run typecheck
- run: npm test
```

‏نضع typecheck أولاً لأن error أسرع وأوضح لو TypeScript لا يمر، وبعده tests للسلوك المغطى حالياً.

## 4. docker job

```yaml
docker:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - uses: docker/setup-buildx-action@v2
    - run: docker build -t mini-erp-api .
    - run: docker compose config --quiet
```

### ‏لماذا checkout مرة ثانية؟

‏هذا job له runner جديد، لذلك لا يرى checkout الخاص بـ⁦`check`⁩.

### ‏ما هو Buildx؟

‏⁦`docker/setup-buildx-action@v2`⁩ يجهّز Docker Buildx، وهو Docker builder حديث. فائدته هنا environment ثابتة للـDocker build.

### ‏ماذا يتحقق ⁦`docker build`⁩؟

‏⁦`docker build -t mini-erp-api .`⁩ يقرأ Dockerfile وينفّذ layers وينشئ image محلية. لا يشغّل container ولا يرفع image إلى registry. يفشل لو Dockerfile أو ⁦`npm ci`⁩ أو Prisma generate به خطأ.

### ‏ماذا يتحقق Compose config؟

‏⁦`docker compose config --quiet`⁩ يقرأ ويوسّع ⁦`docker-compose.yml`⁩ ويتحقق من صحته. لا يشغّل PostgreSQL أو API؛ هو YAML/config validation فقط.

## ‏5. كيف ترى النتيجة؟

1. ‏اعمل commit وpush.
2. ‏افتح repository في GitHub.
3. ‏افتح **Actions** ثم workflow باسم **CI**.
4. ‏افتح run لرؤية jobs: ⁦`check`⁩ و⁦`docker`⁩.
5. ‏عند الفشل اقرأ أول error مفيد في الـlog.

‏العلامة الخضراء تعني أن checks الحالية نجحت، وليس أن كل feature اختُبرت أو أن التطبيق production-ready.

## ‏6. إضافة job مستقبلية

‏مثال lint بعد إضافة lint tool وscript حقيقي:

```yaml
lint:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
      with:
        node-version: 22
        cache: npm
    - run: npm ci
    - run: npm run lint
```

‏لا تضفها الآن إذا لا يوجد ⁦`npm run lint`⁩ حقيقي. الـCI يجب أن يشغّل commands تستطيع تشغيلها محلياً أيضاً.

## ‏7. CI مقابل CD

| المفهوم | وضع المشروع الآن |
| --- | --- |
| CI | يبني ويفحص code عند كل push/PR |
| CD | غير موجود الآن؛ لاحقاً يبني/push image وينشرها عند وجود cloud target |

‏قبل deployment نحتاج tests أوسع وGitHub Secrets وenvironment strategy وrollback plan. لا تضع AWS credentials أو production secrets داخل ⁦`ci.yml`⁩.

## 8. Troubleshooting

| المشكلة | السبب المعتاد | البداية الصحيحة |
| --- | --- | --- |
| `Cannot find module @prisma/client` | `prisma generate` لم يعمل | راجع ترتيب steps. |
| `npm ci` يفشل | lockfile لا يطابق package.json | شغّل `npm install` محلياً ثم commit للـlockfile المقصود. |
| Docker job فقط يفشل | Dockerfile أو `.dockerignore` مختلف | جرّب build محلياً. |
| workflow لا يعمل | path/indentation غلط | راجع `.github/workflows/ci.yml`. |

## ‏9. قاعدة عملية

‏جرّب أهم commands محلياً قبل push: ⁦`npm ci`⁩ ثم ⁦`npx prisma generate`⁩ ثم ⁦`npm run typecheck`⁩ ثم ⁦`npm test`⁩ ثم ⁦`docker build -t mini-erp-api .`⁩ ثم ⁦`docker compose config --quiet`⁩.

‏لو نجحت محلياً وفشلت في CI، قارن environment: Linux مقابل Windows، variables ناقصة، أو file لم يدخل Git.

## ‏كيف تقرأ workflow الموجودة فعلًا

```yaml
on:
  push:
  pull_request:
jobs:
  check:
    runs-on: ubuntu-latest
```

‏⁦`on`⁩ هو trigger: كل push وpull request تشغّل workflow. ⁦`check`⁩ اسم job، و⁦`ubuntu-latest`⁩ VM Linux نظيفة من GitHub وليست جهازك ولا server production.

```yaml
- uses: actions/checkout@v4
- uses: actions/setup-node@v4
  with:
    node-version: 22
    cache: npm
- run: npm ci
- run: npx prisma generate
- run: npm run typecheck
- run: npm test
```

‏⁦`checkout`⁩ تنزّل commit الحالية. ⁦`setup-node`⁩ تثبّت Node 22، و⁦`cache: npm`⁩ تسرّع download فقط. ⁦`npm ci`⁩ تثبّت ما في lockfile بالضبط. بعدها ⁦`prisma generate`⁩ تنتج Prisma Client التي يحتاجها TypeScript، ثم typecheck ثم tests. أي ⁦`run`⁩ تفشل توقف job؛ لا يكمل ما بعدها.

## ‏10. طبّق CI بنفسك

‏قبل push نفّذ بالترتيب نفسه الموجود في workflow:

```powershell
npm ci
npx prisma generate
npm run typecheck
npm test
docker build -t mini-erp-api .
docker compose config --quiet
```

‏ثم افتح ⁦`.github/workflows/ci.yml`⁩ واقرأه كبرنامج: ⁦`on`⁩ متى يبدأ، ⁦`jobs`⁩ أعمال مستقلة، ⁦`steps`⁩ أوامر متتابعة داخل job، و⁦`needs`⁩ يجعل job تنتظر أخرى. بعد push افتح تبويب **Actions** في GitHub: الأخضر يعني كل command نجح؛ الأحمر لا يعني أن GitHub غامضة، بل افتح step الفاشلة واقرأ command وoutput نفسه.
