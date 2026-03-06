import React, { useState, useEffect } from 'react';
import { HardDrive, RefreshCw, CheckCircle2, Database, Save, Activity, Edit2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { getSystemConfig, testDbConnection, initSystemConfig } from '../services/api';

const SystemPersistence: React.FC = () => {
    const { t } = useTranslation();
    const [activeMode, setActiveMode] = useState<'FILE' | 'MYSQL'>('FILE');
    const [mysqlConfig, setMysqlConfig] = useState({
        host: '127.0.0.1',
        port: 3306,
        database: 'dataops',
        username: 'root',
        password: ''
    });
    const [dbTestMessage, setDbTestMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
    const [isTesting, setIsTesting] = useState(false);
    const [isApplying, setIsApplying] = useState(false);
    const [isEditingDb, setIsEditingDb] = useState(false);

    useEffect(() => {
        getSystemConfig().then(res => {
            if (res) {
                setActiveMode(res.activeMode || 'FILE');
                if (res.mysql) {
                    setMysqlConfig(res.mysql);
                }
                if (res.activeMode === 'MYSQL') {
                    setIsEditingDb(false);
                } else {
                    setIsEditingDb(true);
                }
            }
        });
    }, []);

    const handleTestConnection = async () => {
        setIsTesting(true);
        setDbTestMessage(null);
        const res = await testDbConnection(mysqlConfig);
        if (res.success) {
            setDbTestMessage({ type: 'success', text: res.message });
        } else {
            setDbTestMessage({ type: 'error', text: res.message });
        }
        setIsTesting(false);
    };

    const handleApplyConfig = async () => {
        setIsApplying(true);
        const res = await initSystemConfig({ activeMode, mysql: mysqlConfig });
        if (res.success) {
            setDbTestMessage({ type: 'success', text: res.message });
            setTimeout(() => {
                window.location.reload();
            }, 1500);
        } else {
            setDbTestMessage({ type: 'error', text: res.message });
        }
        setIsApplying(false);
    };

    return (
        <div className="max-w-4xl space-y-8 animate-in fade-in duration-500">
            <div>
                <h2 className="text-2xl font-bold border-b border-gray-200 pb-4 text-gray-800 flex items-center gap-2">
                    <Database size={24} className="text-blue-600" />
                    Persistence Engine
                </h2>
                <p className="mt-2 text-sm text-gray-500">
                    Configure where the application stores its internal configurations and states.
                </p>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 relative overflow-hidden">
                <div className="flex flex-col md:flex-row gap-6 mb-6">
                    <label className={`flex-1 border rounded-lg p-4 cursor-pointer transition-all ${activeMode === 'FILE' ? 'border-blue-500 bg-blue-50/50 ring-2 ring-blue-500/20' : 'border-gray-200 hover:border-gray-300'}`}>
                        <input type="radio" className="hidden" name="persistenceMode" checked={activeMode === 'FILE'} onChange={() => setActiveMode('FILE')} />
                        <div className="flex items-center gap-3">
                            <HardDrive className={activeMode === 'FILE' ? 'text-blue-600' : 'text-gray-400'} size={20} />
                            <div className="font-medium text-gray-900">Local JSON Files</div>
                        </div>
                        <p className="mt-2 text-xs text-gray-500">Fast, local flat-file storage. Data is saved directly to disk. Ideal for simple setups.</p>
                    </label>
                    <label className={`flex-1 border rounded-lg p-4 cursor-pointer transition-all ${activeMode === 'MYSQL' ? 'border-blue-500 bg-blue-50/50 ring-2 ring-blue-500/20' : 'border-gray-200 hover:border-gray-300'}`}>
                        <input type="radio" className="hidden" name="persistenceMode" checked={activeMode === 'MYSQL'} onChange={() => setActiveMode('MYSQL')} />
                        <div className="flex items-center gap-3">
                            <Database className={activeMode === 'MYSQL' ? 'text-blue-600' : 'text-gray-400'} size={20} />
                            <div className="font-medium text-gray-900">MySQL 8 Database</div>
                        </div>
                        <p className="mt-2 text-xs text-gray-500">Highly reliable. Replaces flat files with a generic KV table structure. Recommended for HA.</p>
                    </label>
                </div>

                {activeMode === 'MYSQL' && !isEditingDb && (
                    <div className="border border-indigo-100 bg-indigo-50/30 rounded-lg p-5 flex items-center justify-between mb-6 animate-in fade-in">
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600">
                                <CheckCircle2 size={20} />
                            </div>
                            <div>
                                <p className="text-sm font-semibold text-gray-900">Connected to {mysqlConfig.host}:{mysqlConfig.port}</p>
                                <p className="text-xs text-gray-500">Database: {mysqlConfig.database} | User: {mysqlConfig.username}</p>
                            </div>
                        </div>
                        <button
                            onClick={() => setIsEditingDb(true)}
                            className="text-indigo-600 hover:text-indigo-700 text-sm font-medium flex items-center gap-1 bg-white px-3 py-1.5 rounded-md border border-indigo-200 hover:border-indigo-300 transition-colors"
                        >
                            <Edit2 size={14} /> Edit Connection
                        </button>
                    </div>
                )}

                {activeMode === 'MYSQL' && isEditingDb && (
                    <div className="border border-gray-100 bg-gray-50/50 rounded-lg p-5 space-y-4 animate-in fade-in slide-in-from-top-2 duration-300 mb-6 relative">
                        <h4 className="text-sm font-bold text-gray-800 mb-2">MySQL Configuration</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Host</label>
                                <input type="text" value={mysqlConfig.host} onChange={e => setMysqlConfig({ ...mysqlConfig, host: e.target.value })} className="w-full bg-white border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Port</label>
                                <input type="number" value={mysqlConfig.port} onChange={e => setMysqlConfig({ ...mysqlConfig, port: Number(e.target.value) })} className="w-full bg-white border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Database Name</label>
                                <input type="text" value={mysqlConfig.database} onChange={e => setMysqlConfig({ ...mysqlConfig, database: e.target.value })} className="w-full bg-white border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Username</label>
                                <input type="text" value={mysqlConfig.username} onChange={e => setMysqlConfig({ ...mysqlConfig, username: e.target.value })} className="w-full bg-white border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                            </div>
                            <div className="col-span-1 md:col-span-2">
                                <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Password</label>
                                <input type="password" value={mysqlConfig.password} onChange={e => setMysqlConfig({ ...mysqlConfig, password: e.target.value })} className="w-full bg-white border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                            </div>
                        </div>

                        <div className="flex items-center gap-3 pt-4 border-t border-gray-200">
                            <button onClick={handleTestConnection} disabled={isTesting} className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50">
                                {isTesting ? <RefreshCw size={16} className="animate-spin" /> : <Activity size={16} />}
                                Test Connection
                            </button>
                            {dbTestMessage && (
                                <span className={`text-sm font-medium ${dbTestMessage.type === 'success' ? 'text-emerald-600' : 'text-rose-600'}`}>{dbTestMessage.text}</span>
                            )}
                        </div>
                    </div>
                )}

                <div className="flex justify-end border-t border-gray-100 pt-5">
                    <button onClick={handleApplyConfig} disabled={isApplying} className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 transition-colors">
                        {isApplying ? <RefreshCw size={16} className="animate-spin" /> : <Save size={16} />}
                        Apply & Initialize
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SystemPersistence;
