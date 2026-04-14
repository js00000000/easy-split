import { useNavigate } from 'react-router-dom';
import { GroupSelectionView } from '../components/GroupSelectionView';
import { useAuth } from '../contexts/AuthContext';
import { useGroup } from '../contexts/GroupContext';

export function GroupSelectionPage() {
  const navigate = useNavigate();
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
