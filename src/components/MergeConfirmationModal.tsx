import { X, AlertTriangle } from 'lucide-react';

interface AbandonGuestConfirmationModalProps {
  onClose: () => void;
  onConfirm: () => void;
}

export function AbandonGuestConfirmationModal({ onClose, onConfirm }: AbandonGuestConfirmationModalProps) {
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-sm rounded-2xl shadow-xl flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h2 className="text-lg font-semibold text-gray-900">帳號已存在</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto">
            <AlertTriangle className="w-6 h-6" />
          </div>

          <div className="text-center space-y-2">
            <p className="text-gray-900 font-medium">此 Google 帳號已在其他裝置使用過</p>
            <p className="text-gray-500 text-sm">
              如果您繼續登入，將會切換到該帳號，目前的暫時資料（如建立的群組）將會遺失。
            </p>
          </div>

          <div className="space-y-3 pt-2">
            <button
              onClick={onConfirm}
              className="w-full py-3 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-colors"
            >
              捨棄目前資料並登入
            </button>
            <button
              onClick={onClose}
              className="w-full py-3 bg-white text-gray-700 border border-gray-200 rounded-xl font-medium hover:bg-gray-50 transition-colors"
            >
              取消
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
