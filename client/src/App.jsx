import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth, homeFor } from './context/AuthContext.jsx';
import { FullLoader } from './components/ui.jsx';
import AppShell from './components/AppShell.jsx';

// تحميل كل صفحة عند فتحها فقط؛ يقلّل حجم ملف JavaScript الأولي بشكل كبير.
const Login = lazy(() => import('./pages/Login.jsx'));
const Forgot = lazy(() => import('./pages/Forgot.jsx'));
const Reset = lazy(() => import('./pages/Reset.jsx'));
const CompleteProfile = lazy(() => import('./pages/CompleteProfile.jsx'));
const Notifications = lazy(() => import('./pages/Notifications.jsx'));
const Profile = lazy(() => import('./pages/Profile.jsx'));
const ChatHub = lazy(() => import('./pages/ChatHub.jsx'));
const ChatPage = lazy(() => import('./pages/ChatPage.jsx'));
const AssignmentDetail = lazy(() => import('./pages/AssignmentDetail.jsx'));
const NotFound = lazy(() => import('./pages/NotFound.jsx'));

const StudentDashboard = lazy(() => import('./pages/student/Dashboard.jsx'));
const AvailableCourses = lazy(() => import('./pages/student/AvailableCourses.jsx'));
const MyCourses = lazy(() => import('./pages/student/MyCourses.jsx'));
const StudentCourse = lazy(() => import('./pages/student/StudentCourse.jsx'));
const StudentAssignments = lazy(() => import('./pages/student/Assignments.jsx'));
const MySubmissions = lazy(() => import('./pages/student/Submissions.jsx'));

const DoctorDashboard = lazy(() => import('./pages/doctor/Dashboard.jsx'));
const DoctorCourses = lazy(() => import('./pages/doctor/Courses.jsx'));
const CreateCourse = lazy(() => import('./pages/doctor/CreateCourse.jsx'));

const TaDashboard = lazy(() => import('./pages/ta/Dashboard.jsx'));
const TaCourses = lazy(() => import('./pages/ta/Courses.jsx'));
const TaRequests = lazy(() => import('./pages/ta/Requests.jsx'));
const TaSchedule = lazy(() => import('./pages/ta/Schedule.jsx'));

const StaffAssignments = lazy(() => import('./pages/staff/Assignments.jsx'));
const StaffSubmissions = lazy(() => import('./pages/staff/Submissions.jsx'));
const CourseWorkspace = lazy(() => import('./pages/staff/CourseWorkspace.jsx'));

const AdminDashboard = lazy(() => import('./pages/admin/Dashboard.jsx'));
const AdminUsers = lazy(() => import('./pages/admin/Users.jsx'));
const AdminCreateUser = lazy(() => import('./pages/admin/CreateUser.jsx'));
const AdminCourses = lazy(() => import('./pages/admin/Courses.jsx'));
const AdminAssignments = lazy(() => import('./pages/admin/Assignments.jsx'));
const AdminRoles = lazy(() => import('./pages/admin/Roles.jsx'));
const AdminSettings = lazy(() => import('./pages/admin/Settings.jsx'));

function RootRedirect() {
  const { user, loading } = useAuth();
  if (loading) return <FullLoader label="جارٍ فتح المنصة..." />;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === 'student' && !user.profileCompleted) return <Navigate to="/complete-profile" replace />;
  return <Navigate to={homeFor(user.role)} replace />;
}

function PublicOnly({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <FullLoader label="جارٍ التحميل..." />;
  if (user) {
    if (user.role === 'student' && !user.profileCompleted) return <Navigate to="/complete-profile" replace />;
    return <Navigate to={homeFor(user.role)} replace />;
  }
  return children;
}

function ProtectedLayout() {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <FullLoader label="جارٍ تجهيز مساحة العمل..." />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (user.role === 'student' && !user.profileCompleted) return <Navigate to="/complete-profile" replace />;
  return <AppShell />;
}

function ProfileRoute() {
  const { user, loading } = useAuth();
  if (loading) return <FullLoader label="جارٍ التحميل..." />;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'student') return <Navigate to={homeFor(user.role)} replace />;
  if (user.profileCompleted) return <Navigate to="/student" replace />;
  return <CompleteProfile />;
}

function RoleGate({ roles, children }) {
  const { user } = useAuth();
  if (!user || !roles.includes(user.role)) return <Navigate to={user ? homeFor(user.role) : '/login'} replace />;
  return children;
}

export default function App() {
  return (
    <Suspense fallback={<FullLoader label="جارٍ تحميل الصفحة..." />}>
      <Routes>
      <Route path="/" element={<RootRedirect />} />
      <Route path="/login" element={<PublicOnly><Login /></PublicOnly>} />
      <Route path="/forgot" element={<PublicOnly><Forgot /></PublicOnly>} />
      <Route path="/reset" element={<PublicOnly><Reset /></PublicOnly>} />
      <Route path="/complete-profile" element={<ProfileRoute />} />

      <Route element={<ProtectedLayout />}>
        <Route path="/notifications" element={<Notifications />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/chats" element={<ChatHub />} />
        <Route path="/chat/:id" element={<ChatPage />} />
        <Route path="/assignment/:id" element={<AssignmentDetail />} />

        <Route path="/student" element={<RoleGate roles={['student']}><StudentDashboard /></RoleGate>} />
        <Route path="/student/courses" element={<RoleGate roles={['student']}><AvailableCourses /></RoleGate>} />
        <Route path="/student/my-courses" element={<RoleGate roles={['student']}><MyCourses /></RoleGate>} />
        <Route path="/student/courses/:id/:tab?" element={<RoleGate roles={['student']}><StudentCourse /></RoleGate>} />
        <Route path="/student/assignments" element={<RoleGate roles={['student']}><StudentAssignments /></RoleGate>} />
        <Route path="/student/submissions" element={<RoleGate roles={['student']}><MySubmissions /></RoleGate>} />

        <Route path="/doctor" element={<RoleGate roles={['doctor']}><DoctorDashboard /></RoleGate>} />
        <Route path="/doctor/courses" element={<RoleGate roles={['doctor']}><DoctorCourses /></RoleGate>} />
        <Route path="/doctor/courses/new" element={<RoleGate roles={['doctor']}><CreateCourse /></RoleGate>} />
        <Route path="/doctor/courses/:id/:tab?" element={<RoleGate roles={['doctor']}><CourseWorkspace /></RoleGate>} />
        <Route path="/doctor/assignments" element={<RoleGate roles={['doctor']}><StaffAssignments /></RoleGate>} />
        <Route path="/doctor/submissions" element={<RoleGate roles={['doctor']}><StaffSubmissions /></RoleGate>} />

        <Route path="/ta" element={<RoleGate roles={['ta']}><TaDashboard /></RoleGate>} />
        <Route path="/ta/courses" element={<RoleGate roles={['ta']}><TaCourses /></RoleGate>} />
        <Route path="/ta/courses/:id/:tab?" element={<RoleGate roles={['ta']}><CourseWorkspace /></RoleGate>} />
        <Route path="/ta/requests" element={<RoleGate roles={['ta']}><TaRequests /></RoleGate>} />
        <Route path="/ta/schedule" element={<RoleGate roles={['ta']}><TaSchedule /></RoleGate>} />
        <Route path="/ta/assignments" element={<RoleGate roles={['ta']}><StaffAssignments /></RoleGate>} />
        <Route path="/ta/submissions" element={<RoleGate roles={['ta']}><StaffSubmissions /></RoleGate>} />

        <Route path="/admin" element={<RoleGate roles={['developer']}><AdminDashboard /></RoleGate>} />
        <Route path="/admin/users" element={<RoleGate roles={['developer']}><AdminUsers /></RoleGate>} />
        <Route path="/admin/users/new" element={<RoleGate roles={['developer']}><AdminCreateUser /></RoleGate>} />
        <Route path="/admin/courses" element={<RoleGate roles={['developer']}><AdminCourses /></RoleGate>} />
        <Route path="/admin/courses/:id/:tab?" element={<RoleGate roles={['developer']}><CourseWorkspace /></RoleGate>} />
        <Route path="/admin/assignments" element={<RoleGate roles={['developer']}><AdminAssignments /></RoleGate>} />
        <Route path="/admin/roles" element={<RoleGate roles={['developer']}><AdminRoles /></RoleGate>} />
        <Route path="/admin/settings" element={<RoleGate roles={['developer']}><AdminSettings /></RoleGate>} />

        <Route path="*" element={<NotFound />} />
      </Route>
      </Routes>
    </Suspense>
  );
}
