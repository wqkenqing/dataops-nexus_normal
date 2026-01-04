import React from 'react';
import { useTranslation } from 'react-i18next';
import { Languages } from 'lucide-react';

const LanguageSwitcher: React.FC = () => {
    const { t, i18n } = useTranslation();

    const currentLang = i18n.language || 'en';
    const isChinese = currentLang.startsWith('zh');

    const toggleLanguage = () => {
        i18n.changeLanguage(isChinese ? 'en' : 'zh');
    };

    return (
        <button
            onClick={toggleLanguage}
            className="p-2 text-gray-500 hover:text-indigo-600 transition-colors rounded-full hover:bg-gray-100 flex items-center gap-2"
            title={t('switchLanguage')}
        >
            <Languages size={20} />
            <span className="text-sm font-bold">{isChinese ? '中' : 'EN'}</span>
        </button>
    );
};

export default LanguageSwitcher;
