import { useEffect, useMemo, useState } from 'react';
import { CalendarClock, Save, Send, Users } from 'lucide-react';
import { api } from '../lib/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { fromDateTimeLocal, toDateTimeLocal } from '../lib/format.js';
import { Button, ErrorNote, Field, FilePicker, Input, Modal, Select, Spinner, Textarea } from './ui.jsx';

const emptyForm = () => ({
  title: '',
  description: '',
  scope: 'general',
  taId: '',
  publishedAt: toDateTimeLocal(new Date()),
  dueAt: toDateTimeLocal(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)),
  allowLate: false,
  maxGrade: ''
});

export default function CreateAssignmentModal({ open, onClose, onSaved, courseId: fixedCourseId, assignment = null }) {
  const { user } = useAuth();
  const { push } = useToast();
  const [courses, setCourses] = useState([]);
  const [courseId, setCourseId] = useState('');
  const [course, setCourse] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingCourse, setLoadingCourse] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const isEdit = Boolean(assignment);
  const isTa = user?.role === 'ta';

  useEffect(() => {
    if (!open) return;
    setError('');
    setFile(null);
    if (assignment) {
      setCourseId(assignment.courseId);
      setForm({
        title: assignment.title || '',
        description: assignment.description || '',
        scope: assignment.scope || 'general',
        taId: assignment.taId ? String(assignment.taId) : '',
        publishedAt: toDateTimeLocal(assignment.publishedAt),
        dueAt: toDateTimeLocal(assignment.dueAt),
        allowLate: Boolean(assignment.allowLate),
        maxGrade: assignment.maxGrade ?? ''
      });
      return;
    }
    setForm(emptyForm());
    if (fixedCourseId) {
      setCourseId(String(fixedCourseId));
    } else {
      setLoading(true);
      api('/courses')
        .then((data) => {
          const list = data.courses || [];
          setCourses(list);
          setCourseId((current) => current || (list[0] ? String(list[0].id) : ''));
        })
        .catch((err) => setError(err.message))
        .finally(() => setLoading(false));
    }
  }, [open, assignment?.id, fixedCourseId]);

  useEffect(() => {
    if (!open || !courseId) { setCourse(null); return undefined; }
    let alive = true;
    setLoadingCourse(true);
    api(`/courses/${courseId}`)
      .then((data) => { if (alive) setCourse(data.course); })
      .catch((err) => { if (alive) setError(err.message); })
      .finally(() => { if (alive) setLoadingCourse(false); });
    return () => { alive = false; };
  }, [open, courseId]);

  useEffect(() => {
    if (!open || !course || isEdit || !isTa) return;
    if (!course.myTa?.canPostGeneral && form.scope !== 'ta') {
      setForm((current) => ({ ...current, scope: 'ta', taId: String(user.id) }));
    }
  }, [open, course?.id, isEdit, isTa]);

  const tas = useMemo(() => course?.tas || [], [course]);
  const canCreate = !isTa || Boolean(course?.myTa?.canCreateAssignments);
  const allowGeneral = !isTa || Boolean(course?.myTa?.canPostGeneral);
  const scope = isTa ? (allowGeneral ? form.scope : 'ta') : form.scope;

  const update = (key) => (event) => {
    const value = event.target.type === 'checkbox' ? event.target.checked : event.target.value;
    setForm((current) => {
      const next = { ...current, [key]: value };
      if (key === 'scope' && value === 'general') next.taId = '';
      return next;
    });
  };

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    if (!canCreate) { setError('الدكتور لم يمنحك صلاحية إنشاء التكليفات في هذه المادة'); return; }
    if (!courseId) { setError('اختر المادة أولاً'); return; }
    if (scope === 'ta' && !isTa && !form.taId) { setError('اختر المعيد المسؤول عن التكليف'); return; }

    const publishedIso = fromDateTimeLocal(form.publishedAt);
    const dueIso = fromDateTimeLocal(form.dueAt);
    if (!publishedIso || !dueIso) { setError('راجع تواريخ النشر والتسليم'); return; }

    const fd = new FormData();
    fd.append('title', form.title.trim());
    fd.append('description', form.description.trim());
    fd.append('publishedAt', publishedIso);
    fd.append('dueAt', dueIso);
    fd.append('allowLate', form.allowLate ? '1' : '0');
    fd.append('maxGrade', form.maxGrade === '' ? '' : String(form.maxGrade));
    fd.append('scope', scope);
    if (scope === 'ta') fd.append('taId', isTa ? String(user.id) : form.taId);
    if (!isEdit) fd.append('courseId', String(courseId));
    if (file) fd.append('file', file);

    setSaving(true);
    try {
      const result = isEdit
        ? await api(`/assignments/${assignment.id}`, { method: 'PATCH', form: fd })
        : await api('/assignments', { method: 'POST', form: fd });
      push(isEdit ? 'تم تحديث التكليف وإشعار الطلاب' : 'تم نشر التكليف وإشعار الطلاب');
      onSaved?.(result.assignment);
      onClose?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? 'تعديل التكليف' : 'نشر تكليف جديد'}
      subtitle={isEdit ? 'سيتم إشعار الطلاب المسموح لهم بهذا التحديث.' : 'اختر المادة ونطاق التكليف وموعد التسليم ثم أرفق ملف الأسئلة إن وجد.'}
      size="lg"
      footer={(
        <>
          <Button variant="ghost" onClick={onClose}>إلغاء</Button>
          <Button
            icon={isEdit ? Save : Send}
            loading={saving}
            disabled={!canCreate || loadingCourse}
            onClick={submit}
          >
            {isEdit ? 'حفظ التعديلات' : 'نشر التكليف'}
          </Button>
        </>
      )}
    >
      {loading || loadingCourse ? (
        <div className="full-loader" style={{ minHeight: 200 }}><Spinner label="جارٍ تحميل بيانات المادة..." /></div>
      ) : (
        <form onSubmit={submit} className="col gap-14">
          {!canCreate ? (
            <div className="notice warning"><Users size={17} /><span>الدكتور لم يمنحك صلاحية إنشاء التكليفات في هذه المادة.</span></div>
          ) : null}

          <div className="form-grid">
            <Field label="المادة" required className={fixedCourseId || isEdit ? '' : 'span-2'}>
              {fixedCourseId || isEdit ? (
                <Input value={course?.name || assignment?.courseName || ''} disabled />
              ) : (
                <Select value={courseId} onChange={(event) => setCourseId(event.target.value)} required>
                  <option value="">اختر المادة</option>
                  {courses.map((item) => <option key={item.id} value={item.id}>{item.name} {item.code ? `· ${item.code}` : ''}</option>)}
                </Select>
              )}
            </Field>

            <Field label="نطاق التكليف" required>
              <Select value={scope} onChange={update('scope')} disabled={!allowGeneral}>
                <option value="general">عام لكل طلاب المادة</option>
                <option value="ta">خاص بطلاب شات معيد</option>
              </Select>
            </Field>

            {scope === 'ta' ? (
              <Field label="المعيد المسؤول" required>
                {isTa ? (
                  <Input value={user.fullName} disabled />
                ) : (
                  <Select value={form.taId} onChange={update('taId')} required>
                    <option value="">اختر المعيد</option>
                    {tas.map((ta) => <option key={ta.id} value={ta.id}>{ta.fullName}</option>)}
                  </Select>
                )}
              </Field>
            ) : null}

            <Field label="عنوان التكليف" required className="span-2">
              <Input value={form.title} onChange={update('title')} placeholder="مثال: واجب الفصل الأول" minLength={3} maxLength={160} required />
            </Field>

            <Field label="وصف التكليف" className="span-2">
              <Textarea value={form.description} onChange={update('description')} placeholder="اشرح المطلوب وخطوات الحل وشروط التسليم..." maxLength={5000} />
            </Field>

            <Field label="وقت النشر" required>
              <Input type="datetime-local" value={form.publishedAt} onChange={update('publishedAt')} required />
            </Field>

            <Field label="موعد التسليم" required>
              <Input type="datetime-local" value={form.dueAt} onChange={update('dueAt')} required />
            </Field>

            <Field label="الدرجة النهائية" hint="اتركها فارغة إن لم يكن التكليف بدرجة">
              <Input type="number" min="0" max="1000" step="0.5" value={form.maxGrade} onChange={update('maxGrade')} placeholder="مثال: 20" />
            </Field>

            <div className="field">
              <span className="field-label">خيارات التسليم</span>
              <label className="check-row">
                <input type="checkbox" checked={form.allowLate} onChange={update('allowLate')} />
                <span>السماح بالتسليم بعد انتهاء الموعد</span>
              </label>
            </div>

            <div className="span-2">
              <Field label="ملف التكليف" hint="PDF أو Word أو صور · حتى 20 ميجابايت">
                <FilePicker file={file} onChange={setFile} accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.webp" label="إرفاق ملف الأسئلة (اختياري)" />
              </Field>
            </div>
          </div>

          <div className="notice">
            <CalendarClock size={17} />
            <span>سيُغلق التكليف تلقائياً عند موعد التسليم، ويستمر استقبال التسليمات المتأخرة فقط إذا فعّلت الخيار أعلاه.</span>
          </div>

          {error ? <ErrorNote>{error}</ErrorNote> : null}
        </form>
      )}
    </Modal>
  );
}
