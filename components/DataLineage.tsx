import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Database,
    Server,
    FileJson,
    LayoutDashboard,
    ArrowRight,
    Activity,
    User,
    Clock,
    Tag,
    Search
} from 'lucide-react';

// --- Types ---
type NodeType = 'kafka' | 'flink' | 'clickhouse' | 'dashboard';

interface LineageNode {
    id: string;
    type: NodeType;
    label: string;
    x: number;
    y: number;
    // Metadata for details panel
    owner?: string;
    updated?: string;
    description?: string;
    status?: 'healthy' | 'lagging' | 'failed';
}

interface LineageEdge {
    id: string;
    source: string;
    target: string;
    label?: string;
}

// --- Mock Data ---
const initialNodes: LineageNode[] = [
    {
        id: 'n1',
        type: 'kafka',
        label: 'user_events',
        x: 100,
        y: 150,
        owner: 'Data Eng',
        updated: '2 mins ago',
        status: 'healthy',
        description: 'Raw user clickstream events from web/mobile.'
    },
    {
        id: 'n2',
        type: 'flink',
        label: 'ETL_Cleanse',
        x: 400,
        y: 150,
        owner: 'Platform Team',
        updated: 'Running',
        status: 'healthy',
        description: 'Filters bots and enriches events with geo-data.'
    },
    {
        id: 'n3',
        type: 'clickhouse',
        label: 'dw_events',
        x: 700,
        y: 150,
        owner: 'Analytics',
        updated: '1 hour ago',
        status: 'healthy',
        description: 'Columnar storage for fast OLAP queries.'
    },
    {
        id: 'n4',
        type: 'dashboard',
        label: 'User_Growth_KPI',
        x: 1000,
        y: 150,
        owner: 'Product Mgr',
        updated: 'Daily',
        status: 'healthy',
        description: 'Executive dashboard tracking DAU/MAU.'
    },
    // Branch
    {
        id: 'n5',
        type: 'flink',
        label: 'Fraud_Detect',
        x: 400,
        y: 300,
        owner: 'Security',
        updated: 'Running',
        status: 'lagging',
        description: 'Real-time anomaly detection.'
    },
    {
        id: 'n6',
        type: 'kafka',
        label: 'alerts_topic',
        x: 700,
        y: 300,
        owner: 'Security',
        updated: 'Real-time',
        status: 'healthy',
        description: 'High priority security alerts.'
    }
];

const initialEdges: LineageEdge[] = [
    { id: 'e1', source: 'n1', target: 'n2', label: 'consume' },
    { id: 'e2', source: 'n2', target: 'n3', label: 'sink' },
    { id: 'e3', source: 'n3', target: 'n4', label: 'query' },
    { id: 'e4', source: 'n1', target: 'n5', label: 'consume' },
    { id: 'e5', source: 'n5', target: 'n6', label: 'produce' },
];

const DataLineage: React.FC = () => {
    const { t } = useTranslation();
    const [selectedNode, setSelectedNode] = useState<LineageNode | null>(null);

    // Helper to render icon based on type
    const renderIcon = (type: NodeType) => {
        switch (type) {
            case 'kafka': return <FileJson size={20} className="text-purple-500" />;
            case 'flink': return <Activity size={20} className="text-orange-500" />;
            case 'clickhouse': return <Database size={20} className="text-yellow-500" />;
            case 'dashboard': return <LayoutDashboard size={20} className="text-indigo-500" />;
        }
    };

    const getNodeColor = (status?: string) => {
        switch (status) {
            case 'failed': return 'stroke-rose-500 fill-rose-50';
            case 'lagging': return 'stroke-amber-500 fill-amber-50';
            default: return 'stroke-indigo-500 fill-white';
        }
    };

    return (
        <div className="flex h-[calc(100vh-8rem)] gap-6 animate-in fade-in duration-500">

            {/* Main Graph Area */}
            <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-100 relative overflow-hidden">
                <div className="absolute top-4 left-4 z-10 flex items-center gap-2">
                    <h3 className="font-bold text-gray-800 bg-white/80 backdrop-blur px-3 py-1 rounded-full border border-gray-200">
                        {t('lineageGraph')}
                    </h3>
                </div>

                {/* SVG Canvas */}
                <svg className="w-full h-full bg-slate-50/50 cursor-grab active:cursor-grabbing">
                    <defs>
                        <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="28" refY="3.5" orient="auto">
                            <polygon points="0 0, 10 3.5, 0 7" fill="#94a3b8" />
                        </marker>
                    </defs>

                    {/* Edges */}
                    {initialEdges.map(edge => {
                        const source = initialNodes.find(n => n.id === edge.source)!;
                        const target = initialNodes.find(n => n.id === edge.target)!;

                        // Bezier curve
                        const controlOffset = 50;
                        const path = `M ${source.x} ${source.y} C ${source.x + controlOffset} ${source.y}, ${target.x - controlOffset} ${target.y}, ${target.x} ${target.y}`;

                        return (
                            <g key={edge.id}>
                                <path
                                    d={path}
                                    fill="none"
                                    stroke="#cbd5e1"
                                    strokeWidth="2"
                                    markerEnd="url(#arrowhead)"
                                />
                                {edge.label && (
                                    <text x={(source.x + target.x) / 2} y={(source.y + target.y) / 2 - 10} textAnchor="middle" fontSize="10" fill="#64748b">
                                        {edge.label}
                                    </text>
                                )}
                            </g>
                        );
                    })}

                    {/* Nodes */}
                    {initialNodes.map(node => (
                        <g
                            key={node.id}
                            className="cursor-pointer group hover:opacity-100 transition-all"
                            onClick={() => setSelectedNode(node)}
                            style={{ opacity: selectedNode && selectedNode.id !== node.id ? 0.6 : 1 }}
                        >
                            {/* Node Circle */}
                            <circle
                                cx={node.x}
                                cy={node.y}
                                r="20"
                                className={`transition-colors duration-300 ${getNodeColor(node.status)} stroke-2`}
                            />

                            {/* Icon centered */}
                            <foreignObject x={node.x - 10} y={node.y - 10} width="20" height="20" className="pointer-events-none">
                                <div className="flex items-center justify-center w-full h-full">
                                    {renderIcon(node.type)}
                                </div>
                            </foreignObject>

                            {/* Label */}
                            <text
                                x={node.x}
                                y={node.y + 35}
                                textAnchor="middle"
                                className={`text-xs font-semibold ${selectedNode?.id === node.id ? 'fill-indigo-700' : 'fill-slate-600'}`}
                            >
                                {node.label}
                            </text>
                        </g>
                    ))}
                </svg>
            </div>

            {/* Details Panel */}
            <div className={`w-80 bg-white rounded-xl shadow-sm border border-gray-100 flex flex-col transition-all duration-300 ${selectedNode ? 'translate-x-0 opacity-100' : 'translate-x-10 opacity-50'}`}>
                {selectedNode ? (
                    <>
                        <div className="p-6 border-b border-gray-50">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="p-2 bg-indigo-50 rounded-lg">
                                    {renderIcon(selectedNode.type)}
                                </div>
                                <div>
                                    <h3 className="font-bold text-gray-800">{selectedNode.label}</h3>
                                    <span className="text-xs text-gray-400 uppercase tracking-wider">{selectedNode.type}</span>
                                </div>
                            </div>
                        </div>

                        <div className="p-6 space-y-6 flex-1 overflow-y-auto">
                            <div>
                                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                                    <Tag size={12} /> {t('assetDetails')}
                                </h4>
                                <p className="text-sm text-gray-600 leading-relaxed">
                                    {selectedNode.description || 'No description available for this asset.'}
                                </p>
                            </div>

                            <div className="space-y-4">
                                <div className="flex justify-between items-center py-2 border-b border-gray-50">
                                    <span className="text-sm text-gray-500 flex items-center gap-2"><User size={14} /> Owner</span>
                                    <span className="text-sm font-medium text-gray-900">{selectedNode.owner}</span>
                                </div>
                                <div className="flex justify-between items-center py-2 border-b border-gray-50">
                                    <span className="text-sm text-gray-500 flex items-center gap-2"><Clock size={14} /> Updated</span>
                                    <span className="text-sm font-medium text-gray-900">{selectedNode.updated}</span>
                                </div>
                                <div className="flex justify-between items-center py-2 border-b border-gray-50">
                                    <span className="text-sm text-gray-500 flex items-center gap-2"><Activity size={14} /> Status</span>
                                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${selectedNode.status === 'healthy' ? 'bg-emerald-100 text-emerald-700' :
                                            selectedNode.status === 'lagging' ? 'bg-amber-100 text-amber-700' :
                                                'bg-rose-100 text-rose-700'
                                        }`}>
                                        {selectedNode.status}
                                    </span>
                                </div>
                            </div>

                            {/* Mock Actions */}
                            <div className="pt-4">
                                <button className="w-full py-2 bg-indigo-50 text-indigo-600 font-medium rounded-lg hover:bg-indigo-100 transition-colors flex items-center justify-center gap-2">
                                    <Search size={16} /> View Data Preview
                                </button>
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-gray-400 p-6 text-center">
                        <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center mb-3">
                            <ArrowRight size={24} className="opacity-30" />
                        </div>
                        <p className="text-sm">Select a node in the graph to view its details and lineage metadata.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default DataLineage;
