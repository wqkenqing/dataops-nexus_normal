import React, { useState, useEffect } from 'react';
import { X, Calendar, Search, Loader2, FileJson, Download, AlertCircle, ArrowUp, ArrowDown, Database, ChevronsUpDown } from 'lucide-react';
import { fetchESIndexMetadata, fetchESData, ESDataFetchParams } from '../services/api';
import { SortConfig } from './UIComponents';
import { useTranslation } from 'react-i18next';

interface ESDataInspectorModalProps {
    isOpen: boolean;
    onClose: () => void;
    clusterId: string;
    indexName: string;
}

const RenderCellContent: React.FC<{ value: any }> = ({ value }) => {
    const [isExpanded, setIsExpanded] = useState(false);

    if (value === null || value === undefined) {
        return <span className="text-gray-300 italic">null</span>;
    }

    if (typeof value === 'object') {
        const isArray = Array.isArray(value);
        const label = isArray ? `Array(${value.length})` : 'Object';

        return (
            <div className="relative">
                <button
                    onClick={(e) => { e.stopPropagation(); setIsExpanded(!isExpanded); }}
                    className="px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded border border-indigo-100 hover:bg-indigo-600 hover:text-white transition-all text-[10px] font-bold flex items-center gap-1 shadow-sm"
                >
                    <FileJson size={10} />
                    {label}
                </button>

                {isExpanded && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-[2px]" onClick={() => setIsExpanded(false)}>
                        <div
                            className="bg-white p-6 rounded-xl shadow-2xl max-w-2xl w-full max-h-[70vh] overflow-auto border border-gray-200 animate-in zoom-in-95 duration-200"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="flex justify-between items-center mb-4 sticky top-0 bg-white pb-2 border-b">
                                <span className="text-sm font-bold text-gray-800 flex items-center gap-2">
                                    <FileJson size={16} className="text-indigo-500" />
                                    Data Detail
                                </span>
                                <button onClick={() => setIsExpanded(false)} className="text-gray-400 hover:text-gray-600">
                                    <X size={18} />
                                </button>
                            </div>
                            <pre className="text-xs font-mono bg-slate-50 p-4 rounded-lg border border-slate-200 text-slate-700 leading-relaxed whitespace-pre-wrap">
                                {JSON.stringify(value, null, 2)}
                            </pre>
                            <div className="mt-4 flex justify-end">
                                <button
                                    onClick={() => {
                                        navigator.clipboard.writeText(JSON.stringify(value, null, 2));
                                        // Could add a toast here
                                    }}
                                    className="px-3 py-1.5 text-xs bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg flex items-center gap-2 transition-colors"
                                >
                                    Copy to Clipboard
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    return <span>{String(value)}</span>;
};

const ESDataInspectorModal: React.FC<ESDataInspectorModalProps> = ({
    isOpen, onClose, clusterId, indexName
}) => {
    const { t } = useTranslation();
    const [isLoading, setIsLoading] = useState(false);
    const [isMappingLoading, setIsMappingLoading] = useState(false);
    const [dateFields, setDateFields] = useState<string[]>([]);
    const [selectedField, setSelectedField] = useState<string>('');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
    const [limit, setLimit] = useState<number>(100);
    const [data, setData] = useState<any[]>([]);
    const [totalCount, setTotalCount] = useState<number>(0);
    const [tableSortConfig, setTableSortConfig] = useState<SortConfig<any>>({ key: null, direction: 'asc' });
    const [error, setError] = useState<string | null>(null);

    const sortedData = React.useMemo(() => {
        if (!tableSortConfig.key) return data;

        return [...data].sort((a, b) => {
            const aVal = a[tableSortConfig.key!];
            const bVal = b[tableSortConfig.key!];

            if (aVal === bVal) return 0;
            if (aVal === null || aVal === undefined) return 1;
            if (bVal === null || bVal === undefined) return -1;

            const direction = tableSortConfig.direction === 'asc' ? 1 : -1;

            if (typeof aVal === 'string' && typeof bVal === 'string') {
                return aVal.localeCompare(bVal) * direction;
            }

            return (aVal < bVal ? -1 : 1) * direction;
        });
    }, [data, tableSortConfig]);

    const handleTableSort = (key: string) => {
        setTableSortConfig(prev => ({
            key,
            direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
        }));
    };

    // Extract date fields from ES mapping
    const extractDateFields = (mappings: any): string[] => {
        const fields: string[] = [];

        // ES mappings often wrap with index name or "mappings"
        // Handle both { index: { mappings: { ... } } } and { properties: { ... } }
        let root = mappings;
        if (mappings && mappings[indexName]) root = mappings[indexName];
        if (root && root.mappings) root = root.mappings;

        const traverse = (obj: any, prefix = '') => {
            if (!obj || !obj.properties) return;

            Object.keys(obj.properties).forEach(key => {
                const fullKey = prefix ? `${prefix}.${key}` : key;
                const prop = obj.properties[key];

                if (prop.type === 'date') {
                    fields.push(fullKey);
                }

                if (prop.properties) {
                    traverse(prop, fullKey);
                }
            });
        };

        traverse(root);
        return fields;
    };

    useEffect(() => {
        if (isOpen && clusterId && indexName) {
            const loadMetadata = async () => {
                setIsMappingLoading(true);
                try {
                    const metadata = await fetchESIndexMetadata(clusterId, indexName);
                    if (metadata && metadata.mappings) {
                        const fields = extractDateFields(metadata.mappings);
                        setDateFields(fields);
                        if (fields.length > 0) {
                            // Try to find common timestamp fields first
                            const preferred = fields.find(f => f === '@timestamp' || f === 'timestamp' || f === 'created_at');
                            setSelectedField(preferred || fields[0]);
                        }
                    }
                } catch (e) {
                    console.error("Failed to load mappings", e);
                } finally {
                    setIsMappingLoading(false);
                }
            };
            loadMetadata();
        }
    }, [isOpen, clusterId, indexName]);

    const handleFetch = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const params: ESDataFetchParams = {
                sort_field: selectedField || undefined,
                sort_order: sortOrder,
                limit: limit
            };
            const result = await fetchESData(clusterId, indexName, params);
            setData(result.list);
            setTotalCount(result.total);
        } catch (e) {
            setError("Failed to fetch data");
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    };

    const handleDownload = () => {
        if (data.length === 0) return;
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `es_data_${indexName}_${Date.now()}.json`;
        link.click();
        URL.revokeObjectURL(url);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl h-[85vh] flex flex-col animate-in fade-in zoom-in-95 duration-200">

                {/* Header */}
                <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50 rounded-t-xl">
                    <div className="flex items-center gap-3">
                        <div className="bg-blue-100 p-2 rounded-lg text-blue-600">
                            <Database size={20} />
                        </div>
                        <div>
                            <h3 className="font-bold text-gray-800 text-lg">Data Inspector</h3>
                            <p className="text-sm text-gray-500 font-mono">{indexName}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {/* Controls */}
                <div className="p-4 border-b border-gray-200 bg-white shadow-sm z-10">
                    <div className="flex flex-wrap items-end gap-6 text-sm">

                        {/* Field Selection */}
                        <div className="min-w-[200px]">
                            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5 flex items-center gap-1.5">
                                <Calendar size={12} /> Time Field
                            </label>
                            <select
                                value={selectedField}
                                onChange={(e) => setSelectedField(e.target.value)}
                                disabled={isMappingLoading || dateFields.length === 0}
                                className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-gray-50 disabled:text-gray-400 transition-all font-medium"
                            >
                                {isMappingLoading ? (
                                    <option>Loading mappings...</option>
                                ) : dateFields.length > 0 ? (
                                    dateFields.map(f => <option key={f} value={f}>{f}</option>)
                                ) : (
                                    <option value="">No date fields found</option>
                                )}
                            </select>
                        </div>

                        {/* Sort Order */}
                        <div>
                            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">Sort Order</label>
                            <div className="flex bg-gray-100 p-1 rounded-lg">
                                <button
                                    onClick={() => setSortOrder('desc')}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-all ${sortOrder === 'desc' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                                >
                                    <ArrowDown size={14} /> Latest
                                </button>
                                <button
                                    onClick={() => setSortOrder('asc')}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-all ${sortOrder === 'asc' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                                >
                                    <ArrowUp size={14} /> Oldest
                                </button>
                            </div>
                        </div>

                        {/* Limit Selection */}
                        <div className="w-[140px]">
                            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">Limit</label>
                            <select
                                value={limit}
                                onChange={(e) => setLimit(Number(e.target.value))}
                                className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all font-medium"
                            >
                                <option value={10}>10 rows</option>
                                <option value={100}>100 rows</option>
                                <option value={1000}>1,000 rows</option>
                                <option value={10000}>10,000 rows</option>
                            </select>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex gap-2">
                            <button
                                onClick={handleFetch}
                                disabled={isLoading}
                                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all shadow-md active:scale-95 disabled:opacity-50 disabled:active:scale-100 font-semibold flex items-center gap-2"
                            >
                                {isLoading ? <Loader2 size={18} className="animate-spin" /> : <Search size={18} />}
                                Fetch Data
                            </button>
                        </div>
                    </div>

                    {error && (
                        <div className="mt-3 p-2 bg-rose-50 border border-rose-100 rounded-lg text-rose-600 text-xs flex items-center gap-2">
                            <AlertCircle size={14} /> {error}
                        </div>
                    )}
                </div>

                {/* Results Area */}
                <div className="flex-1 overflow-hidden bg-gray-100 p-4">
                    {data.length > 0 ? (
                        <div className="h-full bg-white rounded-xl shadow-sm border border-gray-200 overflow-auto custom-scrollbar">
                            <table className="min-w-full divide-y divide-gray-200 table-fixed">
                                <thead className="bg-gray-50 sticky top-0 z-20 shadow-sm">
                                    <tr>
                                        {Object.keys(data[0]).map(key => (
                                            <th
                                                key={key}
                                                onClick={() => handleTableSort(key)}
                                                className="w-[200px] px-4 py-3 text-left text-[10px] font-bold text-gray-400 uppercase tracking-widest border-b border-gray-100 bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors group/header"
                                            >
                                                <div className="flex items-center gap-1.5">
                                                    {key}
                                                    <div className="flex flex-col">
                                                        {tableSortConfig.key === key ? (
                                                            tableSortConfig.direction === 'asc' ?
                                                                <ArrowUp size={10} className="text-blue-500" /> :
                                                                <ArrowDown size={10} className="text-blue-500" />
                                                        ) : (
                                                            <ChevronsUpDown size={10} className="text-gray-300 opacity-0 group-hover/header:opacity-100" />
                                                        )}
                                                    </div>
                                                </div>
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-100">
                                    {sortedData.map((row, idx) => (
                                        <tr key={idx} className="hover:bg-blue-50/30 transition-colors group">
                                            {Object.keys(data[0]).map(key => (
                                                <td key={key} className="px-4 py-2.5 text-[11px] text-gray-600 font-mono whitespace-nowrap overflow-hidden truncate border-r border-gray-50 last:border-r-0">
                                                    <RenderCellContent value={row[key]} />
                                                </td>
                                            ))}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-gray-400">
                            <div className="p-6 bg-white rounded-full shadow-inner mb-4">
                                <FileJson size={48} className="text-gray-200" />
                            </div>
                            <p className="text-lg font-medium text-gray-500">No data fetched yet</p>
                            <p className="text-sm mt-1">Configure parameters above and click "Fetch Data"</p>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-between items-center rounded-b-xl">
                    <div className="text-sm text-gray-500">
                        {data.length > 0 ? (
                            <span>
                                Showing <span className="font-bold text-gray-700">{data.length}</span> documents
                                {totalCount > 0 && <span> (Total hits: <span className="font-bold text-gray-700">{totalCount.toLocaleString()}</span>)</span>}
                            </span>
                        ) : ''}
                    </div>
                    <div className="flex gap-3">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 text-sm font-semibold text-gray-600 hover:text-gray-800 hover:bg-gray-200 rounded-lg transition-all"
                        >
                            Close
                        </button>
                        <button
                            onClick={handleDownload}
                            disabled={data.length === 0}
                            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-all shadow-md disabled:bg-gray-300 disabled:shadow-none font-semibold text-sm"
                        >
                            <Download size={18} /> Download JSON
                        </button>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default ESDataInspectorModal;
