import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Bell, BookOpen, CalendarClock, ClipboardList, Compass, FileCheck2, GraduationCap,
  LayoutDashboard, LogOut, Menu, MessagesSquare, Settings2, ShieldCheck, UserRoundCog,
  Users, UserPlus, FolderKanban, ClipboardCheck, Search, Sparkles, X
} from 'lucide-react';
import { useAuth, homeFor } from '../context/AuthContext.jsx';
import { useNotifications } from '../context/NotificationContext.jsx';
import { Avatar, IconButton } from './ui.jsx';
import { roleLabel } from '../lib/format.js';

const NAV = {
  student: [
    { section: 'مساحتي', items: [
      { to: '/student', label: 'لوحة التحكم', icon: LayoutDashboard, end: true },
      { to: '/student/courses', label: 'المواد المتاحة', icon: Compass },
      { to: '/student/my-courses', label: 'موادي', icon: BookOpen }
    ] },
    { section: 'الأكاديمي', items: [
      { to: '/student/assignments', label: 'التكليفات', icon: ClipboardList },
      { to: '/student/submissions', label: 'تسليماتي', icon: FileCheck2 },
      { to: '/chats', label: 'المحادثات', icon: MessagesSquare }
    ] },
    { section: 'الحساب', items: [
      { to: '/notifications', label: 'الإشعارات', icon: Bell },
      { to: '/profile', label: 'الملف الشخصي', icon: UserRoundCog }
    ] }
  ],
  doctor: [
    { section: 'مساحة العمل', items: [
      { to: '/doctor', label: 'لوحة التحكم', icon: LayoutDashboard, end: true },
      { to: '/doctor/courses', label: 'موادي', icon: BookOpen },
      { to: '/doctor/courses/new', label: 'إنشاء مادة', icon: Sparkles }
    ] },
    { section: 'المتابعة', items: [
      { to: '/doctor/assignments', label: 'التكليفات', icon: ClipboardList },
      { to: '/doctor/submissions', label: 'التسليمات', icon: FileCheck2 },
      { to: '/chats', label: 'المحادثات', icon: MessagesSquare }
    ] },
    { section: 'الحساب', items: [
      { to: '/notifications', label: 'الإشعارات', icon: Bell },
      { to: '/profile', label: 'الملف الشخصي', icon: UserRoundCog }
    ] }
  ],
  ta: [
    { section: 'مساحة العمل', items: [
      { to: '/ta', label: 'لوحة التحكم', icon: LayoutDashboard, end: true },
      { to: '/ta/courses', label: 'موادي', icon: BookOpen },
      { to: '/ta/requests', label: 'طلبات الانضمام', icon: Users },
      { to: '/ta/schedule', label: 'مواعيد السكاشن', icon: CalendarClock }
    ] },
    { section: 'المتابعة', items: [
      { to: '/ta/assignments', label: 'التكليفات', icon: ClipboardList },
      { to: '/ta/submissions', label: 'التسليمات', icon: FileCheck2 },
      { to: '/chats', label: 'المحادثات', icon: MessagesSquare }
    ] },
    { section: 'الحساب', items: [
      { to: '/notifications', label: 'الإشعارات', icon: Bell },
      { to: '/profile', label: 'الملف الشخصي', icon: UserRoundCog }
    ] }
  ],
  developer: [
    { section: 'الإدارة', items: [
      { to: '/admin', label: 'لوحة التحكم', icon: LayoutDashboard, end: true },
      { to: '/admin/users', label: 'المستخدمون', icon: Users },
      { to: '/admin/users/new', label: 'إنشاء مستخدم', icon: UserPlus },
      { to: '/admin/courses', label: 'المواد', icon: FolderKanban },
      { to: '/admin/assignments', label: 'كل التكليفات', icon: ClipboardCheck }
    ] },
    { section: 'النظام', items: [
      { to: '/admin/roles', label: 'الصلاحيات', icon: ShieldCheck },
      { to: '/admin/settings', label: 'إعدادات المنصة', icon: Settings2 },
      { to: '/chats', label: 'المحادثات', icon: MessagesSquare },
      { to: '/notifications', label: 'الإشعارات', icon: Bell },
      { to: '/profile', label: 'الملف الشخصي', icon: UserRoundCog }
    ] }
  ]
};

function findTitle(pathname) {
  if (pathname.startsWith('/assignment/')) return 'تفاصيل التكليف';
  if (pathname.startsWith('/chat/')) return 'المحادثة';
  if (pathname.startsWith('/chats')) return 'المحادثات';
  if (pathname.startsWith('/notifications')) return 'الإشعارات';
  if (pathname.startsWith('/profile')) return 'الملف الشخصي';
  if (pathname.startsWith('/student/courses/')) return 'تفاصيل المادة';
  if (pathname.startsWith('/doctor/courses/new')) return 'إنشاء مادة';
  if (pathname.startsWith('/doctor/courses/')) return 'إدارة المادة';
  if (pathname.startsWith('/ta/courses/')) return 'إدارة المادة';
  if (pathname.startsWith('/admin/courses/')) return 'إدارة المادة';
  if (pathname.startsWith('/student/courses')) return 'المواد المتاحة';
  if (pathname.startsWith('/student/my-courses')) return 'موادي';
  if (pathname.startsWith('/student/assignments')) return 'التكليفات';
  if (pathname.startsWith('/student/submissions')) return 'تسليماتي';
  if (pathname.startsWith('/doctor/courses')) return 'موادي';
  if (pathname.startsWith('/doctor/assignments')) return 'التكليفات';
  if (pathname.startsWith('/doctor/submissions')) return 'التسليمات';
  if (pathname.startsWith('/ta/requests')) return 'طلبات الانضمام';
  if (pathname.startsWith('/ta/schedule')) return 'مواعيد السكاشن';
  if (pathname.startsWith('/ta/courses')) return 'موادي';
  if (pathname.startsWith('/ta/assignments')) return 'التكليفات';
  if (pathname.startsWith('/ta/submissions')) return 'التسليمات';
  if (pathname.startsWith('/admin/users/new')) return 'إنشاء مستخدم';
  if (pathname.startsWith('/admin/users')) return 'إدارة المستخدمين';
  if (pathname.startsWith('/admin/courses')) return 'إدارة المواد';
  if (pathname.startsWith('/admin/assignments')) return 'كل التكليفات';
  if (pathname.startsWith('/admin/roles')) return 'الصلاحيات';
  if (pathname.startsWith('/admin/settings')) return 'إعدادات المنصة';
  return 'مساحة العمل';
}

export default function AppShell() {
  const { user, logout, settings } = useAuth();
  const { unread } = useNotifications();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setSidebarOpen(false);
    setMenuOpen(false);
  }, [location.pathname]);

  if (!user) return null;
  const sections = NAV[user.role] || [];
  const today = new Intl.DateTimeFormat('ar-EG-u-nu-latn', {
    weekday: 'long', day: 'numeric', month: 'long'
  }).format(new Date());

  const doLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="app-shell">
      {sidebarOpen ? <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} /> : null}
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <Link to={homeFor(user.role)} className="brand">
          <span className="brand-mark"><GraduationCap size={25} /></span>
          <span className="brand-text">
            <strong>{settings.platformName || 'منصة هندسة المنوفية'}</strong>
            <small>{settings.facultyName} · {settings.universityName}</small>
          </span>
        </Link>

        <nav className="side-nav">
          {sections.map((section) => (
            <div key={section.section}>
              <div className="nav-section">{section.section}</div>
              {section.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                >
                  <item.icon size={18} />
                  <span>{item.label}</span>
                  {item.to === '/notifications' && unread > 0 ? (
                    <span className="nav-badge">{unread > 99 ? '99+' : unread}</span>
                  ) : null}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <div className="side-user">
          <Avatar name={user.fullName} src={user.avatar} size={38} />
          <div className="side-user-info">
            <strong>{user.fullName}</strong>
            <small>{roleLabel(user.role)}</small>
          </div>
          <IconButton icon={LogOut} label="تسجيل الخروج" onClick={doLogout} />
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <div className="topbar-start">
            <IconButton className="menu-btn" icon={sidebarOpen ? X : Menu} label="القائمة" onClick={() => setSidebarOpen((v) => !v)} />
            <div className="topbar-title">
              <strong>{findTitle(location.pathname)}</strong>
              <small>{settings.facultyName} · {settings.universityName}</small>
            </div>
          </div>
          <div className="topbar-end">
            <span className="topbar-date">{today}</span>
            <Link to="/notifications" className="bell" aria-label="الإشعارات">
              <Bell size={18} />
              {unread > 0 ? <span className="bell-dot">{unread > 99 ? '99+' : unread}</span> : null}
            </Link>
            <div className="profile-menu-wrap">
              <button className="profile-chip" onClick={() => setMenuOpen((v) => !v)}>
                <Avatar name={user.fullName} src={user.avatar} size={32} />
                <span>
                  <span className="name">{user.fullName}</span>
                  <span className="role">{roleLabel(user.role)}</span>
                </span>
              </button>
              {menuOpen ? (
                <>
                  <div className="menu-backdrop" onClick={() => setMenuOpen(false)} />
                  <div className="profile-menu">
                    <div className="profile-menu-head">
                      <strong>{user.fullName}</strong>
                      <small>@{user.username} · {roleLabel(user.role)}</small>
                    </div>
                    <Link to="/profile"><UserRoundCog size={16} /> الملف الشخصي</Link>
                    <Link to="/notifications"><Bell size={16} /> الإشعارات</Link>
                    <button className="danger" onClick={doLogout}><LogOut size={16} /> تسجيل الخروج</button>
                  </div>
                </>
              ) : null}
            </div>
          </div>
        </header>

        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
