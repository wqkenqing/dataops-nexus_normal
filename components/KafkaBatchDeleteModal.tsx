import React, { useState, useEffect, useMemo } from 'react';
import { X, Search, Trash2, AlertTriangle, CheckSquare, Square, Loader2 } from 'lucide-react';
import { fetchKafkaTopics, deleteKafkaTopics } from '../services/api';
import { KafkaTopic } from '../types';
import { useTranslation } from 'react-i18next';

interface KafkaBatchDeleteModalProps {
    isOpen: boolean;
    onClose: () => void;
    clusterId: string;
    onSuccess: () => void;
}

const KafkaBatchDeleteModal: React.FC<KafkaBatchDeleteModalProps> = ({
    isOpen,
    onClose,
    clusterId,
    onSuccess
}) => {
    const { t } = useTranslation();
    const [topics, setTopics] = useState<KafkaTopic[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedTopics, setSelectedTopics] = useState<Set<string>>(new Set());
    const [confirmDelete, setConfirmDelete] = useState(false);

    useEffect(() => {
        if (isOpen && clusterId) {
            loadTopics();
            setSelectedTopics(new Set()); // Reset selection
            setConfirmDelete(false); // Reset confirmation state
            setSearchTerm(''); // Reset search
        }
    }, [isOpen, clusterId]);

    const loadTopics = async () => {
        setIsLoading(true);
        try {
            const data = await fetchKafkaTopics(clusterId);
            setTopics(Array.isArray(data) ? data : []);
        } catch (e) {
            console.error("Failed to load topics", e);
        } finally {
            setIsLoading(false);
        }
    };

    const filteredTopics = useMemo(() => {
        if (!searchTerm) return topics;
        return topics.filter(t => t.name.toLowerCase().includes(searchTerm.toLowerCase()));
    }, [topics, searchTerm]);

    const toggleSelect = (topicName: string) => {
        const newSelected = new Set(selectedTopics);
        if (newSelected.has(topicName)) {
            newSelected.delete(topicName);
        } else {
            newSelected.add(topicName);
        }
        setSelectedTopics(newSelected);
    };

    const toggleSelectAll = () => {
        if (filteredTopics.length === 0) return;

        // Check if all filtered are currently selected
        const allFilteredSelected = filteredTopics.every(t => selectedTopics.has(t.name));

        const newSelected = new Set(selectedTopics);
        if (allFilteredSelected) {
            // Deselect all filtered
            filteredTopics.forEach(t => newSelected.delete(t.name));
        } else {
            // Select all filtered
            filteredTopics.forEach(t => newSelected.add(t.name));
        }
        setSelectedTopics(newSelected);
    };

    const handleDelete = async () => {
        if (selectedTopics.size === 0) return;

        setIsDeleting(true);
        try {
            const topicsToDelete = Array.from(selectedTopics) as string[];
            const success = await deleteKafkaTopics(clusterId, topicsToDelete);
            if (success) {
                onSuccess();
                onClose();
            } else {
                alert(t('batchDeleteFailed'));
            }
        } catch (e) {
            console.error("Failed to delete topics", e);
            alert(t('batchDeleteError'));
        } finally {
            setIsDeleting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-100">
                    <div>
                        <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                            <Trash2 className="text-rose-500" size={24} />
                            {t('batchDeleteTopicsTitle')}
                        </h2>
                        <p className="text-sm text-gray-500 mt-1">
                            {t('batchDeleteTopicsDesc')}
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-500">
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-hidden flex flex-col p-6 space-y-4">

                    {/* Warning */}
                    <div className="bg-rose-50 border border-rose-100 rounded-lg p-4 flex items-start gap-3">
                        <AlertTriangle className="text-rose-600 flex-shrink-0 mt-0.5" size={18} />
                        <div className="text-sm text-rose-800">
                            <p className="font-semibold">{t('warningDestructiveAction')}</p>
                            <p className="mt-1">{t('warningDestructiveActionDesc')}</p>
                        </div>
                    </div>

                    {/* Search */}
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        <input
                            type="text"
                            placeholder={t('filterTopics')}
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-rose-500 focus:bg-white outline-none transition-all"
                        />
                    </div>

                    {/* Table Header - Select All */}
                    <div className="flex items-center justify-between pb-2 border-b border-gray-200">
                        <button
                            onClick={toggleSelectAll}
                            className="flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-gray-900"
                        >
                            {filteredTopics.length > 0 && filteredTopics.every(t => selectedTopics.has(t.name)) ? (
                                <CheckSquare size={18} className="text-rose-600" />
                            ) : (
                                <Square size={18} className="text-gray-400" />
                            )}
                            {t('selectAllFiltered')} ({filteredTopics.length})
                        </button>
                        <span className="text-sm text-gray-500">
                            {t('selectedCount', { count: selectedTopics.size })}
                        </span>
                    </div>

                    {/* List */}
                    <div className="flex-1 overflow-y-auto border border-gray-200 rounded-lg divide-y divide-gray-100 bg-gray-50/30">
                        {isLoading ? (
                            <div className="flex justify-center items-center py-12">
                                <Loader2 className="animate-spin text-rose-500" size={24} />
                            </div>
                        ) : filteredTopics.length === 0 ? (
                            <div className="p-8 text-center text-gray-500">
                                {t('noTopicsFound')}
                            </div>
                        ) : (
                            filteredTopics.map(topic => {
                                const isSelected = selectedTopics.has(topic.name);
                                return (
                                    <div
                                        key={topic.name}
                                        onClick={() => toggleSelect(topic.name)}
                                        className={`flex items-center p-3 hover:bg-white cursor-pointer transition-colors ${isSelected ? 'bg-rose-50/50' : ''}`}
                                    >
                                        <div className="flex-shrink-0 mr-3 text-rose-600">
                                            {isSelected ? <CheckSquare size={18} /> : <Square size={18} className="text-gray-400" />}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className={`text-sm font-medium truncate ${isSelected ? 'text-rose-900' : 'text-gray-900'}`}>
                                                {topic.name}
                                            </p>
                                            <p className="text-xs text-gray-500 flex gap-2">
                                                <span>{t('partitions')}: {topic.partitionCount}</span>
                                                <span>•</span>
                                                <span>{t('replication')}: {topic.replicationFactor}</span>
                                            </p>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>

                </div>

                {/* Footer */}
                <div className="p-6 border-t border-gray-100 bg-gray-50/50 rounded-b-xl flex flex-col space-y-4">

                    {selectedTopics.size > 0 && (
                        <div className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                id="confirmDelete"
                                checked={confirmDelete}
                                onChange={(e) => setConfirmDelete(e.target.checked)}
                                className="rounded text-rose-600 focus:ring-rose-500 border-gray-300 w-4 h-4 cursor-pointer"
                            />
                            <label htmlFor="confirmDelete" className="text-sm text-gray-700 cursor-pointer select-none">
                                {t('confirmBatchDeleteCheckbox', { count: selectedTopics.size })}
                            </label>
                        </div>
                    )}

                    <div className="flex justify-end gap-3">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 text-gray-700 font-medium hover:bg-gray-100 rounded-lg transition-colors"
                            disabled={isDeleting}
                        >
                            {t('cancel')}
                        </button>
                        <button
                            onClick={handleDelete}
                            disabled={selectedTopics.size === 0 || !confirmDelete || isDeleting}
                            className={`flex items-center gap-2 px-6 py-2 rounded-lg text-white font-medium shadow-sm transition-all
                ${selectedTopics.size === 0 || !confirmDelete || isDeleting
                                    ? 'bg-gray-300 cursor-not-allowed'
                                    : 'bg-rose-600 hover:bg-rose-700 hover:shadow shadow-rose-200'
                                }`}
                        >
                            {isDeleting ? <Loader2 size={18} className="animate-spin" /> : <Trash2 size={18} />}
                            {isDeleting ? t('deleting') : t('deleteCountTopics', { count: selectedTopics.size || '' })}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default KafkaBatchDeleteModal;
