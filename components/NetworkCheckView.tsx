import React, { useState } from 'react';
import { Radio, Search, Loader2, CheckCircle2, XCircle, Clock, Globe, Shield, Activity, Zap, Download, ChevronDown } from 'lucide-react';
import { checkConnectivity } from '../services/api';

interface PingResult {
    ip: string;
    success: boolean;
    latency?: number;
    message?: string;
    timestamp: string;
}

interface PingSession {
    id: string;
    timestamp: string;
    targetCount: number;
    results: PingResult[];
    isExpanded: boolean;
}

const NetworkCheckView: React.FC = () => {
    const [input, setInput] = useState('');
    const [sessions, setSessions] = useState<PingSession[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [progress, setProgress] = useState({ current: 0, total: 0 });
    const [filter, setFilter] = useState<'all' | 'online' | 'offline'>('all');

    const handlePing = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();

        const ipList = input
            .split(/[\n,;]/)
            .map(s => s.trim())
            .filter(s => s && !s.startsWith('#'));

        if (ipList.length === 0 || isLoading) return;

        setIsLoading(true);
        setProgress({ current: 0, total: ipList.length });

        const batchResults: PingResult[] = [];
        const concurrencyLimit = 5;

        for (let i = 0; i < ipList.length; i += concurrencyLimit) {
            const chunk = ipList.slice(i, i + concurrencyLimit);
            const promises = chunk.map(async (ipAddr) => {
                try {
                    const res = await checkConnectivity(ipAddr);
                    return {
                        ip: ipAddr,
                        ...res,
                        timestamp: new Date().toLocaleTimeString()
                    };
                } catch (err) {
                    return {
                        ip: ipAddr,
                        success: false,
                        message: 'Error',
                        timestamp: new Date().toLocaleTimeString()
                    };
                }
            });

            const chunkResults = await Promise.all(promises);
            batchResults.push(...chunkResults);
            setProgress(p => ({ ...p, current: Math.min(i + concurrencyLimit, ipList.length) }));
        }

        const newSession: PingSession = {
            id: Date.now().toString(),
            timestamp: new Date().toLocaleString(),
            targetCount: ipList.length,
            results: batchResults,
            isExpanded: true
        };

        setSessions(prev => [newSession, ...prev]);
        setInput('');
        setIsLoading(false);
    };

    const toggleSession = (sessionId: string) => {
        setSessions(prev => prev.map(s =>
            s.id === sessionId ? { ...s, isExpanded: !s.isExpanded } : s
        ));
    };

    const clearResults = () => setSessions([]);

    const allResults = sessions.flatMap(s => s.results);
    const successCount = allResults.filter(r => r.success).length;
    const failCount = allResults.length - successCount;
    const avgLatency = successCount > 0
        ? Math.round(allResults.filter(r => r.success).reduce((acc, curr) => acc + (curr.latency || 0), 0) / successCount)
        : 0;

    const downloadSessionCSV = (session: PingSession) => {
        const filtered = session.results.filter(r => {
            if (filter === 'online') return r.success;
            if (filter === 'offline') return !r.success;
            return true;
        });

        if (filtered.length === 0) return;

        const headers = ["Target Address", "Status", "Latency (ms)", "Message", "Timestamp"];
        const rows = filtered.map(r => [
            r.ip,
            r.success ? "Online" : "Offline",
            r.latency || "-",
            r.message || "Done",
            r.timestamp
        ]);

        const csvContent = [
            headers.join(","),
            ...rows.map(row => row.map(cell => `"${cell}"`).join(","))
        ].join("\n");

        const blob = new Blob(["\ufeff" + csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `ping_report_${session.id}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="h-[calc(100vh-64px)] flex overflow-hidden bg-slate-50/50">
            {/* Left Column: Input Panel */}
            <div className="w-80 border-r border-slate-200 bg-white flex flex-col shadow-xl z-10 shrink-0">
                <div className="p-6 border-b border-slate-100 bg-slate-50/50">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-indigo-600 rounded-lg text-white shadow-lg shadow-indigo-100">
                            <Zap size={20} />
                        </div>
                        <h2 className="font-bold text-slate-800 tracking-tight">控制台</h2>
                    </div>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest px-1">Network Control Panel</p>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    <div className="space-y-3">
                        <div className="flex justify-between items-center">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">探测目标</label>
                            <span className="text-[10px] font-mono text-indigo-500 bg-indigo-50 px-1.5 py-0.5 rounded">
                                {input.split(/[\n,;]/).filter(s => s.trim()).length} targets
                            </span>
                        </div>
                        <textarea
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder="输入 IP 或域名，每行一个..."
                            className="w-full h-64 p-4 bg-slate-50 border-2 border-slate-100 rounded-xl text-slate-700 font-mono text-xs focus:border-indigo-500 focus:bg-white focus:outline-none transition-all placeholder:text-slate-300 resize-none shadow-inner"
                        />
                    </div>

                    <div className="space-y-4">
                        <button
                            onClick={handlePing}
                            disabled={isLoading || !input.trim()}
                            className="w-full bg-indigo-600 text-white py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-indigo-700 disabled:opacity-50 disabled:grayscale shadow-lg shadow-indigo-100 transition-all active:scale-95"
                        >
                            {isLoading ? <Loader2 size={18} className="animate-spin" /> : <Activity size={18} />}
                            {isLoading ? '探测中...' : '开始任务'}
                        </button>

                        {isLoading && (
                            <div className="space-y-2">
                                <div className="flex justify-between text-[10px] font-bold text-slate-400 uppercase">
                                    <span>Processing Queue</span>
                                    <span>{Math.round((progress.current / progress.total) * 100)}%</span>
                                </div>
                                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-indigo-500 transition-all duration-300"
                                        style={{ width: `${(progress.current / progress.total) * 100}%` }}
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <div className="p-6 border-t border-slate-100 bg-slate-50/10">
                    <div className="flex items-center gap-3 text-slate-400 group cursor-help">
                        <Shield size={16} />
                        <span className="text-[10px] font-bold uppercase tracking-widest">探测节点: 北京核心网关</span>
                    </div>
                </div>
            </div>

            {/* Right Column: Results & History */}
            <div className="flex-1 overflow-y-auto custom-scrollbar">
                <main className="p-10 max-w-5xl">
                    {/* Top Stats Dashboard */}
                    <div className="grid grid-cols-4 gap-4 mb-10">
                        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                                <Search size={48} />
                            </div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">历史任务次</p>
                            <p className="text-2xl font-black text-slate-800">{sessions.length}</p>
                        </div>
                        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-4 text-emerald-500 opacity-5 group-hover:opacity-10 transition-opacity">
                                <CheckCircle2 size={48} />
                            </div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">连通节点</p>
                            <p className="text-2xl font-black text-emerald-600">{successCount}</p>
                        </div>
                        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-4 text-rose-500 opacity-5 group-hover:opacity-10 transition-opacity">
                                <XCircle size={48} />
                            </div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">异常节点</p>
                            <p className="text-2xl font-black text-rose-600">{failCount}</p>
                        </div>
                        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-4 text-indigo-500 opacity-5 group-hover:opacity-10 transition-opacity">
                                <Clock size={48} />
                            </div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">延迟平均值</p>
                            <p className="text-2xl font-black text-indigo-600">{avgLatency}<span className="text-xs ml-1">ms</span></p>
                        </div>
                    </div>

                    {/* archiving section */}
                    <div className="space-y-6">
                        <div className="flex justify-between items-center bg-white/50 backdrop-blur-md sticky top-0 py-4 z-10 border-b border-slate-200 mb-6 px-2">
                            <div className="flex items-center gap-6">
                                <h2 className="text-sm font-black text-slate-800 tracking-tight uppercase">探测日志档案</h2>
                                <div className="flex bg-slate-200/50 p-1 rounded-lg border border-slate-100">
                                    {(['all', 'online', 'offline'] as const).map((f) => (
                                        <button
                                            key={f}
                                            onClick={() => setFilter(f)}
                                            className={`px-4 py-1 text-[10px] font-bold rounded-md transition-all uppercase tracking-wider ${filter === f
                                                ? 'bg-white text-indigo-600 shadow-sm ring-1 ring-slate-100'
                                                : 'text-slate-500 hover:text-slate-700'
                                                }`}
                                        >
                                            {f === 'all' ? '全部' : f === 'online' ? '在线' : '离线'}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            {sessions.length > 0 && (
                                <button
                                    onClick={clearResults}
                                    className="text-[10px] font-bold text-rose-400 hover:text-rose-600 transition-colors uppercase tracking-widest"
                                >
                                    清空所有档案
                                </button>
                            )}
                        </div>

                        {sessions.length === 0 ? (
                            <div className="bg-white/40 rounded-3xl p-32 flex flex-col items-center justify-center border-2 border-dashed border-slate-200 opacity-40">
                                <Globe size={64} className="text-slate-300 mb-6 animate-pulse" />
                                <p className="text-slate-500 font-bold tracking-[0.2em] font-mono text-sm uppercase">Waiting for first task...</p>
                            </div>
                        ) : (
                            <div className="space-y-6 pb-20">
                                {sessions.map((session) => (
                                    <div key={session.id} className="bg-white rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden group">
                                        <div
                                            onClick={() => toggleSession(session.id)}
                                            className={`px-8 py-5 flex items-center justify-between cursor-pointer transition-colors ${session.isExpanded ? 'bg-slate-50/50' : 'hover:bg-slate-50/30'}`}
                                        >
                                            <div className="flex items-center gap-5">
                                                <div className={`p-3 rounded-xl transition-all ${session.isExpanded ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'bg-slate-100 text-slate-400'}`}>
                                                    <Clock size={20} />
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-3">
                                                        <span className="font-black text-slate-800">{session.timestamp}</span>
                                                        <span className="px-2 py-0.5 bg-slate-100 rounded text-[9px] font-bold text-slate-400 tracking-wider">REF:{session.id.slice(-6).toUpperCase()}</span>
                                                    </div>
                                                    <div className="flex items-center gap-4 mt-1.5">
                                                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Targets: {session.targetCount}</span>
                                                        <span className="w-1 h-1 bg-slate-200 rounded-full"></span>
                                                        <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest">Success: {session.results.filter(r => r.success).length}</span>
                                                        <span className="w-1 h-1 bg-slate-200 rounded-full"></span>
                                                        <span className="text-[10px] font-bold text-rose-500 uppercase tracking-widest">Fail: {session.results.filter(r => !r.success).length}</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); downloadSessionCSV(session); }}
                                                    className="px-4 py-2 bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200 rounded-xl transition-all flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest"
                                                >
                                                    <Download size={14} /> 离线分析导出
                                                </button>
                                                <div className={`p-1.5 rounded-full transition-all duration-500 ${session.isExpanded ? 'rotate-180 bg-indigo-50 text-indigo-600' : 'text-slate-300'}`}>
                                                    <ChevronDown size={20} />
                                                </div>
                                            </div>
                                        </div>

                                        {session.isExpanded && (
                                            <div className="border-t border-slate-100 bg-white">
                                                <div className="divide-y divide-slate-50 px-4">
                                                    {session.results
                                                        .filter(r => {
                                                            if (filter === 'online') return r.success;
                                                            if (filter === 'offline') return !r.success;
                                                            return true;
                                                        })
                                                        .map((result, idx) => (
                                                            <div key={idx} className="px-6 py-4 flex items-center gap-8 hover:bg-slate-50/50 rounded-2xl my-1 transition-all">
                                                                <div className={`p-2 rounded-lg ${result.success ? 'bg-emerald-50 text-emerald-500' : 'bg-rose-50 text-rose-500'}`}>
                                                                    {result.success ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
                                                                </div>
                                                                <div className="flex-1">
                                                                    <p className="font-mono text-xs font-bold text-slate-700 tracking-tight">{result.ip}</p>
                                                                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.15em] mt-0.5">{result.message || 'Status Nominal'}</p>
                                                                </div>
                                                                {result.success && (
                                                                    <div className="flex items-center gap-2 bg-indigo-50/50 px-3 py-1.5 rounded-lg">
                                                                        <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-pulse"></div>
                                                                        <span className="text-xs font-black text-indigo-600 font-mono">{result.latency}ms</span>
                                                                    </div>
                                                                )}
                                                                <div className="text-right shrink-0">
                                                                    <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-[0.1em] ${result.success
                                                                        ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                                                                        : 'bg-rose-500/10 text-rose-600 border border-rose-500/20'
                                                                        }`}>
                                                                        {result.success ? 'Active' : 'Offline'}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </main>
            </div>
        </div>
    );
};

export default NetworkCheckView;
