import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AppLayout } from '@/app/layouts/AppLayout';
import { RequireAuth } from '@/app/RequireAuth';
import { DashboardPage } from '@/features/dashboard/DashboardPage';
import { GroupDetailPage } from '@/features/groups/GroupDetailPage';
import { GroupsPage } from '@/features/groups/GroupsPage';
import { LoginPage } from '@/features/auth/LoginPage';
import { ProfilePage } from '@/features/auth/ProfilePage';
import { RegisterPage } from '@/features/auth/RegisterPage';
import { ForbiddenPage } from '@/features/misc/ForbiddenPage';
import { NotFoundPage } from '@/features/misc/NotFoundPage';
import { OfflinePage } from '@/features/misc/OfflinePage';
import { ServerErrorPage } from '@/features/misc/ServerErrorPage';

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  { path: '/register', element: <RegisterPage /> },
  { path: '/404', element: <NotFoundPage /> },
  { path: '/403', element: <ForbiddenPage /> },
  { path: '/500', element: <ServerErrorPage /> },
  { path: '/offline', element: <OfflinePage /> },
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
      { path: '403', element: <ForbiddenPage /> },
      { path: '500', element: <ServerErrorPage /> },
      { path: 'offline', element: <OfflinePage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
  { path: '*', element: <NotFoundPage /> },
]);
