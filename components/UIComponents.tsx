import React, { useState } from 'react';
import { AlertCircle, X, Trash2, CheckCircle2, ArrowUp, ArrowDown, ChevronsUpDown } from 'lucide-react';

export type SortDirection = 'asc' | 'desc';

export interface SortConfig<T> {
    key: keyof T | null;
    direction: SortDirection;
}

interface SortableHeaderProps<T> {
    label: string;
    offsetKey: keyof T;
    currentSort: SortConfig<T>;
    onSort: (key: keyof T) => void;
    align?: 'left' | 'right';
}

export const SortableHeader = <T,>({ label, offsetKey, currentSort, onSort, align = 'left' }: SortableHeaderProps<T>) => {
    const getSortIcon = () => {
        if (currentSort.key !== offsetKey) return <ChevronsUpDown size={14} className="text-gray-400 opacity-0 group-hover:opacity-50" />;
        return currentSort.direction === 'asc' ? <ArrowUp size={14} className="text-purple-600" /> : <ArrowDown size={14} className="text-purple-600" />;
    };

    return (
        <th
            className={`px-6 py-3 text-${align} text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer group hover:bg-gray-100 transition-colors select-none`}
            onClick={() => onSort(offsetKey)}
        >
            <div className={`flex items-center gap-1 ${align === 'right' ? 'justify-end' : ''}`}>
                {label}
                {getSortIcon()}
            </div>
        </th>
    );
};

interface ConfirmDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => Promise<void>;
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    isDestructive?: boolean;
}

const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
    isOpen,
    onClose,
    onConfirm,
    title,
    message,
    confirmLabel = 'Confirm',
    cancelLabel = 'Cancel',
    isDestructive = false
}) => {
    const [isLoading, setIsLoading] = useState(false);

    const handleConfirm = async () => {
        setIsLoading(true);
        try {
            await onConfirm();
            onClose();
        } catch (e) {
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden transform transition-all scale-100">
                <div className="p-6">
                    <div className="flex items-start gap-4">
                        <div className={`p-3 rounded-full ${isDestructive ? 'bg-rose-100 text-rose-600' : 'bg-blue-100 text-blue-600'}`}>
                            <AlertCircle size={24} />
                        </div>
                        <div className="flex-1">
                            <h3 className="text-lg font-bold text-gray-900 mb-2">{title}</h3>
                            <p className="text-sm text-gray-500 leading-relaxed">
                                {message}
                            </p>
                        </div>
                        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
                            <X size={20} />
                        </button>
                    </div>
                </div>

                <div className="px-6 py-4 bg-gray-50 flex justify-end gap-3 border-t border-gray-100">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                        disabled={isLoading}
                    >
                        {cancelLabel}
                    </button>
                    <button
                        onClick={handleConfirm}
                        disabled={isLoading}
                        className={`px-4 py-2 text-sm font-medium text-white rounded-lg shadow-sm flex items-center gap-2 transition-all
         ${isDestructive
                                ? 'bg-rose-600 hover:bg-rose-700 hover:shadow-rose-100'
                                : 'bg-indigo-600 hover:bg-indigo-700 hover:shadow-indigo-100'}
         ${isLoading ? 'opacity-70 cursor-wait' : ''}
       `}
                    >
                        {isDestructive && <Trash2 size={16} />}
                        {isLoading ? 'Processing...' : confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    );
};

export interface ToastProps {
    id: string;
    type: 'success' | 'error' | 'info';
    message: string;
    duration?: number;
}

export const Toast: React.FC<{ toast: ToastProps, onDismiss: (id: string) => void }> = ({ toast, onDismiss }) => {
    React.useEffect(() => {
        if (toast.duration) {
            const timer = setTimeout(() => {
                onDismiss(toast.id);
            }, toast.duration);
            return () => clearTimeout(timer);
        }
    }, [toast, onDismiss]);

    const icons = {
        success: <CheckCircle2 size={18} className="text-emerald-500" />,
        error: <AlertCircle size={18} className="text-rose-500" />,
        info: <AlertCircle size={18} className="text-blue-500" />
    };

    const bgColors = {
        success: 'bg-white border-emerald-100',
        error: 'bg-white border-rose-100',
        info: 'bg-white border-blue-100'
    };

    return (
        <div className={`flex items-center gap-3 p-4 rounded-xl shadow-lg border ${bgColors[toast.type]} animate-in slide-in-from-right-10 fade-in duration-300 max-w-sm pointer-events-auto`}>
            <div className="flex-shrink-0">
                {icons[toast.type]}
            </div>
            <p className="text-sm font-medium text-gray-800">{toast.message}</p>
            <button onClick={() => onDismiss(toast.id)} className="ml-auto text-gray-400 hover:text-gray-600">
                <X size={14} />
            </button>
        </div>
    );
};

export const ToastContainer: React.FC<{ toasts: ToastProps[], onDismiss: (id: string) => void }> = ({ toasts, onDismiss }) => {
    return (
        <div className="fixed top-20 right-8 z-50 flex flex-col gap-3 pointer-events-none">
            {toasts.map(t => (
                <Toast key={t.id} toast={t} onDismiss={onDismiss} />
            ))}
        </div>
    );
};

export default ConfirmDialog;
