import React, { useState } from 'react';
import { X, Play, Terminal, Database, Loader2, AlertCircle, Copy, Check, FileJson, Clock, BarChart3, PieChart, LayoutPanelTop, Activity, Download } from 'lucide-react';
import { executeESQuery } from '../services/api';

const VisualizationPanel: React.FC<{ data: any }> = ({ data }) => {
    // 1. Extract aggregations
    const aggs = data?.aggregations || data?.aggs;
    const totalHits = data?.hits?.total?.value || data?.hits?.total || 0;

    if (!aggs && !totalHits) {
        return (
            <div className="h-full flex flex-col items-center justify-center text-slate-500 opacity-50">
                <Activity size={48} className="mb-4" />
                <p className="font-medium text-sm text-center">No aggregation patterns or hits found <br /> to visualize.</p>
            </div>
        );
    }

    // Process buckets
    const firstAggKey = aggs ? Object.keys(aggs)[0] : null;
    const buckets = firstAggKey ? (aggs[firstAggKey].buckets || []) : [];
    const maxCount = Math.max(...buckets.map((b: any) => b.doc_count), 1);

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Summary Cards */}
            <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-800/50 border border-slate-700 p-4 rounded-xl shadow-lg">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Total Hits</p>
                    <p className="text-2xl font-extrabold text-indigo-400">{totalHits.toLocaleString()}</p>
                </div>
                <div className="bg-slate-800/50 border border-slate-700 p-4 rounded-xl shadow-lg">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Bucket Count</p>
                    <p className="text-2xl font-extrabold text-emerald-400">{buckets.length}</p>
                </div>
            </div>

            {/* Bar Chart Visualization */}
            {buckets.length > 0 && (
                <div className="bg-slate-800/50 border border-slate-700 p-6 rounded-2xl shadow-xl">
                    <div className="flex justify-between items-center mb-6">
                        <h4 className="text-sm font-bold text-slate-300 flex items-center gap-2">
                            <BarChart3 size={16} className="text-indigo-400" />
                            {firstAggKey} Distribution
                        </h4>
                    </div>

                    <div className="space-y-5">
                        {buckets.slice(0, 10).map((bucket: any, i: number) => (
                            <div key={i} className="group cursor-default">
                                <div className="flex justify-between items-end mb-1.5 text-[11px]">
                                    <span className="font-bold text-slate-400 truncate max-w-[70%]" title={bucket.key}>{bucket.key}</span>
                                    <span className="font-mono text-indigo-300 bg-indigo-500/10 px-1.5 py-0.5 rounded">{bucket.doc_count.toLocaleString()}</span>
                                </div>
                                <div className="h-2.5 bg-slate-700/50 rounded-full overflow-hidden border border-slate-700/50">
                                    <div
                                        className="h-full bg-gradient-to-r from-indigo-600 via-indigo-500 to-indigo-400 rounded-full transition-all duration-1000 ease-out group-hover:from-indigo-500 group-hover:to-indigo-300"
                                        style={{ width: `${(bucket.doc_count / maxCount) * 100}%` }}
                                    />
                                </div>
                            </div>
                        ))}
                        {buckets.length > 10 && (
                            <p className="text-center text-[10px] text-slate-500 italic mt-4">Showing top 10 buckets only</p>
                        )}
                    </div>
                </div>
            )}

            {/* Distribution View */}
            {buckets.length > 0 && (
                <div className="bg-slate-800/50 border border-slate-700 p-6 rounded-2xl shadow-xl">
                    <h4 className="text-sm font-bold text-slate-300 flex items-center gap-2 mb-6">
                        <PieChart size={16} className="text-emerald-400" />
                        Percentage Share
                    </h4>
                    <div className="flex flex-wrap gap-3">
                        {buckets.slice(0, 12).map((bucket: any, i: number) => {
                            const percent = ((bucket.doc_count / totalHits) * 100);
                            if (percent < 0.1 && buckets.length > 5) return null;
                            return (
                                <div key={i} className="px-3 py-2 bg-slate-900/50 border border-slate-700/50 rounded-lg flex flex-col items-center">
                                    <span className="text-[10px] font-bold text-slate-500 mb-1">{bucket.key}</span>
                                    <span className="text-xs font-black text-slate-300">{percent < 1 ? percent.toFixed(2) : percent.toFixed(1)}%</span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
};

interface ESDSLConsoleModalProps {
    isOpen: boolean;
    onClose: () => void;
    clusterId: string;
    indexName?: string | null;
}

const ESDSLConsoleModal: React.FC<ESDSLConsoleModalProps> = ({
    isOpen, onClose, clusterId, indexName
}) => {
    const defaultDSL = JSON.stringify({
        "aggs": {
            "status_distribution": {
                "terms": {
                    "field": "level.keyword"
                }
            }
        },
        "size": 0
    }, null, 2);

    // Unified editor state (Kibana style: "METHOD /path \n { body }")
    const initialRaw = indexName
        ? `POST /${indexName}/_search\n${defaultDSL}`
        : `GET /_search\n{\n  "query": { "match_all": {} }\n}`;

    const [rawCommand, setRawCommand] = useState(initialRaw);
    const textareaRef = React.useRef<HTMLTextAreaElement>(null);
    const [result, setResult] = useState<any>(null);
    const [viewMode, setViewMode] = useState<'json' | 'visual'>('json');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);
    const [startTime, setStartTime] = useState<number | null>(null);
    const [executionTime, setExecutionTime] = useState<number | null>(null);

    // Parser: Extract method, path and body from raw input
    const parseCommand = (input: string) => {
        const lines = input.trim().split('\n');
        const firstLine = lines[0].trim();
        const parts = firstLine.split(/\s+/);

        let method = 'GET';
        let path = '/';

        if (parts.length >= 2) {
            method = parts[0].toUpperCase();
            path = parts[1];
        } else if (parts.length === 1 && parts[0].startsWith('/')) {
            path = parts[0];
        }

        const bodyLines = lines.slice(1);
        let body = null;
        if (bodyLines.length > 0) {
            try {
                body = JSON.parse(bodyLines.join('\n'));
            } catch (e) {
                // If it's not valid JSON yet, we might still want to try sending it or handle locally
            }
        }

        return { method, path, body };
    };

    const handleRun = async () => {
        setIsLoading(true);
        setError(null);
        setStartTime(Date.now());

        let targetInput = rawCommand;

        // Kibana behavior: If there's a selection, run that. 
        // Otherwise, find the block where the cursor is.
        if (textareaRef.current) {
            const { selectionStart, selectionEnd, value } = textareaRef.current;

            if (selectionStart !== selectionEnd) {
                targetInput = value.substring(selectionStart, selectionEnd);
            } else {
                // Find block logic
                const lines = value.split('\n');
                const cursorLineIndex = value.substring(0, selectionStart).split('\n').length - 1;

                // Find start line (line with HTTP method)
                let startLine = cursorLineIndex;
                while (startLine > 0 && !lines[startLine].trim().match(/^(GET|POST|PUT|DELETE|PATCH|HEAD)\s/i)) {
                    startLine--;
                }

                // Find end line (before next HTTP method line)
                let endLine = cursorLineIndex + 1;
                while (endLine < lines.length && !lines[endLine].trim().match(/^(GET|POST|PUT|DELETE|PATCH|HEAD)\s/i)) {
                    endLine++;
                }

                targetInput = lines.slice(startLine, endLine).join('\n');
            }
        }

        const { method, path, body } = parseCommand(targetInput);

        try {
            const response = await executeESQuery(clusterId, method, path, body);
            setResult(response);
            setExecutionTime(Date.now() - (startTime || Date.now()));
        } catch (e: any) {
            setError(e.message || "Execution Error");
            console.error(e);
        } finally {
            setIsLoading(false);
            setExecutionTime(Date.now() - (startTime || Date.now()));
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
            e.preventDefault();
            handleRun();
        }
    };

    const handleCopy = async () => {
        if (!result) return;
        const textToCopy = JSON.stringify(result, null, 2);
        try {
            if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(textToCopy);
            } else {
                // Fallback for non-HTTPS environments
                const textArea = document.createElement("textarea");
                textArea.value = textToCopy;
                textArea.style.position = "fixed";
                textArea.style.left = "-999999px";
                textArea.style.top = "-999999px";
                document.body.appendChild(textArea);
                textArea.focus();
                textArea.select();
                try {
                    document.execCommand('copy');
                } catch (err) {
                    console.error('Fallback: Oops, unable to copy', err);
                }
                document.body.removeChild(textArea);
            }
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error('Failed to copy text: ', err);
            alert('Copy failed. Please copy manually.');
        }
    };

    const handleDownload = () => {
        if (!result) return;
        const jsonStr = JSON.stringify(result, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", url);
        downloadAnchorNode.setAttribute("download", `es_result_${indexName || 'cluster'}_${Date.now()}.json`);
        document.body.appendChild(downloadAnchorNode); // required for firefox
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
        URL.revokeObjectURL(url);
    };

    const templates = [
        {
            name: 'Match All',
            dsl: { 
                "query": { "match_all": {} }, 
                "sort": [ { "@timestamp": { "order": "desc" } } ],
                "size": 10 
            }
        },
        {
            name: 'Search Term',
            dsl: { 
                "query": { "match": { "message": "error" } }, 
                "sort": [ { "@timestamp": { "order": "desc" } } ],
                "_source": ["@timestamp", "message", "level"],
                "size": 10 
            }
        },
        {
            name: 'Bool Filter',
            dsl: {
                "query": {
                    "bool": {
                        "must": [ { "match": { "level": "ERROR" } } ],
                        "filter": [ { "range": { "@timestamp": { "gte": "now-1h" } } } ]
                    }
                },
                "sort": [ { "@timestamp": { "order": "desc" } } ],
                "size": 10
            }
        },
        {
            name: 'Aggregation',
            dsl: { 
                "aggs": { 
                    "status_counts": { 
                        "terms": { "field": "level.keyword", "size": 10 } 
                    } 
                }, 
                "size": 0 
            }
        },
        {
            name: 'Range Query',
            dsl: { 
                "query": { "range": { "@timestamp": { "gte": "now-1d/d", "lt": "now/d" } } }, 
                "sort": [ { "@timestamp": { "order": "desc" } } ],
                "size": 10 
            }
        }
    ];

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-7xl h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-300">

                {/* Header */}
                <div className="px-8 py-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                    <div className="flex items-center gap-4">
                        <div className="bg-indigo-600 p-2.5 rounded-xl text-white shadow-lg shadow-indigo-200">
                            <Terminal size={22} />
                        </div>
                        <div>
                            <h3 className="font-extrabold text-gray-900 text-xl tracking-tight">DSL Console</h3>
                            <div className="flex items-center gap-2 mt-0.5">
                                <span className="flex items-center gap-1.5 px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-md text-xs font-bold border border-indigo-100">
                                    <Database size={10} /> {indexName || 'Cluster Level'}
                                </span>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        {executionTime !== null && (
                            <div className="flex items-center gap-1.5 text-xs font-medium text-gray-400 bg-white px-3 py-1.5 rounded-full border border-gray-100 shadow-sm">
                                <Clock size={12} /> {executionTime}ms
                            </div>
                        )}
                        <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-all">
                            <X size={20} />
                        </button>
                    </div>
                </div>

                {/* Workspace */}
                <div className="flex-1 flex overflow-hidden">

                    {/* Left Panel: Editor */}
                    <div className="w-1/2 flex flex-col border-r border-gray-200 relative bg-[#1e1e1e]">
                        <div className="px-6 py-3 bg-[#252526] border-b border-white/5 flex justify-between items-center">
                            <div className="flex items-center gap-3">
                                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2">
                                    <Terminal size={12} className="text-indigo-400" /> Dev Tools / Console
                                </span>
                            </div>
                            <div className="flex gap-2">
                                {templates.map(t => (
                                    <button
                                        key={t.name}
                                        onClick={() => {
                                            const path = indexName ? `/${indexName}/_search` : '/_search';
                                            setRawCommand(`POST ${path}\n${JSON.stringify(t.dsl, null, 2)}`);
                                        }}
                                        className="text-[10px] font-bold px-2 py-1 bg-white/5 text-gray-400 hover:bg-indigo-500/20 hover:text-indigo-300 rounded border border-white/10 transition-all"
                                    >
                                        {t.name}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="flex-1 relative overflow-hidden">
                            <textarea
                                ref={textareaRef}
                                value={rawCommand}
                                onChange={(e) => setRawCommand(e.target.value)}
                                onKeyDown={handleKeyDown}
                                className="w-full h-full p-6 font-mono text-sm text-indigo-300 focus:outline-none resize-none bg-transparent leading-relaxed custom-scrollbar-dark selection:bg-indigo-500/30"
                                spellCheck={false}
                                placeholder="GET /_search&#10;{&#10;  &quot;query&quot;: { &quot;match_all&quot;: {} }&#10;}"
                            />

                            {/* Line parse visual cue */}
                            <div className="absolute top-6 left-1 w-1 bg-indigo-500/50 rounded-full h-5 opacity-50"></div>
                        </div>

                        {/* Run Button Overlay */}
                        <div className="absolute bottom-6 right-6">
                            <button
                                onClick={handleRun}
                                disabled={isLoading}
                                className="flex items-center gap-3 px-8 py-4 bg-indigo-600 text-white rounded-2xl hover:bg-indigo-700 shadow-xl shadow-indigo-200 transition-all active:scale-95 disabled:opacity-50 font-bold group"
                            >
                                {isLoading ? <Loader2 size={20} className="animate-spin" /> : <Play size={20} className="group-hover:translate-x-0.5 transition-transform" />}
                                <span>RUN QUERY</span>
                            </button>
                        </div>
                    </div>

                    {/* Right Panel: Result */}
                    <div className="w-1/2 flex flex-col bg-slate-900 overflow-hidden relative">
                        <div className="px-6 py-3 bg-slate-800 border-b border-white/5 flex justify-between items-center shrink-0">
                            <div className="flex gap-4">
                                <button
                                    onClick={() => setViewMode('json')}
                                    className={`text-[10px] font-bold uppercase tracking-widest flex items-center gap-1.5 transition-colors ${viewMode === 'json' ? 'text-indigo-400' : 'text-slate-500 hover:text-slate-300'}`}
                                >
                                    <FileJson size={12} /> JSON Response
                                </button>
                                <button
                                    onClick={() => setViewMode('visual')}
                                    className={`text-[10px] font-bold uppercase tracking-widest flex items-center gap-1.5 transition-colors ${viewMode === 'visual' ? 'text-emerald-400' : 'text-slate-500 hover:text-slate-300'}`}
                                >
                                    <BarChart3 size={12} /> Visualize
                                </button>
                            </div>

                            {result && (
                                <div className="flex items-center gap-3">
                                    <button
                                        onClick={handleCopy}
                                        className="text-slate-400 hover:text-white transition-colors p-1"
                                        title="Copy result"
                                    >
                                        {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                                    </button>
                                    <button
                                        onClick={handleDownload}
                                        className="text-slate-400 hover:text-white transition-colors p-1"
                                        title="Download JSON result"
                                    >
                                        <Download size={14} />
                                    </button>
                                </div>
                            )}
                        </div>

                        <div className="flex-1 overflow-auto p-6 custom-scrollbar bg-slate-900/50">
                            {error && (
                                <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-sm flex items-start gap-3 animate-in slide-in-from-top-2">
                                    <AlertCircle size={18} className="flex-shrink-0 mt-0.5" />
                                    <div>
                                        <p className="font-bold">Execution Error</p>
                                        <p className="opacity-80 mt-1 font-mono text-xs">{error}</p>
                                    </div>
                                </div>
                            )}

                            {result ? (
                                viewMode === 'json' ? (
                                    <pre className="text-xs font-mono text-indigo-200 leading-relaxed selection:bg-indigo-500/30 animate-in fade-in duration-300">
                                        {JSON.stringify(result, null, 2)}
                                    </pre>
                                ) : (
                                    <VisualizationPanel data={result} />
                                )
                            ) : !error && (
                                <div className="h-full flex flex-col items-center justify-center text-slate-700 grayscale opacity-40">
                                    <LayoutPanelTop size={64} className="mb-4" />
                                    <p className="font-medium">Run a query to see the results</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="px-8 py-4 bg-white border-t border-gray-100 flex justify-between items-center">
                    <div className="flex items-center gap-6 text-xs font-medium text-gray-500">
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                            Connected to {clusterId.slice(0, 8)}...
                        </div>
                    </div>
                    <div className="flex gap-3">
                        <button
                            onClick={onClose}
                            className="px-6 py-2.5 text-sm font-bold text-gray-600 hover:text-gray-900 transition-colors"
                        >
                            Close console
                        </button>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default ESDSLConsoleModal;
