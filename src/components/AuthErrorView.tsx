import { X } from 'lucide-react';

interface AuthErrorViewProps {
  error: string;
}

export function AuthErrorView({ error }: AuthErrorViewProps) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="bg-white border-l-4 border-red-500 shadow-sm p-6 rounded-xl max-w-md w-full">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-red-100 text-red-500 rounded-full flex items-center justify-center shrink-0">
            <X className="w-5 h-5" />
          </div>
          <h2 className="font-bold text-lg text-gray-900">Firebase 驗證錯誤</h2>
        </div>
        <div className="text-gray-600 text-sm space-y-4">
          <p className="font-mono text-xs bg-gray-100 p-2 rounded text-red-600 break-words">{error}</p>
          <p>這個錯誤通常是因為您的 Firebase 專案尚未啟用<strong>「匿名登入 (Anonymous)」</strong>所導致的。</p>
          <div className="bg-blue-50 text-blue-800 p-4 rounded-lg">
            <strong className="block mb-2 text-blue-900">請按照以下步驟解決：</strong>
            <ol className="list-decimal ml-4 space-y-1">
              <li>前往您的 Firebase 控制台。</li>
              <li>在左側選單選擇 <strong>Authentication</strong> (驗證)。</li>
              <li>切換到上方 <strong>Sign-in method</strong> (登入方式) 頁籤。</li>
              <li>找到 <strong>Anonymous</strong> (匿名) 並將其<strong>啟用 (Enable)</strong>。</li>
              <li>儲存設定後，重新整理這個網頁。</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}
