import { Link } from 'react-router-dom';
import { BookOpen, GraduationCap, Users, ClipboardList, ArrowLeft } from 'lucide-react';
import { Avatar } from './ui.jsx';
import { courseImage } from '../lib/media.js';

export default function CourseCard({ course, href, action, showJoinState = false }) {
  const coverImage = courseImage(course);
  return (
    <article className="glass card course-card">
      <div className="course-cover" style={coverImage ? { backgroundImage: `url(${coverImage})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}>
        {!coverImage ? <><span className="cover-orb a" /><span className="cover-orb b" /></> : null}
        <span className="cover-code">{course.code || 'مادة'}</span>
        <GraduationCap className="cover-icon" size={22} />
      </div>
      <div className="course-body">
        <div>
          <h3><Link to={href}>{course.name}</Link></h3>
          <div className="course-meta" style={{ marginTop: 5 }}>
            <span><Users size={12} /> {course.studentsCount ?? 0} طالب</span>
            <span><BookOpen size={12} /> {course.tasCount ?? 0} معيد</span>
            <span><ClipboardList size={12} /> {course.assignmentsCount ?? 0} تكليف</span>
          </div>
        </div>
        <p className="course-desc">{course.description || 'لا يوجد وصف للمادة بعد.'}</p>
        <div className="course-foot">
          <span className="course-doctor">
            <Avatar name={course.doctorName} src={course.doctorAvatar} size={26} />
            {course.doctorName || 'دكتور المادة'}
          </span>
          {action || (
            <Link to={href} className="btn btn-ghost btn-sm">
              {showJoinState && course.joined ? 'فتح المادة' : 'عرض'}
              <ArrowLeft size={14} />
            </Link>
          )}
        </div>
      </div>
    </article>
  );
}
