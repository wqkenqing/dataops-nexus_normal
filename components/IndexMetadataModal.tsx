import React, { useState, useEffect } from 'react';
import { X, FileJson, Settings, Layers, Loader2 } from 'lucide-react';
import { IndexMetadata } from '../types';
import { fetchESIndexMetadata } from '../services/api';
import { getIndexMetadata } from '../services/mockData';

interface IndexMetadataModalProps {
  isOpen: boolean;
  onClose: () => void;
  clusterId: string; // Used for both Mock check and Real API call
  indexName: string;
}

const IndexMetadataModal: React.FC<IndexMetadataModalProps> = ({ 
  isOpen, onClose, clusterId, indexName 
}) => {
  const [activeTab, setActiveTab] = useState<'settings' | 'mappings'>('settings');
  const [data, setData] = useState<IndexMetadata | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && clusterId && indexName) {
      loadData();
    }
  }, [isOpen, clusterId, indexName]);

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    setData(null);

    try {
      // Determine if we should use mock or real API
      const staticMockIds = ['es-prod-01', 'es-dev-01'];
      
      if (staticMockIds.includes(clusterId)) {
        // Use Mock
        await new Promise(resolve => setTimeout(resolve, 500)); // Simulate delay
        const mockData = getIndexMetadata(clusterId, indexName);
        setData(mockData);
      } else {
        // Use Real API - passing ID (UUID)
        const realData = await fetchESIndexMetadata(clusterId, indexName);
        if (realData) {
          setData(realData);
        } else {
          setError('Failed to fetch index metadata. Check console for details.');
        }
      }
    } catch (e) {
      setError('An unexpected error occurred while loading data.');
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl h-[80vh] flex flex-col animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50 rounded-t-xl">
          <div className="flex items-center gap-3">
             <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg">
               <Layers size={20} />
             </div>
             <div>
               <h3 className="font-bold text-gray-800 text-lg">Index Details</h3>
               <p className="text-sm text-gray-500 font-mono">{indexName}</p>
             </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Tabs */}
        <div className="px-6 py-2 border-b border-gray-200 bg-white flex items-center gap-4">
           <button
             onClick={() => setActiveTab('settings')}
             className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
               activeTab === 'settings' 
                 ? 'border-indigo-600 text-indigo-600' 
                 : 'border-transparent text-gray-500 hover:text-gray-700'
             }`}
           >
             <Settings size={16} /> Settings
           </button>
           <button
             onClick={() => setActiveTab('mappings')}
             className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
               activeTab === 'mappings' 
                 ? 'border-indigo-600 text-indigo-600' 
                 : 'border-transparent text-gray-500 hover:text-gray-700'
             }`}
           >
             <FileJson size={16} /> Mappings
           </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden bg-slate-50 relative p-4">
           {isLoading ? (
             <div className="flex flex-col items-center justify-center h-full text-indigo-600">
               <Loader2 size={40} className="animate-spin mb-2" />
               <p className="text-sm font-medium">Loading metadata...</p>
             </div>
           ) : error ? (
             <div className="flex flex-col items-center justify-center h-full text-rose-500">
               <p className="font-medium">{error}</p>
               <button onClick={loadData} className="mt-4 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50">
                 Retry
               </button>
             </div>
           ) : data ? (
             <div className="h-full bg-slate-900 rounded-lg border border-slate-700 overflow-auto custom-scrollbar p-4 shadow-inner">
               <pre className="text-xs font-mono text-emerald-400 leading-relaxed">
                 {JSON.stringify(activeTab === 'settings' ? data.settings : data.mappings, null, 2)}
               </pre>
             </div>
           ) : (
             <div className="flex items-center justify-center h-full text-gray-400">
               <p>No data available.</p>
             </div>
           )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end rounded-b-xl">
          <button 
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
};

export default IndexMetadataModal;