import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRightLeft,
  Database,
  CheckCircle,
  AlertCircle,
  Loader2,
  ArrowRight,
  Play,
  Plus,
  FileJson,
  Trash2,
  Search,
  X,
  ChevronDown,
  ChevronRight,
  Layers,
  RefreshCw,
  Settings,
  HardDrive
} from 'lucide-react';
import { fetchESIndices, fetchESSyncTasks, fetchESSyncTaskById, createESSyncTask, updateESSyncTask, executeESSync } from '../services/api';
import { ESCluster, ESIndex, BackendSyncTask, BackendSyncResultItem } from '../types';

interface ESSyncViewProps {
  clusters: ESCluster[];
}

// ... (Rest of interfaces and SearchableSelect component remain same) ...
interface IndexMapping {
  source: string;
  target: string;
  docsCount: number;
  totalDocs?: number; // Added
  docsSynced?: number; // Added
  status: string;
}

interface SyncTask {
  id: string;
  sourceClusterId: string;
  sourceClusterName: string;
  targetClusterId: string;
  targetClusterName: string;

  indices: IndexMapping[];

  configStatus: 'pending' | 'running' | 'success' | 'failed';
  dataStatus: 'idle' | 'running' | 'completed' | 'failed';

  progress: number;
  docsSynced: number;
  totalDocsEstimate: number;
  createdAt: number;
  logs: string[];
}

// ... (SearchableSelect) ...
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

  const filteredOptions = useMemo(() => {
    return options.filter(opt =>
      opt.label.toLowerCase().includes(filter.toLowerCase()) ||
      opt.value.toLowerCase().includes(filter.toLowerCase())
    );
  }, [options, filter]);

  const selectedLabel = options.find(o => o.value === value)?.label || value;

  return (
    <div className="w-full" ref={wrapperRef}>
      <label className="block text-xs font-semibold text-gray-500 mb-1">{label}</label>
      <div className="relative">
        <div
          onClick={() => { if (!disabled) { setIsOpen(!isOpen); setFilter(''); } }}
          className={`
            w-full bg-white border rounded-lg px-3 py-2.5 text-sm flex items-center justify-between cursor-pointer transition-all
            ${disabled ? 'bg-gray-100 text-gray-400 cursor-not-allowed border-gray-200' : 'border-gray-300 hover:border-blue-400'}
            ${isOpen ? 'ring-2 ring-blue-500 border-blue-500' : ''}
          `}
        >
          <span className={`truncate ${!selectedLabel ? 'text-gray-400' : 'text-gray-700'}`}>
            {selectedLabel || placeholder}
          </span>
          <ChevronDown size={14} className="text-gray-400 flex-shrink-0 ml-2" />
        </div>

        {isOpen && (
          <div className="absolute z-50 mt-1 w-full bg-white rounded-lg shadow-lg border border-gray-200 max-h-60 flex flex-col animate-in fade-in zoom-in-95 duration-100">
            <div className="p-2 border-b border-gray-100">
              <div className="relative">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  autoFocus
                  type="text"
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-gray-50 border border-gray-200 rounded-md focus:ring-1 focus:ring-blue-500 outline-none"
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
                      ${opt.value === value ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700 hover:bg-gray-100'}
                    `}
                  >
                    <span className="truncate">{opt.label}</span>
                    {opt.value === value && <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>}
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


const ESSyncView: React.FC<ESSyncViewProps> = ({ clusters }) => {
  const navigate = useNavigate();

  // State
  const [tasks, setTasks] = useState<SyncTask[]>([]);
  const [isLoadingTasks, setIsLoadingTasks] = useState(false);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);

  // New Task Form State
  const [sourceClusterId, setSourceClusterId] = useState('');
  const [targetClusterId, setTargetClusterId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [creatingDataTaskFor, setCreatingDataTaskFor] = useState<string | null>(null);

  // Options Flags
  const [syncMappings, setSyncMappings] = useState(true);
  const [syncData, setSyncData] = useState(true);

  // Multi-select State
  const [sourceIndices, setSourceIndices] = useState<ESIndex[]>([]);
  const [selectedSourceIndices, setSelectedSourceIndices] = useState<string[]>([]);
  const [targetIndexMap, setTargetIndexMap] = useState<Record<string, string>>({}); // source -> target
  const [indexSearchTerm, setIndexSearchTerm] = useState('');

  const [isLoadingIndices, setIsLoadingIndices] = useState(false);

  // --- Effects ---

  // Load Tasks from API
  // Helper to transform a single backend task
  const transformBackendTask = useCallback((bt: BackendSyncTask): SyncTask => {
    const sCluster = clusters.find(c => c.id === bt.source);
    const tCluster = clusters.find(c => c.id === bt.target);

    let indices: IndexMapping[] = [];
    if (bt.result && bt.result.length > 0) {
      indices = bt.result.map(res => ({
        source: res.index,
        target: res.index,
        docsCount: res.docs_synced || 0,
        docsSynced: res.docs_synced || 0,
        totalDocs: res.total_docs || 0,
        status: res.status
      }));
    } else if (bt.payload && bt.payload.indices && Array.isArray(bt.payload.indices)) {
      indices = bt.payload.indices.map(idxName => ({
        source: idxName,
        target: idxName,
        docsCount: 0,
        status: 'pending'
      }));
    }

    // Determine Statuses with better mapping (Case Insensitive)
    const taskStatus = bt.status?.toLowerCase() || '';
    const isOverallSuccess = ['success', 'completed', 'finished'].includes(taskStatus);
    const isOverallFailed = ['failed', 'error', 'failure'].includes(taskStatus);
    const isOverallRunning = ['running', 'processing', 'syncing'].includes(taskStatus);

    let configStatus: SyncTask['configStatus'] = 'pending';
    if (isOverallSuccess) configStatus = 'success';
    else if (isOverallFailed) configStatus = 'failed';
    else if (isOverallRunning) {
      const hasConfiguredAny = indices.some(idx => ['synced', 'exists', 'success'].includes(idx.status?.toLowerCase()));
      configStatus = hasConfiguredAny ? 'success' : 'running';
    }

    let dataStatus: SyncTask['dataStatus'] = 'idle';
    if (bt.payload && bt.payload.sync_data) {
      if (isOverallSuccess) dataStatus = 'completed';
      else if (isOverallRunning) dataStatus = 'running';
      else if (isOverallFailed) dataStatus = 'failed';
    }

    // Parse Created Time (Handle camelCase createdAt, snake_case created_at, or provided created)
    const rawCreated = bt.createdAt || bt.created_at || bt.created;
    let createdAt = 0;
    if (rawCreated) {
      if (typeof rawCreated === 'number') {
        createdAt = rawCreated < 10000000000 ? rawCreated * 1000 : rawCreated;
      } else {
        createdAt = new Date(rawCreated).getTime();
      }
    }

    // Progress Calculation with robust field support
    let progress = bt.progress || 0;
    const totalDocsTask = bt.totalDocs || bt.total_docs || indices.reduce((acc, i) => acc + (bt.payload.indices.includes(i.source) ? (i.totalDocs || 0) : 0), 0);
    const syncedDocsTask = bt.syncedDocs || bt.docs_synced || indices.reduce((acc, i) => acc + (i.docsSynced || 0), 0);

    if (taskStatus === 'success' || taskStatus === 'completed') {
      progress = 100;
    } else if (bt.progress !== undefined) {
      progress = bt.progress;
    } else if (totalDocsTask > 0) {
      progress = Math.min(99, Math.round((syncedDocsTask / totalDocsTask) * 100));
    } else {
      const totalIndicesCount = bt.totalIndices || bt.payload?.indices?.length || 0;
      const syncedIndicesCount = indices.filter(idx => ['synced', 'success', 'exists'].includes(idx.status)).length;
      if (totalIndicesCount > 0) progress = Math.round((syncedIndicesCount / totalIndicesCount) * 100);
    }

    return {
      id: bt.id,
      sourceClusterId: bt.source,
      sourceClusterName: sCluster?.name || bt.source,
      targetClusterId: bt.target,
      targetClusterName: tCluster?.name || bt.target,
      indices: indices,
      configStatus: configStatus,
      dataStatus: dataStatus,
      progress: progress,
      docsSynced: syncedDocsTask,
      totalDocsEstimate: totalDocsTask,
      createdAt: createdAt || Date.now(),
      logs: bt.message ? [bt.message] : []
    };
  }, [clusters]);

  // Load Tasks from API
  const loadTasks = useCallback(async (silent = false) => {
    if (!silent) setIsLoadingTasks(true);
    try {
      const backendTasks = await fetchESSyncTasks();

      if (!backendTasks || !Array.isArray(backendTasks)) {
        setTasks([]);
        return;
      }

      const frontendTasks: SyncTask[] = backendTasks.map(bt => transformBackendTask(bt));
      frontendTasks.sort((a, b) => b.createdAt - a.createdAt);
      setTasks(frontendTasks);
    } catch (error) {
      console.error("Failed to load sync tasks", error);
      setTasks([]);
    } finally {
      if (!silent) setIsLoadingTasks(false);
    }
  }, [clusters, transformBackendTask]);

  // Initial Load
  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  // Auto-Refresh Polling for Running Tasks
  useEffect(() => {
    // Check which tasks are currently running/pending
    const runningTaskIds = tasks
      .filter(t => t.configStatus === 'running' || t.dataStatus === 'running' || t.configStatus === 'pending')
      .map(t => t.id);

    if (runningTaskIds.length > 0) {
      const intervalId = setInterval(async () => {
        // Fetch status for each running task individually as requested
        const updates = await Promise.all(
          runningTaskIds.map(async (id) => {
            try {
              const bt = await fetchESSyncTaskById(id);
              return bt ? transformBackendTask(bt) : null;
            } catch (e) {
              return null;
            }
          })
        );

        const validUpdates = updates.filter(u => u !== null) as SyncTask[];
        if (validUpdates.length > 0) {
          setTasks(prevTasks => prevTasks.map(t => {
            const update = validUpdates.find(u => u.id === t.id);
            return update ? update : t;
          }));
        }
      }, 5000); // Poll every 5 seconds

      return () => clearInterval(intervalId);
    }
  }, [tasks, transformBackendTask]);


  // Initialize Defaults for Modal
  useEffect(() => {
    if (isModalOpen && clusters.length > 0) {
      if (!sourceClusterId) setSourceClusterId(clusters[0].id);
      if (!targetClusterId) setTargetClusterId(clusters.length > 1 ? clusters[1].id : clusters[0].id);
      // Reset options defaults
      setSyncMappings(true);
      setSyncData(true);
    }
  }, [isModalOpen, clusters]);

  // Fetch Source Indices
  useEffect(() => {
    const loadIndices = async () => {
      if (!sourceClusterId) return;
      const c = clusters.find(cl => cl.id === sourceClusterId);
      if (!c) return;

      setIsLoadingIndices(true);
      try {
        const list = await fetchESIndices(c.id); // FIXED: Pass ID
        setSourceIndices(list);
        setSelectedSourceIndices([]);
        setTargetIndexMap({});
      } catch (e) {
        setSourceIndices([]);
      } finally {
        setIsLoadingIndices(false);
      }
    };
    loadIndices();
  }, [sourceClusterId]);

  // --- Handlers ---

  const handleToggleIndex = (indexName: string) => {
    setSelectedSourceIndices(prev => {
      const isSelected = prev.includes(indexName);
      if (isSelected) {
        const newSelection = prev.filter(i => i !== indexName);
        // Clean up target map
        const newMap = { ...targetIndexMap };
        delete newMap[indexName];
        setTargetIndexMap(newMap);
        return newSelection;
      } else {
        // Add to selection and set default target name
        setTargetIndexMap(curr => ({ ...curr, [indexName]: indexName }));
        return [...prev, indexName];
      }
    });
  };

  const handleTargetNameChange = (sourceName: string, targetName: string) => {
    setTargetIndexMap(prev => ({ ...prev, [sourceName]: targetName }));
  };

  const handleCreateTask = async () => {
    if (!sourceClusterId || !targetClusterId || selectedSourceIndices.length === 0) return;

    setIsSubmitting(true);

    // Note: currently backend create API only takes list of source indices names
    // It doesn't seem to support renaming target indices yet in the provided curl example
    // So we will just send the list of selected source indices.

    const payload = {
      indices: selectedSourceIndices,
      sync_settings: false, // Removed as requested
      sync_mappings: syncMappings,
      sync_data: syncData
    };

    try {
      const result = await createESSyncTask(sourceClusterId, targetClusterId, payload);

      if (result) {
        await loadTasks();
        setIsModalOpen(false);
        setSelectedSourceIndices([]);
        setTargetIndexMap({});
      }
    } catch (e) {
      console.error("Error creating task", e);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStartDataSync = async (task: SyncTask) => {
    // Phase 2: Trigger data sync using the new executeESSync API
    setCreatingDataTaskFor(task.id);

    try {
      const uniqueIndices = Array.from(new Set(task.indices.map(i => i.source)));

      // Using the new POST /es/sync endpoint per OpenAPI snippet
      await executeESSync(task.sourceClusterId, task.targetClusterId, uniqueIndices);

      // Reload list to reflect changes
      await loadTasks(true);
    } catch (e) {
      console.error("Error executing sync operation", e);
    } finally {
      setCreatingDataTaskFor(null);
    }
  };

  const handleDeleteTask = (taskId: string) => {
    // Placeholder: In real app, call DELETE API
    setTasks(prev => prev.filter(t => t.id !== taskId));
  };

  // Filter available indices
  const filteredIndices = sourceIndices.filter(i =>
    i.name.toLowerCase().includes(indexSearchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-300">

      {/* Page Header */}
      <div className="sticky top-16 z-20 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/elasticsearch')}
            className="p-2 bg-gray-50 hover:bg-gray-100 rounded-lg text-gray-600 transition-colors"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <ArrowRightLeft className="text-blue-500" size={24} />
              Index Synchronization Tasks
            </h1>
            <p className="text-sm text-gray-500">Manage cross-cluster index replication and migration jobs</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => loadTasks(false)}
            className="p-2.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors border border-gray-200"
            title="Refresh List"
          >
            <RefreshCw size={18} className={isLoadingTasks ? "animate-spin" : ""} />
          </button>
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-all shadow-sm hover:shadow-md"
          >
            <Plus size={18} />
            New Sync Task
          </button>
        </div>
      </div>

      {/* Task Dashboard Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 group hover:border-blue-200 transition-all">
          <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 flex items-center gap-2">
            <Layers size={12} /> Workload Statistics
          </div>
          <div className="flex items-baseline gap-2">
            <div className="text-3xl font-black text-slate-800">{tasks.length}</div>
            <div className="text-xs font-bold text-slate-400 uppercase">Tasks</div>
          </div>
          <div className="mt-3 flex items-center gap-2 text-[10px] font-bold text-gray-500">
            <span className="px-1.5 py-0.5 bg-gray-100 rounded">{tasks.reduce((sum, t) => sum + t.indices.length, 0)} Combined Indices</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 group hover:border-blue-200 transition-all">
          <div className="text-[10px] font-bold text-blue-400 uppercase tracking-widest mb-2 flex items-center gap-2">
            <RefreshCw size={12} className="animate-spin-slow" /> Active Stream
          </div>
          <div className="flex items-baseline gap-2">
            <div className="text-3xl font-black text-blue-600">
              {tasks.filter(t => t.dataStatus === 'running').length}
            </div>
            <div className="text-xs font-bold text-blue-400 uppercase">Syncing</div>
          </div>
          <div className="mt-3 w-full h-1 bg-blue-50 rounded-full overflow-hidden">
            <div className="h-full bg-blue-500 animate-pulse" style={{ width: tasks.some(t => t.dataStatus === 'running') ? '100%' : '0%' }}></div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 group hover:border-emerald-200 transition-all">
          <div className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest mb-2 flex items-center gap-2">
            <CheckCircle size={12} /> Sync Volume
          </div>
          <div className="flex items-baseline gap-2">
            <div className="text-3xl font-black text-emerald-600">
              {(() => {
                const total = tasks.reduce((sum, t) => sum + (t.docsSynced || 0), 0);
                if (total > 1000000) return (total / 1000000).toFixed(1) + 'M';
                if (total > 1000) return (total / 1000).toFixed(1) + 'K';
                return total;
              })()}
            </div>
            <div className="text-xs font-bold text-emerald-400 uppercase">Docs</div>
          </div>
          <div className="mt-3 flex items-center gap-2 text-[10px] font-bold text-emerald-600/70">
            <span>{tasks.filter(t => t.dataStatus === 'completed').length} Tasks Finalized</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 group hover:border-rose-200 transition-all">
          <div className="text-[10px] font-bold text-rose-400 uppercase tracking-widest mb-2 flex items-center gap-2">
            <AlertCircle size={12} /> Fault Detection
          </div>
          <div className="flex items-baseline gap-2">
            <div className="text-3xl font-black text-rose-600">
              {tasks.filter(t =>
                t.configStatus === 'failed' ||
                t.dataStatus === 'failed' ||
                t.indices.some(idx => ['failed', 'error', 'failure'].includes(idx.status?.toLowerCase()))
              ).length}
            </div>
            <div className="text-xs font-bold text-rose-400 uppercase">Failures</div>
          </div>
          <div className="mt-3 text-[10px] font-bold text-rose-500/80">
            {tasks.reduce((sum, t) => sum + t.indices.filter(idx => ['failed', 'error', 'failure'].includes(idx.status?.toLowerCase())).length, 0)} Indices Halted
          </div>
        </div>
      </div>

      {/* Task List */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden min-h-[400px]">
        {tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            {isLoadingTasks ? (
              <div className="flex flex-col items-center">
                <Loader2 size={32} className="animate-spin text-blue-500 mb-4" />
                <p className="text-sm">Loading tasks...</p>
              </div>
            ) : (
              <>
                <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                  <ArrowRightLeft size={32} className="opacity-50" />
                </div>
                <h3 className="text-lg font-medium text-gray-600">No active tasks</h3>
                <p className="max-w-xs text-center mt-1">Create a new synchronization task to copy indices between clusters.</p>
                <button
                  onClick={() => setIsModalOpen(true)}
                  className="mt-6 text-blue-600 hover:text-blue-800 font-medium"
                >
                  Create your first task
                </button>
              </>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="w-10 px-6 py-4"></th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Source Cluster</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Target Cluster</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Indices</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Config Sync</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Data Sync</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
                  <th className="px-6 py-4 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {tasks.map(task => (
                  <React.Fragment key={task.id}>
                    <tr
                      className={`hover:bg-gray-50 transition-colors group cursor-pointer ${expandedTaskId === task.id ? 'bg-gray-50' : ''}`}
                      onClick={() => setExpandedTaskId(expandedTaskId === task.id ? null : task.id)}
                    >
                      <td className="px-6 py-4 text-gray-400">
                        {expandedTaskId === task.id ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                      </td>

                      {/* Source */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm font-medium text-gray-800">{task.sourceClusterName}</span>
                      </td>

                      {/* Target */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm font-medium text-gray-800">{task.targetClusterName}</span>
                      </td>

                      {/* Indices Count with Hover Tooltip */}
                      <td className="px-6 py-4 whitespace-nowrap relative">
                        <div className="group/indices relative inline-block">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700 cursor-help">
                            <Layers size={12} /> {task.indices.length} Indices
                          </span>

                          {/* Tooltip scoped to group/indices with smooth transition */}
                          <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-56 bg-slate-900 text-white text-xs rounded-lg p-3 invisible opacity-0 group-hover/indices:visible group-hover/indices:opacity-100 transition-all duration-200 z-50 pointer-events-none shadow-xl border border-slate-700">
                            <div className="font-semibold text-slate-300 border-b border-slate-700 pb-1 mb-1">
                              Included Indices
                            </div>
                            <div className="max-h-32 overflow-hidden flex flex-col gap-0.5">
                              {task.indices.slice(0, 8).map((idx, i) => (
                                <div key={i} className="truncate text-slate-400">• {idx.source}</div>
                              ))}
                              {task.indices.length > 8 && (
                                <div className="text-slate-500 italic pt-1">+ {task.indices.length - 8} more...</div>
                              )}
                            </div>
                            {/* Triangle */}
                            <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-l-4 border-l-transparent border-r-4 border-r-transparent border-t-4 border-t-slate-900"></div>
                          </div>
                        </div>
                      </td>

                      {/* Config Status */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        {task.configStatus === 'running' && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
                            <Loader2 size={12} className="animate-spin" /> Preparing
                          </span>
                        )}
                        {task.configStatus === 'success' && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700">
                            <CheckCircle size={12} /> Synced
                          </span>
                        )}
                        {task.configStatus === 'failed' && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-rose-50 text-rose-700">
                            <AlertCircle size={12} /> Failed
                          </span>
                        )}
                        {task.configStatus === 'pending' && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-500">
                            Pending
                          </span>
                        )}
                      </td>

                      {/* Data Status & Progress */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="group relative">
                          <div className="flex flex-col gap-2 min-w-[140px] cursor-help">
                            <div className="flex items-center justify-between gap-2">
                              {task.dataStatus === 'idle' && <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded font-bold uppercase">Ready</span>}
                              {task.dataStatus === 'running' && <span className="text-[10px] bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded font-bold uppercase animate-pulse">In Progress</span>}
                              {task.dataStatus === 'completed' && <span className="text-[10px] bg-emerald-100 text-emerald-600 px-1.5 py-0.5 rounded font-bold uppercase">Finished</span>}
                              {task.dataStatus === 'failed' && <span className="text-[10px] bg-rose-100 text-rose-600 px-1.5 py-0.5 rounded font-bold uppercase">Halted</span>}

                              {task.dataStatus === 'running' && (
                                <span className="text-xs font-mono font-bold text-blue-600">{task.progress}%</span>
                              )}
                            </div>

                            <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden border border-gray-50">
                              <div
                                className={`h-full transition-all duration-1000 ease-out rounded-full ${task.dataStatus === 'running' ? 'bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]' :
                                  task.dataStatus === 'completed' ? 'bg-emerald-500' :
                                    task.dataStatus === 'failed' ? 'bg-rose-500' : 'bg-gray-200'
                                  }`}
                                style={{ width: `${task.dataStatus === 'completed' ? 100 : task.progress}%` }}
                              />
                            </div>

                            {(task.dataStatus === 'completed' || task.dataStatus === 'running') && (
                              <div className="flex items-center justify-between text-[10px] text-gray-400 font-medium">
                                <span>{task.docsSynced.toLocaleString()} / {task.totalDocsEstimate ? task.totalDocsEstimate.toLocaleString() : '?'} docs</span>
                              </div>
                            )}
                          </div>

                          {/* Dynamic Progress Tooltip (Tips) */}
                          <div className="absolute left-0 bottom-full mb-2 w-48 bg-slate-900 text-white p-3 rounded-lg shadow-2xl invisible opacity-0 group-hover:visible group-hover:opacity-100 transition-all z-50 pointer-events-none">
                            <div className="text-[10px] font-bold text-slate-400 uppercase mb-2 border-b border-slate-700 pb-1">Real-time Snapshot</div>
                            <div className="space-y-1.5">
                              <div className="flex justify-between items-center text-[10px]">
                                <span className="text-slate-500">Synced:</span>
                                <span className="text-emerald-400 font-mono font-bold">{task.indices.filter(i => ['success', 'synced', 'exists'].includes(i.status)).length} Indices</span>
                              </div>
                              <div className="flex justify-between items-center text-[10px]">
                                <span className="text-slate-500">Failed:</span>
                                <span className={`${task.indices.some(i => i.status === 'failed' || i.status === 'error') ? 'text-rose-400' : 'text-slate-400'} font-mono font-bold`}>
                                  {task.indices.filter(i => i.status === 'failed' || i.status === 'error').length} Items
                                </span>
                              </div>
                              <div className="flex justify-between items-center text-[10px]">
                                <span className="text-slate-500">Efficiency:</span>
                                <span className="text-blue-400 font-mono font-bold">{task.progress}% Peak</span>
                              </div>
                            </div>
                            <div className="absolute top-full left-4 w-0 h-0 border-l-4 border-l-transparent border-r-4 border-r-transparent border-t-4 border-t-slate-900"></div>
                          </div>
                        </div>
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-500">
                        {new Date(task.createdAt).toLocaleString()}
                      </td>

                      {/* Actions */}
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="flex items-center justify-end gap-2">
                          {/* Allow manual sync trigger if data is idle, OR if it failed previously */}
                          {(task.dataStatus === 'idle' || task.dataStatus === 'failed') && (
                            <button
                              onClick={(e) => { e.stopPropagation(); handleStartDataSync(task); }}
                              disabled={creatingDataTaskFor === task.id}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-medium transition-colors shadow-sm disabled:opacity-70 disabled:cursor-not-allowed"
                            >
                              {creatingDataTaskFor === task.id ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} fill="currentColor" />}
                              Sync Data
                            </button>
                          )}
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDeleteTask(task.id); }}
                            className="p-1.5 text-gray-400 hover:bg-rose-50 hover:text-rose-600 rounded transition-colors"
                            title="Delete Task"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>

                    {/* Expanded Detail View */}
                    {expandedTaskId === task.id && (
                      <tr>
                        <td colSpan={8} className="bg-gray-50 px-6 py-4 border-b border-gray-200 shadow-inner">
                          <div className="flex gap-6">
                            {/* Index List */}
                            <div className="flex-1 bg-white rounded-lg border border-gray-200 overflow-hidden">
                              <div className="px-4 py-2 bg-gray-100 border-b border-gray-200 text-xs font-bold text-gray-500 uppercase">
                                Included Indices
                              </div>
                              <div className="max-h-48 overflow-y-auto">
                                <table className="min-w-full divide-y divide-gray-100">
                                  <thead className="bg-gray-50">
                                    <tr>
                                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Source Index</th>
                                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Target Index</th>
                                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Status</th>
                                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Docs</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-gray-50">
                                    {task.indices.map((mapping, idx) => (
                                      <tr key={idx}>
                                        <td className="px-4 py-2 text-xs text-gray-700">{mapping.source}</td>
                                        <td className="px-4 py-2 text-xs text-blue-600">{mapping.target}</td>
                                        <td className="px-4 py-2 text-xs text-right">
                                          <span className={`px-1.5 py-0.5 rounded capitalize ${mapping.status === 'synced' || mapping.status === 'success' ? 'bg-emerald-100 text-emerald-700' :
                                            mapping.status === 'exists' ? 'bg-amber-100 text-amber-700' :
                                              mapping.status === 'failed' || mapping.status === 'error' ? 'bg-rose-100 text-rose-700' :
                                                mapping.status === 'pending' ? 'bg-blue-50 text-blue-600' :
                                                  mapping.status === 'skipped' ? 'bg-gray-200 text-gray-600' :
                                                    'bg-gray-100 text-gray-600'
                                            }`}>
                                            {mapping.status}
                                          </span>
                                        </td>
                                        <td className="px-4 py-2 text-xs text-gray-500 text-right">{mapping.docsCount ? mapping.docsCount.toLocaleString() : '-'}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>

                            {/* Logs & Activity Terminal */}
                            <div className="flex-1 flex flex-col bg-slate-900 rounded-lg overflow-hidden border border-slate-700 shadow-xl max-h-64">
                              <div className="px-4 py-2 bg-slate-800 border-b border-slate-700 flex justify-between items-center">
                                <div className="flex items-center gap-2">
                                  <div className="flex gap-1.5">
                                    <div className="w-2.5 h-2.5 rounded-full bg-rose-500"></div>
                                    <div className="w-2.5 h-2.5 rounded-full bg-amber-500"></div>
                                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-500"></div>
                                  </div>
                                  <span className="ml-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Real-time Activity Stream</span>
                                </div>
                                <div className="flex items-center gap-3">
                                  {task.dataStatus === 'running' && (
                                    <span className="flex items-center gap-1 text-[10px] font-bold text-blue-400 animate-pulse">
                                      <RefreshCw size={10} className="animate-spin" /> LIVE
                                    </span>
                                  )}
                                  <span className="text-[10px] text-slate-500 font-mono">ID: {task.id.split('-')[0]}</span>
                                </div>
                              </div>

                              <div
                                className="flex-1 p-4 font-mono text-[11px] overflow-y-auto custom-scrollbar-dark space-y-1.5"
                                ref={(el) => {
                                  if (el && task.dataStatus === 'running') {
                                    el.scrollTop = el.scrollHeight;
                                  }
                                }}
                              >
                                {task.logs.length === 0 && (
                                  <div className="text-slate-600 italic">Initializing stream processor...</div>
                                )}

                                {/* Mapping initial task creation */}
                                <div className="flex gap-3 text-slate-500">
                                  <span className="opacity-40">[{new Date(task.createdAt).toLocaleTimeString()}]</span>
                                  <span className="text-emerald-500/80 font-bold">[SYSTEM]</span>
                                  <span>Task initialized: {task.indices.length} indices queued.</span>
                                </div>

                                {/* Virtual Logs based on Index Statuses */}
                                {task.indices.map((idx, i) => (
                                  <React.Fragment key={`vlog-${i}`}>
                                    {idx.status !== 'pending' && (
                                      <div className="flex gap-3">
                                        <span className="text-slate-600 opacity-40">[{new Date(task.createdAt + (i + 1) * 500).toLocaleTimeString()}]</span>
                                        <span className={`font-bold ${idx.status === 'success' || idx.status === 'synced' ? 'text-emerald-500' :
                                          idx.status === 'failed' || idx.status === 'error' ? 'text-rose-500' : 'text-blue-400'
                                          }`}>
                                          [{idx.status.toUpperCase()}]
                                        </span>
                                        <span className="text-slate-300">
                                          {idx.status === 'synced' || idx.status === 'success' ? `Synchronization finalized for index: ${idx.target}` :
                                            idx.status === 'exists' ? `Index ${idx.target} already exists on target; checking mappings...` :
                                              idx.status === 'running' ? `In-flight data transfer: stream docs -> ${idx.target}` :
                                                `Operation for ${idx.target} returned status: ${idx.status}`}
                                        </span>
                                      </div>
                                    )}
                                  </React.Fragment>
                                ))}

                                {task.logs.map((log, i) => (
                                  <div key={i} className="flex gap-3 border-t border-white/5 pt-1 mt-1">
                                    <span className="text-slate-600 opacity-40 font-mono">[{new Date(task.createdAt).toLocaleTimeString()}]</span>
                                    <span className="text-amber-400 font-bold">[EXT]</span>
                                    <span className="text-slate-400 italic font-mono">{log}</span>
                                  </div>
                                ))}

                                {task.dataStatus === 'running' && (
                                  <div className="flex items-center gap-2 text-blue-400 pt-2 border-t border-blue-500/10">
                                    <Loader2 size={10} className="animate-spin" />
                                    <span>Polling backend telemetry for updates...</span>
                                  </div>
                                )}

                                {task.dataStatus === 'completed' && (
                                  <div className="flex gap-3 text-emerald-400 font-bold pt-2 border-t border-emerald-500/20">
                                    <span className="opacity-40">[{new Date().toLocaleTimeString()}]</span>
                                    <span>[SYSTEM] TASK COMPLETED SUCCESSFULLY</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* New Task Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
                  <ArrowRightLeft size={20} />
                </div>
                <h3 className="font-bold text-gray-800">New Synchronization Task</h3>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-hidden grid grid-cols-1 md:grid-cols-[1fr,1.5fr] divide-x divide-gray-200">

              {/* Left Col: Cluster & Index Selection */}
              <div className="p-6 overflow-y-auto flex flex-col gap-6">

                {/* Cluster Selectors */}
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase mb-2">
                      <div className="w-2 h-2 rounded-full bg-emerald-500"></div> Source Cluster
                    </div>
                    <SearchableSelect
                      label=""
                      value={sourceClusterId}
                      onChange={setSourceClusterId}
                      options={clusters.map(c => ({ value: c.id, label: c.name }))}
                    />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase mb-2">
                      <div className="w-2 h-2 rounded-full bg-blue-500"></div> Target Cluster
                    </div>
                    <SearchableSelect
                      label=""
                      value={targetClusterId}
                      onChange={setTargetClusterId}
                      options={clusters.map(c => ({ value: c.id, label: c.name }))}
                    />
                  </div>
                </div>

                {/* Index Picker */}
                <div className="flex-1 flex flex-col min-h-0 border-t border-gray-100 pt-4">
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-sm font-semibold text-gray-800">Available Indices</label>
                    <span className="text-xs text-gray-500">{sourceIndices.length} found</span>
                  </div>

                  {/* Filter Input */}
                  <div className="relative mb-2">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Filter indices..."
                      value={indexSearchTerm}
                      onChange={(e) => setIndexSearchTerm(e.target.value)}
                      className="w-full pl-9 pr-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-1 focus:ring-blue-500 outline-none"
                    />
                  </div>

                  {/* List */}
                  <div className="flex-1 border border-gray-200 rounded-lg overflow-y-auto custom-scrollbar max-h-[300px]">
                    {isLoadingIndices ? (
                      <div className="flex justify-center p-4"><Loader2 className="animate-spin text-blue-500" /></div>
                    ) : filteredIndices.length === 0 ? (
                      <div className="p-4 text-center text-xs text-gray-400">No indices found</div>
                    ) : (
                      <div className="divide-y divide-gray-50">
                        {filteredIndices.map(idx => {
                          const isChecked = selectedSourceIndices.includes(idx.name);
                          return (
                            <div
                              key={idx.name}
                              onClick={() => handleToggleIndex(idx.name)}
                              className={`px-3 py-2 text-sm flex items-center justify-between cursor-pointer hover:bg-gray-50 transition-colors ${isChecked ? 'bg-blue-50' : ''}`}
                            >
                              <div className="flex items-center gap-2 overflow-hidden">
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  readOnly
                                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                />
                                <span className="truncate text-gray-700" title={idx.name}>{idx.name}</span>
                              </div>
                              <span className="text-xs text-gray-400 whitespace-nowrap">{idx.docsCount.toLocaleString()} docs</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Right Col: Selected Review */}
              <div className="p-6 bg-gray-50 flex flex-col overflow-hidden">
                <div className="flex justify-between items-center mb-4">
                  <h4 className="font-bold text-gray-800 text-sm uppercase tracking-wide">Configuration</h4>
                </div>

                {/* Task Flags Options */}
                <div className="bg-white p-4 rounded-lg border border-gray-200 mb-6 space-y-3">
                  {/* Settings Sync removed per requirement */}
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      id="opt_mappings"
                      checked={syncMappings}
                      onChange={(e) => setSyncMappings(e.target.checked)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-4 h-4"
                    />
                    <label htmlFor="opt_mappings" className="text-sm text-gray-700 flex items-center gap-2">
                      <FileJson size={14} className="text-gray-400" /> Sync Mappings
                    </label>
                  </div>
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      id="opt_data"
                      checked={syncData}
                      onChange={(e) => setSyncData(e.target.checked)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-4 h-4"
                    />
                    <label htmlFor="opt_data" className="text-sm text-gray-700 flex items-center gap-2">
                      <HardDrive size={14} className="text-gray-400" /> Sync Data (Docs)
                    </label>
                  </div>
                </div>

                <div className="flex justify-between items-center mb-4">
                  <h4 className="font-bold text-gray-800 text-sm uppercase tracking-wide">Selected Indices</h4>
                  <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full text-xs font-bold">
                    {selectedSourceIndices.length}
                  </span>
                </div>

                {selectedSourceIndices.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-gray-400 border-2 border-dashed border-gray-200 rounded-xl">
                    <Database size={32} className="mb-2 opacity-50" />
                    <p className="text-sm">No indices selected</p>
                    <p className="text-xs mt-1">Select indices from the left panel</p>
                  </div>
                ) : (
                  <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-3">
                    {selectedSourceIndices.map(sourceName => (
                      <div key={sourceName} className="bg-white p-3 rounded-lg border border-gray-200 shadow-sm">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-bold text-gray-500">Source: {sourceName}</span>
                          <button onClick={() => handleToggleIndex(sourceName)} className="text-gray-400 hover:text-rose-500">
                            <X size={14} />
                          </button>
                        </div>
                        <div className="flex items-center gap-2">
                          <ArrowRight size={14} className="text-gray-300 flex-shrink-0" />
                          <div className="flex-1">
                            <label className="block text-[10px] text-gray-400 mb-0.5">Target Name</label>
                            <input
                              type="text"
                              value={targetIndexMap[sourceName]}
                              onChange={(e) => handleTargetNameChange(sourceName, e.target.value)}
                              className="w-full px-2 py-1 text-xs border border-gray-200 rounded focus:ring-1 focus:ring-blue-500 outline-none text-blue-600 font-medium"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="mt-4 pt-4 border-t border-gray-200">
                  <div className="flex justify-between text-sm text-gray-600 mb-4">
                    <span>Total Documents (Est):</span>
                    <span className="font-mono font-bold">
                      {selectedSourceIndices.reduce((sum, name) => {
                        const idx = sourceIndices.find(i => i.name === name);
                        return sum + (idx?.docsCount || 0);
                      }, 0).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 bg-white border-t border-gray-100 flex justify-end gap-3">
              <button
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateTask}
                disabled={selectedSourceIndices.length === 0 || isSubmitting}
                className="flex items-center gap-2 px-6 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting && <Loader2 size={16} className="animate-spin" />}
                {isSubmitting ? 'Creating...' : `Create Task (${selectedSourceIndices.length})`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ESSyncView;