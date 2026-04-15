import { useNavigate, useParams } from 'react-router-dom';
import { MemberManagementView } from '../components/MemberManagementView';
import { useGroup } from '../contexts/GroupContext';

export function MemberManagementPage() {
  const navigate = useNavigate();
  const { groupId } = useParams();
  const { 
    members, expenses, currentMember, currentGroup, 
    handleDeleteMember, handleDeleteAllExpenses, handleUpdateGroupName, handleDeleteGroup,
    handleCreateMemberByHost
  } = useGroup();

  if (!currentMember) return null;

  return (
    <MemberManagementView
      members={members}
      expenses={expenses}
      currentMember={currentMember}
      currentGroup={currentGroup}
      onBack={() => navigate(`/group/${groupId}`)}
      onDeleteMember={handleDeleteMember}
      onDeleteAllExpenses={handleDeleteAllExpenses}
      onUpdateGroupName={handleUpdateGroupName}
      onDeleteGroup={handleDeleteGroup}
      onCreateMember={handleCreateMemberByHost}
    />
  );
}
