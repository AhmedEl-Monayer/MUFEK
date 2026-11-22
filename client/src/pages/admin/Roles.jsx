import { Link } from 'react-router-dom';
import {
  BookOpen, GraduationCap, ShieldCheck, UserRoundCog, Users, Wrench
} from 'lucide-react';
import { useFetch } from '../../hooks/useFetch.js';
import { Badge, EmptyState, FullLoader, PageHead, SectionTitle, StatCard } from '../../components/ui.jsx';

const ROLE_META = {
  developer: { icon: Wrench, tone: 'accent', usersKey: 'users' },
  doctor: { icon: BookOpen, tone: 'primary', usersKey: 'doctors' },
  ta: { icon: Users, tone: 'info', usersKey: 'tas' },
  student: { icon: GraduationCap, tone: 'success', usersKey: 'students' }
};

const PERMISSIONS = [
  { label: 'إنشاء الحسابات وإدارة المستخدمين', developer: true, doctor: false, ta: false, student: false },
  { label: 'إعدادات المنصة والصلاحيات', developer: true, doctor: false, ta: false, student: false },
  { label: 'إنشاء المواد وإسنادها للدكاترة', developer: true, doctor: true, ta: false, student: false },
  { label: 'إضافة المعيدين وتحديد صلاحياتهم', developer: true, doctor: true, ta: false, student: false },
  { label: 'إدارة طلاب المادة وإزالتهم', developer: true, doctor: true, ta: false, student: false },
  { label: 'الكتابة في شات المادة العام', developer: true, doctor: true, ta: true, student: true },
  { label: 'إدارة شات السكشن وطلبات الانضمام', developer: true, doctor: false, ta: true, student: false },
  { label: 'نشر تكليف عام في المادة', developer: true, doctor: true, ta: true, student: false },
  { label: 'نشر تكليف خاص بشات المعيد', developer: true, doctor: true, ta: true, student: false },
  { label: 'تسليم التكليفات', developer: false, doctor: false, ta: false, student: true },
  { label: 'مراجعة التسليمات وتسجيل الدرجات', developer: true, doctor: true, ta: true, student: false },
  { label: 'استعراض كل مواد المنصة', developer: true, doctor: false, ta: false, student: false }
];

const ROLE_LABELS = { developer: 'المطور', doctor: 'دكتور', ta: 'معيد', student: 'طالب' };

export default function AdminRoles() {
  const { data: rolesData, loading: loadingRoles, error } = useFetch('/admin/roles');
  const { data: statsData } = useFetch('/admin/stats');

  if (loadingRoles) return <FullLoader label="جارٍ تحميل الصلاحيات..." />;

  const roles = rolesData?.roles || [];
  const stats = statsData?.stats || {};

  return (
    <div className="page">
      <PageHead
        eyebrow="أمان المنصة"
        title="الصلاحيات والأدوار"
        subtitle="كل دور له مساحة عمل مستقلة وصلاحيات محددة تُفحص على الخادم قبل تنفيذ أي عملية."
        actions={<Link to="/admin/users" className="btn btn-secondary btn-sm"><Users size={15} /> إدارة المستخدمين</Link>}
      />

      <div className="grid grid-4">
        <StatCard icon={Users} label="كل الحسابات" value={stats.users} tone="blue" />
        <StatCard icon={BookOpen} label="الدكاترة" value={stats.doctors} tone="violet" />
        <StatCard icon={Users} label="المعيدون" value={stats.tas} tone="teal" />
        <StatCard icon={GraduationCap} label="الطلاب" value={stats.students} tone="emerald" />
      </div>

      {error ? (
        <EmptyState icon={ShieldCheck} title="تعذر تحميل الأدوار" text={error} />
      ) : (
        <div className="grid grid-4">
          {roles.map((role) => {
            const meta = ROLE_META[role.id] || {};
            const Icon = meta.icon || UserRoundCog;
            const count = stats[meta.usersKey] ?? 0;
            return (
              <div key={role.id} className="glass card role-card">
                <span className="role-card-icon"><Icon size={20} /></span>
                <div className="grow">
                  <strong>{role.name}</strong>
                  <p>{role.description}</p>
                  <div className="row gap-8 wrap" style={{ marginTop: 10 }}>
                    <Badge tone={meta.tone || 'neutral'}>{count} حساب</Badge>
                    {role.id !== 'developer' ? (
                      <Link to={`/admin/users?role=${role.id}`} className="btn btn-ghost btn-sm">عرض</Link>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="glass card">
        <SectionTitle
          title="مصفوفة الصلاحيات"
          subtitle="هذه الصلاحيات مطبقة فعلياً على مستوى واجهات الخادم، وليست مجرد عرض واجهة."
        />
        <div className="table-wrap" style={{ marginTop: 14 }}>
          <table className="matrix">
            <thead>
              <tr>
                <th>الصلاحية</th>
                <th>المطور</th>
                <th>دكتور</th>
                <th>معيد</th>
                <th>طالب</th>
              </tr>
            </thead>
            <tbody>
              {PERMISSIONS.map((permission) => (
                <tr key={permission.label}>
                  <td>{permission.label}</td>
                  {['developer', 'doctor', 'ta', 'student'].map((role) => (
                    <td key={role} className={permission[role] ? 'yes' : 'no'}>
                      {permission[role] ? '✓' : '—'}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="notice" style={{ marginTop: 14 }}>
          <ShieldCheck size={17} />
          <span>
            بعض الصلاحيات مشروطة بسياق المادة: المعيد ينشر التكليف العام فقط بعد منحه الصلاحية من الدكتور،
            ويراجع التسليمات المسندة إليه فقط. كل طلب يُتحقق من الملكية والعضوية قبل تنفيذه.
          </span>
        </div>
      </div>

      <div className="glass card">
        <SectionTitle title="ملاحظات أمنية" subtitle="كيف تحمي المنصة بيانات المستخدمين." />
        <div className="col gap-8" style={{ marginTop: 12 }}>
          <div className="info-row">
            <span className="info-icon"><ShieldCheck size={16} /></span>
            <span className="info-label">كلمات المرور</span>
            <span className="info-value">مُشفَّرة بـ bcrypt ولا تُعاد أبداً</span>
          </div>
          <div className="info-row">
            <span className="info-icon"><ShieldCheck size={16} /></span>
            <span className="info-label">الرقم القومي</span>
            <span className="info-value">مشفَّر AES-256-GCM ويظهر مقنّعاً فقط</span>
          </div>
          <div className="info-row">
            <span className="info-icon"><ShieldCheck size={16} /></span>
            <span className="info-label">الجلسات</span>
            <span className="info-value">كوكيز httpOnly مع إلغاء فوري عند التعطيل</span>
          </div>
          <div className="info-row">
            <span className="info-icon"><ShieldCheck size={16} /></span>
            <span className="info-label">الملفات</span>
            <span className="info-value">تُقدَّم عبر مسارات محمية بفحص الصلاحية</span>
          </div>
        </div>
      </div>
    </div>
  );
}
