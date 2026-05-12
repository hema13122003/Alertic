import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import theme from './theme';
import DashboardLayout from './components/DashboardLayout';
import FacultyUsers from './pages/FacultyUsers';
import StudentUsers from './pages/StudentUsers';
import TableCreation from './pages/TableCreation';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import FacultyDashboard from './pages/FacultyDashboard';
import FacultyLogin from './pages/FacultyLogin';
import MyTimetable from './pages/MyTimetable';
import AlertSettings from './pages/AlertSettings';
import StudentTimetable from './pages/StudentTimetable';
import StudentDashboard from './pages/StudentDashboard';
import FacultyAddStudent from './pages/FacultyAddStudent';
import FeeManager from './pages/FeeManager';

const ProtectedRoute = ({ children, allowedRoles = [] }) => {
  const isAuthenticated = localStorage.getItem('isAuthenticated') === 'true';
  const userRole = localStorage.getItem('userRole') || 'admin';

  if (!isAuthenticated) return <Navigate to="/login" />;
  if (allowedRoles.length > 0 && !allowedRoles.includes(userRole)) {
    // Graceful redirection to the user's primary dashboard instead of a loop
    const homePath = userRole === 'faculty' ? '/faculty-dashboard' : '/dashboard';
    return <Navigate to={homePath} />;
  }
  
  return children;
};

const RootRedirect = () => {
  const isAuthenticated = localStorage.getItem('isAuthenticated') === 'true';
  const userRole = localStorage.getItem('userRole') || 'admin';

  if (!isAuthenticated) return <Navigate to="/login" />;
  if (userRole === 'faculty') return <Navigate to="/faculty-dashboard" />;
  if (userRole === 'student') return <Navigate to="/student-dashboard" />;
  return <Navigate to="/dashboard" />;
};

function App() {
  return (
    <ThemeProvider theme={theme}>
      <Router>
        <div className="w-screen h-screen overflow-hidden">
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/faculty-login" element={<FacultyLogin />} />
            <Route 
              path="/*" 
              element={
                <DashboardLayout>
                  <Routes>
                    <Route path="/" element={<RootRedirect />} />
                    <Route 
                      path="/dashboard" 
                      element={
                        <ProtectedRoute allowedRoles={['admin', 'student', 'faculty']}>
                          <Dashboard />
                        </ProtectedRoute>
                      } 
                    />
                    
                    <Route 
                      path="/faculty-dashboard" 
                      element={
                        <ProtectedRoute allowedRoles={['admin', 'faculty']}>
                          <FacultyDashboard />
                        </ProtectedRoute>
                      } 
                    />

                    <Route 
                      path="/student-dashboard" 
                      element={
                        <ProtectedRoute allowedRoles={['student']}>
                          <StudentDashboard />
                        </ProtectedRoute>
                      } 
                    />

                    <Route 
                      path="/student-timetable" 
                      element={
                        <ProtectedRoute allowedRoles={['admin', 'faculty', 'student']}>
                          <StudentTimetable />
                        </ProtectedRoute>
                      } 
                    />
                    
                    <Route 
                      path="/my-timetable" 
                      element={
                        <ProtectedRoute allowedRoles={['admin', 'faculty']}>
                          <MyTimetable />
                        </ProtectedRoute>
                      } 
                    />
                    
                    <Route 
                      path="/alert-settings" 
                      element={
                        <ProtectedRoute allowedRoles={['admin', 'faculty', 'student']}>
                          <AlertSettings />
                        </ProtectedRoute>
                      } 
                    />

                    <Route 
                      path="/faculty-students" 
                      element={
                        <ProtectedRoute allowedRoles={['admin', 'faculty']}>
                          <FacultyAddStudent />
                        </ProtectedRoute>
                      } 
                    />
                    <Route 
                      path="/fee-manager" 
                      element={
                        <ProtectedRoute allowedRoles={['admin', 'faculty']}>
                          <FeeManager />
                        </ProtectedRoute>
                      } 
                    />
                    
                    {/* Admin Only Routes */}
                    <Route 
                      path="/staff" 
                      element={
                        <ProtectedRoute allowedRoles={['admin']}>
                          <FacultyUsers />
                        </ProtectedRoute>
                      } 
                    />
                    <Route 
                      path="/students" 
                      element={
                        <ProtectedRoute allowedRoles={['admin']}>
                          <StudentUsers />
                        </ProtectedRoute>
                      } 
                    />
                    <Route 
                      path="/table-creation" 
                      element={
                        <ProtectedRoute allowedRoles={['admin']}>
                          <TableCreation />
                        </ProtectedRoute>
                      } 
                    />
                  </Routes>
                </DashboardLayout>
              } 
            />
          </Routes>
          <ToastContainer position="bottom-right" theme="dark" />
        </div>
      </Router>
    </ThemeProvider>
  );
}

export default App;
