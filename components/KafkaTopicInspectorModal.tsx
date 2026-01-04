import React, { useState, useEffect } from 'react';
import { X, Calendar, Hash, Download, Search, Loader2, FileJson, AlertCircle, PlayCircle, SkipBack, SkipForward } from 'lucide-react';
import { fetchKafkaMessages } from '../services/api';
import { KafkaMessage, KafkaMessageFetchParams } from '../types';
import { useTranslation } from 'react-i18next';

interface KafkaTopicInspectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  clusterId: string;
  topicName: string;
}

const KafkaTopicInspectorModal: React.FC<KafkaTopicInspectorModalProps> = ({
  isOpen, onClose, clusterId, topicName
}) => {
  const { t } = useTranslation();
  const [mode, setMode] = useState<'offset' | 'time' | 'smart'>('smart');
  const [partition, setPartition] = useState(0);

  // Offset Inputs
  const [startOffset, setStartOffset] = useState<number>(0);
  const [endOffset, setEndOffset] = useState<number>(100);

  // Time Inputs
  const [startTime, setStartTime] = useState<string>('');
  const [endTime, setEndTime] = useState<string>('');

  // Smart Seek Inputs
  const [smartPosition, setSmartPosition] = useState<'latest' | 'earliest'>('latest');
  const [smartLimit, setSmartLimit] = useState<number>(10);

  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState<KafkaMessage[]>([]);
  const [downloadUrl, setDownloadUrl] = useState<string | undefined>(undefined);

  // Initialize time inputs on open
  useEffect(() => {
    if (isOpen) {
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      setEndTime(now.toISOString().slice(0, 16));
      setStartTime(oneHourAgo.toISOString().slice(0, 16));
      setMessages([]);
    }
  }, [isOpen]);

  const handleFetch = async () => {
    setIsLoading(true);
    setDownloadUrl(undefined);

    // Construct params based on mode
    let params: KafkaMessageFetchParams = { mode: 'smart' }; // Default init
    if (mode === 'smart') {
      params = {
        mode: smartPosition, // 'latest' | 'earliest'
        limit: smartLimit
      };
    } else if (mode === 'offset') {
      params = {
        mode: 'offset_range',
        start_offset: startOffset,
        end_offset: endOffset,
        partition: partition
      };
    } else if (mode === 'time') {
      // Convert datetime-local strings to milliseconds timestamp
      const startMs = new Date(startTime).getTime();
      const endMs = new Date(endTime).getTime();

      params = {
        mode: 'time_range',
        start: startMs,
        end: endMs,
        partition: partition
      };
    }

    const result = await fetchKafkaMessages(clusterId, topicName, params);

    setMessages(result.messages);
    if (result.downloadUrl) {
      // If relative path, you might need to prepend base url, but assuming absolute or root-relative for now.
      // If it's a backend path like /static/..., we might need to prepend API host if on different port.
      // Assuming localhost:8000 for dev based on api.ts
      let url = result.downloadUrl;
      if (url.startsWith('/') && !url.startsWith('http')) {
        url = `http://127.0.0.1:8000${url}`;
      }
      setDownloadUrl(url);
    }

    setIsLoading(false);
  };

  const handleDownload = () => {
    if (downloadUrl) {
      // Use binding from API
      const link = document.createElement('a');
      link.href = downloadUrl;
      // Extract filename from URL or use default
      link.download = downloadUrl.split('/').pop() || `${topicName}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      return;
    }

    if (messages.length === 0) return;

    const jsonString = JSON.stringify(messages, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${topicName}_${mode}_${Date.now()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl h-[80vh] flex flex-col animate-in fade-in zoom-in-95 duration-200">

        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50 rounded-t-xl">
          <div>
            <h3 className="font-bold text-gray-800 text-lg">{t('topicInspector')}</h3>
            <p className="text-sm text-gray-500 font-mono">{topicName}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>

        {/* Controls */}
        <div className="p-4 border-b border-gray-200 bg-white">
          <div className="flex flex-wrap items-end gap-4">

            {/* Mode Toggle */}
            <div className="flex bg-gray-100 p-1 rounded-lg self-start">
              <button
                onClick={() => setMode('smart')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${mode === 'smart' ? 'bg-white text-purple-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              >
                <PlayCircle size={14} /> {t('smartSeek')}
              </button>
              <button
                onClick={() => setMode('offset')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${mode === 'offset' ? 'bg-white text-purple-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              >
                <Hash size={14} /> {t('offsetRange')}
              </button>
              <button
                onClick={() => setMode('time')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${mode === 'time' ? 'bg-white text-purple-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              >
                <Calendar size={14} /> {t('timeRange')}
              </button>
            </div>

            {/* Partition Input */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">{t('partition')}</label>
              <input
                type="number"
                min="0"
                value={partition}
                onChange={(e) => setPartition(parseInt(e.target.value))}
                className="w-20 px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 outline-none"
              />
            </div>

            {/* Dynamic Inputs based on Mode */}
            {mode === 'smart' && (
              <>
                <div className="flex items-center gap-2 border-l border-gray-200 pl-4">
                  <div className="flex bg-gray-50 p-1 rounded-lg">
                    <button
                      onClick={() => setSmartPosition('latest')}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${smartPosition === 'latest' ? 'bg-white text-purple-600 shadow-sm border border-gray-200' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                      <SkipForward size={14} /> {t('latest')}
                    </button>
                    <button
                      onClick={() => setSmartPosition('earliest')}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${smartPosition === 'earliest' ? 'bg-white text-purple-600 shadow-sm border border-gray-200' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                      <SkipBack size={14} /> {t('earliest')}
                    </button>
                  </div>
                </div>

                <div className="min-w-[140px]">
                  <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">{t('limitCount')}</label>
                  <select
                    value={smartLimit}
                    onChange={(e) => setSmartLimit(parseInt(e.target.value))}
                    className="w-full px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 outline-none"
                  >
                    <option value={10}>{t('messagesCount', { count: 10 })}</option>
                    <option value={50}>{t('messagesCount', { count: 50 })}</option>
                    <option value={100}>{t('messagesCount', { count: 100 })}</option>
                    <option value={500}>{t('messagesCount', { count: 500 })}</option>
                    <option value={-1}>{t('noLimit')}</option>
                  </select>
                </div>
              </>
            )}

            {mode === 'offset' && (
              <>
                <div className="flex-1 min-w-[120px]">
                  <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">{t('startOffset')}</label>
                  <input
                    type="number"
                    value={startOffset}
                    onChange={(e) => setStartOffset(parseInt(e.target.value))}
                    className="w-full px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 outline-none"
                  />
                </div>
                <div className="flex-1 min-w-[120px]">
                  <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">{t('endOffset')}</label>
                  <input
                    type="number"
                    value={endOffset}
                    onChange={(e) => setEndOffset(parseInt(e.target.value))}
                    className="w-full px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 outline-none"
                  />
                </div>
              </>
            )}

            {mode === 'time' && (
              <>
                <div className="flex-1 min-w-[180px]">
                  <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">{t('startTime')}</label>
                  <input
                    type="datetime-local"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 outline-none"
                  />
                </div>
                <div className="flex-1 min-w-[180px]">
                  <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">{t('endTime')}</label>
                  <input
                    type="datetime-local"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="w-full px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 outline-none"
                  />
                </div>
              </>
            )}

            <button
              onClick={handleFetch}
              disabled={isLoading}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors shadow-sm text-sm font-medium flex items-center gap-2 h-[34px]"
            >
              {isLoading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
              {t('fetch')}
            </button>
          </div>
        </div>

        {/* Results Area */}
        <div className="flex-1 overflow-auto bg-slate-50 relative">
          {messages.length > 0 ? (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-100 sticky top-0 shadow-sm z-10">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('offset')}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('timestamp')}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('key')}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-full">{t('value')}</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {messages.map((msg, idx) => (
                  <tr key={idx} className="hover:bg-purple-50 transition-colors">
                    <td className="px-6 py-3 whitespace-nowrap text-xs text-gray-600 font-mono">
                      {msg.offset}
                    </td>
                    <td className="px-6 py-3 whitespace-nowrap text-xs text-gray-500">
                      {new Date(msg.timestamp).toLocaleString()}
                    </td>
                    <td className="px-6 py-3 whitespace-nowrap text-xs text-gray-500 font-mono">
                      {msg.key || <span className="text-gray-300 italic">null</span>}
                    </td>
                    <td className="px-6 py-3 text-xs text-gray-700 font-mono break-all max-w-lg">
                      {msg.value}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-gray-400">
              <div className="p-4 bg-gray-100 rounded-full mb-3">
                <FileJson size={32} className="text-gray-300" />
              </div>
              <p className="text-sm">{t('noMessagesFetched')}</p>
              <p className="text-xs mt-1">{t('selectParamsToFetch')}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-between items-center rounded-b-xl">
          <div className="text-xs text-gray-500">
            {messages.length > 0 ? t('showingResults', { count: messages.length }) : ''}
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
            >
              {t('close')}
            </button>
            <button
              onClick={handleDownload}
              disabled={messages.length === 0}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium text-white rounded-lg shadow-sm transition-all
                 ${messages.length === 0 ? 'bg-gray-400 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-700'}
               `}
            >
              <Download size={16} /> {t('downloadJson')}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

export default KafkaTopicInspectorModal;
