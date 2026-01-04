import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Database, Search, Filter, RefreshCw, EyeOff, FileText, LayoutGrid, GitCompare, ArrowRightLeft, Loader2, Info, ArrowUpDown, ArrowUp, ArrowDown, ChevronLeft, ChevronRight, Terminal } from 'lucide-react';
import { getIndicesForCluster } from '../services/mockData';
import { fetchESIndices } from '../services/api';
import StatusBadge from './StatusBadge';
import { ESCluster, ComponentType, ESIndex } from '../types';
import CrossClusterActionModal from './CrossClusterActionModal';
import IndexMetadataModal from './IndexMetadataModal';
import ESDataInspectorModal from './ESDataInspectorModal';
import ESDSLConsoleModal from './ESDSLConsoleModal';
import { SortableHeader, SortConfig } from './UIComponents';

interface ESIndicesTableProps {
  clusters: ESCluster[];
}

const ESIndicesTable: React.FC<ESIndicesTableProps> = ({ clusters }) => {
  const { clusterId } = useParams();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');

  // Data State
  const [indices, setIndices] = useState<ESIndex[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Sort State
  const [sortConfig, setSortConfig] = useState<SortConfig<ESIndex>>({ key: 'name', direction: 'asc' });

  // Modal State
  const [activeAction, setActiveAction] = useState<{ type: 'compare' | 'sync', index: ESIndex } | null>(null);
  const [selectedMetadataIndex, setSelectedMetadataIndex] = useState<string | null>(null);
  const [selectedDataIndex, setSelectedDataIndex] = useState<string | null>(null);
  const [selectedConsoleIndex, setSelectedConsoleIndex] = useState<string | null>(null);

  // Find cluster in the live state list
  const cluster = clusters.find(c => c.id === clusterId);

  // Load Data
  const loadData = async () => {
    if (!clusterId || !cluster) return;

    // Hardcoded mock IDs from services/mockData.ts
    const staticMockIds = ['es-prod-01', 'es-dev-01'];

    // If it is NOT a static mock cluster, try to fetch from API
    if (!staticMockIds.includes(clusterId)) {
      setIsLoading(true);
      try {
        // FIXED: Using cluster.id (UUID) as per correction
        const realIndices = await fetchESIndices(cluster.id);
        setIndices(realIndices);
      } catch (e) {
        console.error("Failed to load real indices", e);
        setIndices([]);
      } finally {
        setIsLoading(false);
      }
    } else {
      // Fallback to mock data for static demo clusters
      setIsLoading(true);
      // Simulate small network delay for consistency
      await new Promise(resolve => setTimeout(resolve, 300));
      const mock = getIndicesForCluster(clusterId);
      setIndices(mock);
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [clusterId, cluster]);

  // Reset page when filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  // --- Helpers for Sorting ---

  const handleSort = (key: keyof ESIndex) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const parseSize = (sizeStr: string): number => {
    if (!sizeStr) return 0;
    const regex = /^([\d.]+)\s*([a-zA-Z]*)$/;
    const match = sizeStr.toLowerCase().match(regex);
    if (!match) return 0;

    const value = parseFloat(match[1]);
    const unit = match[2];

    switch (unit) {
      case 'b': return value;
      case 'kb': return value * 1024;
      case 'mb': return value * 1024 * 1024;
      case 'gb': return value * 1024 * 1024 * 1024;
      case 'tb': return value * 1024 * 1024 * 1024 * 1024;
      default: return value;
    }
  };

  const processedIndices = useMemo(() => {
    const filtered = indices.filter(idx =>
      idx.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return filtered.sort((a, b) => {
      let valA: any = a[sortConfig.key];
      let valB: any = b[sortConfig.key];

      if (sortConfig.key === 'storeSize') {
        valA = parseSize(a.storeSize);
        valB = parseSize(b.storeSize);
      }

      if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
      if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });

  }, [indices, searchTerm, sortConfig]);

  const totalPages = Math.ceil(processedIndices.length / pageSize);
  const paginatedIndices = processedIndices.slice((currentPage - 1) * pageSize, currentPage * pageSize);




  if (!cluster) {
    return (
      <div className="flex flex-col items-center justify-center h-96 text-gray-500">
        <div className="mb-4 bg-gray-100 p-4 rounded-full">
          <Database size={32} className="text-gray-400" />
        </div>
        <p className="text-lg font-medium">Cluster not found</p>
        <button
          onClick={() => navigate('/elasticsearch')}
          className="mt-4 text-indigo-600 hover:text-indigo-800"
        >
          Return to list
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Sticky Header Wrapper */}
      <div className="sticky top-16 z-30 bg-gray-50/95 backdrop-blur-sm pb-4 pt-2 transition-all">
        <div className="flex flex-col space-y-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/elasticsearch')}
              className="p-2 bg-white border border-gray-200 hover:bg-gray-50 rounded-lg transition-colors text-gray-600 shadow-sm"
            >
              <ArrowLeft size={18} />
            </button>
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
                <Database className="text-blue-500" size={24} />
                {cluster.name}
                <StatusBadge status={cluster.status} health={cluster.health} />
              </h1>
              <p className="text-sm text-gray-500 mt-1 ml-1">
                Host: {cluster.host}:{cluster.port} • Version: v{cluster.version}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setSelectedConsoleIndex('__CLUSTER_LEVEL__')}
                className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-900 transition-colors shadow-sm text-sm font-medium"
              >
                <Terminal size={16} />
                DSL Console
              </button>
              <button
                onClick={loadData}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors shadow-sm text-sm font-medium"
              >
                {isLoading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                Refresh
              </button>
            </div>
          </div>

          {/* Filters bar */}
          <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
            <div className="relative flex-1 min-w-[300px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input
                type="text"
                placeholder="Search indices by name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-1.5 bg-white border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none transition-all"
              />
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-500 font-medium">{processedIndices.length} Indices</span>
              <div className="h-6 w-px bg-gray-200 mx-1"></div>
              <button className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors border border-transparent hover:border-gray-200">
                <Filter size={16} /> Filter
              </button>
              <button className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors border border-transparent hover:border-gray-200">
                <LayoutGrid size={16} /> Columns
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Indices Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col">
        {isLoading ? (
          <div className="flex justify-center items-center py-20">
            <Loader2 className="animate-spin text-indigo-600" size={32} />
          </div>
        ) : (
          <>

            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50 sticky top-[220px] z-20 shadow-sm">
                <tr>
                  <SortableHeader label="Health" offsetKey="health" currentSort={sortConfig} onSort={handleSort} />
                  <SortableHeader label="Name" offsetKey="name" currentSort={sortConfig} onSort={handleSort} />
                  <SortableHeader label="Status" offsetKey="status" currentSort={sortConfig} onSort={handleSort} />
                  <SortableHeader label="Docs Count" offsetKey="docsCount" currentSort={sortConfig} onSort={handleSort} />
                  <SortableHeader label="Storage" offsetKey="storeSize" currentSort={sortConfig} onSort={handleSort} />
                  <SortableHeader label="Shards (P)" offsetKey="primaryShards" currentSort={sortConfig} onSort={handleSort} />
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {paginatedIndices.length > 0 ? (
                  paginatedIndices.map((index, idx) => (
                    <tr key={idx} className="hover:bg-gray-50 transition-colors group">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize 
                             ${index.health === 'green' ? 'bg-emerald-100 text-emerald-700' :
                            index.health === 'yellow' ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700'}`}>
                          <span className={`w-1.5 h-1.5 mr-1.5 rounded-full 
                               ${index.health === 'green' ? 'bg-emerald-500' :
                              index.health === 'yellow' ? 'bg-amber-500' : 'bg-rose-500'}`}></span>
                          {index.health}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button
                          onClick={() => setSelectedMetadataIndex(index.name)}
                          className="text-indigo-600 hover:text-indigo-800 hover:underline flex items-center gap-1 group-hover:text-indigo-700 transition-colors"
                          title="View Index Settings & Mappings"
                        >
                          {index.name}
                          <Info size={12} className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-400" />
                        </button>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {index.status === 'open' ? (
                          <span className="text-emerald-600 flex items-center gap-1"><RefreshCw size={12} /> Open</span>
                        ) : (
                          <span className="text-gray-400 flex items-center gap-1"><EyeOff size={12} /> Closed</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">
                        {index.docsCount.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">
                        {index.storeSize}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <div className="flex items-center gap-2">
                          <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-xs border border-blue-100">{index.primaryShards} P</span>
                          <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded text-xs border border-gray-200">{index.replicaShards} R</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => setSelectedDataIndex(index.name)}
                            className="p-1.5 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
                            title="Browse Index Data"
                          >
                            <Search size={16} />
                          </button>
                          <button
                            onClick={() => setSelectedConsoleIndex(index.name)}
                            className="p-1.5 text-gray-400 hover:text-slate-800 hover:bg-slate-100 rounded transition-colors"
                            title="DSL Console"
                          >
                            <Terminal size={16} />
                          </button>
                          <button
                            onClick={() => setActiveAction({ type: 'compare', index })}
                            className="p-1.5 text-gray-500 hover:text-orange-600 hover:bg-orange-50 rounded transition-colors"
                            title="Compare with another cluster"
                          >
                            <GitCompare size={16} />
                          </button>
                          <button
                            onClick={() => setActiveAction({ type: 'sync', index })}
                            className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                            title="Sync to another cluster"
                          >
                            <ArrowRightLeft size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                      <div className="flex flex-col items-center justify-center">
                        <FileText size={32} className="text-gray-300 mb-2" />
                        <p>No indices found matching "{searchTerm}"</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            {/* Pagination Controls */}
            {processedIndices.length > 0 && (
              <div className="bg-gray-50 px-6 py-3 border-t border-gray-200 flex items-center justify-between">
                <div className="text-xs text-gray-500">
                  Showing <span className="font-medium">{(currentPage - 1) * pageSize + 1}</span> to <span className="font-medium">{Math.min(currentPage * pageSize, processedIndices.length)}</span> of <span className="font-medium">{processedIndices.length}</span> indices
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">Rows per page:</span>
                    <select
                      value={pageSize}
                      onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
                      className="bg-white border border-gray-300 text-gray-700 text-xs rounded-md px-2 py-1 outline-none focus:border-indigo-500"
                    >
                      <option value={10}>10</option>
                      <option value={25}>25</option>
                      <option value={50}>50</option>
                      <option value={100}>100</option>
                    </select>
                  </div>
                  <div className="flex items-center rounded-md shadow-sm">
                    <button
                      onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                      disabled={currentPage === 1}
                      className="p-1.5 rounded-l-md border border-gray-300 bg-white text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <ChevronLeft size={16} />
                    </button>
                    <span className="px-4 py-1.5 border-t border-b border-gray-300 bg-white text-xs font-medium text-gray-700">
                      Page {currentPage} of {totalPages}
                    </span>
                    <button
                      onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                      disabled={currentPage === totalPages}
                      className="p-1.5 rounded-r-md border border-gray-300 bg-white text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Cross Cluster Action Modal */}
      {
        activeAction && (
          <CrossClusterActionModal
            isOpen={!!activeAction}
            onClose={() => setActiveAction(null)}
            mode={activeAction.type}
            sourceCluster={cluster}
            sourceIndexName={activeAction.index.name}
            clusterList={clusters}
          />
        )
      }

      {/* Index Metadata View Modal */}
      {
        selectedMetadataIndex && (
          <IndexMetadataModal
            isOpen={!!selectedMetadataIndex}
            onClose={() => setSelectedMetadataIndex(null)}
            clusterId={cluster.id} // Passed UUID
            indexName={selectedMetadataIndex}
          />
        )
      }
      {
        selectedDataIndex && (
          <ESDataInspectorModal
            isOpen={!!selectedDataIndex}
            onClose={() => setSelectedDataIndex(null)}
            clusterId={cluster.id}
            indexName={selectedDataIndex}
          />
        )
      }
      {
        selectedConsoleIndex && (
          <ESDSLConsoleModal
            isOpen={!!selectedConsoleIndex}
            onClose={() => setSelectedConsoleIndex(null)}
            clusterId={cluster.id}
            indexName={selectedConsoleIndex === '__CLUSTER_LEVEL__' ? null : selectedConsoleIndex}
          />
        )
      }
    </div >
  );
};

export default ESIndicesTable;