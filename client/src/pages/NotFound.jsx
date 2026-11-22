import { Link } from 'react-router-dom';
import { ArrowLeft, Compass, Home } from 'lucide-react';
import { useAuth, homeFor } from '../context/AuthContext.jsx';
import { EmptyState, PageHead } from '../components/ui.jsx';

export default function NotFound() {
  const { user } = useAuth();
  const home = user ? homeFor(user.role) : '/login';

  return (
    <div className="page">
      <PageHead
        eyebrow="404"
        title="الصفحة غير موجودة"
        subtitle="الرابط الذي فتحته غير متاح أو تم نقله. يمكنك العودة إلى مساحة عملك والمتابعة من هناك."
      />
      <div className="glass card">
        <EmptyState
          icon={Compass}
          title="لم نجد هذه الصفحة"
          text="تأكد من الرابط، أو استخدم الأزرار التالية للعودة إلى الصفحة الرئيسية."
          action={(
            <div className="row gap-8">
              <Link to={home} className="btn btn-primary btn-sm"><Home size={14} /> مساحة العمل</Link>
              <Link to="/chats" className="btn btn-soft btn-sm">المحادثات <ArrowLeft size={14} /></Link>
            </div>
          )}
        />
      </div>
    </div>
  );
}
