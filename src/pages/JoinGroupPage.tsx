import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';
import { useGroup } from '../contexts/GroupContext';
import { LoadingView } from '../components/LoadingView';

export function JoinGroupPage() {
  const { groupId } = useParams<{ groupId: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user, authLoading } = useAuth();
  const { handleJoinGroup } = useGroup();
  const [error, setError] = useState<string | null>(null);
  const [isJoining, setIsJoining] = useState(false);

  useEffect(() => {
    // Wait for auth to initialize (handled by App's authLoading check, but safe here too)
    if (authLoading) return;

    if (user && groupId && !isJoining) {
      const join = async () => {
        setIsJoining(true);
        try {
          // handleJoinGroup in GroupContext already navigates to /group/:id on success
          await handleJoinGroup(groupId);
        } catch (err) {
          console.error("Auto-join error:", err);
          toast.error(t('common.error'));
          setError(t('common.error'));
          setIsJoining(false);
        }
      };
      join();
    }
  }, [user, groupId, handleJoinGroup, isJoining, authLoading, t]);

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow-sm border text-center space-y-4 max-w-sm w-full">
          <h2 className="text-xl font-bold text-red-600">{t('common.error')}</h2>
          <p className="text-gray-600">{error}</p>
          <button
            onClick={() => navigate('/')}
            className="w-full py-2 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-colors"
          >
            {t('common.back')}
          </button>
        </div>
      </div>
    );
  }

  return <LoadingView message={t('common.loading')} />;
}
