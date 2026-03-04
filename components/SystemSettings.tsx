import React, { useState, useRef } from 'react';
import { DownloadCloud, UploadCloud, AlertCircle, HardDrive, RefreshCw, CheckCircle2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { exportSystemArchive, importSystemArchive } from '../services/api';

const SystemSettings: React.FC = () => {
  const { t } = useTranslation();
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreMessage, setRestoreMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = () => {
    exportSystemArchive();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.zip')) {
      setRestoreMessage({ type: 'error', text: 'Please select a valid .zip archive.' });
      return;
    }

    setIsRestoring(true);
    setRestoreMessage(null);

    const success = await importSystemArchive(file);
    if (success) {
      setRestoreMessage({ type: 'success', text: t('restoreSuccess') });
      // Force reload after 2 seconds to fetch the newly imported data
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } else {
      setRestoreMessage({ type: 'error', text: t('restoreFailed') });
      setIsRestoring(false);
    }
    
    // reset input
    if (fileInputRef.current) {
        fileInputRef.current.value = '';
    }
  };

  return (
    <div className="max-w-4xl space-y-8 animate-in fade-in duration-500">
      
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold border-b border-gray-200 pb-4 text-gray-800 flex items-center gap-2">
          <HardDrive size={24} className="text-indigo-600" />
          {t('systemSettings')}
        </h2>
        <p className="mt-2 text-sm text-gray-500">
          Manage core system state, create snapshots, and restore operations from backups.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        
        {/* Export Card */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 hover:shadow-md transition-shadow">
          <div className="flex items-start justify-between mb-4">
            <div className="p-3 bg-indigo-50 rounded-lg text-indigo-600">
              <DownloadCloud size={24} />
            </div>
          </div>
          <h3 className="text-lg font-bold text-gray-900 mb-2">{t('exportArchive')}</h3>
          <p className="text-sm text-gray-500 mb-6 h-10">
            {t('exportArchiveDesc')}
          </p>
          <button
            onClick={handleExport}
            className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2.5 px-4 rounded-lg transition-colors"
          >
            <DownloadCloud size={18} />
            {t('exportArchive')}
          </button>
        </div>

        {/* Import Card */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 hover:shadow-md transition-shadow">
          <div className="flex items-start justify-between mb-4">
            <div className="p-3 bg-rose-50 rounded-lg text-rose-600">
              <UploadCloud size={24} />
            </div>
          </div>
          <h3 className="text-lg font-bold text-gray-900 mb-2">{t('importArchive')}</h3>
          <p className="text-sm text-gray-500 mb-6 h-10">
            {t('importArchiveDesc')}
          </p>
          
          <input 
            type="file" 
            accept=".zip" 
            className="hidden" 
            ref={fileInputRef}
            onChange={handleFileChange}
            disabled={isRestoring}
          />

          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isRestoring}
            className={`w-full flex items-center justify-center gap-2 font-medium py-2.5 px-4 rounded-lg transition-colors border-2 border-dashed
              ${isRestoring 
                ? 'bg-gray-50 text-gray-400 border-gray-200 cursor-not-allowed' 
                : 'border-rose-300 text-rose-600 hover:bg-rose-50 hover:border-rose-400'
              }
            `}
          >
            {isRestoring ? (
              <>
                <RefreshCw size={18} className="animate-spin" />
                {t('restoring')}
              </>
            ) : (
              <>
                <UploadCloud size={18} />
                {t('dropArchiveHere')}
              </>
            )}
          </button>

        </div>
      </div>

      {/* Status Messages */}
      {restoreMessage && (
        <div className={`p-4 rounded-lg flex items-start gap-3 border ${
          restoreMessage.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-800'
        }`}>
          {restoreMessage.type === 'success' ? (
            <CheckCircle2 size={20} className="text-emerald-500 mt-0.5 flex-shrink-0" />
          ) : (
            <AlertCircle size={20} className="text-rose-500 mt-0.5 flex-shrink-0" />
          )}
          <div>
            <h4 className="font-bold text-sm">
              {restoreMessage.type === 'success' ? 'Restoration Complete' : 'Restoration Failed'}
            </h4>
            <p className="text-sm mt-1 opacity-90">{restoreMessage.text}</p>
          </div>
        </div>
      )}

    </div>
  );
};

export default SystemSettings;
