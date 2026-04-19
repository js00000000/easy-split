import { Routes, Route, Navigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useTranslation } from 'react-i18next';
import { LoadingView } from './components/LoadingView';
import { LoginView } from './components/LoginView';
import { AuthGuard } from './components/ProtectedRoute';

// Import Pages
import { GroupSelectionPage } from './pages/GroupSelectionPage';
import { MemberSelectionPage } from './pages/MemberSelectionPage';
import { GroupDashboardPage } from './pages/GroupDashboardPage';
import { MemberManagementPage } from './pages/MemberManagementPage';
import { JoinGroupPage } from './pages/JoinGroupPage';

// Import Hooks
import { useAuth } from './contexts/AuthContext';
import { useGroup } from './contexts/GroupContext';

export default function App() {
  const { t, i18n } = useTranslation();
  const { 
    user, authLoading, googleLoading, guestLoading, isSoftLoggedOut, 
    handleGoogleLogin, handleGuestLogin 
  } = useAuth();
  const { currentMemberId, currentMember, isLoading } = useGroup();

  if (authLoading) return <LoadingView />;
  
  if (!user || isSoftLoggedOut) return (
    <>
      <Helmet>
        <html lang={i18n.language} />
        <title>{t('common.seo_title')}</title>
      </Helmet>
      <LoginView
        onGoogleLogin={handleGoogleLogin}
        onGuestLogin={handleGuestLogin}
        isGoogleLoading={googleLoading}
        isGuestLoading={guestLoading}
      />
    </>
  );

  return (
    <>
      <Helmet>
        <html lang={i18n.language} />
        <title>{t('common.seo_title')}</title>
        <meta name="description" content={t('common.seo_description')} />
        <meta property="og:title" content={t('common.seo_title')} />
        <meta property="og:description" content={t('common.seo_description')} />
        <meta property="twitter:title" content={t('common.seo_title')} />
        <meta property="twitter:description" content={t('common.seo_description')} />
      </Helmet>
      
      {isLoading ? (
        <LoadingView />
      ) : (
        <Routes>
          <Route element={<AuthGuard />}>
            <Route path="/" element={<GroupSelectionPage />} />

            <Route path="/group/:groupId" element={
              !currentMemberId || !currentMember ? (
                <MemberSelectionPage />
              ) : (
                <GroupDashboardPage />
              )
            } />

            <Route path="/group/:groupId/members" element={<MemberManagementPage />} />
            <Route path="/join/:groupId" element={<JoinGroupPage />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      )}
    </>
  );
}
