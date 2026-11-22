# دليل النشر على الإنترنت

هذا الدليل يشرح كيفية تشغيل المنصة على استضافة حقيقية بحيث يستخدمها أي شخص من أي جهاز، دون الحاجة لإبقاء جهازك مفتوحاً.

---

## قبل أن تبدأ: ما تحتاجه المنصة

| المتطلب | السبب |
|---|---|
| **تخزين دائم أو قاعدة سحابية** | إما قرص دائم (Volume) تحفظ عليه قاعدة البيانات والملفات، أو قاعدة Turso سحابية مجانية تحفظ البيانات والملفات بدلاً من القرص. |
| **عملية Node دائمة التشغيل** | المنصة تستخدم SSE للإشعارات الفورية، ولا تعمل على Serverless مثل Vercel/Netlify. |
| **HTTPS** | في وضع الإنتاج يتم ضبط الكوكي `secure`، لذا لن يعمل تسجيل الدخول بدون HTTPS. |
| **نسخة واحدة فقط (Replica = 1)** | SQLite لا يدعم تعدد النسخ المتزامنة. |

> الحد الأدنى: Node.js 24+ إن كنت ستشغّل بدون Docker، أو Docker إن كنت ستستخدم الصورة الجاهزة.

---

## الخيار المجاني تماماً — Abasthan + Turso (بدون بطاقة بنكية) ✅

هذا هو الحل الموصى به لو تريد استضافة **مجانية فعلاً بدون أي بطاقة**. البيانات والملفات تُحفظ في قاعدة سحابية مجانية، لذلك لا تحتاج قرصاً دائماً.

| الجزء | الدور | المجانية |
|---|---|---|
| **GitHub** | حفظ الكود وتشغيل مهمة الإيقاظ | مجاني، بدون بطاقة |
| **Abasthan** | تشغيل الموقع + HTTPS + رابط مجاني `*.abasthan.app` | أول تطبيق مجاني بشكل دائم، بدون بطاقة |
| **Turso** | قاعدة البيانات والملفات المرفوعة | 5 جيجا + 500 مليون قراءة/شهر، بدون بطاقة |

> Abasthan يشغّل Node 22 مباشرةً، ويدعم المتغيرات السرية وHTTPS. لو ظهر في أي خطوة طلب بطاقة، قف فوراً ولا تُكمل — المفروض ما بيحصلش.

### 1) أنشئ حساب GitHub
افتح <https://github.com/signup> وسجّل بالبريد الإلكتروني. مجاني تماماً وبدون بطاقة.

### 2) أنشئ قاعدة بيانات Turso مجانية
1. افتح <https://app.turso.tech/signup> وسجّل بحساب GitHub.
2. أنشئ قاعدة بيانات جديدة على الخطة **Free**.
3. في المنطقة (Region) اختر **`fra` (Frankfurt)** — أقرب منطقة لمصر. لو مش موجودة اختار `ams` (Amsterdam).
4. انسخ من لوحة التحكم:
   - `TURSO_DATABASE_URL` — يبدأ بـ `libsql://...`
   - `TURSO_AUTH_TOKEN` — رمز الوصول (اعمل **Create token** إن لم يظهر).

### 3) ارفع الكود إلى GitHub
أنشئ مستودعاً جديداً (Repository) وارفع محتويات هذا المجلد إليه. ملف `.gitignore` يستبعد تلقائياً `node_modules` و`data` و`uploads` و`.env`. تأكد أن `package.json` و`render.yaml` ظهروا في **أول صفحة** للمستودع، مش داخل مجلد إضافي.

### 4) أنشئ الموقع على Abasthan
1. افتح <https://dashboard.abasthan.com> وسجّل بحساب GitHub.
2. **+ Create App → Web Service**.
3. اختر GitHub، ثم المستودع والـ branch الذي رفعت عليه الكود.
4. اضبط:
   - **App Language & Version:** `Node.js 22`
   - **Build Command:** `npm ci && npm run build`
   - **Start Command:** `npm start`
   - **Instance / Plan:** `Free`
5. في تبويب **Environment Variables** أضف:

| الاسم | القيمة |
|---|---|
| `NODE_ENV` | `production` |
| `TURSO_DATABASE_URL` | الرابط الذي نسخته من Turso |
| `TURSO_AUTH_TOKEN` | الرمز الذي نسخته من Turso |
| `DEVELOPER_PASSWORD` | كلمة مرور قوية تختارها أنت |
| `APP_SECRET` | القيمة الموجودة في ملف `elmanasa-deploy-values.txt` الذي أنشأناه لك |
| `MAX_FILE_MB` | `10` |
| `ALLOWED_ORIGINS` | اتركها فاضية |

6. اضغط **Deploy Web Service** وانتظر حتى يظهر الرابط.

### 5) متغير الرابط (اختياري لكن مفيد)
في مستودع GitHub: **Settings → Secrets and variables → Actions → Variables → New repository variable**
- الاسم: `APP_URL`
- القيمة: رابط الموقع الذي أعطاك إياه Abasthan مثل `https://elmanasa.abasthan.app`

ملف `keep-alive.yml` يفتح `/api/health` كل 10 دقائق، فيبقى الموقع مستيقظاً حتى لو الاستضافة أوقفت الخدمة بعد خمول.

### 6) أول دخول
افتح الرابط، ثم سجّل الدخول بـ:
- اسم المستخدم: `developer`
- كلمة المرور: التي وضعتها في `DEVELOPER_PASSWORD`

> لا تغيّر `APP_SECRET` بعد إنشاء الحسابات، وإلا تصبح الأرقام القومية المشفرة غير مقروءة. احتفظ بنسخة منه في مكان آمن.

### النسخ الاحتياطي على Turso
```bash
turso db dump elmanasa > backup.sql
```
احتفظ بالنسخة في مكان آمن. الملفات المرفوعة محفوظة داخل قاعدة البيانات نفسها (جدول `assets`).

### ملاحظات مهمة
- تعمل نسخة واحدة فقط من الموقع، لأن قاعدة البيانات لا تدعم كتابات متزامنة متعددة.
- حد الملف المرفوع في هذه النسخة 10 ميجابايت (`MAX_FILE_MB`) لأنه يُخزّن داخل قاعدة البيانات.
- بعض الاستضافات الأخرى مثل Render قد تطلب بطاقة في بعض الحالات؛ لذلك اعتمدنا Abasthan هنا لأنه لا يطلبها للتطبيق المجاني الأول.
- إذا أردت يوماً استضافة مدفوعة أقوى، انقل قاعدة البيانات إلى قرص دائم باتباع الخيار 2 أو 3 أدناه.

---


## الخيار 1 — Railway (الأسهل والموصى به)

Railway يوفّر HTTPS تلقائياً وقرصاً دائماً (Volume). تحتاج حساب Railway (يمكن التسجيل بحساب GitHub أو Google).

### أ) رفع المشروع

**إن كان Git مثبتاً لديك:**

```bash
git init
git add .
git commit -m "initial deploy"
```

ارفع المشروع إلى GitHub، ثم من لوحة Railway: **New Project → Deploy from GitHub repo**.

**بدون Git (عبر Railway CLI):**

```bash
npx @railway/cli login
npx @railway/cli init
npx @railway/cli up
```

الأمر `up` يرفع مجلد المشروع ويبني `Dockerfile` تلقائياً.

### ب) إضافة قرص دائم

من لوحة المشروع: **Service → Settings → Volumes → Add Volume** واختر مسار التركيب:

```
/data
```

### ج) متغيرات البيئة

من **Variables** أضف:

| المتغير | القيمة |
|---|---|
| `NODE_ENV` | `production` |
| `DATA_DIR` | `/data` |
| `UPLOAD_DIR` | `/data/uploads` |
| `APP_SECRET` | سر عشوائي طويل (انظر أدناه) |
| `DEVELOPER_PASSWORD` | كلمة مرور قوية لحساب المطور |
| `MAX_FILE_MB` | `20` (اختياري) |

توليد `APP_SECRET`:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

> ⚠️ احتفظ بـ `APP_SECRET` ثابتاً وانسخه في مكان آمن. تغييره بعد إنشاء الحسابات يجعل الأرقام القومية المشفّرة غير قابلة للقراءة.

### د) النطاق

**Settings → Networking → Generate Domain** — ستحصل على رابط مثل:

```
https://elmanasa-production.up.railway.app
```

### هـ) أول تشغيل

لا تحتاج أي أوامر إضافية: عند أول إقلاع، إذا كانت قاعدة البيانات فارغة، ينشئ الخادم حساب المطور تلقائياً من متغيرات `DEVELOPER_*`.

سجّل الدخول باسم المستخدم `developer` وكلمة المرور التي وضعتها في `DEVELOPER_PASSWORD`، ثم **غيّر كلمة المرور فوراً** من صفحة الحساب.

---

## الخيار 2 — Render + قرص دائم

Render يوفّر HTTPS تلقائياً، لكن **القرص الدائم متاح في الخطة المدفوعة فقط**. الخطة المجانية بلا قرص دائم، لذلك ستفقد البيانات عند كل نشر أو إعادة تشغيل.

1. ارفع المشروع إلى GitHub.
2. من Render: **New → Blueprint** واختر المستودع (ملف `render.yaml` موجود في المشروع)، أو أنشئ **Web Service** يدوياً بنوع **Docker**.
3. تأكد من:
   - **Plan:** Starter أو أعلى.
   - **Disk:** الاسم `elmanasa-data`، المسار `/data`، الحجم 5GB.
   - **Health Check Path:** `/api/health`.
4. أضف متغيرات البيئة نفسها المذكورة في Railway (`NODE_ENV`, `DATA_DIR=/data`, `UPLOAD_DIR=/data/uploads`, `APP_SECRET`, `DEVELOPER_PASSWORD`).
5. بعد النشر افتح رابط `onrender.com` وسجّل الدخول بحساب المطور.

---

## الخيار 3 — سيرفر VPS (تحكم كامل)

مناسب لـ DigitalOcean / Hetzner / Contabo / AWS Lightsail. يمنحك نطاقاً خاصاً وتحكماً كاملاً.

### 1) تجهيز السيرفر (Ubuntu 24.04)

```bash
sudo apt update
sudo apt install -y docker.io docker-compose-v2 nginx certbot python3-certbot-nginx
sudo systemctl enable --now docker
```

### 2) رفع المشروع

```bash
# من جهازك
scp -r ./elmanasa user@SERVER_IP:/home/user/
```

أو ارفعه عبر GitHub ثم `git clone` على السيرفر.

### 3) إعداد متغيرات البيئة

```bash
cd elmanasa
cp .env.example .env
nano .env
```

اضبط على الأقل:

```env
APP_SECRET=سر-عشوائي-طويل-وثابت
DEVELOPER_PASSWORD=كلمة-مرور-قوية
```

### 4) التشغيل

```bash
docker compose up -d --build
docker compose logs -f
```

الخادم يعمل الآن على `127.0.0.1:4000`، وقاعدة البيانات داخل Volume باسم `elmanasa_data`.

### 5) Nginx + HTTPS

أنشئ `/etc/nginx/sites-available/elmanasa`:

```nginx
server {
    listen 80;
    server_name your-domain.com;

    # يجب أن يكون أكبر من MAX_FILE_MB
    client_max_body_size 25m;

    # الإشعارات الفورية (SSE) تحتاج تعطيل التخزين المؤقت
    location /api/events {
        proxy_pass http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header Connection '';
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 3600s;
    }

    location / {
        proxy_pass http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

ثم:

```bash
sudo ln -s /etc/nginx/sites-available/elmanasa /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
sudo certbot --nginx -d your-domain.com
```

سجّل الدخول من `https://your-domain.com`.

---

## ماذا يحدث عند أول تشغيل؟

1. ينشئ الخادم قاعدة البيانات والمجلدات تلقائياً.
2. إن لم يوجد أي مستخدم، ينشئ حساب المطور من:
   - `DEVELOPER_USERNAME` (افتراضي `developer`)
   - `DEVELOPER_PASSWORD` (افتراضي `Admin@12345`)
   - `DEVELOPER_NATIONAL_ID` (افتراضي `30001011234567`)
3. من حساب المطور أنشئ حسابات الدكاترة والمعيدين والطلاب — لا يوجد تسجيل ذاتي.

### بيانات تجريبية (اختياري)

من داخل السيرفر/الحاوية:

```bash
docker compose exec app npm run seed:demo
```

> لا تشغّل هذه الخطوة على قاعدة بيانات الإنتاج إن كنت لا تريد بيانات وهمية.

---

## متغيرات البيئة

| المتغير | الافتراضي | الوصف |
|---|---|---|
| `NODE_ENV` | — | `production` لتفعيل الكوكي الآمن وخدمة الواجهة المبنية |
| `PORT` | `4000` | منفذ الخادم |
| `APP_SECRET` | يُولَّد في `data/.secret` | سر تشفير الأرقام القومية والجلسات — **ثبّته في الإنتاج** |
| `DATA_DIR` | `./data` | مجلد قاعدة البيانات |
| `UPLOAD_DIR` | `./uploads` | مجلد الملفات المرفوعة |
| `MAX_FILE_MB` | `20` | أقصى حجم للملف |
| `ALLOWED_ORIGINS` | — | نطاقات إضافية مسموحة للطلبات، مفصولة بفاصلة |
| `DEVELOPER_USERNAME` | `developer` | اسم حساب المطور عند أول تهيئة |
| `DEVELOPER_PASSWORD` | `Admin@12345` | كلمة مرور المطور عند أول تهيئة |
| `DEVELOPER_NATIONAL_ID` | `30001011234567` | الرقم القومي للمطور عند أول تهيئة |
| `DEVELOPER_NAME` | `مسؤول المنصة` | الاسم الظاهر للمطور |

> في Docker استخدم دائماً `DATA_DIR=/data` و`UPLOAD_DIR=/data/uploads` مع Volume على `/data`.

---

## النسخ الاحتياطي والاستعادة

### Docker / VPS

```bash
# نسخ احتياطي (قاعدة البيانات + الملفات)
docker run --rm \
  -v elmanasa_data:/data \
  -v "$PWD":/backup \
  alpine tar czf /backup/elmanasa-backup-$(date +%F).tar.gz -C /data .
```

```bash
# استعادة
docker compose down
docker run --rm \
  -v elmanasa_data:/data \
  -v "$PWD":/backup \
  alpine sh -c "rm -rf /data/* && tar xzf /backup/elmanasa-backup-YYYY-MM-DD.tar.gz -C /data"
docker compose up -d
```

> خذ النسخة الاحتياطية أثناء توقف الخادم أو بعد إيقافه مؤقتاً لضمان اتساق قاعدة SQLite.

### Railway / Render

نزّل نسخة من الـ Volume من لوحة التحكم، أو استخدم أوامر النسخ المتاحة في المنصة.

---

## تحديث النسخة

```bash
# VPS
git pull            # أو ارفع الملفات الجديدة
docker compose up -d --build
```

قاعدة البيانات والملفات تبقى كما هي داخل الـ Volume.

---

## استكشاف الأخطاء

| المشكلة | السبب والحل |
|---|---|
| تسجيل الدخول لا يستمر | الموقع يعمل على HTTP. الإنتاج يتطلب HTTPS (الكوكي `secure`). |
| `413 Request Entity Too Large` | ارفع `client_max_body_size` في Nginx أو `MAX_FILE_MB`. |
| الإشعارات لا تصل فوراً | فعّل `proxy_buffering off` لمسار `/api/events` وارفع `proxy_read_timeout`. |
| `طلب غير موثوق` | أضف نطاق الموقع كاملاً إلى `ALLOWED_ORIGINS` (مثل `https://example.com`). |
| ضياع البيانات بعد كل نشر | لا يوجد Volume دائم، أو لم يتم ضبط `DATA_DIR=/data`. |
| `database is locked` | شغّل نسخة واحدة فقط من الخدمة (Replica = 1). |
| `502 Bad Gateway` | الحاوية توقفت — راجع `docker compose logs -f`. |
| فحص الصحة `503` | تعذّر الوصول لقاعدة البيانات — تحقق من صلاحيات مجلد `/data`. |

---

## قائمة تحقق أمان قبل التسليم

- [ ] `APP_SECRET` قوي وثابت ومحفوظ خارج المستودع.
- [ ] كلمة مرور المطور الافتراضية تم تغييرها.
- [ ] الموقع يعمل على HTTPS.
- [ ] الـ Volume الدائم مربوط بـ `/data`.
- [ ] `ALLOWED_ORIGINS` مضبوط إن استخدمت نطاقاً خارجياً.
- [ ] نسخة احتياطية مجدولة من `/data`.
- [ ] لا توجد نسخة من `.env` أو `data/` أو `uploads/` داخل المستودع.
