import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';
import { useGroup } from '../contexts/GroupContext';
import { LoadingView } from '../components/LoadingView';

export function JoinGroupPage() {
  const { groupId } = useParams<{ groupId: string }>();
  const navigate = useNavigate();
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
          toast.error("加入群組失敗，請確認連結是否正確。");
          setError("加入群組失敗，請確認連結是否正確。");
          setIsJoining(false);
        }
      };
      join();
    }
  }, [user, groupId, handleJoinGroup, isJoining, authLoading]);

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow-sm border text-center space-y-4 max-w-sm w-full">
          <h2 className="text-xl font-bold text-red-600">發生錯誤</h2>
          <p className="text-gray-600">{error}</p>
          <button 
            onClick={() => navigate('/')}
            className="w-full py-2 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-colors"
          >
            回首頁
          </button>
        </div>
      </div>
    );
  }

  // If user is not logged in, they are still waiting for onAuthStateChanged to trigger signInAnonymously
  // App.tsx handles authLoading and authError, so if we are here and !user, it means it's still initializing.
  // Actually, GroupContext's handleJoinGroup also handles navigation.

  return <LoadingView message="正在加入群組..." />;
}
