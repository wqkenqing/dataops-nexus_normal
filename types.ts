export enum ComponentType {
  ELASTICSEARCH = 'Elasticsearch',
  KAFKA = 'Kafka',
  CLICKHOUSE = 'ClickHouse',
  UNKNOWN = 'Unknown'
}

export enum Status {
  RUNNING = 'Running',
  STOPPED = 'Stopped',
  DEGRADED = 'Degraded',
  MAINTENANCE = 'Maintenance'
}

export interface BaseCluster {
  id: string;
  name: string;
  host: string;
  port: number;
  version: string;
  status: Status;
  uptime: string;
  region: string;
}

export interface ESCluster extends BaseCluster {
  type: ComponentType.ELASTICSEARCH;
  nodeCount: number;
  shardCount: number;
  indexCount: number;
  health: 'green' | 'yellow' | 'red';
}

export interface KafkaCluster extends BaseCluster {
  type: ComponentType.KAFKA;
  brokerCount: number;
  topicCount: number;
  partitionCount: number;
  controllerType: 'ZooKeeper' | 'KRaft';
}

export interface ClickHouseCluster extends BaseCluster {
  type: ComponentType.CLICKHOUSE;
  shardCount: number;
  replicaCount: number;
  databaseCount: number;
  rowsReadPerSec: number;
}

export type AnyCluster = ESCluster | KafkaCluster | ClickHouseCluster;

// Elasticsearch Specifics
export interface ESIndex {
  name: string;
  health: 'green' | 'yellow' | 'red';
  status: 'open' | 'close';
  primaryShards: number;
  replicaShards: number;
  docsCount: number;
  storeSize: string;
}

export interface IndexMetadata {
  settings: Record<string, any>;
  mappings: Record<string, any>;
}

export interface BackendESIndex {
  health: 'green' | 'yellow' | 'red';
  index: string; // Backend uses 'index' instead of 'name'
  status: string;
  docs_count: string;
  store_size: string;
  shards?: string;
}

export interface BackendSyncResultItem {
  index: string;
  status: string; // "exists", "success", "running", "failed", etc.
  sync_settings?: boolean;
  sync_mappings?: boolean;
  sync_data?: boolean;
  docs_synced?: number;
  total_docs?: number;
  totalDocs?: number;
  syncedDocs?: number;
  progress?: number;
}

export interface BackendSyncTask {
  id: string;
  source: string; // Cluster ID
  target: string; // Cluster ID
  payload: {
    indices: string[];
    sync_settings: boolean;
    sync_mappings: boolean;
    sync_data: boolean;
  };
  status: string; // "success", "failed", "running", "SUCCESS", "FAILED", "RUNNING"
  result: BackendSyncResultItem[] | null;
  message: string | null;
  // Compatibility for different backend field namings
  created?: string | number;
  created_at?: string | number;
  createdAt?: string | number;
  updatedAt?: string | number;
  total_docs?: number;
  docs_synced?: number;
  totalDocs?: number;
  syncedDocs?: number;
  progress?: number;
  totalIndices?: number;
  completedIndices?: number;
}

// Kafka Specifics
export interface KafkaTopic {
  name: string;
  partitionCount: number;
  replicationFactor: number;
  messageCount: number; // Added
  sizeBytes: number;    // Added
  retentionBytes: string;
  cleanupPolicy: 'delete' | 'compact';
  isrPercentage: number; // In-Sync Replicas %
}

export interface KafkaConsumerOffset {
  group: string; // Changed from groupId
  topic?: string; // Optional, as API might not return it in the list if context is already topic
  partition: number; // Changed from partitionId
  committed_offset: number; // Changed from currentOffset
  latest_offset: number; // Changed from logEndOffset
  lag: number;
  clientId?: string; // Optional/Missing in new response
}

export interface KafkaMessage {
  partition: number;
  offset: number;
  timestamp: string;
  key: string | null;
  value: string;
  headers?: Record<string, string>;
}

export interface KafkaMessageFetchParams {
  mode: 'smart' | 'offset_range' | 'time_range' | 'earliest' | 'latest';
  limit?: number;
  start_offset?: number;
  end_offset?: number;
  start?: number; // timestamp in ms
  end?: number;   // timestamp in ms
  partition?: number;
}

export interface NavItem {
  id: string;
  label: string;
  path?: string;
  icon?: any;
  color?: string; // Tailwind color class for dots
  children?: NavItem[];
}