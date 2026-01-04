import { ComponentType, Status, ESCluster, KafkaCluster, ClickHouseCluster, AnyCluster, ESIndex, IndexMetadata, KafkaTopic, KafkaConsumerOffset, KafkaMessage } from '../types';

// NOTE: esClusters removed. ES data is now fully dynamic via API.

export const kafkaClusters: KafkaCluster[] = [
  {
    id: 'kf-prod-events',
    name: 'Global-Events-Stream',
    type: ComponentType.KAFKA,
    host: '10.0.5.10',
    port: 9092,
    version: '3.6.0',
    status: Status.RUNNING,
    uptime: '120d 1h',
    region: 'us-east-1',
    brokerCount: 9,
    topicCount: 230,
    partitionCount: 1200,
    controllerType: 'KRaft'
  },
  {
    id: 'kf-staging',
    name: 'Staging-Stream',
    type: ComponentType.KAFKA,
    host: '10.0.5.55',
    port: 9092,
    version: '3.5.1',
    status: Status.STOPPED,
    uptime: '0m',
    region: 'us-east-1',
    brokerCount: 3,
    topicCount: 45,
    partitionCount: 120,
    controllerType: 'ZooKeeper'
  }
];

export const clickHouseClusters: ClickHouseCluster[] = [
  {
    id: 'ch-dw-main',
    name: 'Main-DataWarehouse',
    type: ComponentType.CLICKHOUSE,
    host: '10.0.8.100',
    port: 8123,
    version: '23.8.2.7',
    status: Status.RUNNING,
    uptime: '89d 6h',
    region: 'eu-central-1',
    shardCount: 4,
    replicaCount: 2,
    databaseCount: 12,
    rowsReadPerSec: 15000000
  },
  {
    id: 'ch-metrics',
    name: 'App-Metrics-Store',
    type: ComponentType.CLICKHOUSE,
    host: '10.0.8.102',
    port: 8123,
    version: '24.1.1.5',
    status: Status.RUNNING,
    uptime: '12d 22h',
    region: 'us-east-1',
    shardCount: 2,
    replicaCount: 1,
    databaseCount: 4,
    rowsReadPerSec: 250000
  }
];

// Helper to get any cluster by ID (Note: Only looks in static mock lists for Kafka/ClickHouse now)
export const getClusterById = (id: string): AnyCluster | undefined => {
  return [...kafkaClusters, ...clickHouseClusters].find(c => c.id === id);
};

// --- FACTORY FOR NEW CLUSTERS ---
export const createMockCluster = (
  basicInfo: { name: string; host: string; port: number; version: string; type: ComponentType }
): AnyCluster => {
  const base = {
    id: `${basicInfo.type.toLowerCase().substring(0, 2)}-${Math.random().toString(36).substr(2, 6)}`,
    ...basicInfo,
    status: Status.RUNNING,
    uptime: '0m',
    region: 'us-east-1' // Default
  };

  switch (basicInfo.type) {
    case ComponentType.ELASTICSEARCH:
      return {
        ...base,
        type: ComponentType.ELASTICSEARCH,
        nodeCount: Math.floor(Math.random() * 5) + 1,
        shardCount: Math.floor(Math.random() * 100),
        indexCount: Math.floor(Math.random() * 20),
        health: 'green'
      } as ESCluster;
    case ComponentType.KAFKA:
      return {
        ...base,
        type: ComponentType.KAFKA,
        brokerCount: Math.floor(Math.random() * 3) + 1,
        topicCount: 0,
        partitionCount: 0,
        controllerType: 'KRaft'
      } as KafkaCluster;
    case ComponentType.CLICKHOUSE:
      return {
        ...base,
        type: ComponentType.CLICKHOUSE,
        shardCount: 2,
        replicaCount: 1,
        databaseCount: 2,
        rowsReadPerSec: 0
      } as ClickHouseCluster;
    default:
      throw new Error("Unknown type");
  }
};


// --- ELASTICSEARCH MOCK DATA ---

const mockIndicesMap: Record<string, ESIndex[]> = {
  // Kept for fallback testing if needed, though app primarily uses API now
  'es-prod-01': [
    { name: 'logs-2024-03-01', health: 'green', status: 'open', primaryShards: 1, replicaShards: 1, docsCount: 1542000, storeSize: '1.2 GB' },
    { name: 'logs-2024-03-02', health: 'green', status: 'open', primaryShards: 1, replicaShards: 1, docsCount: 2100500, storeSize: '1.8 GB' },
    { name: 'app-metrics-v1', health: 'green', status: 'open', primaryShards: 5, replicaShards: 1, docsCount: 45000000, storeSize: '45 GB' },
  ]
};

export const getIndicesForCluster = (clusterId: string): ESIndex[] => {
  return mockIndicesMap[clusterId] || [];
};

export const getIndexMetadata = (clusterId: string, indexName: string): IndexMetadata => {
  const isProd = clusterId.includes('prod');
  
  return {
    settings: {
      "index": {
        "number_of_shards": isProd ? "5" : "1",
        "number_of_replicas": isProd ? "1" : "0",
        "refresh_interval": "1s",
        "translog.durability": "request",
        "max_result_window": isProd ? 50000 : 10000
      }
    },
    mappings: {
      "properties": {
        "@timestamp": { "type": "date" },
        "level": { "type": "keyword" },
        "message": { "type": "text", "analyzer": "standard" },
        "service": { "type": "keyword" },
        ...(isProd ? { "host_ip": { "type": "ip" } } : { "host_ip": { "type": "keyword" } }),
        "request_id": { "type": "keyword" }
      }
    }
  };
};

// --- KAFKA MOCK DATA ---

const mockKafkaTopics: Record<string, KafkaTopic[]> = {
  'kf-prod-events': [
    { name: 'orders.payment.v1', partitionCount: 12, replicationFactor: 3, retentionBytes: '100 GB', cleanupPolicy: 'delete', isrPercentage: 100 },
    { name: 'orders.shipping.v1', partitionCount: 12, replicationFactor: 3, retentionBytes: '100 GB', cleanupPolicy: 'delete', isrPercentage: 100 },
    { name: 'users.signup', partitionCount: 6, replicationFactor: 3, retentionBytes: '50 GB', cleanupPolicy: 'delete', isrPercentage: 98 },
    { name: 'clickstream.mobile', partitionCount: 24, replicationFactor: 2, retentionBytes: '500 GB', cleanupPolicy: 'delete', isrPercentage: 100 },
    { name: 'config.global', partitionCount: 1, replicationFactor: 3, retentionBytes: '-1', cleanupPolicy: 'compact', isrPercentage: 100 },
    { name: 'fraud.alerts', partitionCount: 3, replicationFactor: 3, retentionBytes: '1 GB', cleanupPolicy: 'delete', isrPercentage: 66 },
  ],
  'kf-staging': [
    { name: 'test-topic-a', partitionCount: 3, replicationFactor: 1, retentionBytes: '1 GB', cleanupPolicy: 'delete', isrPercentage: 100 },
    { name: 'dev.logs', partitionCount: 1, replicationFactor: 1, retentionBytes: '5 GB', cleanupPolicy: 'delete', isrPercentage: 100 },
  ]
};

export const getKafkaTopics = (clusterId: string): KafkaTopic[] => {
  return mockKafkaTopics[clusterId] || [];
};

export const getKafkaConsumerOffsets = (clusterId: string, topicName: string): KafkaConsumerOffset[] => {
  const count = 3; // Mocking 3 partitions per topic for this view
  const offsets: KafkaConsumerOffset[] = [];
  
  const groups = ['warehouse-syncer-group', 'audit-logger-group'];
  
  if (topicName === 'fraud.alerts') {
    // Simulate lag for this topic
    groups.push('realtime-fraud-detector');
    groups.forEach(group => {
      for (let i = 0; i < 3; i++) {
        const logEnd = 50000 + Math.floor(Math.random() * 1000);
        const lag = group === 'realtime-fraud-detector' ? Math.floor(Math.random() * 5000) : Math.floor(Math.random() * 10);
        
        offsets.push({
          groupId: group,
          topic: topicName,
          partitionId: i,
          logEndOffset: logEnd,
          currentOffset: logEnd - lag,
          lag: lag,
          clientId: `${group}-client-${i}`
        });
      }
    });
  } else {
     // Normal healthy offsets
    groups.forEach(group => {
      for (let i = 0; i < 3; i++) {
        const logEnd = 1200000 + Math.floor(Math.random() * 5000);
        const lag = Math.floor(Math.random() * 5); // very low lag
        
        offsets.push({
          groupId: group,
          topic: topicName,
          partitionId: i,
          logEndOffset: logEnd,
          currentOffset: logEnd - lag,
          lag: lag,
          clientId: `${group}-client-${i}`
        });
      }
    });
  }

  return offsets;
};

// Fetch Kafka messages mock
export const fetchKafkaMessages = (
  topicName: string, 
  filter: { 
    type: 'offset' | 'time' | 'smart', 
    start?: number | string, 
    end?: number | string, 
    partition: number,
    smartConfig?: {
      position: 'latest' | 'earliest',
      limit: number // -1 for no limit
    }
  }
): KafkaMessage[] => {
  const messages: KafkaMessage[] = [];
  
  // Determine count
  let count = 20; 
  if (filter.type === 'smart' && filter.smartConfig) {
    if (filter.smartConfig.limit === -1) {
      count = 500; // Mock "No limit" as a large page for performance
    } else {
      count = filter.smartConfig.limit;
    }
  }

  // Determine offsets
  const MAX_OFFSET = 150000; // Mock current end offset
  let startOffset = 0;
  let startTime = Date.now();

  if (filter.type === 'offset') {
    startOffset = Number(filter.start || 0);
    startTime = Date.now() - 3600000;
  } else if (filter.type === 'time') {
    startTime = new Date(filter.start as string).getTime();
    startOffset = 50000;
  } else if (filter.type === 'smart' && filter.smartConfig) {
    if (filter.smartConfig.position === 'latest') {
      startOffset = Math.max(0, MAX_OFFSET - count);
      startTime = Date.now() - (count * 1000); // approximate timestamps
    } else {
      // Earliest
      startOffset = 0;
      startTime = Date.now() - (MAX_OFFSET * 1000);
    }
  }

  // Generate Messages
  for (let i = 0; i < count; i++) {
    const currentOffset = startOffset + i;
    
    // Safety break for mock
    if (filter.type === 'offset' && filter.end && currentOffset > Number(filter.end)) break;

    messages.push({
      partition: filter.partition,
      offset: currentOffset,
      timestamp: new Date(startTime + (i * 1000)).toISOString(),
      key: i % 5 === 0 ? `key-${i}` : null,
      value: `{"event": "test_event", "id": "${currentOffset}", "data": "sample payload data for ${topicName}", "mode": "${filter.type}"}`,
      headers: { "trace-id": `tr-${Math.random().toString(36).substring(7)}` }
    });
  }

  return messages;
};