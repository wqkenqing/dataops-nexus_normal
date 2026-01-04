import React, { useState, useEffect, useMemo } from 'react';
import { Search, Activity, Users, AlertTriangle, Loader2, ChevronDown, ChevronRight } from 'lucide-react';
import { fetchKafkaTopicConsumers } from '../services/api';
import { KafkaConsumerOffset } from '../types';
import { useTranslation } from 'react-i18next';

interface ConsumerOffsetsViewProps {
    clusterId: string;
    topicName: string;
}

const ConsumerOffsetsView: React.FC<ConsumerOffsetsViewProps> = ({ clusterId, topicName }) => {
    const { t } = useTranslation();
    const [offsets, setOffsets] = useState<KafkaConsumerOffset[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(false);
    const [filterTerm, setFilterTerm] = useState('');

    useEffect(() => {
        let isMounted = true;
        const loadOffsets = async () => {
            setIsLoading(true);
            setError(false);
            try {
                const data = await fetchKafkaTopicConsumers(clusterId, topicName);
                if (isMounted) {
                    setOffsets(data);
                }
            } catch (e) {
                console.error("Failed to load topic consumers", e);
                if (isMounted) setError(true);
            } finally {
                if (isMounted) setIsLoading(false);
            }
        };

        if (clusterId && topicName) {
            loadOffsets();
        }

        return () => { isMounted = false; };
    }, [clusterId, topicName]);

    // Group by Consumer Group
    const groupedOffsets = useMemo<Record<string, KafkaConsumerOffset[]>>(() => {
        return offsets.reduce((acc, curr) => {
            // Filter logic
            if (filterTerm && !curr.group.toLowerCase().includes(filterTerm.toLowerCase())) {
                return acc;
            }

            if (!acc[curr.group]) acc[curr.group] = [];
            acc[curr.group].push(curr);
            return acc;
        }, {} as Record<string, KafkaConsumerOffset[]>);
    }, [offsets, filterTerm]);

    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

    const toggleGroup = (groupId: string) => {
        const newExpanded = new Set(expandedGroups);
        if (newExpanded.has(groupId)) {
            newExpanded.delete(groupId);
        } else {
            newExpanded.add(groupId);
        }
        setExpandedGroups(newExpanded);
    };

    if (isLoading) {
        return (
            <div className="flex justify-center py-4">
                <Loader2 className="animate-spin text-purple-600" size={20} />
            </div>
        );
    }

    if (offsets.length === 0 && !error) {
        return (
            <div className="flex flex-col items-center justify-center text-gray-400 py-4">
                <Users size={24} className="mb-2 opacity-50" />
                <span className="text-sm">{t('noConsumerGroupsFound')}</span>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex items-center gap-2 text-rose-500 py-4 justify-center">
                <AlertTriangle size={16} />
                <span className="text-sm">{t('failedToLoadConsumerInfo')}</span>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in slide-in-from-top-2 duration-200">
            <div className="flex justify-between items-center mb-2">
                <div className="flex items-center gap-2">
                    <Activity size={18} className="text-purple-600" />
                    <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wide">{t('consumerGroupsAnalysis')}</h3>
                </div>

                {/* Filter Input */}
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                    <input
                        type="text"
                        placeholder={t('filterGroups')}
                        value={filterTerm}
                        onChange={(e) => setFilterTerm(e.target.value)}
                        className="pl-8 pr-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs focus:ring-2 focus:ring-purple-500 outline-none w-48 transition-all"
                    />
                </div>
            </div>

            {Object.entries(groupedOffsets).length === 0 ? (
                <div className="text-center py-8 text-gray-400 text-sm">
                    {t('noMatchingGroups')}
                </div>
            ) : (
                Object.entries(groupedOffsets).map(([groupId, groupOffsets]: [string, KafkaConsumerOffset[]]) => {
                    const totalLag = groupOffsets.reduce((sum, item) => sum + item.lag, 0);
                    const isExpanded = expandedGroups.has(groupId);

                    return (
                        <div key={groupId} className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm">
                            <div
                                className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex justify-between items-center cursor-pointer hover:bg-gray-100 transition-colors"
                                onClick={() => toggleGroup(groupId)}
                            >
                                <div className="flex items-center gap-2">
                                    {isExpanded ? <ChevronDown size={16} className="text-gray-500" /> : <ChevronRight size={16} className="text-gray-500" />}
                                    <span className="text-sm font-semibold text-gray-700">{t('groupName', { name: groupId })}</span>
                                    <span className="px-2 py-0.5 bg-gray-200 text-gray-600 text-xs rounded-full">{t('partitionsCount', { count: groupOffsets.length })}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-xs text-gray-500 uppercase font-medium">{t('totalLag')}</span>
                                    <span className={`text-sm font-mono font-bold ${totalLag > 1000 ? 'text-rose-600' : 'text-emerald-600'}`}>
                                        {totalLag.toLocaleString()}
                                    </span>
                                    {totalLag > 1000 && <AlertTriangle size={14} className="text-rose-500" />}
                                </div>
                            </div>

                            {isExpanded && (
                                <table className="min-w-full divide-y divide-gray-100">
                                    <thead className="bg-white">
                                        <tr>
                                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-400 uppercase">{t('partition')}</th>
                                            <th className="px-4 py-2 text-right text-xs font-medium text-gray-400 uppercase">{t('currentOffset')}</th>
                                            <th className="px-4 py-2 text-right text-xs font-medium text-gray-400 uppercase">{t('logEndOffset')}</th>
                                            <th className="px-4 py-2 text-right text-xs font-medium text-gray-400 uppercase">{t('lag')}</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50">
                                        {groupOffsets.map((offset, idx) => (
                                            <tr key={idx} className="hover:bg-gray-50">
                                                <td className="px-4 py-2 text-xs text-gray-600 font-mono">
                                                    Partition-{offset.partition}
                                                </td>
                                                <td className="px-4 py-2 text-right text-xs text-gray-600 font-mono">
                                                    {offset.committed_offset.toLocaleString()}
                                                </td>
                                                <td className="px-4 py-2 text-right text-xs text-gray-600 font-mono">
                                                    {offset.latest_offset.toLocaleString()}
                                                </td>
                                                <td className="px-4 py-2 text-right text-xs font-mono font-medium">
                                                    <span className={offset.lag > 100 ? 'text-amber-600' : 'text-gray-400'}>
                                                        {offset.lag.toLocaleString()}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    );
                })
            )}
        </div>
    );
};

export default ConsumerOffsetsView;
