import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useTranslation } from 'react-i18next';
import { GroupSelectionView } from '../components/GroupSelectionView';
import { useAuth } from '../contexts/AuthContext';
import { useGroup } from '../contexts/GroupContext';

export function GroupSelectionPage() {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const { user, handleGoogleLogin, handleLogout } = useAuth();
  const { myGroups, handleCreateGroup, handleJoinGroup } = useGroup();

  return (
    <>
      <Helmet>
        <html lang={i18n.language} />
        <title>{t('groups.my_groups')} - Slice</title>
        <meta name="description" content={t('common.seo_description')} />
        <meta property="og:title" content={`${t('groups.my_groups')} - Slice`} />
        <meta property="og:description" content={t('common.seo_description')} />
        <meta property="twitter:title" content={`${t('groups.my_groups')} - Slice`} />
        <meta property="twitter:description" content={t('common.seo_description')} />
      </Helmet>
      <GroupSelectionView
        user={user}
        myGroups={myGroups}
        onGoogleLogin={handleGoogleLogin}
        onLogout={handleLogout}
        onCreateGroup={handleCreateGroup}
        onJoinGroup={handleJoinGroup}
        onSelectGroup={(id) => navigate(`/group/${id}`)}
      />
    </>
  );
}
