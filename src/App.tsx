import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthErrorView } from './components/AuthErrorView';
import { LoadingView } from './components/LoadingView';

// Import Pages
import { GroupSelectionPage } from './pages/GroupSelectionPage';
import { MemberSelectionPage } from './pages/MemberSelectionPage';
import { GroupDashboard } from './pages/GroupDashboard';
import { MemberManagementPage } from './pages/MemberManagementPage';

// Import Hooks
import { useAuth } from './contexts/AuthContext';
import { useGroup } from './contexts/GroupContext';

export default function App() {
  const { authLoading, authError } = useAuth();
  const { currentMemberId, currentMember, isLoading } = useGroup();

  if (authError) return <AuthErrorView error={authError} />;
  if (authLoading || isLoading) return <LoadingView />;

  return (
    <Routes>
      <Route path="/" element={<GroupSelectionPage />} />
      
      <Route path="/group/:groupId" element={
        !currentMemberId || !currentMember ? (
          <MemberSelectionPage />
        ) : (
          <GroupDashboard />
        )
      } />

      <Route path="/group/:groupId/members" element={<MemberManagementPage />} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
