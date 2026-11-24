import { Navigate, Route, Routes } from 'react-router-dom';
import {
  ProtectedRoute,
  QueueStatusRedirect,
} from './components/ProtectedRoute';
import HomePage from './pages/HomePage';
import JoinQueuePage from './pages/JoinQueuePage';
import BarberViewPage from './pages/BarberViewPage';
import QueueStatusPage from './pages/QueueStatusPage';
import ReceptionDashboardPage from './pages/ReceptionDashboardPage';
import WaitingAreaDisplayPage from './pages/WaitingAreaDisplayPage';
import OwnerAdminPage from './pages/OwnerAdminPage';
import LoginPage from './pages/LoginPage';
import UnauthorizedPage from './pages/UnauthorizedPage';

function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/join"
        element={
          <ProtectedRoute allowedRoles={['CUSTOMER']}>
            <JoinQueuePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/status"
        element={
          <ProtectedRoute allowedRoles={['CUSTOMER']}>
            <QueueStatusRedirect />
          </ProtectedRoute>
        }
      />
      <Route
        path="/status/:id"
        element={
          <ProtectedRoute allowedRoles={['CUSTOMER']}>
            <QueueStatusPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/barber/:barberId"
        element={
          <ProtectedRoute allowedRoles={['OWNER', 'BARBER']}>
            <BarberViewPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/reception"
        element={
          <ProtectedRoute allowedRoles={['OWNER', 'RECEPTIONIST']}>
            <ReceptionDashboardPage />
          </ProtectedRoute>
        }
      />
      <Route path="/display" element={<WaitingAreaDisplayPage />} />
      <Route
        path="/admin"
        element={
          <ProtectedRoute allowedRoles={['OWNER']}>
            <OwnerAdminPage />
          </ProtectedRoute>
        }
      />
      <Route path="/unauthorized" element={<UnauthorizedPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
