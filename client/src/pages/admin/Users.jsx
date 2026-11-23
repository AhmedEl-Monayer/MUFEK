import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  AlertTriangle, CheckCircle2, Copy, KeyRound, Pencil, Search, ShieldCheck, Trash2, UserPlus,
  Users as UsersIcon, XCircle
} from 'lucide-react';
import { api } from '../../lib/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { useFetch } from '../../hooks/useFetch.js';
import { fmtDateTime, roleLabel } from '../../lib/format.js';
import {
  Avatar, Badge, Button, ConfirmModal, EmptyState, Field, FullLoader, Input, Modal, PageHead,
  SearchInput, Select, StatCard
} from '../../components/ui.jsx';

const ROLE_TONES = { developer: 'accent', doctor: 'primary', ta: 'info', student: 'success' };

const emptyForm = () => ({ fullName: '', username: '', phone: '', role: 'student', isActive: true });

export default function AdminUsers() {
  const { user: me } = useAuth();
  const { push } = useToast();
  const [searchParams] = useSearchParams();
  const { data, loading, error, reload } = useFetch('/admin/users');
  const [role, setRole] = useState(searchParams.get('role') || '');
  const [query, setQuery] = useState(searchParams.get('q') || '');
  const [editTarget, setEditTarget] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [resetTarget, setResetTarget] = useState(null);
  const [resetting, setResetting] = useState(false);
  const [resetResult, setResetResult] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [purgeCourses, setPurgeCourses] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const users = data?.users || [];

  const visible = useMemo(() => users.filter((user) => {
    if (role && user.role !== role) return false;
    if (!query.trim()) return true;
    const q = query.trim().toLowerCase();
    return [user.fullName, user.username, user.phone, user.nationalIdMasked]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(q));
  }), [users, role, query]);

  const openEdit = (user) => {
    setEditTarget(user);
    setForm({
      fullName: user.fullName || '',
      username: user.username || '',
      phone: user.phone || '',
      role: user.role,
      isActive: Boolean(user.isActive)
    });
  };

  const save = async (event) => {
    event.preventDefault();
    if (!editTarget) return;
    setSaving(true);
    const payload = {
      fullName: form.fullName,
      username: form.username,
      phone: form.phone,
      isActive: form.isActive
    };
    if (editTarget.role !== 'developer' && form.role !== editTarget.role) payload.role = form.role;
    try {
      const result = await api(`/admin/users/${editTarget.id}`, { method: 'PATCH', body: payload });
      push(result.message || 'تم تحديث الحساب');
      setEditTarget(null);
      await reload({ silent: true });
    } catch (err) {
      push(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const resetPassword = async () => {
    if (!resetTarget) return;
    setResetting(true);
    try {
      const result = await api(`/admin/users/${resetTarget.id}/reset-password`, { method: 'POST' });
      setResetTarget(null);
      setResetResult({ user: resetTarget, password: result.temporaryPassword });
      push(result.message || 'تم إعادة تعيين كلمة المرور');
      await reload({ silent: true });
    } catch (err) {
      push(err.message, 'error');
    } finally {
      setResetting(false);
    }
  };

  const copyPassword = async () => {
    if (!resetResult?.password) return;
    try {
      await navigator.clipboard.writeText(resetResult.password);
      push('تم نسخ كلمة المرور المؤقتة');
    } catch {
      push('تعذر النسخ التلقائي، انسخ الكلمة يدوياً', 'error');
    }
  };

  const openDelete = (user) => {
    setDeleteTarget(user);
    setDeleteConfirm('');
    setPurgeCourses(false);
  };

  const removeUser = async () => {
    if (!deleteTarget) return;
    if (deleteConfirm.trim() !== deleteTarget.username) {
      push('اكتب اسم المستخدم بالضبط لتأكيد الحذف', 'error');
      return;
    }
    setDeleting(true);
    try {
      const result = await api(`/admin/users/${deleteTarget.id}`, {
        method: 'DELETE',
        body: { confirm: deleteConfirm.trim(), purgeCourses }
      });
      push(result.message || 'تم حذف الحساب نهائياً');
      setDeleteTarget(null);
      await reload({ silent: true });
    } catch (err) {
      push(err.message, 'error');
    } finally {
      setDeleting(false);
    }
  };

  if (loading) return <FullLoader label="جارٍ تحميل المستخدمين..." />;

  const counts = {
    doctor: users.filter((user) => user.role === 'doctor').length,
    ta: users.filter((user) => user.role === 'ta').length,
    student: users.filter((user) => user.role === 'student').length,
    inactive: users.filter((user) => !user.isActive).length
  };

  return (
    <div className="page">
      <PageHead
        eyebrow="إدارة الحسابات"
        title="المستخدمون"
        subtitle="أنشئ الحسابات وعدّل بياناتها وأعد تعيين كلمات المرور. لا يمكن لأي حساب إنشاء حساب آخر من داخل المنصة."
        actions={<Link to="/admin/users/new" className="btn btn-primary btn-sm"><UserPlus size={15} /> إنشاء حساب</Link>}
      />

      <div className="grid grid-4">
        <StatCard icon={UsersIcon} label="كل المستخدمين" value={users.length} tone="blue" />
        <StatCard icon={ShieldCheck} label="الدكاترة" value={counts.doctor} tone="violet" />
        <StatCard icon={UsersIcon} label="المعيدون" value={counts.ta} tone="teal" />
        <StatCard icon={XCircle} label="حسابات معطلة" value={counts.inactive} tone="rose" />
      </div>

      <div className="glass card" style={{ padding: 16 }}>
        <div className="filters">
          <SearchInput value={query} onChange={setQuery} placeholder="ابحث بالاسم أو اسم المستخدم أو الهاتف..." />
          <Select value={role} onChange={(event) => setRole(event.target.value)}>
            <option value="">كل الأنواع</option>
            <option value="doctor">دكتور ({counts.doctor})</option>
            <option value="ta">معيد ({counts.ta})</option>
            <option value="student">طالب ({counts.student})</option>
          </Select>
          <span className="pill"><UsersIcon size={13} /> {visible.length} مستخدم</span>
        </div>
      </div>

      {error ? (
        <EmptyState icon={UsersIcon} title="تعذر تحميل المستخدمين" text={error} />
      ) : visible.length === 0 ? (
        <EmptyState
          icon={Search}
          title="لا توجد حسابات مطابقة"
          text={users.length === 0 ? 'ابدأ بإنشاء أول حساب في المنصة.' : 'جرّب تغيير النوع أو كلمة البحث.'}
          action={users.length === 0 ? <Link to="/admin/users/new" className="btn btn-primary btn-sm"><UserPlus size={14} /> إنشاء حساب</Link> : null}
        />
      ) : (
        <div className="glass card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>المستخدم</th>
                  <th>النوع</th>
                  <th>الرقم القومي</th>
                  <th>الهاتف</th>
                  <th>الارتباطات</th>
                  <th>الحالة</th>
                  <th>تاريخ الإنشاء</th>
                  <th style={{ textAlign: 'end' }}>إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((user) => (
                  <tr key={user.id}>
                    <td>
                      <div className="user-cell">
                        <Avatar name={user.fullName} src={user.avatar} size={32} />
                        <div>
                          <strong>{user.fullName}</strong>
                          <small>@{user.username}</small>
                        </div>
                      </div>
                    </td>
                    <td><Badge tone={ROLE_TONES[user.role] || 'neutral'}>{roleLabel(user.role)}</Badge></td>
                    <td className="small" style={{ direction: 'ltr', textAlign: 'start' }}>{user.nationalIdMasked || '—'}</td>
                    <td className="small" style={{ direction: 'ltr', textAlign: 'start' }}>{user.phone || '—'}</td>
                    <td className="small">
                      {user.role === 'doctor' ? `${user.coursesCount} مادة` : null}
                      {user.role === 'ta' ? `${user.taCoursesCount} مادة` : null}
                      {user.role === 'student' ? `${user.enrollmentsCount} اشتراك` : null}
                      {user.role === 'developer' ? '—' : null}
                    </td>
                    <td>
                      <Badge tone={user.isActive ? 'success' : 'danger'} icon={user.isActive ? CheckCircle2 : XCircle}>
                        {user.isActive ? 'نشط' : 'معطل'}
                      </Badge>
                    </td>
                    <td className="small">{fmtDateTime(user.createdAt)}</td>
                    <td>
                      <div className="table-actions">
                        <Button size="sm" variant="soft" icon={Pencil} onClick={() => openEdit(user)}>تعديل</Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          icon={KeyRound}
                          disabled={user.id === me?.id}
                          title={user.id === me?.id ? 'استخدم صفحة الملف الشخصي لتغيير كلمة مرورك' : 'إعادة تعيين كلمة المرور'}
                          onClick={() => setResetTarget(user)}
                        >
                          كلمة المرور
                        </Button>
                        <Button
                          size="sm"
                          variant="danger"
                          icon={Trash2}
                          disabled={user.role === 'developer' || user.id === me?.id}
                          title={user.role === 'developer' || user.id === me?.id
                            ? 'لا يمكن حذف حساب مطور أو حسابك الشخصي'
                            : 'حذف الحساب نهائياً'}
                          onClick={() => openDelete(user)}
                        >
                          حذف
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal
        open={Boolean(editTarget)}
        onClose={() => setEditTarget(null)}
        title="تعديل الحساب"
        subtitle={editTarget ? `@${editTarget.username} · ${roleLabel(editTarget.role)}` : ''}
        footer={(
          <>
            <Button variant="ghost" onClick={() => setEditTarget(null)}>إلغاء</Button>
            <Button type="submit" form="edit-user-form" loading={saving}>حفظ التغييرات</Button>
          </>
        )}
      >
        <form id="edit-user-form" onSubmit={save} className="form-grid">
          <Field label="الاسم الكامل" required className="span-2">
            <Input
              value={form.fullName}
              onChange={(event) => setForm((current) => ({ ...current, fullName: event.target.value }))}
              required
              minLength={3}
              maxLength={120}
            />
          </Field>
          <Field label="اسم المستخدم" required>
            <Input
              value={form.username}
              onChange={(event) => setForm((current) => ({ ...current, username: event.target.value }))}
              required
              dir="ltr"
            />
          </Field>
          <Field label="رقم الهاتف">
            <Input
              value={form.phone}
              onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
              dir="ltr"
              placeholder="01xxxxxxxxx"
            />
          </Field>
          <Field label="نوع الحساب" hint="لا يمكن تغيير النوع قبل إزالة ارتباطات الحساب بالمواد أو التسليمات.">
            <Select
              value={form.role}
              onChange={(event) => setForm((current) => ({ ...current, role: event.target.value }))}
              disabled={editTarget?.role === 'developer'}
            >
              <option value="developer">المطور</option>
              <option value="student">طالب</option>
              <option value="ta">معيد</option>
              <option value="doctor">دكتور</option>
            </Select>
          </Field>
          <Field label="حالة الحساب">
            <label className="check-row">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(event) => setForm((current) => ({ ...current, isActive: event.target.checked }))}
              />
              الحساب نشط ويمكنه تسجيل الدخول
            </label>
          </Field>
          <div className="span-2 notice">
            <ShieldCheck size={17} />
            <span>تغيير كلمة المرور أو تعطيل الحساب يلغي كل الجلسات المفتوحة له فوراً.</span>
          </div>
        </form>
      </Modal>

      <ConfirmModal
        open={Boolean(resetTarget)}
        onClose={() => setResetTarget(null)}
        onConfirm={resetPassword}
        loading={resetting}
        title="إعادة تعيين كلمة المرور"
        message={`سيتم إنشاء كلمة مرور مؤقتة للحساب @${resetTarget?.username || ''} وإلغاء جلساته الحالية، وسيُطلب منه تغييرها عند أول دخول. هل تريد المتابعة؟`}
        confirmLabel="إعادة التعيين"
      />

      <Modal
        open={Boolean(resetResult)}
        onClose={() => setResetResult(null)}
        title="كلمة المرور المؤقتة"
        subtitle="اعرض هذه الكلمة للمستخدم مرة واحدة، فلن تظهر مرة أخرى."
        size="sm"
        footer={<Button onClick={() => setResetResult(null)}>تم</Button>}
      >
        <div className="col gap-12">
          <div className="notice warning">
            <KeyRound size={17} />
            <span>سلّم كلمة المرور للمستخدم عبر قناة آمنة. يمكنه تغييرها من صفحة الملف الشخصي.</span>
          </div>
          <div className="auth-token">{resetResult?.password}</div>
          <Button variant="soft" icon={Copy} onClick={copyPassword}>نسخ كلمة المرور</Button>
        </div>
      </Modal>

      <Modal
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title="حذف الحساب نهائياً"
        subtitle={deleteTarget ? `${deleteTarget.fullName} · @${deleteTarget.username}` : ''}
        size="sm"
        footer={(
          <>
            <Button variant="ghost" onClick={() => setDeleteTarget(null)}>إلغاء</Button>
            <Button
              variant="danger-solid"
              loading={deleting}
              disabled={deleteConfirm.trim() !== deleteTarget?.username}
              onClick={removeUser}
            >
              حذف نهائي
            </Button>
          </>
        )}
      >
        <div className="col gap-12">
          <div className="notice danger">
            <AlertTriangle size={17} />
            <span>هذا الحذف نهائي ولا يمكن التراجع عنه. سيُحذف الحساب وصورته الشخصية وكل جلساته.</span>
          </div>
          <div className="info-row">
            <span className="info-label">اسم المستخدم للتأكيد</span>
            <span className="info-value" dir="ltr">@{deleteTarget?.username}</span>
          </div>
          <Field label={`اكتب @${deleteTarget?.username || ''} بالضبط`} required>
            <Input
              value={deleteConfirm}
              onChange={(event) => setDeleteConfirm(event.target.value)}
              dir="ltr"
              autoComplete="off"
              placeholder={deleteTarget?.username}
            />
          </Field>
          <Field
            label="المواد والتكليفات المرتبطة"
            hint="بدون تحديد هذا الخيار، تُبقى البيانات الأكاديمية وتُنقل ملكيتها لحسابك أنت."
          >
            <label className="check-row">
              <input
                type="checkbox"
                checked={purgeCourses}
                onChange={(event) => setPurgeCourses(event.target.checked)}
              />
              حذف المواد والتكليفات والتسليمات وملفاتها نهائياً
            </label>
          </Field>
          {purgeCourses ? (
            <div className="notice danger">
              <AlertTriangle size={17} />
              <span>سيتم حذف كل المواد التي يدرسها هذا المستخدم وكل التكليفات والتسليمات المرتبطة بها، حتى للطلاب الآخرين.</span>
            </div>
          ) : (
            <div className="notice warning">
              <ShieldCheck size={17} />
              <span>تسليمات هذا المستخدم وصورته الشخصية تُحذف دائماً، وبقية البيانات الأكاديمية تُحفظ.</span>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
