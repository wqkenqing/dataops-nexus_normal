import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { AnyCluster, ComponentType, ESCluster, KafkaCluster, ClickHouseCluster } from '../types';
import StatusBadge from './StatusBadge';
import { Server, Activity, Database, HardDrive, Layers, ShieldCheck, ArrowRight, GitCompare, PlusCircle, Edit, Trash2, AlertTriangle, Loader2, ArrowUpDown, ArrowUp, ArrowDown, Search, Terminal } from 'lucide-react';
import AddClusterModal from './AddClusterModal';
import ESDSLConsoleModal from './ESDSLConsoleModal';
import { deleteCluster, deleteKafkaCluster } from '../services/api';

interface ClusterTableProps {
  type: ComponentType;
  data: AnyCluster[];
  onAddCluster: (cluster: AnyCluster) => void;
  onEditCluster?: (cluster: AnyCluster) => void;
  onDeleteCluster?: (clusterId: string) => void;
}

type SortDirection = 'asc' | 'desc';
interface SortConfig {
  key: string;
  direction: SortDirection;
}

const ClusterTable: React.FC<ClusterTableProps> = ({ type, data, onAddCluster, onEditCluster, onDeleteCluster }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingCluster, setEditingCluster] = useState<AnyCluster | undefined>(undefined);

  // Search & Sort State
  const [searchQuery, setSearchQuery] = useState('');
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'name', direction: 'asc' });
  const [selectedConsoleCluster, setSelectedConsoleCluster] = useState<ESCluster | null>(null);

  // Delete Modal State
  const [clusterToDelete, setClusterToDelete] = useState<AnyCluster | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isClearAllModalOpen, setIsClearAllModalOpen] = useState(false);
  const [isClearAllDeleting, setIsClearAllDeleting] = useState(false);

  // --- Sorting Logic ---
  const handleSort = (key: string) => {
    let direction: SortDirection = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const getSortIcon = (key: string) => {
    if (sortConfig.key !== key) return <ArrowUpDown size={14} className="text-gray-400 opacity-50" />;
    return sortConfig.direction === 'asc'
      ? <ArrowUp size={14} className="text-indigo-600" />
      : <ArrowDown size={14} className="text-indigo-600" />;
  };

  const SortableHeader: React.FC<{ label: string; sortKey: string; align?: 'left' | 'right' }> = ({ label, sortKey, align = 'left' }) => (
    <th
      className={`px-6 py-3 text-${align} text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors group select-none`}
      onClick={() => handleSort(sortKey)}
    >
      <div className={`flex items-center gap-2 ${align === 'right' ? 'justify-end' : ''}`}>
        {label}
        <span className="group-hover:opacity-100 transition-opacity">
          {getSortIcon(sortKey)}
        </span>
      </div>
    </th>
  );

  // --- Data Processing ---
  const processedData = useMemo(() => {
    // 1. Filter
    let filtered = data.filter(item =>
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.host.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.id.toLowerCase().includes(searchQuery.toLowerCase())
    );

    // 2. Sort
    return filtered.sort((a, b) => {
      // Handle generic access safely
      const valA = (a as any)[sortConfig.key];
      const valB = (b as any)[sortConfig.key];

      if (valA === undefined || valB === undefined) return 0;

      let comparison = 0;
      if (typeof valA === 'string' && typeof valB === 'string') {
        comparison = valA.localeCompare(valB);
      } else if (typeof valA === 'number' && typeof valB === 'number') {
        comparison = valA - valB;
      } else {
        // Fallback
        comparison = String(valA).localeCompare(String(valB));
      }

      return sortConfig.direction === 'asc' ? comparison : -comparison;
    });
  }, [data, searchQuery, sortConfig]);


  // Render specific columns based on type
  const renderSpecificHeaders = () => {
    switch (type) {
      case ComponentType.ELASTICSEARCH:
        return (
          <>
            <SortableHeader label="Nodes" sortKey="nodeCount" />
            <SortableHeader label="Shards" sortKey="shardCount" />
            <SortableHeader label="Indices" sortKey="indexCount" />
          </>
        );
      case ComponentType.KAFKA:
        return (
          <>
            <SortableHeader label="Brokers" sortKey="brokerCount" />
            <SortableHeader label="Topics" sortKey="topicCount" />
            <SortableHeader label="Controller" sortKey="controllerType" />
          </>
        );
      case ComponentType.CLICKHOUSE:
        return (
          <>
            <SortableHeader label="Topology (S/R)" sortKey="shardCount" />
            <SortableHeader label="Databases" sortKey="databaseCount" />
            <SortableHeader label="Read Load" sortKey="rowsReadPerSec" />
          </>
        );
      default:
        return null;
    }
  };

  const renderSpecificCells = (cluster: AnyCluster) => {
    switch (type) {
      case ComponentType.ELASTICSEARCH:
        const es = cluster as ESCluster;
        return (
          <>
            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
              <div className="flex items-center gap-1"><Server size={14} /> {es.nodeCount}</div>
            </td>
            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
              <div className="flex items-center gap-1"><Layers size={14} /> {es.shardCount}</div>
            </td>
            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{es.indexCount}</td>
          </>
        );
      case ComponentType.KAFKA:
        const kf = cluster as KafkaCluster;
        return (
          <>
            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
              <div className="flex items-center gap-1"><Server size={14} /> {kf.brokerCount}</div>
            </td>
            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{kf.topicCount}</td>
            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
              <span className={`px-2 py-0.5 rounded text-xs border ${kf.controllerType === 'KRaft' ? 'bg-purple-50 text-purple-700 border-purple-200' : 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                {kf.controllerType}
              </span>
            </td>
          </>
        );
      case ComponentType.CLICKHOUSE:
        const ch = cluster as ClickHouseCluster;
        return (
          <>
            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{ch.shardCount}S / {ch.replicaCount}R</td>
            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
              <div className="flex items-center gap-1"><Database size={14} /> {ch.databaseCount}</div>
            </td>
            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
              <div className="flex items-center gap-1"><Activity size={14} /> {(ch.rowsReadPerSec / 1000).toFixed(1)}K rows/s</div>
            </td>
          </>
        );
      default:
        return null;
    }
  };

  const handleRowClick = (cluster: AnyCluster) => {
    if (type === ComponentType.ELASTICSEARCH) {
      navigate(`/elasticsearch/${cluster.id}`);
    } else if (type === ComponentType.KAFKA) {
      navigate(`/kafka/${cluster.id}`);
    }
  };

  const handleEdit = (e: React.MouseEvent, cluster: AnyCluster) => {
    e.stopPropagation();
    setEditingCluster(cluster);
    setIsAddModalOpen(true);
  };

  const handleDeleteClick = (e: React.MouseEvent, cluster: AnyCluster) => {
    e.stopPropagation();
    setClusterToDelete(cluster);
  };

  const confirmDelete = async () => {
    if (!clusterToDelete) return;
    setIsDeleting(true);

    // Call API
    let success = false;
    if (type === ComponentType.KAFKA) {
      success = await deleteKafkaCluster(clusterToDelete.id);
    } else {
      success = await deleteCluster(clusterToDelete.id);
    }

    if (success && onDeleteCluster) {
      onDeleteCluster(clusterToDelete.id);
    }

    setIsDeleting(false);
    setClusterToDelete(null);
  };

  const handleModalClose = () => {
    setIsAddModalOpen(false);
    setEditingCluster(undefined);
  };

  const confirmClearAll = async () => {
    setIsClearAllDeleting(true);
    // Iterate and delete all
    for (const cluster of data) {
      if (type === ComponentType.KAFKA) {
        await deleteKafkaCluster(cluster.id);
      } else {
        await deleteCluster(cluster.id);
      }
      if (onDeleteCluster) onDeleteCluster(cluster.id);
    }
    setIsClearAllDeleting(false);
    setIsClearAllModalOpen(false);
  };

  // Wrapper for onAdd/onEdit handling
  const handleModalSuccess = (cluster: AnyCluster) => {
    if (editingCluster && onEditCluster) {
      onEditCluster(cluster);
    } else {
      onAddCluster(cluster);
    }
  };

  return (
    <div className="space-y-6">
      {/* Sticky Header */}
      <div className="sticky top-16 z-20 bg-gray-50/95 backdrop-blur-sm pb-4 pt-2 transition-all">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 flex flex-col md:flex-row justify-between items-center gap-4">
          <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
            {type === ComponentType.ELASTICSEARCH && <ShieldCheck className="text-blue-500" />}
            {type === ComponentType.KAFKA && <HardDrive className="text-purple-500" />}
            {type === ComponentType.CLICKHOUSE && <Database className="text-yellow-500" />}
            {type} Clusters
          </h2>

          <div className="flex items-center gap-3 w-full md:w-auto">
            {/* Search Input */}
            <div className="relative flex-1 md:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input
                type="text"
                placeholder="Search name, host..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-1.5 bg-white border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>

            {data.length > 0 && (
              <button
                onClick={() => setIsClearAllModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-rose-200 text-rose-600 rounded-lg text-xs font-medium shadow-sm hover:bg-rose-50 transition-colors whitespace-nowrap"
              >
                <Trash2 size={14} />
                {t('clearAll')}
              </button>
            )}
            <div className="flex items-center gap-2">
              {type === ComponentType.ELASTICSEARCH && (
                <button
                  onClick={() => navigate('/elasticsearch/compare')}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 text-indigo-600 rounded-lg text-xs font-medium shadow-sm hover:bg-gray-50 transition-colors whitespace-nowrap"
                >
                  <GitCompare size={14} />
                  Compare
                </button>
              )}
              <button
                onClick={() => {
                  setEditingCluster(undefined);
                  setIsAddModalOpen(true);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white border border-transparent rounded-lg text-xs font-medium shadow-sm hover:bg-indigo-700 transition-colors whitespace-nowrap"
              >
                <PlusCircle size={14} />
                Add Cluster
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <SortableHeader label="Cluster Name" sortKey="name" />
                <SortableHeader label="Status" sortKey="status" />
                <SortableHeader label="Host:Port" sortKey="host" />
                <SortableHeader label="Version" sortKey="version" />
                {renderSpecificHeaders()}
                <SortableHeader label="Region" sortKey="region" />
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {processedData.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-6 py-12 text-center text-gray-500">
                    <div className="flex flex-col items-center justify-center">
                      <Server size={32} className="text-gray-300 mb-2" />
                      <p className="text-sm">No clusters found.</p>
                      {data.length === 0 && (
                        <button
                          onClick={() => {
                            setEditingCluster(undefined);
                            setIsAddModalOpen(true);
                          }}
                          className="mt-2 text-indigo-600 hover:text-indigo-800 text-sm font-medium"
                        >
                          Add your first cluster
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                processedData.map((cluster) => (
                  <tr
                    key={cluster.id}
                    onClick={() => handleRowClick(cluster)}
                    className={`hover:bg-gray-50 transition-colors cursor-pointer group`}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-col">
                        <span className={`text-sm font-medium ${type === ComponentType.ELASTICSEARCH ? 'text-indigo-600' : type === ComponentType.KAFKA ? 'text-purple-600' : 'text-gray-900'}`}>
                          {cluster.name}
                        </span>
                        <span className="text-xs text-gray-400">ID: {cluster.id}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <StatusBadge
                        status={cluster.status}
                        health={type === ComponentType.ELASTICSEARCH ? (cluster as ESCluster).health : undefined}
                      />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">
                      {cluster.host}:{cluster.port}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      v{cluster.version}
                    </td>
                    {renderSpecificCells(cluster)}
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {cluster.region}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRowClick(cluster);
                          }}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all font-bold"
                        >
                          Manage
                          <ArrowRight size={14} />
                        </button>

                        <div className="w-px h-4 bg-gray-200 mx-2"></div>

                        {type === ComponentType.ELASTICSEARCH && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedConsoleCluster(cluster as ESCluster);
                            }}
                            className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-all"
                            title="DSL Console"
                          >
                            <Terminal size={16} />
                          </button>
                        )}

                        <button
                          onClick={(e) => handleEdit(e, cluster)}
                          className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-all"
                          title="Edit Configuration"
                        >
                          <Edit size={16} />
                        </button>

                        <div className="w-px h-4 bg-gray-200 mx-2"></div>

                        <button
                          onClick={(e) => handleDeleteClick(e, cluster)}
                          className="p-1.5 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-all"
                          title="Delete Cluster"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Modal */}
      <AddClusterModal
        isOpen={isAddModalOpen}
        onClose={handleModalClose}
        type={type}
        onAdd={handleModalSuccess}
        clusterToEdit={editingCluster}
      />

      {/* Delete Confirmation Modal */}
      {clusterToDelete && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 text-center">
              <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertTriangle size={24} />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Delete Cluster?</h3>
              <p className="text-sm text-gray-500 mb-6">
                Are you sure you want to delete <b>{clusterToDelete.name}</b>?<br />
                This action cannot be undone.
              </p>
              <div className="flex justify-center gap-3">
                <button
                  onClick={() => setClusterToDelete(null)}
                  disabled={isDeleting}
                  className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDelete}
                  disabled={isDeleting}
                  className="px-4 py-2 text-sm font-medium text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-sm transition-colors flex items-center gap-2"
                >
                  {isDeleting && <Loader2 size={14} className="animate-spin" />}
                  {isDeleting ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Clear All Confirmation Modal */}
      {isClearAllModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 text-center">
              <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertTriangle size={24} />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">{t('clearAllConfirmTitle')}</h3>
              <p className="text-sm text-gray-500 mb-6">
                {t('clearAllConfirmMessage', { type: type })}
              </p>
              <div className="flex justify-center gap-3">
                <button
                  onClick={() => setIsClearAllModalOpen(false)}
                  disabled={isClearAllDeleting}
                  className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  {t('cancel')}
                </button>
                <button
                  onClick={confirmClearAll}
                  disabled={isClearAllDeleting}
                  className="px-4 py-2 text-sm font-medium text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-sm transition-colors flex items-center gap-2"
                >
                  {isClearAllDeleting && <Loader2 size={14} className="animate-spin" />}
                  {isClearAllDeleting ? t('deleting') : t('confirm')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* DSL Console Modal */}
      {selectedConsoleCluster && (
        <ESDSLConsoleModal
          isOpen={!!selectedConsoleCluster}
          onClose={() => setSelectedConsoleCluster(null)}
          clusterId={selectedConsoleCluster.id}
          indexName={null}
        />
      )}
    </div>
  );
};

export default ClusterTable;