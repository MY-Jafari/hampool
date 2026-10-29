import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AppLayout } from '@/app/layouts/AppLayout';
import { RequireAuth } from '@/app/RequireAuth';
import { DashboardPage } from '@/features/dashboard/DashboardPage';
import { GroupDetailPage } from '@/features/groups/GroupDetailPage';
import { GroupsPage } from '@/features/groups/GroupsPage';
import { LoginPage } from '@/features/auth/LoginPage';
import { ProfilePage } from '@/features/auth/ProfilePage';
import { RegisterPage } from '@/features/auth/RegisterPage';
import { NotFoundPage } from '@/features/misc/NotFoundPage';

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  { path: '/register', element: <RegisterPage /> },
  {
    path: '/',
    element: (
      <RequireAuth>
        <AppLayout />
      </RequireAuth>
    ),
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      { path: 'dashboard', element: <DashboardPage /> },
      { path: 'groups', element: <GroupsPage /> },
      { path: 'groups/:groupId', element: <GroupDetailPage /> },
      { path: 'profile', element: <ProfilePage /> },
      { path: '*', element: <Navigate to="/dashboard" replace /> },
    ],
  },
  { path: '*', element: <NotFoundPage /> },
]);
