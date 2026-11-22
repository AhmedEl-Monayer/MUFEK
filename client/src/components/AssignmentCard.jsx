import { Link } from 'react-router-dom';
import { CalendarClock, ClipboardList, FileText, GraduationCap, Paperclip, UserRound } from 'lucide-react';
import { Badge } from './ui.jsx';
import { fmtDateTime, statusMeta, timeLeft } from '../lib/format.js';

export default function AssignmentCard({ assignment, href, action, showCourse = true }) {
  const due = timeLeft(assignment.dueAt);
  const meta = statusMeta(assignment.status);
  const dueTone = assignment.status === 'expired' || due?.expired
    ? 'due-chip'
    : assignment.submission
      ? 'due-chip done'
      : due && due.days < 1
        ? 'due-chip urgent'
        : due && due.days < 3
          ? 'due-chip soon'
          : 'due-chip';

  return (
    <article className={`glass card assignment-card ${assignment.scope === 'ta' ? 'scope-ta' : ''} ${assignment.status === 'expired' ? 'expired' : ''}`}>
      <div className="assignment-top">
        <div>
          <h3><Link to={href}>{assignment.title}</Link></h3>
          {showCourse ? (
            <span className="assignment-course">
              <GraduationCap size={12} /> {assignment.courseName} {assignment.courseCode ? `· ${assignment.courseCode}` : ''}
            </span>
          ) : null}
        </div>
        <Badge tone={meta.tone}>{meta.label}</Badge>
      </div>
      {assignment.description ? <p className="assignment-desc">{assignment.description}</p> : null}
      <div className="assignment-meta">
        <span><CalendarClock size={12} /> {fmtDateTime(assignment.dueAt)}</span>
        <span><UserRound size={12} /> {assignment.taName || assignment.creatorName}</span>
        {assignment.file ? <span><Paperclip size={12} /> مرفق</span> : null}
        {assignment.scope === 'ta' ? <span><ClipboardList size={12} /> خاص بالمعيد</span> : null}
      </div>
      <div className="assignment-foot">
        <span className={dueTone}>
          {assignment.submission
            ? (assignment.status === 'graded' ? 'تم التصحيح' : 'تم التسليم')
            : due?.expired
              ? 'انتهى موعد التسليم'
              : `متبقي ${due?.text || '—'}`}
        </span>
        {action || (
          <Link to={href} className="btn btn-ghost btn-sm">
            <FileText size={14} /> التفاصيل
          </Link>
        )}
      </div>
    </article>
  );
}
