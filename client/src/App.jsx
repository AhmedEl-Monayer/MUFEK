import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth, homeFor } from './context/AuthContext.jsx';
import { FullLoader } from './components/ui.jsx';
import AppShell from './components/AppShell.jsx';

import Login from './pages/Login.jsx';
import Forgot from './pages/Forgot.jsx';
import Reset from './pages/Reset.jsx';
import CompleteProfile from './pages/CompleteProfile.jsx';
import Notifications from './pages/Notifications.jsx';
import Profile from './pages/Profile.jsx';
import ChatHub from './pages/ChatHub.jsx';
import ChatPage from './pages/ChatPage.jsx';
import AssignmentDetail from './pages/AssignmentDetail.jsx';
import NotFound from './pages/NotFound.jsx';

import StudentDashboard from './pages/student/Dashboard.jsx';
import AvailableCourses from './pages/student/AvailableCourses.jsx';
import MyCourses from './pages/student/MyCourses.jsx';
import StudentCourse from './pages/student/StudentCourse.jsx';
import StudentAssignments from './pages/student/Assignments.jsx';
import MySubmissions from './pages/student/Submissions.jsx';

import DoctorDashboard from './pages/doctor/Dashboard.jsx';
import DoctorCourses from './pages/doctor/Courses.jsx';
import CreateCourse from './pages/doctor/CreateCourse.jsx';

import TaDashboard from './pages/ta/Dashboard.jsx';
import TaCourses from './pages/ta/Courses.jsx';
import TaRequests from './pages/ta/Requests.jsx';
import TaSchedule from './pages/ta/Schedule.jsx';

import StaffAssignments from './pages/staff/Assignments.jsx';
import StaffSubmissions from './pages/staff/Submissions.jsx';
import CourseWorkspace from './pages/staff/CourseWorkspace.jsx';

import AdminDashboard from './pages/admin/Dashboard.jsx';
import AdminUsers from './pages/admin/Users.jsx';
import AdminCreateUser from './pages/admin/CreateUser.jsx';
import AdminCourses from './pages/admin/Courses.jsx';
import AdminAssignments from './pages/admin/Assignments.jsx';
import AdminRoles from './pages/admin/Roles.jsx';
import AdminSettings from './pages/admin/Settings.jsx';

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
  );
}
