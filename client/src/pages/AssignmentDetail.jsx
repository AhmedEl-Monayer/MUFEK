import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowRight, CalendarClock, CheckCircle2, ClipboardCheck, Clock, Download, FileText,
  GraduationCap, Paperclip, Pencil, Send, Trash2, UserRound, Users, XCircle
} from 'lucide-react';
import { api } from '../lib/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { useFetch } from '../hooks/useFetch.js';
import { fileSize, fmtDateTime, roleLabel, statusMeta, timeLeft } from '../lib/format.js';
import {
  Avatar, Badge, Button, Card, ConfirmModal, EmptyState, ErrorNote, Field, FilePicker,
  FullLoader, Input, Modal, PageHead, SectionTitle, Select, StatCard, Textarea
} from '../components/ui.jsx';
import CreateAssignmentModal from '../components/CreateAssignmentModal.jsx';

export default function AssignmentDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const { push } = useToast();
  const navigate = useNavigate();
  const { data, loading, error, reload } = useFetch(`/assignments/${id}`);
  const canManage = Boolean(data?.canManage);
  const { data: submissionsData, reload: reloadSubmissions } = useFetch(canManage ? `/assignments/${id}/submissions` : null);

  const [file, setFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [review, setReview] = useState(null);
  const [reviewForm, setReviewForm] = useState({ status: 'graded', grade: '', feedback: '' });
  const [reviewSaving, setReviewSaving] = useState(false);
  const [reviewError, setReviewError] = useState('');

  if (loading) return <FullLoader label="جارٍ تحميل التكليف..." />;

  if (error || !data?.assignment) {
    return (
      <div className="page">
        <EmptyState
          icon={XCircle}
          title="تعذر عرض التكليف"
          text={error || 'قد يكون التكليف محذوفاً أو غير متاح لحسابك.'}
          action={<Link to={`/${user.role === 'developer' ? 'admin' : user.role}/assignments`} className="btn btn-primary btn-sm">العودة للتكليفات</Link>}
        />
      </div>
    );
  }

  const assignment = data.assignment;
  const due = timeLeft(assignment.dueAt);
  const meta = statusMeta(assignment.status);
  const isStudent = user.role === 'student';
  const rows = submissionsData?.rows || [];
  const summary = submissionsData?.summary;
  const backTo = `/${user.role === 'developer' ? 'admin' : user.role}/assignments`;

  const submitSolution = async (event) => {
    event.preventDefault();
    setSubmitError('');
    if (!file) { setSubmitError('اختر ملف الحل أولاً'); return; }
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const result = await api(`/assignments/${id}/submit`, { method: 'POST', form: fd });
      push(result.message || 'تم تسليم الحل بنجاح');
      setFile(null);
      await reload({ silent: true });
    } catch (err) {
      setSubmitError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const openReview = (row) => {
    setReview(row);
    setReviewError('');
    setReviewForm({
      status: row.submission?.status || 'graded',
      grade: row.submission?.grade ?? '',
      feedback: row.submission?.feedback || ''
    });
  };

  const saveReview = async () => {
    if (!review?.submission) return;
    setReviewError('');
    setReviewSaving(true);
    try {
      await api(`/submissions/${review.submission.id}`, {
        method: 'PATCH',
        body: {
          status: reviewForm.status,
          grade: reviewForm.grade === '' ? null : Number(reviewForm.grade),
          feedback: reviewForm.feedback
        }
      });
      push('تم حفظ التصحيح وإشعار الطالب');
      setReview(null);
      await Promise.all([reloadSubmissions({ silent: true }), reload({ silent: true })]);
    } catch (err) {
      setReviewError(err.message);
    } finally {
      setReviewSaving(false);
    }
  };

  const removeAssignment = async () => {
    setDeleting(true);
    try {
      await api(`/assignments/${id}`, { method: 'DELETE' });
      push('تم حذف التكليف مع الاحتفاظ بسجل التسليمات');
      navigate(backTo, { replace: true });
    } catch (err) {
      push(err.message, 'error');
      setDeleting(false);
    }
  };

  return (
    <div className="page">
      <PageHead
        eyebrow={assignment.courseName}
        title={assignment.title}
        subtitle={`${assignment.scope === 'general' ? 'تكليف عام لكل طلاب المادة' : `تكليف خاص بطلاب شات ${assignment.taName || 'المعيد'}`} · النشر بواسطة ${assignment.creatorName}`}
        actions={(
          <>
            <Link to={backTo} className="btn btn-ghost btn-sm"><ArrowRight size={15} /> العودة</Link>
            {canManage ? <Button variant="secondary" icon={Pencil} onClick={() => setEditOpen(true)}>تعديل</Button> : null}
            {canManage ? <Button variant="danger" icon={Trash2} onClick={() => setDeleteOpen(true)}>حذف</Button> : null}
          </>
        )}
      />

      <Card>
        <div className="assignment-detail-head">
          <div>
            <div className="row gap-6 wrap" style={{ marginBottom: 8 }}>
              {!canManage ? <Badge tone={meta.tone}>{meta.label}</Badge> : null}
              <Badge tone={assignment.scope === 'ta' ? 'accent' : 'primary'}>
                {assignment.scope === 'ta' ? `خاص بالمعيد ${assignment.taName || ''}` : 'عام'}
              </Badge>
              {assignment.maxGrade != null ? <Badge tone="neutral">الدرجة من {assignment.maxGrade}</Badge> : null}
              {assignment.allowLate ? <Badge tone="warning">يسمح بالتأخير</Badge> : null}
            </div>
            <div className="assignment-detail-meta">
              <span><GraduationCap size={14} /> {assignment.courseName} {assignment.courseCode ? `· ${assignment.courseCode}` : ''}</span>
              <span><CalendarClock size={14} /> التسليم: {fmtDateTime(assignment.dueAt)}</span>
              <span><UserRound size={14} /> {assignment.taName || assignment.creatorName}</span>
            </div>
          </div>
          <div className={`countdown-box ${due?.expired ? 'urgent' : due && due.days < 1 ? 'urgent' : due && due.days < 3 ? '' : 'success'}`} style={{ minWidth: 210 }}>
            <Clock size={18} />
            <div>
              <strong style={{ display: 'block', fontSize: 12 }}>
                {due?.expired ? 'انتهى موعد التسليم' : `متبقي ${due?.text || '—'}`}
              </strong>
              <span className="tiny">{assignment.allowLate ? 'التسليم المتأخر مسموح' : 'لن يُقبل التسليم بعد الموعد'}</span>
            </div>
          </div>
        </div>
      </Card>

      <div className="assignment-body-grid">
        <div className="col gap-16">
          <Card>
            <SectionTitle title="تفاصيل التكليف" subtitle="اقرأ المطلوب جيداً قبل التسليم." />
            <p style={{ marginTop: 12, fontSize: 13, lineHeight: 1.9, color: 'var(--ink-soft)', whiteSpace: 'pre-wrap' }}>
              {assignment.description || 'لا يوجد وصف إضافي لهذا التكليف.'}
            </p>

            {assignment.file ? (
              <div className="assignment-file" style={{ marginTop: 16 }}>
                <span className="assignment-file-icon"><FileText size={20} /></span>
                <div className="grow">
                  <strong>{assignment.fileName || 'ملف التكليف'}</strong>
                  <small>{fileSize(assignment.fileSize)} · مرفق من {assignment.creatorName}</small>
                </div>
                <a className="btn btn-soft btn-sm" href={`/api/files/assignment/${assignment.id}`} target="_blank" rel="noreferrer">
                  <Paperclip size={14} /> فتح
                </a>
                <a className="btn btn-ghost btn-sm" href={`/api/files/assignment/${assignment.id}?download=1`}>
                  <Download size={14} /> تنزيل
                </a>
              </div>
            ) : (
              <p className="tiny muted" style={{ marginTop: 12 }}>لا يوجد ملف مرفق بهذا التكليف.</p>
            )}
          </Card>

          {canManage ? (
            <Card>
              <SectionTitle
                title="تسليمات الطلاب"
                subtitle={summary ? `${summary.submitted} تسليم من أصل ${summary.eligible} طالب · ${summary.graded} تم تصحيحه` : 'جارٍ التحميل...'}
              />
              {summary ? (
                <div className="grid grid-3" style={{ marginTop: 14 }}>
                  <div className="pill"><Users size={13} /> المستحقون: {summary.eligible}</div>
                  <div className="pill"><CheckCircle2 size={13} /> سلّموا: {summary.submitted}</div>
                  <div className="pill"><ClipboardCheck size={13} /> صُححوا: {summary.graded}</div>
                </div>
              ) : null}
              <div className="table-wrap" style={{ marginTop: 14 }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th>الطالب</th>
                      <th>الحالة</th>
                      <th>وقت التسليم</th>
                      <th>الدرجة</th>
                      <th style={{ textAlign: 'end' }}>الإجراءات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.studentId}>
                        <td>
                          <div className="user-cell">
                            <Avatar name={row.studentName} src={row.avatar} size={32} />
                            <div>
                              <strong>{row.studentName}</strong>
                              <small>@{row.username}</small>
                            </div>
                          </div>
                        </td>
                        <td>
                          {row.submitted ? (
                            <Badge tone={statusMeta(row.submission.status).tone}>
                              {statusMeta(row.submission.status).label}
                              {row.submission.isLate ? ' · متأخر' : ''}
                            </Badge>
                          ) : (
                            <Badge tone="neutral">لم يسلّم</Badge>
                          )}
                        </td>
                        <td className="small">{row.submitted ? fmtDateTime(row.submission.submittedAt) : '—'}</td>
                        <td className="small strong">
                          {row.submission?.grade != null ? `${row.submission.grade}${assignment.maxGrade != null ? ` / ${assignment.maxGrade}` : ''}` : '—'}
                        </td>
                        <td>
                          <div className="table-actions">
                            {row.submitted ? (
                              <a className="btn btn-ghost btn-sm" href={`/api/files/submission/${row.submission.id}`} target="_blank" rel="noreferrer">
                                <FileText size={14} /> الملف
                              </a>
                            ) : null}
                            {row.submitted ? (
                              <Button size="sm" variant="soft" icon={ClipboardCheck} onClick={() => openReview(row)}>تصحيح</Button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    ))}
                    {rows.length === 0 ? (
                      <tr><td colSpan={5}><EmptyState compact icon={Users} title="لا يوجد طلاب مستحقون" text="قد يكون التكليف خاصاً بشات معيد لا يوجد به طلاب بعد." /></td></tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </Card>
          ) : null}
        </div>

        <div className="col gap-16">
          {isStudent ? (
            <Card>
              <div className="submit-zone">
                <h3>تسليم الحل</h3>
                {assignment.submission ? (
                  <div className="submission-summary">
                    <h4>تسليمك الحالي</h4>
                    <div className="summary-row"><span>الملف</span><strong>{assignment.submission.fileName}</strong></div>
                    <div className="summary-row"><span>وقت التسليم</span><strong>{fmtDateTime(assignment.submission.submittedAt)}</strong></div>
                    <div className="summary-row"><span>الحالة</span><Badge tone={statusMeta(assignment.submission.status).tone}>{statusMeta(assignment.submission.status).label}</Badge></div>
                    {assignment.submission.isLate ? <Badge tone="warning">تسليم متأخر</Badge> : null}
                    <a className="btn btn-soft btn-sm" href={`/api/files/submission/${assignment.submission.id}`} target="_blank" rel="noreferrer">
                      <FileText size={14} /> عرض الملف المسلّم
                    </a>
                    {assignment.submission.status === 'graded' ? (
                      <div className="notice success" style={{ marginTop: 4 }}>
                        <CheckCircle2 size={17} />
                        <span>
                          تم تصحيح تسليمك{assignment.submission.grade != null ? ` — الدرجة: ${assignment.submission.grade}${assignment.maxGrade != null ? ` / ${assignment.maxGrade}` : ''}` : ''}.
                          {assignment.submission.feedback ? ` ملاحظات: ${assignment.submission.feedback}` : ''}
                        </span>
                      </div>
                    ) : null}
                  </div>
                ) : null}

                {assignment.canSubmit ? (
                  <form onSubmit={submitSolution} className="col gap-10">
                    <FilePicker
                      file={file}
                      onChange={setFile}
                      accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.webp,.zip"
                      label={assignment.submission ? 'رفع حل بديل' : 'اختر ملف الحل'}
                      hint="PDF أو Word أو صور أو ZIP · حتى 20 ميجابايت"
                    />
                    {submitError ? <ErrorNote>{submitError}</ErrorNote> : null}
                    <Button type="submit" icon={Send} loading={submitting} className="btn-block">
                      {assignment.submission ? 'استبدال التسليم' : 'تسليم الحل'}
                    </Button>
                  </form>
                ) : (
                  <div className={`notice ${assignment.status === 'graded' ? 'success' : 'warning'}`}>
                    {assignment.status === 'graded' ? <CheckCircle2 size={17} /> : <Clock size={17} />}
                    <span>
                      {assignment.status === 'graded'
                        ? 'تم تصحيح هذا التسليم، ولا يمكن تعديله.'
                        : due?.expired && !assignment.allowLate
                          ? 'انتهى موعد التسليم ولا يُسمح بالتسليم المتأخر.'
                          : new Date(assignment.publishedAt).getTime() > Date.now()
                            ? 'لم يتم نشر التكليف بعد.'
                            : 'لا يمكن التسليم حالياً.'}
                    </span>
                  </div>
                )}
              </div>
            </Card>
          ) : (
            <Card className="course-side-card">
              <h3>ملخص التكليف</h3>
              <div className="summary-row"><span>النطاق</span><strong>{assignment.scope === 'general' ? 'عام' : 'خاص بالمعيد'}</strong></div>
              <div className="summary-row"><span>النشر</span><strong>{fmtDateTime(assignment.publishedAt)}</strong></div>
              <div className="summary-row"><span>التسليم</span><strong>{fmtDateTime(assignment.dueAt)}</strong></div>
              <div className="summary-row"><span>الدرجة</span><strong>{assignment.maxGrade ?? 'بدون'}</strong></div>
              <div className="summary-row"><span>السماح بالتأخير</span><strong>{assignment.allowLate ? 'نعم' : 'لا'}</strong></div>
              <div className="summary-row"><span>المسؤول</span><strong>{assignment.taName || assignment.creatorName}</strong></div>
              <div className="summary-row"><span>أنشأه</span><strong>{assignment.creatorName} · {roleLabel(assignment.creatorRole)}</strong></div>
            </Card>
          )}

          <Card className="course-side-card">
            <h3>حالة التكليف</h3>
            <StatCard icon={Users} label="المستحقون" value={assignment.eligibleCount ?? summary?.eligible ?? '—'} tone="blue" />
            <StatCard icon={CheckCircle2} label="التسليمات" value={assignment.submissionsCount ?? summary?.submitted ?? '—'} tone="emerald" />
            <StatCard icon={ClipboardCheck} label="تم تصحيحه" value={assignment.gradedCount ?? summary?.graded ?? '—'} tone="violet" />
          </Card>
        </div>
      </div>

      <CreateAssignmentModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        onSaved={() => reload({ silent: true })}
        assignment={assignment}
      />

      <ConfirmModal
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={removeAssignment}
        loading={deleting}
        title="حذف التكليف"
        message="سيتم إخفاء التكليف عن الطلاب مع الاحتفاظ الكامل بسجل التسليمات والدرجات. هل تريد المتابعة؟"
        confirmLabel="حذف التكليف"
      />

      <Modal
        open={Boolean(review)}
        onClose={() => setReview(null)}
        title={`تصحيح تسليم ${review?.studentName || ''}`}
        subtitle={review?.submission ? `تم التسليم في ${fmtDateTime(review.submission.submittedAt)}` : ''}
        footer={(
          <>
            <Button variant="ghost" onClick={() => setReview(null)}>إلغاء</Button>
            <Button icon={CheckCircle2} loading={reviewSaving} onClick={saveReview}>حفظ التصحيح</Button>
          </>
        )}
      >
        <div className="col gap-12">
          {review?.submission ? (
            <a className="btn btn-soft btn-sm" href={`/api/files/submission/${review.submission.id}`} target="_blank" rel="noreferrer" style={{ alignSelf: 'flex-start' }}>
              <FileText size={14} /> عرض ملف الطالب
            </a>
          ) : null}
          <div className="form-grid">
            <Field label="حالة التسليم" required>
              <Select value={reviewForm.status} onChange={(event) => setReviewForm((current) => ({ ...current, status: event.target.value }))}>
                <option value="submitted">تم التسليم</option>
                <option value="reviewed">تمت المراجعة</option>
                <option value="graded">تم التصحيح</option>
              </Select>
            </Field>
            <Field label={`الدرجة${assignment.maxGrade != null ? ` (من ${assignment.maxGrade})` : ''}`}>
              <Input
                type="number"
                min="0"
                max={assignment.maxGrade ?? 1000}
                step="0.5"
                value={reviewForm.grade}
                onChange={(event) => setReviewForm((current) => ({ ...current, grade: event.target.value }))}
                placeholder="اتركها فارغة إن لم تُصحح بعد"
              />
            </Field>
            <Field label="ملاحظات للطالب" className="span-2">
              <Textarea
                value={reviewForm.feedback}
                onChange={(event) => setReviewForm((current) => ({ ...current, feedback: event.target.value }))}
                placeholder="اكتب ملاحظات التصحيح..."
                maxLength={3000}
              />
            </Field>
          </div>
          {reviewError ? <ErrorNote>{reviewError}</ErrorNote> : null}
        </div>
      </Modal>
    </div>
  );
}
