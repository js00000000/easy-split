import { createContext, useContext, useState, useCallback } from 'react';
import type { ReactNode } from 'react';
import { AlertCircle, HelpCircle } from 'lucide-react';

interface DialogOptions {
  title?: string;
  confirmLabel?: string;
  cancelLabel?: string;
}

interface DialogContextType {
  alert: (message: string, options?: DialogOptions) => Promise<void>;
  confirm: (message: string, options?: DialogOptions) => Promise<boolean>;
}

const DialogContext = createContext<DialogContextType | undefined>(undefined);

export function DialogProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [type, setType] = useState<'alert' | 'confirm'>('alert');
  const [message, setMessage] = useState('');
  const [title, setTitle] = useState('');
  const [confirmLabel, setConfirmLabel] = useState('確定');
  const [cancelLabel, setCancelLabel] = useState('取消');
  const [resolvePromise, setResolvePromise] = useState<((value: void | boolean) => void) | null>(null);

  const showAlert = useCallback((message: string, options?: DialogOptions) => {
    setMessage(message);
    setTitle(options?.title || '提示');
    setConfirmLabel(options?.confirmLabel || '確定');
    setType('alert');
    setIsOpen(true);
    return new Promise<void>((resolve) => {
      setResolvePromise(() => resolve);
    });
  }, []);

  const showConfirm = useCallback((message: string, options?: DialogOptions) => {
    setMessage(message);
    setTitle(options?.title || '確認');
    setConfirmLabel(options?.confirmLabel || '確定');
    setCancelLabel(options?.cancelLabel || '取消');
    setType('confirm');
    setIsOpen(true);
    return new Promise<boolean>((resolve) => {
      setResolvePromise(() => resolve);
    });
  }, []);

  const handleConfirm = () => {
    setIsOpen(false);
    if (resolvePromise) {
      if (type === 'confirm') resolvePromise(true);
      else resolvePromise(undefined);
    }
  };

  const handleCancel = () => {
    setIsOpen(false);
    if (resolvePromise && type === 'confirm') {
      resolvePromise(false);
    }
  };

  return (
    <DialogContext.Provider value={{ alert: showAlert, confirm: showConfirm }}>
      {children}
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200" onClick={type === 'alert' ? handleConfirm : undefined} />
          <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl z-10 overflow-hidden animate-in zoom-in-95 fade-in duration-200">
            <div className="px-6 pt-6 pb-4">
              <div className="flex items-start gap-4">
                <div className={`p-2 rounded-full flex-shrink-0 ${type === 'confirm' ? 'bg-amber-100 text-amber-600' : 'bg-indigo-100 text-indigo-600'}`}>
                  {type === 'confirm' ? <HelpCircle className="w-6 h-6" /> : <AlertCircle className="w-6 h-6" />}
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-gray-900 leading-tight mb-1">{title}</h3>
                  <p className="text-gray-600 text-sm whitespace-pre-wrap leading-relaxed">{message}</p>
                </div>
              </div>
            </div>
            <div className="px-6 py-4 bg-gray-50 flex flex-row-reverse gap-3">
              <button
                onClick={handleConfirm}
                className="flex-1 px-4 py-2.5 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 active:scale-[0.98] transition-all shadow-sm"
              >
                {confirmLabel}
              </button>
              {type === 'confirm' && (
                <button
                  onClick={handleCancel}
                  className="flex-1 px-4 py-2.5 bg-white text-gray-700 text-sm font-semibold rounded-xl border border-gray-200 hover:bg-gray-100 active:scale-[0.98] transition-all"
                >
                  {cancelLabel}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </DialogContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useDialog() {
  const context = useContext(DialogContext);
  if (!context) throw new Error('useDialog must be used within DialogProvider');
  return context;
}
