import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, GitCompare, FileJson, Settings, AlertCircle, RefreshCw, ChevronDown, Search, X } from 'lucide-react';
import { fetchESIndices, fetchESIndexMetadata } from '../services/api';
import { ESCluster, IndexMetadata, ESIndex } from '../types';

interface ESCompareViewProps {
  clusters: ESCluster[];
}

// --- Helper: Recursive Key Sorter for JSON Comparison ---
const sortKeys = (obj: any): any => {
  if (Array.isArray(obj)) {
    return obj.map(sortKeys);
  } else if (typeof obj === 'object' && obj !== null) {
    return Object.keys(obj).sort().reduce((acc, key) => {
      acc[key] = sortKeys(obj[key]);
      return acc;
    }, {} as any);
  }
  return obj;
};

// --- Component: Searchable Select ---
interface SearchableSelectProps {
  label: string;
  options: { value: string; label: string }[];
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

const SearchableSelect: React.FC<SearchableSelectProps> = ({ 
  label, options, value, onChange, placeholder = "Select...", disabled = false 
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [filter, setFilter] = useState('');
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!isOpen) {
    }
  }, [value, isOpen]);

  const filteredOptions = useMemo(() => {
    return options.filter(opt => 
      opt.label.toLowerCase().includes(filter.toLowerCase()) || 
      opt.value.toLowerCase().includes(filter.toLowerCase())
    );
  }, [options, filter]);

  const selectedLabel = options.find(o => o.value === value)?.label || value;

  return (
    <div className="flex-1 min-w-[200px]" ref={wrapperRef}>
      <label className="block text-xs font-semibold text-gray-500 mb-1">{label}</label>
      <div className="relative">
        <div 
          onClick={() => { if (!disabled) { setIsOpen(!isOpen); setFilter(''); } }}
          className={`
            w-full bg-white border rounded-md px-3 py-2 text-sm flex items-center justify-between cursor-pointer transition-all
            ${disabled ? 'bg-gray-100 text-gray-400 cursor-not-allowed border-gray-200' : 'border-gray-300 hover:border-indigo-400'}
            ${isOpen ? 'ring-2 ring-indigo-500 border-indigo-500' : ''}
          `}
        >
          <span className={`truncate ${!selectedLabel ? 'text-gray-400' : 'text-gray-700'}`}>
            {selectedLabel || placeholder}
          </span>
          <ChevronDown size={14} className="text-gray-400 flex-shrink-0 ml-2" />
        </div>

        {isOpen && (
          <div className="absolute z-50 mt-1 w-full bg-white rounded-md shadow-lg border border-gray-200 max-h-60 flex flex-col animate-in fade-in zoom-in-95 duration-100">
            <div className="p-2 border-b border-gray-100">
              <div className="relative">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input 
                  autoFocus
                  type="text" 
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-gray-50 border border-gray-200 rounded-md focus:ring-1 focus:ring-indigo-500 outline-none"
                  placeholder="Filter..."
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                />
              </div>
            </div>
            <div className="overflow-y-auto flex-1 p-1 custom-scrollbar">
              {filteredOptions.length > 0 ? (
                filteredOptions.map(opt => (
                  <div 
                    key={opt.value}
                    onClick={() => {
                      onChange(opt.value);
                      setIsOpen(false);
                    }}
                    className={`
                      px-3 py-2 text-sm rounded cursor-pointer flex items-center justify-between
                      ${opt.value === value ? 'bg-indigo-50 text-indigo-700 font-medium' : 'text-gray-700 hover:bg-gray-100'}
                    `}
                  >
                    <span className="truncate">{opt.label}</span>
                    {opt.value === value && <div className="w-1.5 h-1.5 rounded-full bg-indigo-500"></div>}
                  </div>
                ))
              ) : (
                <div className="px-3 py-4 text-center text-xs text-gray-400">
                  No results found
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};


const ESCompareView: React.FC<ESCompareViewProps> = ({ clusters }) => {
  const navigate = useNavigate();
  
  // Selection State
  const [leftClusterId, setLeftClusterId] = useState<string>('');
  const [leftIndexName, setLeftIndexName] = useState<string>('');
  
  const [rightClusterId, setRightClusterId] = useState<string>('');
  const [rightIndexName, setRightIndexName] = useState<string>('');
  
  // Data State
  const [leftIndices, setLeftIndices] = useState<ESIndex[]>([]);
  const [rightIndices, setRightIndices] = useState<ESIndex[]>([]);
  
  const [activeTab, setActiveTab] = useState<'settings' | 'mappings'>('settings');
  const [loading, setLoading] = useState(false);
  const [loadingIndices, setLoadingIndices] = useState(false);
  const [data, setData] = useState<{ left: IndexMetadata | null, right: IndexMetadata | null }>({ left: null, right: null });

  // Initialize cluster selections
  useEffect(() => {
    if (clusters.length > 0) {
      if (!leftClusterId) setLeftClusterId(clusters[0].id);
      if (!rightClusterId) setRightClusterId(clusters.length > 1 ? clusters[1].id : clusters[0].id);
    }
  }, [clusters]);

  // Fetch Left Indices
  useEffect(() => {
    const loadLeft = async () => {
      if (!leftClusterId) return;
      const c = clusters.find(cl => cl.id === leftClusterId);
      if (!c) return;

      setLoadingIndices(true);
      try {
        const list = await fetchESIndices(c.id); // REVERTED: Pass ID
        setLeftIndices(list);
        if (list.length > 0 && !list.find(i => i.name === leftIndexName)) {
          setLeftIndexName('');
        }
      } catch (e) {
        setLeftIndices([]);
      } finally {
        setLoadingIndices(false);
      }
    };
    loadLeft();
  }, [leftClusterId]);

  // Fetch Right Indices
  useEffect(() => {
    const loadRight = async () => {
      if (!rightClusterId) return;
      const c = clusters.find(cl => cl.id === rightClusterId);
      if (!c) return;

      setLoadingIndices(true);
      try {
        const list = await fetchESIndices(c.id); // REVERTED: Pass ID
        setRightIndices(list);
        if (list.length > 0 && !list.find(i => i.name === rightIndexName)) {
          setRightIndexName('');
        }
      } catch (e) {
        setRightIndices([]);
      } finally {
        setLoadingIndices(false);
      }
    };
    loadRight();
  }, [rightClusterId]);

  // Fetch Metadata Comparison
  const handleCompare = async () => {
    if (!leftClusterId || !leftIndexName || !rightClusterId || !rightIndexName) return;
    
    const c1 = clusters.find(cl => cl.id === leftClusterId);
    const c2 = clusters.find(cl => cl.id === rightClusterId);
    if (!c1 || !c2) return;

    setLoading(true);
    
    try {
      const [leftMeta, rightMeta] = await Promise.all([
        fetchESIndexMetadata(c1.id, leftIndexName), // REVERTED: Pass ID
        fetchESIndexMetadata(c2.id, rightIndexName)  // REVERTED: Pass ID
      ]);
      
      setData({ left: leftMeta, right: rightMeta });
    } catch (error) {
      console.error("Error fetching comparison data", error);
    } finally {
      setLoading(false);
    }
  };

  // Trigger compare when selections change
  useEffect(() => {
    if (leftIndexName && rightIndexName) {
      handleCompare();
    }
  }, [leftIndexName, rightIndexName, leftClusterId, rightClusterId]);


  // --- Diff Rendering Logic ---
  const renderDiffView = () => {
    const leftRaw = activeTab === 'settings' ? data.left?.settings : data.left?.mappings;
    const rightRaw = activeTab === 'settings' ? data.right?.settings : data.right?.mappings;

    if (!leftRaw && !rightRaw) {
      return (
        <div className="col-span-2 h-full flex flex-col items-center justify-center text-gray-400 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
          <AlertCircle className="mb-2 opacity-50" size={32} />
          <p>Select indices on both sides to compare configuration</p>
        </div>
      );
    }

    // 1. Sort Keys for fair comparison
    const leftSorted = sortKeys(leftRaw || {});
    const rightSorted = sortKeys(rightRaw || {});

    // 2. Stringify to split into lines
    const leftLines = JSON.stringify(leftSorted, null, 2).split('\n');
    const rightLines = JSON.stringify(rightSorted, null, 2).split('\n');

    const maxLines = Math.max(leftLines.length, rightLines.length);

    // 3. Render Lines
    const rows = [];
    for (let i = 0; i < maxLines; i++) {
      const lText = leftLines[i] || '';
      const rText = rightLines[i] || '';
      
      const isDiff = lText.trim() !== rText.trim();
      const isEmpty = !lText && !rText;
      
      if (isEmpty) continue;

      rows.push(
        <div key={i} className={`grid grid-cols-2 border-b border-gray-800/30 ${isDiff ? 'bg-yellow-900/20' : 'hover:bg-gray-800/30'}`}>
          {/* Left Line */}
          <div className={`px-4 py-0.5 font-mono text-xs whitespace-pre overflow-x-hidden ${isDiff ? 'text-yellow-200' : 'text-emerald-400'}`}>
            {lText}
          </div>
          {/* Right Line */}
          <div className={`px-4 py-0.5 font-mono text-xs whitespace-pre overflow-x-hidden border-l border-gray-700 ${isDiff ? 'text-yellow-200' : 'text-emerald-400'}`}>
            {rText}
          </div>
        </div>
      );
    }

    return (
      <div className="flex flex-col h-full shadow-sm rounded-lg border border-gray-200 overflow-hidden bg-white">
        {/* Header Row */}
        <div className="bg-gray-50 border-b border-gray-200 grid grid-cols-2 divide-x divide-gray-200">
          <div className="px-4 py-2 flex justify-between items-center">
             <div>
               <span className="text-xs font-bold text-gray-500 uppercase tracking-wider block">
                 {clusters.find(c => c.id === leftClusterId)?.name || 'Source'}
               </span>
               <span className="text-sm font-semibold text-indigo-700 truncate block max-w-[200px]" title={leftIndexName}>
                 {leftIndexName || 'No Index'}
               </span>
             </div>
             {activeTab === 'settings' && <Settings size={14} className="text-gray-400"/>}
             {activeTab === 'mappings' && <FileJson size={14} className="text-gray-400"/>}
          </div>
          <div className="px-4 py-2 flex justify-between items-center bg-gray-50/50">
             <div>
               <span className="text-xs font-bold text-gray-500 uppercase tracking-wider block">
                 {clusters.find(c => c.id === rightClusterId)?.name || 'Target'}
               </span>
               <span className="text-sm font-semibold text-indigo-700 truncate block max-w-[200px]" title={rightIndexName}>
                 {rightIndexName || 'No Index'}
               </span>
             </div>
             {/* Legend for Diff */}
             <div className="flex items-center gap-2">
                <span className="text-[10px] text-gray-400">Diff Highlight:</span>
                <div className="w-3 h-3 bg-yellow-100 border border-yellow-300 rounded shadow-sm" title="Difference detected"></div>
             </div>
          </div>
        </div>

        {/* Diff Content */}
        <div className="flex-1 overflow-auto bg-slate-900 custom-scrollbar">
          {rows}
          {rows.length === 0 && (
             <div className="p-8 text-center text-gray-500 text-sm">Waiting for selection...</div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] animate-in fade-in duration-300">
      {/* Header & Controls */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 mb-6 space-y-4 z-20 relative">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => navigate('/elasticsearch')}
              className="p-2 bg-gray-50 hover:bg-gray-100 rounded-lg text-gray-600 transition-colors"
            >
              <ArrowLeft size={18} />
            </button>
            <div>
              <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <GitCompare className="text-orange-500" size={24} />
                Configuration Diff Tool
              </h1>
              <p className="text-sm text-gray-500">Compare Settings and Mappings with visual diff</p>
            </div>
          </div>
          
          <div className="flex bg-gray-100 p-1 rounded-lg">
            <button
              onClick={() => setActiveTab('settings')}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'settings' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              <Settings size={16} /> Settings
            </button>
            <button
              onClick={() => setActiveTab('mappings')}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'mappings' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              <FileJson size={16} /> Mappings
            </button>
          </div>
        </div>

        {/* Selectors */}
        <div className="grid grid-cols-1 md:grid-cols-[1fr,auto,1fr] gap-4 items-start">
          {/* Left Selector */}
          <div className="flex gap-2 p-3 bg-gray-50 rounded-lg border border-gray-200">
             <SearchableSelect
                label="Source Cluster"
                value={leftClusterId}
                onChange={setLeftClusterId}
                options={clusters.map(c => ({ value: c.id, label: c.name }))}
             />
             <SearchableSelect
                label="Source Index"
                value={leftIndexName}
                onChange={setLeftIndexName}
                options={leftIndices.map(i => ({ value: i.name, label: i.name }))}
                placeholder={loadingIndices ? "Loading..." : "Search index..."}
                disabled={loadingIndices}
             />
          </div>

          <div className="flex justify-center text-gray-400 pt-8">
             <RefreshCw size={20} className={(loading || loadingIndices) ? 'animate-spin text-indigo-500' : ''} />
          </div>

          {/* Right Selector */}
          <div className="flex gap-2 p-3 bg-gray-50 rounded-lg border border-gray-200">
             <SearchableSelect
                label="Target Cluster"
                value={rightClusterId}
                onChange={setRightClusterId}
                options={clusters.map(c => ({ value: c.id, label: c.name }))}
             />
             <SearchableSelect
                label="Target Index"
                value={rightIndexName}
                onChange={setRightIndexName}
                options={rightIndices.map(i => ({ value: i.name, label: i.name }))}
                placeholder={loadingIndices ? "Loading..." : "Search index..."}
                disabled={loadingIndices}
             />
          </div>
        </div>
      </div>

      {/* Main Diff Area */}
      <div className="flex-1 min-h-0">
        {renderDiffView()}
      </div>
    </div>
  );
};

export default ESCompareView;