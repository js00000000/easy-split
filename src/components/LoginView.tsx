import { LogIn, UserCircle, Languages } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface LoginViewProps {
  onGoogleLogin: () => void;
  onGuestLogin: () => void;
}

export function LoginView({ onGoogleLogin, onGuestLogin }: LoginViewProps) {
  const { t, i18n } = useTranslation();

  const toggleLanguage = () => {
    const newLang = i18n.language.startsWith('zh') ? 'en' : 'zh-TW';
    i18n.changeLanguage(newLang);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl border border-gray-100 p-8 space-y-8 animate-in fade-in zoom-in duration-300">
        <div className="text-center space-y-3">
          <div className="relative">
            <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-xs font-black tracking-widest uppercase text-indigo-400">Slice</span>
            <div className="w-20 h-20 bg-gradient-to-br from-indigo-500 to-purple-600 text-white rounded-3xl flex items-center justify-center mx-auto shadow-lg rotate-3">
              <LogIn className="w-10 h-10" />
            </div>
          </div>
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">{t('auth.login_title')}</h1>
          <p className="text-gray-500 font-medium">{t('auth.login_subtitle')}</p>
        </div>

        <div className="space-y-4 pt-4">
          <button 
            onClick={onGoogleLogin}
            className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-white border-2 border-gray-100 rounded-2xl font-bold text-gray-700 hover:border-indigo-600 hover:bg-gray-50 transition-all duration-200 group active:scale-[0.98]"
          >
            <img src="https://www.google.com/favicon.ico" alt="Google" className="w-5 h-5" />
            {t('auth.google_login')}
          </button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-100"></div>
            </div>
            <div className="relative flex justify-center text-xs uppercase tracking-widest font-bold">
              <span className="px-4 bg-white text-gray-400">OR</span>
            </div>
          </div>

          <button 
            onClick={onGuestLogin}
            className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 shadow-md shadow-indigo-200 transition-all duration-200 active:scale-[0.98]"
          >
            <UserCircle className="w-6 h-6" />
            {t('auth.guest_login')}
          </button>
          
          <div className="pt-2 border-t border-gray-50 flex justify-center">
            <button 
              onClick={toggleLanguage}
              className="flex items-center gap-2 text-sm font-medium text-indigo-600 hover:text-indigo-700 transition-colors"
            >
              <Languages className="w-4 h-4" />
              {i18n.language.startsWith('zh') ? 'English' : '繁體中文'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
