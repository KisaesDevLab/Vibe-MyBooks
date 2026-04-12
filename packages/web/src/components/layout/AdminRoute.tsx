import { Navigate } from 'react-router-dom';
import { useMe } from '../../api/hooks/useAuth';

interface AdminRouteProps {
  children: React.ReactNode;
}

export function AdminRoute({ children }: AdminRouteProps) {
  const { data: meData } = useMe();

  if (meData && !meData.user?.isSuperAdmin) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
