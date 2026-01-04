import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Search, HardDrive, RefreshCw, Plus, ChevronDown, ChevronRight, Eye, Loader2, ArrowUp, ArrowDown, ChevronsUpDown, Trash2 } from 'lucide-react';
import { fetchKafkaTopics, deleteKafkaTopics } from '../services/api';
import StatusBadge from './StatusBadge';
import { KafkaCluster, KafkaTopic } from '../types';
import KafkaBatchCreateModal from './KafkaBatchCreateModal';
import KafkaTopicInspectorModal from './KafkaTopicInspectorModal';
import ConsumerOffsetsView from './ConsumerOffsetsView';
import { useBackend } from '../contexts/BackendContext';
import KafkaBatchDeleteModal from './KafkaBatchDeleteModal';
import ConfirmDialog, { ToastContainer, ToastProps, SortableHeader, SortConfig } from './UIComponents';
import { useTranslation } from 'react-i18next';

interface KafkaTopicsTableProps {
  clusters: KafkaCluster[];
}



const KafkaTopicsTable: React.FC<KafkaTopicsTableProps> = ({ clusters }) => {
  const { t } = useTranslation();
  const { backend } = useBackend();
  // Helper to format bytes
  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Helper to format duration (ms to human readable)
  const formatDuration = (ms: string | number) => {
    if (ms === '-1' || ms === -1) return t('noLimit');
    const value = typeof ms === 'string' ? parseInt(ms) : ms;
    if (isNaN(value)) return ms;

    const seconds = Math.floor(value / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d`;
    if (hours > 0) return `${hours}h`;
    if (minutes > 0) return `${minutes}m`;
    return `${seconds}s`;
  };

  const { clusterId } = useParams();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedTopic, setExpandedTopic] = useState<string | null>(null);

  // Data State
  const [topics, setTopics] = useState<KafkaTopic[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [sortConfig, setSortConfig] = useState<SortConfig<KafkaTopic>>({ key: null, direction: 'asc' });

  // Modal States
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isBatchDeleteModalOpen, setIsBatchDeleteModalOpen] = useState(false);
  const [inspectTopic, setInspectTopic] = useState<string | null>(null);

  // UI States
  const [deleteConfirmTopic, setDeleteConfirmTopic] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastProps[]>([]);

  // Toast Helpers
  const addToast = (type: 'success' | 'error' | 'info', message: string) => {
    const id = Math.random().toString(36).substr(2, 9);
    setToasts(prev => [...prev, { id, type, message, duration: 3000 }]);
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };


  // Find the cluster in props
  const cluster = clusters.find(c => c.id === clusterId);

  // Load Data
  const loadData = async () => {
    if (cluster && cluster.id) {
      setIsLoading(true);
      try {
        const data = await fetchKafkaTopics(cluster.id);
        setTopics(Array.isArray(data) ? data : []);
      } catch (e) {
        console.error("Failed to load Kafka topics", e);
        setTopics([]);
      } finally {
        setIsLoading(false);
      }
    }
  };

  useEffect(() => {
    let isMounted = true;
    if (clusterId) {
      loadData();
    }
    return () => { isMounted = false; };
  }, [clusterId, cluster]);

  const filteredTopics = useMemo(() => {
    let sortableItems = [...(topics || [])];

    if (searchTerm) {
      sortableItems = sortableItems.filter(t =>
        t.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (sortConfig.key) {
      sortableItems.sort((a, b) => {
        const aValue = a[sortConfig.key!];
        const bValue = b[sortConfig.key!];

        if (typeof aValue === 'string' && typeof bValue === 'string') {
          return sortConfig.direction === 'asc'
            ? aValue.localeCompare(bValue)
            : bValue.localeCompare(aValue);
        }

        if (aValue < bValue) {
          return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (aValue > bValue) {
          return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
      });
    }

    return sortableItems;
  }, [topics, searchTerm, sortConfig]);

  const requestSort = (key: keyof KafkaTopic) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };



  const toggleExpand = (topicName: string) => {
    if (expandedTopic === topicName) {
      setExpandedTopic(null);
    } else {
      setExpandedTopic(topicName);
    }
  };

  if (!cluster) {
    return (
      <div className="flex flex-col items-center justify-center h-96 text-gray-500">
        <div className="mb-4 bg-gray-100 p-4 rounded-full">
          <HardDrive size={32} className="text-gray-400" />
        </div>
        <p className="text-lg font-medium">{t('clusterNotFound')}</p>
        <button
          onClick={() => navigate('/kafka')}
          className="mt-4 text-purple-600 hover:text-purple-800"
        >
          {t('returnToList')}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="sticky top-16 z-30 bg-gray-50/95 backdrop-blur-sm pb-4 pt-2 transition-all">
        <div className="flex flex-col space-y-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/kafka')}
              className="p-2 bg-white border border-gray-200 hover:bg-gray-50 rounded-lg transition-colors text-gray-600 shadow-sm"
            >
              <ArrowLeft size={18} />
            </button>
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
                <HardDrive className="text-purple-500" size={24} />
                {cluster.name}
                <StatusBadge status={cluster.status} />
              </h1>
              <p className="text-sm text-gray-500 mt-1 ml-1">
                Host: {cluster.host}:{cluster.port} • Controller: {cluster.controllerType}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setIsCreateModalOpen(true)}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors shadow-sm text-sm font-medium"
              >
                <Plus size={16} /> {t('batchCreateTopics')}
              </button>
              {backend === 'java' && (
                <button
                  onClick={() => setIsBatchDeleteModalOpen(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-white text-rose-600 border border-rose-200 rounded-lg hover:bg-rose-50 hover:border-rose-300 transition-colors shadow-sm text-sm font-medium"
                >
                  <Trash2 size={16} /> {t('batchDelete')}
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between gap-4 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
            <div className="relative flex-1 max-w-lg">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="text"
                placeholder={t('searchTopics')}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:bg-white outline-none transition-all"
              />
            </div>
            <button
              onClick={loadData}
              className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              {isLoading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
              {t('refresh')}
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        {isLoading ? (
          <div className="flex justify-center items-center py-20">
            <Loader2 className="animate-spin text-purple-600" size={32} />
          </div>
        ) : filteredTopics.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-gray-500">
            <p>{t('noTopicsFound')}</p>
          </div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50 sticky top-[220px] z-20 shadow-sm">
              <tr>
                <th className="w-10 px-6 py-3 rounded-tl-xl"></th>
                <SortableHeader label={t('topicName')} offsetKey="name" currentSort={sortConfig} onSort={requestSort} />
                <SortableHeader label={t('partitions')} offsetKey="partitionCount" currentSort={sortConfig} onSort={requestSort} />
                <SortableHeader label={t('replication')} offsetKey="replicationFactor" currentSort={sortConfig} onSort={requestSort} />
                <SortableHeader label={t('inSyncReplicas')} offsetKey="isrPercentage" currentSort={sortConfig} onSort={requestSort} />
                <SortableHeader label={t('messages')} offsetKey="messageCount" currentSort={sortConfig} onSort={requestSort} />
                <SortableHeader label={t('size')} offsetKey="sizeBytes" currentSort={sortConfig} onSort={requestSort} />
                <SortableHeader label={t('retention')} offsetKey="retentionBytes" currentSort={sortConfig} onSort={requestSort} />
                <SortableHeader label={t('cleanupPolicy')} offsetKey="cleanupPolicy" currentSort={sortConfig} onSort={requestSort} />
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider rounded-tr-xl">{t('actions')}</th>
              </tr>
            </thead>
            {filteredTopics.map((topic) => (
              <tbody key={topic.name} className="bg-white divide-y divide-gray-200">
                <tr
                  onClick={() => toggleExpand(topic.name)}
                  className={`hover:bg-purple-50 transition-colors cursor-pointer ${expandedTopic === topic.name
                    ? 'bg-purple-50 sticky top-[268px] z-10 shadow-md'
                    : ''
                    }`}
                >
                  <td className="px-6 py-4 text-gray-400">
                    {expandedTopic === topic.name ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {topic.name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {topic.partitionCount}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {topic.replicationFactor}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${topic.isrPercentage === 100 ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                      {topic.isrPercentage}%
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">
                    {topic.messageCount.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">
                    {formatBytes(topic.sizeBytes)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">
                    {formatDuration(topic.retentionBytes)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 capitalize">
                    {topic.cleanupPolicy}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setInspectTopic(topic.name);
                        }}
                        className="text-purple-600 hover:text-purple-900 bg-purple-50 hover:bg-purple-100 p-2 rounded-lg transition-colors"
                        title={t('inspectBrowseMessages')}
                      >
                        <Eye size={16} />
                      </button>

                      {backend === 'java' && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteConfirmTopic(topic.name);
                          }}
                          className="text-rose-600 hover:text-rose-900 bg-rose-50 hover:bg-rose-100 p-2 rounded-lg transition-colors"
                          title={t('deleteTopic')}
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>

                {expandedTopic === topic.name && (
                  <tr>
                    <td colSpan={10} className="bg-gray-50 p-6 border-b border-gray-200 shadow-inner">
                      <ConsumerOffsetsView clusterId={cluster.id} topicName={topic.name} />
                    </td>
                  </tr>
                )}
              </tbody>
            ))}
          </table>
        )}
      </div>

      <KafkaBatchCreateModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        cluster={cluster}
        onSuccess={loadData}
      />

      <KafkaBatchDeleteModal
        isOpen={isBatchDeleteModalOpen}
        onClose={() => setIsBatchDeleteModalOpen(false)}
        clusterId={cluster.id}
        onSuccess={() => {
          loadData();
          addToast('success', t('batchDeleteSuccess'));
        }}
      />

      {inspectTopic && (
        <KafkaTopicInspectorModal
          isOpen={!!inspectTopic}
          onClose={() => setInspectTopic(null)}
          clusterId={cluster.id}
          topicName={inspectTopic}
        />
      )}

      {/* Confirmation Dialog for Single Delete */}
      <ConfirmDialog
        isOpen={!!deleteConfirmTopic}
        onClose={() => setDeleteConfirmTopic(null)}
        title={t('deleteTopic')}
        message={t('deleteTopicConfirmMessage', { topic: deleteConfirmTopic })}
        confirmLabel={t('deleteTopic')}
        isDestructive={true}
        onConfirm={async () => {
          if (!deleteConfirmTopic) return;
          const success = await deleteKafkaTopics(cluster.id, [deleteConfirmTopic]);
          if (success) {
            addToast('success', t('deleteTopicSuccess', { topic: deleteConfirmTopic }));
            // Optimistic update: remove locally to avoid full list reload
            setTopics(prev => prev.filter(t => t.name !== deleteConfirmTopic));
          } else {
            addToast('error', t('deleteTopicFailed', { topic: deleteConfirmTopic }));
          }
        }}
      />

      {/* Global Toasts */}
      <ToastContainer toasts={toasts} onDismiss={removeToast} />
    </div>
  );
};

export default KafkaTopicsTable;