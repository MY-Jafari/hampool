import { lazy, Suspense } from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AppLayout } from '@/app/layouts/AppLayout';
import { RequireAuth } from '@/app/RequireAuth';
import { Skeleton } from '@/shared/components/ui/skeleton';

const LoginPage = lazy(() =>
  import('@/features/auth/LoginPage').then((m) => ({ default: m.LoginPage })),
);
const RegisterPage = lazy(() =>
  import('@/features/auth/RegisterPage').then((m) => ({ default: m.RegisterPage })),
);
const DashboardPage = lazy(() =>
  import('@/features/dashboard/DashboardPage').then((m) => ({ default: m.DashboardPage })),
);
const GroupsPage = lazy(() =>
  import('@/features/groups/GroupsPage').then((m) => ({ default: m.GroupsPage })),
);
const GroupDetailPage = lazy(() =>
  import('@/features/groups/GroupDetailPage').then((m) => ({ default: m.GroupDetailPage })),
);
const ProfilePage = lazy(() =>
  import('@/features/auth/ProfilePage').then((m) => ({ default: m.ProfilePage })),
);
const NotFoundPage = lazy(() =>
  import('@/features/misc/NotFoundPage').then((m) => ({ default: m.NotFoundPage })),
);
const ForbiddenPage = lazy(() =>
  import('@/features/misc/ForbiddenPage').then((m) => ({ default: m.ForbiddenPage })),
);
const ServerErrorPage = lazy(() =>
  import('@/features/misc/ServerErrorPage').then((m) => ({ default: m.ServerErrorPage })),
);
const OfflinePage = lazy(() =>
  import('@/features/misc/OfflinePage').then((m) => ({ default: m.OfflinePage })),
);

function RouteFallback() {
  return (
    <div className="space-y-5 p-4 sm:p-6" role="status" aria-label="Loading page content">
      <Skeleton className="h-9 w-44 rounded-xl" />
      <Skeleton className="h-36 w-full rounded-2xl" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Skeleton className="h-28 rounded-xl" />
        <Skeleton className="h-28 rounded-xl" />
      </div>
    </div>
  );
}

const withSuspense = (Component: React.ComponentType) => (
  <Suspense fallback={<RouteFallback />}>
    <Component />
  </Suspense>
);

export const router = createBrowserRouter([
  { path: '/login', element: withSuspense(LoginPage) },
  { path: '/register', element: withSuspense(RegisterPage) },
  { path: '/404', element: withSuspense(NotFoundPage) },
  { path: '/403', element: withSuspense(ForbiddenPage) },
  { path: '/500', element: withSuspense(ServerErrorPage) },
  { path: '/offline', element: withSuspense(OfflinePage) },
  {
    path: '/',
    element: (
      <RequireAuth>
        <AppLayout />
      </RequireAuth>
    ),
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      { path: 'dashboard', element: withSuspense(DashboardPage) },
      { path: 'groups', element: withSuspense(GroupsPage) },
      { path: 'groups/:groupId', element: withSuspense(GroupDetailPage) },
      { path: 'profile', element: withSuspense(ProfilePage) },
      { path: '403', element: withSuspense(ForbiddenPage) },
      { path: '500', element: withSuspense(ServerErrorPage) },
      { path: 'offline', element: withSuspense(OfflinePage) },
      { path: '*', element: withSuspense(NotFoundPage) },
    ],
  },
  { path: '*', element: withSuspense(NotFoundPage) },
]);
