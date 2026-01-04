import React, { useState, DragEvent } from 'react';
import { useTranslation } from 'react-i18next';
import {
    BarChart3,
    LineChart,
    PieChart,
    Table,
    CreditCard,
    GripHorizontal,
    X,
    TrendingUp,
    MoreHorizontal
} from 'lucide-react';

// Draggable Component Types
type ComponentType = 'line' | 'bar' | 'pie' | 'metric' | 'table';

interface DraggableItem {
    id: ComponentType;
    label: string;
    icon: React.ElementType;
    defaultSize: { w: number, h: number }; // Grid units (1-12)
}

interface PlacedItem {
    id: string; // Unique instance ID
    type: ComponentType;
    x: number;
    y: number; // Not strictly used in this flex/grid flow but good for future 2D canvas
}

const DataCanvas: React.FC = () => {
    const { t } = useTranslation();
    const [placedItems, setPlacedItems] = useState<PlacedItem[]>([]);
    const [isDraggingOver, setIsDraggingOver] = useState(false);

    const tools: DraggableItem[] = [
        { id: 'metric', label: 'metricCard', icon: CreditCard, defaultSize: { w: 3, h: 1 } },
        { id: 'line', label: 'chartLine', icon: LineChart, defaultSize: { w: 6, h: 4 } },
        { id: 'bar', label: 'chartBar', icon: BarChart3, defaultSize: { w: 6, h: 4 } },
        { id: 'pie', label: 'chartPie', icon: PieChart, defaultSize: { w: 4, h: 4 } },
        { id: 'table', label: 'dataTable', icon: Table, defaultSize: { w: 12, h: 6 } },
    ];

    const handleDragStart = (e: DragEvent, type: ComponentType) => {
        e.dataTransfer.setData('application/react-dnd', type);
        e.dataTransfer.effectAllowed = 'copy';
    };

    const handleDragOver = (e: DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
        setIsDraggingOver(true);
    };

    const handleDragLeave = (e: DragEvent) => {
        e.preventDefault();
        setIsDraggingOver(false);
    };

    const handleDrop = (e: DragEvent) => {
        e.preventDefault();
        setIsDraggingOver(false);
        const type = e.dataTransfer.getData('application/react-dnd') as ComponentType;

        if (type) {
            const newItem: PlacedItem = {
                id: `item-${Date.now()}`,
                type,
                x: 0,
                y: 0
            };
            setPlacedItems([...placedItems, newItem]);
        }
    };

    const removeItem = (id: string) => {
        setPlacedItems(placedItems.filter(item => item.id !== id));
    };

    // --- Mock Components Renderers ---

    const renderMetricCard = () => (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-between h-full">
            <div className="flex justify-between items-start">
                <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600">
                    <TrendingUp size={20} />
                </div>
                <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">+12%</span>
            </div>
            <div>
                <p className="text-sm font-medium text-gray-500">Total Revenue</p>
                <h3 className="text-2xl font-bold text-gray-900">$45,231.89</h3>
            </div>
        </div>
    );

    const renderChartPlaceholder = (icon: React.ElementType, title: string, color: string) => (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 h-full flex flex-col">
            <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-gray-800">{title}</h3>
                <button className="text-gray-400 hover:text-gray-600"><MoreHorizontal size={18} /></button>
            </div>
            <div className={`flex-1 rounded-lg ${color} flex items-center justify-center relative overflow-hidden group`}>
                {React.createElement(icon, { size: 48, className: "text-white/50" })}
                <div className="absolute inset-0 bg-gradient-to-t from-black/10 to-transparent"></div>
                {/* Mock Data Lines/Bars */}
                <div className="absolute bottom-0 left-0 right-0 h-1/2 flex items-end justify-around px-4 pb-4 gap-2">
                    {[40, 70, 50, 90, 60, 80].map((h, i) => (
                        <div key={i} style={{ height: `${h}%` }} className="w-full bg-white/30 rounded-t-sm"></div>
                    ))}
                </div>
            </div>
        </div>
    );

    const renderTable = () => (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 h-full overflow-hidden flex flex-col">
            <div className="p-6 border-b border-gray-50">
                <h3 className="font-bold text-gray-800">Recent Transactions</h3>
            </div>
            <div className="flex-1 overflow-auto">
                <table className="w-full text-sm text-left">
                    <thead className="bg-gray-50 text-gray-500 font-medium">
                        <tr>
                            <th className="px-6 py-3">ID</th>
                            <th className="px-6 py-3">User</th>
                            <th className="px-6 py-3">Status</th>
                            <th className="px-6 py-3 text-right">Amount</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                        {[1, 2, 3, 4, 5].map(i => (
                            <tr key={i} className="hover:bg-gray-50/50">
                                <td className="px-6 py-3 text-gray-600">#TRX-00{i}</td>
                                <td className="px-6 py-3 font-medium text-gray-900">User {i}</td>
                                <td className="px-6 py-3"><span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">Completed</span></td>
                                <td className="px-6 py-3 text-right text-gray-600">$120.00</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );

    const renderComponent = (item: PlacedItem) => {
        switch (item.type) {
            case 'metric': return renderMetricCard();
            case 'line': return renderChartPlaceholder(LineChart, 'Traffic Trends', 'bg-indigo-500');
            case 'bar': return renderChartPlaceholder(BarChart3, 'Sales Distribution', 'bg-purple-500');
            case 'pie': return renderChartPlaceholder(PieChart, 'User Demographics', 'bg-rose-500');
            case 'table': return renderTable();
            default: return null;
        }
    };

    // Grid classes mapper based on size
    const getGridClass = (type: ComponentType) => {
        switch (type) {
            case 'metric': return 'col-span-12 md:col-span-6 lg:col-span-3 h-32';
            case 'line': return 'col-span-12 lg:col-span-6 h-80';
            case 'bar': return 'col-span-12 lg:col-span-6 h-80';
            case 'pie': return 'col-span-12 md:col-span-6 lg:col-span-4 h-80';
            case 'table': return 'col-span-12 h-96';
            default: return 'col-span-12 h-64';
        }
    };

    return (
        <div className="flex h-[calc(100vh-8rem)] gap-6">
            {/* Tools Sidebar */}
            <div className="w-64 bg-white rounded-xl shadow-sm border border-gray-100 flex flex-col overflow-hidden">
                <div className="p-4 border-b border-gray-100 bg-gray-50/50">
                    <h3 className="font-bold text-gray-800 text-sm">{t('visualComponents')}</h3>
                </div>
                <div className="p-4 space-y-3 overflow-y-auto flex-1">
                    {tools.map(tool => (
                        <div
                            key={tool.id}
                            draggable
                            onDragStart={(e) => handleDragStart(e, tool.id)}
                            className="group flex items-center p-3 bg-white border border-gray-200 rounded-lg cursor-grab hover:border-indigo-500 hover:shadow-md transition-all active:cursor-grabbing"
                        >
                            <div className="p-2 bg-gray-50 rounded-md text-gray-500 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors">
                                <tool.icon size={18} />
                            </div>
                            <span className="ml-3 text-sm font-medium text-gray-600 group-hover:text-gray-900">{t(tool.label)}</span>
                            <GripHorizontal size={14} className="ml-auto text-gray-300" />
                        </div>
                    ))}
                </div>
                <div className="p-4 bg-gray-50 border-t border-gray-100 text-xs text-gray-400 text-center">
                    v1.0.0 Beta
                </div>
            </div>

            {/* Main Canvas Area */}
            <div
                className={`flex-1 bg-gray-100/50 rounded-xl border-2 border-dashed transition-all overflow-y-auto p-6 ${isDraggingOver ? 'border-indigo-400 bg-indigo-50/30' : 'border-gray-200'
                    }`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
            >
                {placedItems.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-gray-400 pointer-events-none select-none">
                        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                            <BarChart3 size={32} className="opacity-50" />
                        </div>
                        <p className="text-lg font-medium">{t('canvasPlaceholder')}</p>
                        <p className="text-sm mt-2 opacity-60">HTML5 Native Drag & Drop</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-12 gap-6 pb-20">
                        {placedItems.map((item, index) => (
                            <div
                                key={item.id}
                                className={`relative group ${getGridClass(item.type)} animate-in zoom-in-95 duration-300`}
                                style={{ animationDelay: `${index * 50}ms` }}
                            >
                                {renderComponent(item)}

                                {/* Overlay Controls */}
                                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                        onClick={() => removeItem(item.id)}
                                        className="p-1.5 bg-rose-500 text-white rounded-full shadow-sm hover:bg-rose-600"
                                    >
                                        <X size={14} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default DataCanvas;
