import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useGroup } from '../contexts/GroupContext';
import { LoadingView } from './LoadingView';

/**
 * Ensures user is authenticated.
 */
export function AuthGuard() {
  const { user, authLoading, isSoftLoggedOut } = useAuth();

  if (authLoading) return <LoadingView />;
  if (!user || isSoftLoggedOut) return <Navigate to="/" replace />;

  return <Outlet />;
}

/**
 * Ensures user is a member of the group before showing dashboard.
 */
export function GroupMemberGuard() {
  const { isLoading } = useGroup();

  if (isLoading) return <LoadingView />;
  
  return <Outlet />;
}
