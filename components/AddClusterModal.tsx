import React, { useState, useEffect } from 'react';
import { X, Server, Loader2, CheckCircle, Shield, Globe, Tag, MapPin, Edit } from 'lucide-react';
import { ComponentType, AnyCluster, Status, ESCluster, KafkaCluster, ClickHouseCluster } from '../types';
import { addCluster, updateCluster, addKafkaCluster, updateKafkaCluster } from '../services/api';

interface AddClusterModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: ComponentType;
  onAdd: (cluster: AnyCluster) => void;
  clusterToEdit?: AnyCluster; // If present, modal is in Edit mode
}

const AddClusterModal: React.FC<AddClusterModalProps> = ({ isOpen, onClose, type, onAdd, clusterToEdit }) => {
  const isEditMode = !!clusterToEdit;

  const [formData, setFormData] = useState({
    name: '',
    host: '',
    port: '',
    username: '',
    password: '',
    region: 'cn-shanghai'
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Reset or Populate form on open
  useEffect(() => {
    if (isOpen) {
      setErrorMsg('');
      setSuccess(false);

      if (isEditMode && clusterToEdit) {
        // Edit Mode: Pre-fill
        setFormData({
          name: clusterToEdit.name,
          host: clusterToEdit.host,
          port: clusterToEdit.port.toString(),
          username: '', // Do not pre-fill sensitive data if not provided in cluster object
          password: '',
          region: clusterToEdit.region || 'cn-shanghai'
        });
      } else {
        // Add Mode: Defaults
        let defaultPort = '9200';
        if (type === ComponentType.KAFKA) defaultPort = '9092';
        if (type === ComponentType.CLICKHOUSE) defaultPort = '8123';

        setFormData({
          name: '',
          host: '',
          port: defaultPort,
          username: '',
          password: '',
          region: 'cn-shanghai'
        });
      }
    }
  }, [isOpen, type, isEditMode, clusterToEdit]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.host || !formData.port) return;

    setIsSubmitting(true);
    setErrorMsg('');

    try {
      // Branch logic based on Component Type
      let result;
      let updatedCluster: AnyCluster | null = null;

      if (type === ComponentType.KAFKA) {
        // Special case for Kafka (different API signature)
        const bootstrapServers = `${formData.host}:${formData.port}`;

        let kafkaResult;
        if (isEditMode && clusterToEdit) {
          kafkaResult = await updateKafkaCluster(clusterToEdit.id, formData.name, bootstrapServers);
        } else {
          kafkaResult = await addKafkaCluster(formData.name, bootstrapServers);
        }

        if (kafkaResult) {
          // Manually construct KafkaCluster from backend response
          // Logic mirrored from fetchKafkaClusters in api.ts to keep consistency
          let displayHost = formData.host;
          let displayPort = parseInt(formData.port);

          updatedCluster = {
            id: kafkaResult.cluster_id || (kafkaResult as any).id || kafkaResult.name,
            name: kafkaResult.name,
            type: ComponentType.KAFKA,
            host: displayHost,
            port: displayPort,
            version: 'Unknown',
            status: Status.RUNNING,
            uptime: clusterToEdit?.uptime || '0m',
            region: 'default',
            brokerCount: (clusterToEdit as KafkaCluster)?.brokerCount || 0,
            topicCount: (clusterToEdit as KafkaCluster)?.topicCount || 0,
            partitionCount: (clusterToEdit as KafkaCluster)?.partitionCount || 0,
            controllerType: (clusterToEdit as KafkaCluster)?.controllerType || 'KRaft'
          } as KafkaCluster;
          result = kafkaResult;
        }
      } else {
        // Generic logic for ES / ClickHouse / Updates
        const payload = {
          name: formData.name,
          host: formData.host,
          port: parseInt(formData.port),
          username: formData.username,
          password: formData.password,
          region: formData.region
        };

        if (isEditMode && clusterToEdit) {
          result = await updateCluster(clusterToEdit.id, payload);
        } else {
          result = await addCluster(payload);
        }

        if (result) {
          const baseProps = {
            id: result.id,
            name: result.name,
            host: result.host,
            port: result.port,
            version: clusterToEdit?.version || 'Unknown',
            status: clusterToEdit?.status || Status.RUNNING,
            uptime: clusterToEdit?.uptime || '0m',
            region: result.region || formData.region
          };

          if (type === ComponentType.ELASTICSEARCH) {
            updatedCluster = {
              ...baseProps,
              type: ComponentType.ELASTICSEARCH,
              nodeCount: (clusterToEdit as ESCluster)?.nodeCount || 3,
              shardCount: (clusterToEdit as ESCluster)?.shardCount || 0,
              indexCount: (clusterToEdit as ESCluster)?.indexCount || 0,
              health: (clusterToEdit as ESCluster)?.health || 'green'
            } as ESCluster;
          } else if (type === ComponentType.KAFKA) {
            // Logic for Kafka UPDATE (if it falls here in future)
            updatedCluster = {
              ...baseProps,
              type: ComponentType.KAFKA,
              brokerCount: (clusterToEdit as KafkaCluster)?.brokerCount || 1,
              topicCount: (clusterToEdit as KafkaCluster)?.topicCount || 0,
              partitionCount: (clusterToEdit as KafkaCluster)?.partitionCount || 0,
              controllerType: (clusterToEdit as KafkaCluster)?.controllerType || 'KRaft'
            } as KafkaCluster;
          } else {
            updatedCluster = {
              ...baseProps,
              type: ComponentType.CLICKHOUSE,
              shardCount: (clusterToEdit as ClickHouseCluster)?.shardCount || 1,
              replicaCount: (clusterToEdit as ClickHouseCluster)?.replicaCount || 1,
              databaseCount: (clusterToEdit as ClickHouseCluster)?.databaseCount || 0,
              rowsReadPerSec: (clusterToEdit as ClickHouseCluster)?.rowsReadPerSec || 0
            } as ClickHouseCluster;
          }
        }
      }

      if (result && updatedCluster) {
        onAdd(updatedCluster);
        setSuccess(true);

        setTimeout(() => {
          setIsSubmitting(false);
          onClose();
        }, 1000);
      } else {
        setErrorMsg(`Failed to ${isEditMode ? 'update' : 'add'} cluster. Backend returned error.`);
        setIsSubmitting(false);
      }
    } catch (err) {
      console.error(err);
      setErrorMsg('An unexpected error occurred.');
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
            <div className={`p-2 rounded-lg ${type === ComponentType.ELASTICSEARCH ? 'bg-blue-100 text-blue-600' :
              type === ComponentType.KAFKA ? 'bg-purple-100 text-purple-600' : 'bg-yellow-100 text-yellow-600'
              }`}>
              {isEditMode ? <Edit size={20} /> : <Server size={20} />}
            </div>
            <div>
              <h3 className="font-bold text-gray-800">{isEditMode ? 'Edit Cluster' : `Add ${type} Cluster`}</h3>
              <p className="text-xs text-gray-500">{isEditMode ? 'Update connection details' : 'Connect a new resource'}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {success ? (
            <div className="flex flex-col items-center justify-center py-8 text-center animate-in fade-in">
              <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-4">
                <CheckCircle size={32} />
              </div>
              <h3 className="text-xl font-bold text-gray-900">Success!</h3>
              <p className="text-gray-500 mt-2">
                Cluster <b>{formData.name}</b> has been {isEditMode ? 'updated' : 'added'}.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">

              {errorMsg && (
                <div className="p-3 bg-rose-50 border border-rose-100 text-rose-600 text-sm rounded-lg mb-4">
                  {errorMsg}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Cluster Name</label>
                <div className="relative">
                  <Tag className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    placeholder="e.g. yanggu-cluster"
                    className="w-full pl-9 pr-3 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">
                    {type === ComponentType.KAFKA ? 'Bootstrap Servers (First Seed Host)' : 'Host / IP'}
                  </label>
                  <div className="relative">
                    <Globe className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                    <input
                      type="text"
                      name="host"
                      value={formData.host}
                      onChange={handleChange}
                      placeholder={type === ComponentType.KAFKA ? "kafka01" : "es01"}
                      className="w-full pl-9 pr-3 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Port</label>
                  <input
                    type="number"
                    name="port"
                    value={formData.port}
                    onChange={handleChange}
                    className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                    required
                  />
                </div>
              </div>

              {type !== ComponentType.KAFKA && (
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Region</label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                    <input
                      type="text"
                      name="region"
                      value={formData.region}
                      onChange={handleChange}
                      placeholder="cn-shanghai"
                      className="w-full pl-9 pr-3 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                  </div>
                </div>
              )}

              {type !== ComponentType.KAFKA && (
                <div className="pt-2 border-t border-gray-100 mt-2">
                  <p className="text-xs font-medium text-gray-500 mb-3 flex items-center gap-1">
                    <Shield size={12} /> Authentication {isEditMode && <span className="text-gray-400 font-normal">(Leave blank to keep unchanged)</span>}
                  </p>
                  <div className="grid grid-cols-2 gap-4">
                    <input
                      type="text"
                      name="username"
                      value={formData.username}
                      onChange={handleChange}
                      placeholder="Username"
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                    <input
                      type="password"
                      name="password"
                      value={formData.password}
                      onChange={handleChange}
                      placeholder="Password"
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                  </div>
                </div>
              )}

              <div className="pt-4 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center gap-2 px-6 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition-all"
                >
                  {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : isEditMode ? <Edit size={16} /> : <Server size={16} />}
                  {isSubmitting ? 'Saving...' : isEditMode ? 'Update Cluster' : 'Add Cluster'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default AddClusterModal;