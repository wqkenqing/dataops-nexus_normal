import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Upload, Play, Square, Wifi, CheckCircle2, XCircle, FileText, Trash2, Shield, Activity, ChevronRight, ChevronDown, AlertTriangle } from 'lucide-react';
import { 
    OvpnConfig, 
    uploadOvpnConfig, 
    fetchOvpnConfigs, 
    connectOvpn, 
    disconnectOvpn, 
    deleteOvpnConfig, 
    fetchOvpnStatus, 
    fetchOvpnLogs 
} from '../services/api';

const LogPanel: React.FC<{ profileId: string }> = ({ profileId }) => {
    const [lines, setLines] = useState<string[]>([]);
    const boxRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        let active = true;
        const load = async () => {
            const result = await fetchOvpnLogs(profileId, 100);
            if (active) setLines(result || []);
        };
        load();
        const t = setInterval(load, 3000);
        return () => { active = false; clearInterval(t); };
    }, [profileId]);

    useEffect(() => {
        if (boxRef.current) {
            boxRef.current.scrollTop = boxRef.current.scrollHeight;
        }
    }, [lines]);

    if (lines.length === 0) return <div className="text-xs text-gray-400 mt-3 text-center p-4 border border-dashed rounded-lg border-gray-200">No logs generated yet.</div>;

    return (
        <div className="bg-[#1e1e1e] text-[#d4d4d4] font-mono text-xs p-3 rounded-lg max-h-64 overflow-y-auto whitespace-pre-wrap break-all mt-3 shadow-inner" ref={boxRef}>
            {lines.join('\n')}
        </div>
    );
};

const OpenVPNManager: React.FC = () => {
    const { t } = useTranslation();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [dragActive, setDragActive] = useState(false);
    const [configs, setConfigs] = useState<OvpnConfig[]>([]);
    const [loadingMap, setLoadingMap] = useState<Record<string, boolean>>({});
    const [showLogsMap, setShowLogsMap] = useState<Record<string, boolean>>({});
    const [isUploading, setIsUploading] = useState(false);

    const loadData = useCallback(async () => {
        const data = await fetchOvpnConfigs();
        setConfigs(data || []);
    }, []);

    // Initial load
    useEffect(() => {
        loadData();
    }, [loadData]);

    // Polling statuses
    useEffect(() => {
        const interval = setInterval(async () => {
            setConfigs(prev => {
                prev.forEach(async (c) => {
                    const statusUpdate = await fetchOvpnStatus(c.id);
                    if (statusUpdate && statusUpdate.status !== c.status) {
                        setConfigs(currentList => currentList.map(item => item.id === c.id ? statusUpdate : item));
                    }
                });
                return prev;
            });
        }, 2500);
        return () => clearInterval(interval);
    }, []);

    const handleDrag = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === "dragenter" || e.type === "dragover") {
            setDragActive(true);
        } else if (e.type === "dragleave") {
            setDragActive(false);
        }
    };

    const handleDrop = async (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            await processFile(e.dataTransfer.files[0]);
        }
    };

    const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        e.preventDefault();
        if (e.target.files && e.target.files[0]) {
            await processFile(e.target.files[0]);
        }
    };

    const processFile = async (file: File) => {
        if (!file.name.endsWith('.ovpn') && !file.name.endsWith('.conf')) {
            alert("Please upload a .ovpn or .conf file");
            return;
        }
        setIsUploading(true);
        await uploadOvpnConfig(file);
        setIsUploading(false);
        loadData();
        // Reset file input
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const handleConnect = async (id: string) => {
        setLoadingMap(p => ({ ...p, [id]: true }));
        const updated = await connectOvpn(id);
        if (updated) {
            setConfigs(prev => prev.map(c => c.id === id ? updated : c));
        }
        setLoadingMap(p => ({ ...p, [id]: false }));
    };

    const handleDisconnect = async (id: string) => {
        setLoadingMap(p => ({ ...p, [id]: true }));
        const updated = await disconnectOvpn(id);
        if (updated) {
            setConfigs(prev => prev.map(c => c.id === id ? updated : c));
        }
        setLoadingMap(p => ({ ...p, [id]: false }));
    };

    const handleDelete = async (id: string) => {
        if (confirm('Are you sure you want to delete this configuration?')) {
            await deleteOvpnConfig(id);
            loadData();
        }
    };

    const toggleLogs = (id: string) => {
        setShowLogsMap(prev => ({ ...prev, [id]: !prev[id] }));
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header Banner */}
            <div className="bg-gradient-to-r from-emerald-900 to-teal-900 rounded-2xl p-8 text-white shadow-lg relative overflow-hidden">
                <div className="relative z-10 flex justify-between items-center">
                    <div>
                        <h2 className="text-3xl font-bold mb-2 flex items-center gap-3">
                            <Shield className="text-emerald-400" size={32} />
                            OpenVPN Manager
                        </h2>
                        <p className="text-emerald-100 max-w-xl">
                            Securely manage your network connections using OpenVPN profiles. Upload your configurations and manage connectivity status directly from this dashboard.
                        </p>
                    </div>
                    <div className="bg-white/10 p-4 rounded-xl backdrop-blur-sm border border-white/20">
                        <div className="text-sm text-emerald-200">Active Connections</div>
                        <div className="text-2xl font-bold text-white flex items-center gap-2">
                            {configs.filter(c => c.status === 'CONNECTED').length}
                            <span className="text-sm font-normal text-emerald-300">/ {configs.length} profiles</span>
                        </div>
                    </div>
                </div>
                <div className="absolute right-0 top-0 h-full w-1/3 bg-white/5 skew-x-12 transform translate-x-10"></div>
                <div className="absolute left-10 bottom-[-20px] h-32 w-32 bg-emerald-500/20 rounded-full blur-2xl"></div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Upload Area */}
                <div className="lg:col-span-1">
                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 h-full">
                        <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                            <Upload size={20} className="text-gray-500" />
                            Upload Configuration
                        </h3>

                        <div
                            className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center text-center transition-colors h-64 ${dragActive ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 hover:border-indigo-400 hover:bg-gray-50'
                                }`}
                            onDragEnter={handleDrag}
                            onDragLeave={handleDrag}
                            onDragOver={handleDrag}
                            onDrop={handleDrop}
                        >
                            <FileText size={48} className={`mb-4 ${dragActive ? 'text-indigo-500' : 'text-gray-300'}`} />
                            <p className="text-sm text-gray-600 font-medium mb-2">Drag & Drop your .ovpn file here</p>
                            <p className="text-xs text-gray-400 mb-6">or click to browse from your computer</p>

                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".ovpn,.conf"
                                className="hidden"
                                onChange={handleChange}
                            />
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                disabled={isUploading}
                                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium disabled:opacity-50"
                            >
                                {isUploading ? 'Uploading...' : 'Browse Files'}
                            </button>
                        </div>

                        <div className="mt-6 p-4 bg-blue-50 text-blue-800 rounded-lg text-xs leading-relaxed border border-blue-100">
                            <p className="font-bold flex items-center gap-2 mb-1">
                                <Shield size={12} /> Local VPN Engine
                            </p>
                            Configurations execute via the local `openvpn` system binary on the backend container. Ensure certificates and credentials are valid.
                        </div>
                    </div>
                </div>

                {/* Config List */}
                <div className="lg:col-span-2">
                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex flex-col h-full">
                        <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                            <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                                <Wifi size={20} className="text-gray-500" />
                                Connection Profiles
                            </h3>
                            <button onClick={loadData} className="text-sm text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1">
                                <Activity size={14} /> Refresh
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 bg-gray-50/50">
                            {configs.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-64 text-gray-400">
                                    <FileText size={48} className="mb-4 opacity-20" />
                                    <p>No configurations found.</p>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {configs.map(config => {
                                        const isConnected = config.status === 'CONNECTED';
                                        const isFailed = config.status === 'FAILED';
                                        const isConnecting = config.status === 'CONNECTING';
                                        const isBusy = loadingMap[config.id] || isConnecting;
                                        
                                        return (
                                            <div key={config.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden hover:shadow-md transition-shadow">
                                                <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                                    <div className="flex items-start gap-4">
                                                        <div className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 mt-1 ${
                                                            isConnected ? 'bg-emerald-100 text-emerald-600' : 
                                                            isFailed ? 'bg-rose-100 text-rose-600' :
                                                            isConnecting ? 'bg-amber-100 text-amber-600 animate-pulse' :
                                                            'bg-gray-100 text-gray-500'
                                                        }`}>
                                                            {isConnected ? <CheckCircle2 size={24} /> : isFailed ? <AlertTriangle size={24} /> : <XCircle size={24} />}
                                                        </div>
                                                        <div>
                                                            <div className="flex items-center gap-2">
                                                                <h4 className="font-bold text-gray-900 text-lg">{config.name}</h4>
                                                                <div className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-wider ${
                                                                        isConnected ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 
                                                                        isFailed ? 'bg-rose-50 text-rose-700 border border-rose-200' :
                                                                        isConnecting ? 'bg-yellow-50 text-yellow-700 border border-yellow-200' :
                                                                        'bg-gray-100 text-gray-600 border border-gray-200'
                                                                    }`}>
                                                                    {config.status}
                                                                </div>
                                                            </div>
                                                            <div className="flex items-center gap-4 text-xs text-gray-500 mt-1.5 font-medium">
                                                                <span>{new Date(config.uploadTime).toLocaleString()}</span>
                                                                {config.ipAddress && (
                                                                    <span className="text-emerald-600 font-bold bg-emerald-50 px-1.5 rounded">
                                                                        IP: {config.ipAddress}
                                                                    </span>
                                                                )}
                                                            </div>
                                                            {config.lastError && (
                                                                <div className="text-xs text-rose-600 mt-2 bg-rose-50 p-2 rounded border border-rose-100 flex items-start gap-1.5">
                                                                    <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />
                                                                    <span className="break-all">{config.lastError}</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center justify-end gap-2 ml-[64px] sm:ml-0">
                                                        <button
                                                            onClick={() => isConnected ? handleDisconnect(config.id) : handleConnect(config.id)}
                                                            disabled={isBusy}
                                                            className={`flex items-center justify-center w-10 h-10 rounded-lg transition-colors font-medium border disabled:opacity-50 disabled:cursor-not-allowed ${
                                                                isConnected
                                                                    ? 'bg-rose-50 text-rose-600 border-rose-200 hover:bg-rose-100 hover:border-rose-300'
                                                                    : 'bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-100 hover:border-emerald-300'
                                                            }`}
                                                            title={isConnected ? 'Disconnect' : 'Connect'}
                                                        >
                                                            {isConnected ? <Square size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" className="ml-1" />}
                                                        </button>

                                                        <button
                                                            onClick={() => toggleLogs(config.id)}
                                                            className={`flex items-center justify-center w-10 h-10 rounded-lg transition-colors border ${
                                                                showLogsMap[config.id] 
                                                                ? 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100' 
                                                                : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50 hover:text-gray-700'
                                                            }`}
                                                            title="Toggle Logs"
                                                        >
                                                            <FileText size={18} />
                                                        </button>

                                                        <button
                                                            onClick={() => handleDelete(config.id)}
                                                            className="flex items-center justify-center w-10 h-10 bg-white border border-gray-200 text-gray-400 hover:text-rose-600 hover:bg-rose-50 hover:border-rose-200 rounded-lg transition-colors"
                                                            title="Delete Configuration"
                                                        >
                                                            <Trash2 size={18} />
                                                        </button>
                                                    </div>
                                                </div>
                                                
                                                {/* Logs Expansion Panel */}
                                                {showLogsMap[config.id] && (
                                                    <div className="bg-gray-50 border-t border-gray-100 p-4">
                                                        <div className="flex items-center justify-between mb-2">
                                                            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Live Logs</span>
                                                            <span className="text-[10px] text-gray-400">Streaming recent output</span>
                                                        </div>
                                                        <LogPanel profileId={config.id} />
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default OpenVPNManager;
