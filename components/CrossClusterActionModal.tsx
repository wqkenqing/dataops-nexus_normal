import React, { useState, useEffect } from 'react';
import { X, GitCompare, ArrowRightLeft, Check, AlertCircle, ArrowRight, Loader2, Copy } from 'lucide-react';
import { ESCluster, IndexMetadata, BackendSyncTask } from '../types';
import { getIndexMetadata } from '../services/mockData';
import { createESSyncTask, fetchESSyncTaskById, fetchESIndexStats } from '../services/api';

interface CrossClusterActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'compare' | 'sync';
  sourceCluster: ESCluster;
  sourceIndexName: string;
  clusterList: ESCluster[];
}

const CrossClusterActionModal: React.FC<CrossClusterActionModalProps> = ({
  isOpen,
  onClose,
  mode,
  sourceCluster,
  sourceIndexName,
  clusterList
}) => {
  const [targetClusterId, setTargetClusterId] = useState<string>('');
  const [targetIndexName, setTargetIndexName] = useState<string>(sourceIndexName);
  const [step, setStep] = useState<'config' | 'processing' | 'result'>('config');
  const [comparisonData, setComparisonData] = useState<{ source: IndexMetadata, target: IndexMetadata } | null>(null);

  // Sync Progress State
  const [syncTaskId, setSyncTaskId] = useState<string | null>(null);
  const [syncProgress, setSyncProgress] = useState<number>(0);
  const [docStats, setDocStats] = useState<{ source: number, target: number } | null>(null);
  const [taskStatus, setTaskStatus] = useState<string>('pending');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Filter out the source cluster from the target options based on prop
  const targetOptions = clusterList.filter(c => c.id !== sourceCluster.id);

  useEffect(() => {
    if (isOpen) {
      setStep('config');
      setComparisonData(null);
      setTargetIndexName(sourceIndexName);
      if (targetOptions.length > 0) {
        setTargetClusterId(targetOptions[0].id);
      }
    }
  }, [isOpen, sourceIndexName, sourceCluster.id, targetOptions.length]);

  const handleAction = async () => {
    setStep('processing');
    setErrorMessage(null);
    setSyncProgress(0);
    setDocStats(null);

    if (mode === 'compare') {
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 1500));
      const sourceMeta = getIndexMetadata(sourceCluster.id, sourceIndexName);
      const targetMeta = getIndexMetadata(targetClusterId, targetIndexName);
      setComparisonData({ source: sourceMeta, target: targetMeta });
      setStep('result');
    } else {
      // Real Sync Logic
      try {
        const task = await createESSyncTask(sourceCluster.id, targetClusterId, {
          indices: [sourceIndexName],
          sync_settings: true,
          sync_mappings: true,
          sync_data: true
        });

        if (task) {
          setSyncTaskId(task.id);
          setTaskStatus(task.status);
          setStep('result');
        } else {
          setErrorMessage("Failed to create sync task. Please check cluster connectivity.");
          setStep('config');
        }
      } catch (err) {
        console.error("Sync Error:", err);
        setErrorMessage("An unexpected error occurred during sync initialization.");
        setStep('config');
      }
    }
  };

  // Polling for Sync Progress
  useEffect(() => {
    let interval: any;

    const currentTaskStatus = taskStatus?.toLowerCase() || '';

    if (mode === 'sync' && step === 'result' && syncTaskId && (currentTaskStatus === 'running' || currentTaskStatus === 'pending')) {
      interval = setInterval(async () => {
        try {
          // 1. Fetch task status
          const task = await fetchESSyncTaskById(syncTaskId);
          if (task) {
            const status = task.status?.toLowerCase() || '';
            setTaskStatus(status);

            const total = task.totalDocs || task.total_docs || 0;
            const synced = task.syncedDocs || task.docs_synced || 0;

            if (total > 0 || synced > 0) {
              setDocStats({
                source: total,
                target: synced
              });
            }

            // 2. Prioritize task-provided progress if available
            if (task.progress !== undefined) {
              setSyncProgress(task.progress);
            } else if (total > 0) {
              const progress = Math.min(99, Math.floor((synced / total) * 100));
              setSyncProgress(progress);
            } else {
              // Fallback: Fetch doc counts from both sides as per initial design
              const [sourceStats, targetStats] = await Promise.all([
                fetchESIndexStats(sourceCluster.id, sourceIndexName),
                fetchESIndexStats(targetClusterId, targetIndexName)
              ]);

              if (sourceStats && targetStats) {
                setDocStats({
                  source: sourceStats.docsCount,
                  target: targetStats.docsCount
                });

                const progress = sourceStats.docsCount > 0
                  ? Math.min(100, Math.floor((targetStats.docsCount / sourceStats.docsCount) * 100))
                  : 0;
                setSyncProgress(progress);
              }
            }

            if (status === 'success' || status === 'completed' || status === 'failed') {
              if (status === 'success' || status === 'completed') setSyncProgress(100);
              clearInterval(interval);
            }
          }
        } catch (err) {
          console.error("Polling error:", err);
        }
      }, 3000); // Poll every 3 seconds
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [mode, step, syncTaskId, taskStatus, sourceCluster.id, sourceIndexName, targetClusterId, targetIndexName]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className={`bg-white rounded-xl shadow-2xl w-full transition-all ${mode === 'compare' && step === 'result' ? 'max-w-5xl' : 'max-w-xl'}`}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <div className={`p-2 rounded-lg ${mode === 'compare' ? 'bg-orange-100 text-orange-600' : 'bg-blue-100 text-blue-600'}`}>
              {mode === 'compare' ? <GitCompare size={20} /> : <ArrowRightLeft size={20} />}
            </div>
            <div>
              <h3 className="font-bold text-gray-800">
                {mode === 'compare' ? 'Compare Configuration' : 'Sync Index'}
              </h3>
              <p className="text-xs text-gray-500">Cross-cluster operation</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {step === 'config' && (
            <div className="space-y-6">
              {/* Source (Read-only) */}
              <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                <div>
                  <span className="text-xs font-semibold text-gray-500 uppercase">Source Cluster</span>
                  <div className="flex items-center gap-2 mt-1 font-medium text-gray-700">
                    <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                    {sourceCluster.name}
                  </div>
                </div>
                <div>
                  <span className="text-xs font-semibold text-gray-500 uppercase">Source Index</span>
                  <div className="mt-1 font-medium text-gray-700 break-all">{sourceIndexName}</div>
                </div>
              </div>

              <div className="flex justify-center text-gray-400">
                <ArrowRight size={20} className="transform rotate-90 md:rotate-0" />
              </div>

              {/* Target Selection */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Target Cluster</label>
                  {targetOptions.length > 0 ? (
                    <select
                      value={targetClusterId}
                      onChange={(e) => setTargetClusterId(e.target.value)}
                      className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                    >
                      {targetOptions.map(c => (
                        <option key={c.id} value={c.id}>{c.name} ({c.host})</option>
                      ))}
                    </select>
                  ) : (
                    <div className="p-3 bg-amber-50 text-amber-700 text-sm rounded-lg border border-amber-200">
                      No other clusters available to select. Please add another cluster first.
                    </div>
                  )}
                </div>

                {targetOptions.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {mode === 'compare' ? 'Target Index (to compare against)' : 'Target Index Name (new or overwrite)'}
                    </label>
                    <input
                      type="text"
                      value={targetIndexName}
                      onChange={(e) => setTargetIndexName(e.target.value)}
                      className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                    />
                    {mode === 'sync' && (
                      <p className="mt-1 text-xs text-amber-600 flex items-center gap-1">
                        <AlertCircle size={12} />
                        Warning: If the index exists in the target cluster, it may be overwritten.
                      </p>
                    )}
                  </div>
                )}
                {errorMessage && (
                  <div className="p-3 bg-rose-50 text-rose-700 text-sm rounded-lg border border-rose-200 flex items-center gap-2">
                    <AlertCircle size={16} />
                    {errorMessage}
                  </div>
                )}
              </div>
            </div>
          )}

          {step === 'processing' && (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 size={48} className="text-indigo-600 animate-spin mb-4" />
              <h4 className="text-lg font-medium text-gray-800">
                {mode === 'compare' ? 'Fetching Metadata...' : 'Synchronizing Data...'}
              </h4>
              <p className="text-sm text-gray-500 mt-2">Connecting to clusters securely</p>
            </div>
          )}

          {step === 'result' && mode === 'sync' && (
            <div className="flex flex-col items-center justify-center py-8">
              <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 transition-colors ${taskStatus === 'success' ? 'bg-emerald-100 text-emerald-600' :
                taskStatus === 'failed' ? 'bg-rose-100 text-rose-600' : 'bg-blue-100 text-blue-600'
                }`}>
                {taskStatus === 'success' ? <Check size={32} /> :
                  taskStatus === 'failed' ? <AlertCircle size={32} /> : <Loader2 size={32} className="animate-spin" />}
              </div>

              <h4 className="text-xl font-bold text-gray-900">
                {taskStatus === 'success' ? 'Sync Completed' :
                  taskStatus === 'failed' ? 'Sync Failed' : 'Synchronizing Data...'}
              </h4>

              <div className="w-full mt-6 space-y-2">
                <div className="flex justify-between text-sm font-medium text-gray-600">
                  <span>Progress</span>
                  <span>{syncProgress}%</span>
                </div>
                <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden border border-gray-200">
                  <div
                    className={`h-full transition-all duration-500 ease-out rounded-full ${taskStatus === 'failed' ? 'bg-rose-500' :
                      taskStatus === 'success' ? 'bg-emerald-500' : 'bg-blue-500'
                      }`}
                    style={{ width: `${syncProgress}%` }}
                  ></div>
                </div>
                {docStats && (
                  <p className="text-center text-xs text-gray-500 mt-2">
                    {docStats.target.toLocaleString()} / {docStats.source.toLocaleString()} documents synced
                  </p>
                )}
              </div>

              <p className="text-gray-600 mt-6 text-center max-w-sm text-sm">
                Task ID: <span className="font-mono bg-gray-100 px-1 rounded">{syncTaskId || 'task_sync_99283'}</span><br />
                Status: <span className={`font-semibold capitalize ${taskStatus === 'success' ? 'text-emerald-600' :
                  taskStatus === 'failed' ? 'text-rose-600' : 'text-blue-600'
                  }`}>{taskStatus}</span>
              </p>

              {taskStatus === 'failed' && (
                <div className="mt-4 p-3 bg-rose-50 text-rose-700 text-xs rounded-lg border border-rose-200">
                  Documentation sync encountered errors on remote cluster. Please check logs for details.
                </div>
              )}
            </div>
          )}

          {step === 'result' && mode === 'compare' && comparisonData && (
            <div className="grid grid-cols-2 gap-6 h-[400px]">
              <div className="flex flex-col h-full">
                <div className="mb-2 font-medium text-sm text-gray-600 flex items-center justify-between">
                  <span>{sourceCluster.name}</span>
                  <span className="text-xs bg-gray-100 px-2 py-0.5 rounded">Source</span>
                </div>
                <div className="flex-1 bg-slate-900 rounded-lg p-4 overflow-auto text-xs font-mono text-emerald-400 border border-slate-700 custom-scrollbar">
                  <pre>{JSON.stringify(comparisonData.source, null, 2)}</pre>
                </div>
              </div>
              <div className="flex flex-col h-full">
                <div className="mb-2 font-medium text-sm text-gray-600 flex items-center justify-between">
                  <span>Target Cluster</span>
                  <span className="text-xs bg-orange-50 text-orange-600 px-2 py-0.5 rounded border border-orange-100">Diff Target</span>
                </div>
                <div className="flex-1 bg-slate-900 rounded-lg p-4 overflow-auto text-xs font-mono text-orange-300 border border-slate-700 custom-scrollbar">
                  <pre>{JSON.stringify(comparisonData.target, null, 2)}</pre>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 rounded-b-xl border-t border-gray-200 flex justify-end gap-3">
          {step === 'config' ? (
            <>
              <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors">
                Cancel
              </button>
              <button
                onClick={handleAction}
                disabled={targetOptions.length === 0}
                className={`px-4 py-2 text-sm font-medium text-white rounded-lg shadow-sm transition-all ${targetOptions.length === 0
                  ? 'bg-gray-400 cursor-not-allowed'
                  : mode === 'compare' ? 'bg-orange-600 hover:bg-orange-700' : 'bg-blue-600 hover:bg-blue-700'
                  }`}
              >
                {mode === 'compare' ? 'Compare Config' : 'Start Sync'}
              </button>
            </>
          ) : (
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg transition-colors"
            >
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default CrossClusterActionModal;