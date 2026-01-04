import React, { useState } from 'react';
import { X, Plus, Loader2, CheckCircle, HardDrive } from 'lucide-react';
import { KafkaCluster } from '../types';
import { createKafkaTopics } from '../services/api';
import { useTranslation } from 'react-i18next';

interface KafkaBatchCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  cluster: KafkaCluster;
  onSuccess?: () => void;
}

const KafkaBatchCreateModal: React.FC<KafkaBatchCreateModalProps> = ({ isOpen, onClose, cluster, onSuccess }) => {
  const { t } = useTranslation();
  const [topicNames, setTopicNames] = useState('');
  const [partitions, setPartitions] = useState(3);
  const [replication, setReplication] = useState(3);
  const [cleanupPolicy, setCleanupPolicy] = useState<'delete' | 'compact'>('delete');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async () => {
    if (!topicNames.trim()) return;

    setIsSubmitting(true);
    setErrorMsg('');

    // Pre-process topics input: comma separated string
    const cleanedTopics = topicNames
      .split('\n')
      .map(t => t.trim())
      .filter(t => t.length > 0)
      .join(',');

    try {
      const result = await createKafkaTopics(cluster.id, {
        topics: cleanedTopics,
        partitions: partitions,
        replication_factor: replication,
        cleanup_policy: cleanupPolicy
      });

      if (result) {
        setSuccess(true);
        if (onSuccess) onSuccess();

        // Reset after showing success
        setTimeout(() => {
          setSuccess(false);
          setIsSubmitting(false);
          onClose();
          setTopicNames('');
        }, 1500);
      } else {
        setErrorMsg(t('batchCreateFailed'));
        setIsSubmitting(false);
      }
    } catch (e) {
      console.error(e);
      setErrorMsg(t('unexpectedError'));
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
          <div className="flex items-center gap-2">
            <div className="bg-purple-100 p-2 rounded-lg text-purple-600">
              <HardDrive size={20} />
            </div>
            <div>
              <h3 className="font-bold text-gray-800">{t('batchCreateTopics')}</h3>
              <p className="text-xs text-gray-500">{t('clusterLabel', { name: cluster.name })}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {success ? (
            <div className="flex flex-col items-center justify-center py-8 text-center animate-in fade-in">
              <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-4">
                <CheckCircle size={32} />
              </div>
              <h3 className="text-xl font-bold text-gray-900">{t('topicsCreatedTitle')}</h3>
              <p className="text-gray-500 mt-2">{t('topicsCreatedDesc')}</p>
            </div>
          ) : (
            <>
              {errorMsg && (
                <div className="p-3 bg-rose-50 border border-rose-100 text-rose-600 text-sm rounded-lg">
                  {errorMsg}
                </div>
              )}

              {/* Topic Names Input */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  {t('topicNamesLabel')} <span className="text-gray-400 font-normal">{t('onePerLine')}</span>
                </label>
                <textarea
                  value={topicNames}
                  onChange={(e) => setTopicNames(e.target.value)}
                  placeholder={`orders.events.v1\npayments.processed\nusers.registrations`}
                  className="w-full h-32 px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none resize-none"
                />
              </div>

              {/* Configurations */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">{t('partitions')}</label>
                  <input
                    type="number"
                    min="1"
                    value={partitions}
                    onChange={(e) => setPartitions(parseInt(e.target.value))}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">{t('replicationFactor')}</label>
                  <input
                    type="number"
                    min="1"
                    value={replication}
                    onChange={(e) => setReplication(parseInt(e.target.value))}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-2">{t('cleanupPolicy')}</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="cleanup"
                      checked={cleanupPolicy === 'delete'}
                      onChange={() => setCleanupPolicy('delete')}
                      className="text-purple-600 focus:ring-purple-500"
                    />
                    <span className="text-sm text-gray-700">{t('deletePolicy')}</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="cleanup"
                      checked={cleanupPolicy === 'compact'}
                      onChange={() => setCleanupPolicy('compact')}
                      className="text-purple-600 focus:ring-purple-500"
                    />
                    <span className="text-sm text-gray-700">{t('compactPolicy')}</span>
                  </label>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        {!success && (
          <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-3">
            <button
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
            >
              {t('cancel')}
            </button>
            <button
              onClick={handleSubmit}
              disabled={isSubmitting || !topicNames.trim()}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-lg shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
              {isSubmitting ? t('creating') : t('createTopicsButton')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default KafkaBatchCreateModal;