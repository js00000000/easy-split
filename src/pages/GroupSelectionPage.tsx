import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { GroupSelectionView } from '../components/GroupSelectionView';
import { useAuth } from '../contexts/AuthContext';
import { useGroup } from '../contexts/GroupContext';

export function GroupSelectionPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user, handleGoogleLogin, handleLogout } = useAuth();
  const { myGroups, handleCreateGroup, handleJoinGroup } = useGroup();

  return (
    <GroupSelectionView
      user={user}
      myGroups={myGroups}
      onGoogleLogin={handleGoogleLogin}
      onLogout={handleLogout}
      onCreateGroup={handleCreateGroup}
      onJoinGroup={handleJoinGroup}
      onSelectGroup={(id) => navigate(`/group/${id}`)}
    />
  );
}
