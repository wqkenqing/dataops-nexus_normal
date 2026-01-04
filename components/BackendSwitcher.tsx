import React from 'react';
import { Terminal, Coffee } from 'lucide-react';
import { useBackend } from '../contexts/BackendContext';
import { useTranslation } from 'react-i18next';

const BackendSwitcher: React.FC = () => {
    const { backend, switchBackend } = useBackend();
    const { t } = useTranslation();

    const toggleBackend = () => {
        const newBackend = backend === 'python' ? 'java' : 'python';
        switchBackend(newBackend);
    };

    return (
        <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider hidden md:block">{t('backend')}</span>
            <button
                onClick={toggleBackend}
                className={`
                    relative flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-300 border shadow-sm
                    ${backend === 'python'
                        ? 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100 hover:shadow-indigo-100'
                        : 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100 hover:shadow-red-100'
                    }
                `}
                title={t('switchBackendTooltip', { current: backend })}
            >
                {backend === 'python' ? <Terminal size={16} strokeWidth={2.5} /> : <Coffee size={16} strokeWidth={2.5} />}
                <span className="capitalize">{backend}</span>
                <span className={`absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full border-2 border-white ${backend === 'python' ? 'bg-green-500' : 'bg-gray-400'}`}></span>
            </button>
        </div>
    );
};

export default BackendSwitcher;
