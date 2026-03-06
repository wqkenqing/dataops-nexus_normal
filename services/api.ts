import { ESCluster, ESIndex, ComponentType, Status, IndexMetadata, KafkaCluster, KafkaTopic, KafkaConsumerOffset, KafkaMessage, KafkaMessageFetchParams, BackendESIndex, BackendSyncResultItem, BackendSyncTask } from '../types';

export type BackendType = 'python' | 'java';

const getSavedBackend = (): BackendType => {
  if (typeof window !== 'undefined' && window.localStorage) {
    const saved = localStorage.getItem('backendType');
    if (saved === 'java' || saved === 'python') {
      return saved;
    }
  }
  return 'java'; // Default
};

// Application Environment Variables (Runtime takes precedence over Build-time)
const getEnvConfig = () => {
  if (typeof window !== 'undefined' && (window as any)._env_) {
    return (window as any)._env_;
  }
  return import.meta.env;
};

// Determine base URL dynamically. If in a browser environment, use the current host.
const getHost = () => {
  if (typeof window !== 'undefined') {
    return window.location.hostname;
  }
  return '127.0.0.1';
};

// Initialize URL based on saved type
const getApiBaseUrl = (type: BackendType) => {
  const env = getEnvConfig();
  const host = getHost();
  if (type === 'java') {
    return env.VITE_JAVA_API_URL || `http://${host}:8080/api/v1`;
  } else {
    return env.VITE_PYTHON_API_URL || `http://${host}:8000/api/v1`;
  }
};

let currentBackendType: BackendType = getSavedBackend();

let API_BASE_URL = getApiBaseUrl(currentBackendType);

// Event emitter for backend changes (simple version)
type BackendChangeListener = (type: BackendType) => void;
const listeners: BackendChangeListener[] = [];

export const onBackendChange = (listener: BackendChangeListener) => {
  listeners.push(listener);
};

export const setBackendType = (type: BackendType) => {
  currentBackendType = type;
  API_BASE_URL = getApiBaseUrl(type);

  console.log(`[Config] Switched backend to: ${type} (${API_BASE_URL})`);

  // Notify listeners
  listeners.forEach(l => l(type));
};

export const getBackendType = () => currentBackendType;

// Generic API Response wrapper
interface ApiResponse<T> {
  code: number;
  message: string;
  data: T;
  trace_id: string;
}

// Wrapper for fetch that automatically injects the auth token
export const fetchWithAuth = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  const headers = new Headers(init?.headers);

  // Get token from localStorage
  if (typeof window !== 'undefined') {
    const storedAuth = localStorage.getItem('nexus_auth');
    if (storedAuth) {
      try {
        const parsedAuth = JSON.parse(storedAuth);
        if (parsedAuth.token) {
          headers.set('Authorization', `Bearer ${parsedAuth.token}`);
        }
      } catch (e) {
        console.error('Failed to parse auth token', e);
      }
    }
  }

  const modifiedInit = {
    ...init,
    headers,
  };

  const response = await fetch(input, modifiedInit);
  
  // Debugging aid for interceptor rejections
  if (response.status === 401) {
    try {
      const cloned = response.clone();
      const errorBody = await cloned.text();
      console.error(`[Auth Debug] 401 Unauthorized for ${input.toString()}`);
      console.error(`[Auth Debug] Backend said: ${errorBody}`);
      console.error(`[Auth Debug] Sent Authorization Header: ${modifiedInit.headers?.get('Authorization')}`);
    } catch (e) {
      // Ignore clone errors
    }
  }

  return response;
};

// Backend specific interfaces
interface BackendClusterConfig {
  id: string; // UUID
  name: string;
  host: string; // "http://es01"
  port: number;
  username?: string;
  password?: string;
  region?: string;
  version?: string;
}


/**
 * Fetch a single index's basic stats (specifically doc count)
 */
export const fetchESIndexStats = async (clusterId: string, indexName: string): Promise<{ docsCount: number } | null> => {
  try {
    // We can use the fetchESIndices and filter, or if there's a direct endpoint use that.
    // For now, let's assume we can fetch indices for the cluster and find our index.
    const indices = await fetchESIndices(clusterId);
    const target = indices.find(idx => idx.name === indexName);
    return target ? { docsCount: target.docsCount } : null;
  } catch (error) {
    console.error(`[API Failure] fetchESIndexStats for ${indexName}:`, error);
    return null;
  }
};

// ... (existing codes) ...

export const executeESSync = async (
  source: string,
  target: string,
  indices: string[]
): Promise<BackendSyncResultItem[]> => {
  try {
    // POST /api/v1/es/sync?source=...&target=...
    // Body: JSON stringified array of indices (per snippet: "schema: type: string" for body might mean JSON body)
    const url = new URL(`${API_BASE_URL}/es/sync`);
    url.searchParams.append('source', source);
    url.searchParams.append('target', target);

    console.log(`[API] Executing ES Sync: ${url.toString()}`);

    const response = await fetchWithAuth(url.toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(indices)
    });

    if (!response.ok) {
      throw new Error(`Sync failed: ${response.status} ${response.statusText}`);
    }

    const json: ApiResponse<BackendSyncResultItem[]> = await response.json();
    return json.data || [];
  } catch (error) {
    console.error('[API Failure] executeESSync:', error);
    throw error;
  }
};

// --- API Calls ---

export const fetchESClusterOverview = async (): Promise<ESCluster[]> => {
  try {
    const url = `${API_BASE_URL}/cluster/`;
    console.log(`[API] Fetching Clusters: ${url}`);

    const response = await fetchWithAuth(url);

    if (!response.ok) {
      console.error(`[API Error] Status: ${response.status} ${response.statusText} | URL: ${url}`);
      return [];
    }

    const json: ApiResponse<BackendClusterConfig[]> = await response.json();

    if (json.code !== 0) {
      console.error('[API Error] Backend returned non-zero code:', json.message);
      return [];
    }

    const dataList = json.data;

    if (!Array.isArray(dataList)) {
      console.error('[API Error] Expected array of clusters but got:', dataList);
      return [];
    }

    // Map to frontend ESCluster interface
    return dataList.map(config => {
      // Parse host just in case, though backend seems to send "http://es01"
      let hostStr = config.host;
      try {
        if (hostStr.startsWith('http')) {
          const urlObj = new URL(hostStr);
          hostStr = urlObj.hostname;
        }
      } catch (e) {
        // keep original if parsing fails
      }

      return {
        id: config.id, // Use the real UUID from backend
        name: config.name,
        type: ComponentType.ELASTICSEARCH,
        host: hostStr,
        port: config.port,
        version: config.version || 'Unknown',
        status: Status.RUNNING, // Defaulting to Running since it's in the config list
        uptime: 'Unknown',
        region: config.region || 'default',
        // Default stats since this endpoint is config-only
        nodeCount: 3,
        shardCount: 0,
        indexCount: 0,
        health: 'green'
      };
    });

  } catch (error) {
    console.error('[API Failure] fetchESClusterOverview:', error);
    return [];
  }
};

export const fetchESIndices = async (clusterName: string): Promise<ESIndex[]> => {
  try {
    // Construct path: /api/v1/es/{clusterName}/indices
    const url = `${API_BASE_URL}/es/${encodeURIComponent(clusterName)}/indices`;
    console.log(`[API] Fetching Indices: ${url}`);

    const response = await fetchWithAuth(url);

    if (!response.ok) {
      console.error(`[API Error] Status: ${response.status} ${response.statusText} | URL: ${url}`);
      return [];
    }

    // The backend returns the array directly in 'data'
    const json: ApiResponse<BackendESIndex[]> = await response.json();

    if (json.code !== 0) {
      console.warn('[API Warning] Backend returned non-zero code:', json.message);
      return [];
    }

    // Check if data is array
    if (!json.data || !Array.isArray(json.data)) {
      console.warn('[API Warning] Response data is not an array:', json.data);
      return [];
    }

    return json.data.map(backendIndex => {
      // Parse shards "1/1" -> primary: 1, replica: 1
      let pri = 0;
      let rep = 0;
      if (backendIndex.shards && typeof backendIndex.shards === 'string' && backendIndex.shards.includes('/')) {
        const parts = backendIndex.shards.split('/');
        pri = parseInt(parts[0]) || 0;
        rep = parseInt(parts[1]) || 0;
      }

      return {
        name: backendIndex.index, // Map 'index' field to 'name'
        health: backendIndex.health,
        status: backendIndex.status === 'open' ? 'open' : 'close',
        primaryShards: pri,
        replicaShards: rep,
        docsCount: parseInt(backendIndex.docs_count) || 0,
        storeSize: backendIndex.store_size
      };
    });

  } catch (error) {
    console.error('[API Failure] fetchESIndices:', error);
    return [];
  }
};

export const fetchESIndexMetadata = async (clusterId: string, indexName: string): Promise<IndexMetadata | null> => {
  try {
    // Construct path: /api/v1/es/{clusterId}/index/{indexName}
    // FIXED: Using ID (UUID) per requirement
    const url = `${API_BASE_URL}/es/${encodeURIComponent(clusterId)}/index/${encodeURIComponent(indexName)}`;
    console.log(`[API] Fetching Index Metadata: ${url}`);

    const response = await fetchWithAuth(url);

    if (!response.ok) {
      console.error(`[API Error] Status: ${response.status} ${response.statusText} | URL: ${url}`);
      return null;
    }

    const json: ApiResponse<IndexMetadata> = await response.json();

    if (json.code !== 0) {
      console.warn('[API Warning] Backend returned non-zero code:', json.message);
      return null;
    }

    return json.data;
  } catch (error) {
    console.error('[API Failure] fetchESIndexMetadata:', error);
    return null;
  }
};

export interface ESDataFetchParams {
  sort_field?: string;
  sort_order?: 'asc' | 'desc';
  limit: number;
}

export interface ESDataFetchResult {
  total: number;
  list: any[];
}

export const fetchESData = async (
  clusterId: string,
  indexName: string,
  params: ESDataFetchParams
): Promise<ESDataFetchResult> => {
  try {
    // Construct path: /api/v1/es/{clusterId}/index/{indexName}/data
    // Note: Backend might not have this yet, using a logical path
    const url = new URL(`${API_BASE_URL}/es/${encodeURIComponent(clusterId)}/index/${encodeURIComponent(indexName)}/data`);

    if (params.sort_field) url.searchParams.append('sort_field', params.sort_field);
    if (params.sort_order) url.searchParams.append('sort_order', params.sort_order);
    url.searchParams.append('limit', params.limit.toString());

    console.log(`[API] Fetching ES Data: ${url.toString()}`);

    const response = await fetchWithAuth(url.toString());

    if (!response.ok) {
      console.error(`[API Error] Status: ${response.status} ${response.statusText} | URL: ${url.toString()}`);
      // Mock data if backend fails/not implemented
      return generateMockESData(indexName, params.limit);
    }

    const json: ApiResponse<{ total: number; list: any[] }> = await response.json();
    if (json.code !== 0) {
      console.warn('[API Warning] Backend returned non-zero code:', json.message);
      return generateMockESData(indexName, params.limit);
    }

    return {
      total: json.data?.total || 0,
      list: json.data?.list || []
    };
  } catch (error) {
    console.error('[API Failure] fetchESData:', error);
    return generateMockESData(indexName, params.limit);
  }
};

export const executeESQuery = async (
  clusterId: string,
  method: string,
  path: string,
  dsl: any
): Promise<any> => {
  try {
    // POST /api/v1/es/{cluster_id}/console
    const url = `${API_BASE_URL}/es/${encodeURIComponent(clusterId)}/console`;
    console.log(`[API] Executing ES Console: ${method} ${path}`);

    const response = await fetchWithAuth(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        method,
        path,
        dsl
      })
    });

    if (!response.ok) {
      throw new Error(`Execution failed: ${response.status} ${response.statusText}`);
    }

    // Backend returns ApiResponse<Object>
    const json: ApiResponse<any> = await response.json();
    return json.data;
  } catch (error) {
    console.error('[API Failure] executeESQuery:', error);
    throw error;
  }
};

export const checkConnectivity = async (ip: string, timeout: number = 2000): Promise<{ success: boolean; latency?: number; message?: string }> => {
  try {
    // GET /api/v1/tools/network/ping?ip=...&timeout=...
    const url = `${API_BASE_URL}/tools/network/ping?ip=${encodeURIComponent(ip)}&timeout=${timeout}`;
    console.log(`[API] Checking connectivity: GET ${url}`);

    const response = await fetchWithAuth(url);
    if (!response.ok) {
      // Backend might still return 404/500 which we should treat as "failure" in UI
      return { success: false, message: `Status: ${response.status}` };
    }

    const json = await response.json();
    // Real backend structure mapping:
    // data: { status: "online", latency_ms: 59, ... }
    const data = json.data;

    if (!data) return { success: false, message: 'No data returned' };

    return {
      success: data.status === 'online',
      latency: data.latency_ms,
      message: data.status === 'online' ? 'Success' : (data.status || 'Offline')
    };
  } catch (error) {
    console.error('[API Failure] checkConnectivity:', error);
    return { success: false, message: 'Service Unavailable' };
  }
};

// Internal helper for mock data
const generateMockESData = (indexName: string, limit: number): ESDataFetchResult => {
  const list = [];
  const now = Date.now();
  for (let i = 0; i < limit; i++) {
    list.push({
      _id: `doc_${i}`,
      "@timestamp": new Date(now - i * 60000).toISOString(),
      "message": `Auto-generated mock message ${i} for index ${indexName}`,
      "level": i % 5 === 0 ? "error" : "info",
      "user": `user_${i % 10}`,
      "latency": Math.floor(Math.random() * 500)
    });
  }
  return {
    total: 10000,
    list
  };
};

// --- Generic / ES Cluster Operations ---

export interface AddClusterPayload {
  name: string;
  host: string;
  port: number;
  username?: string;
  password?: string;
  region?: string;
}

export const addCluster = async (payload: AddClusterPayload): Promise<BackendClusterConfig | null> => {
  try {
    const url = `${API_BASE_URL}/cluster/`;
    console.log(`[API] Adding Cluster: ${url}`, payload);

    const response = await fetchWithAuth(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      console.error(`[API Error] Status: ${response.status} ${response.statusText}`);
      return null;
    }

    const json: ApiResponse<BackendClusterConfig> = await response.json();

    if (json.code !== 0) {
      console.error('[API Error] Backend returned non-zero code:', json.message);
      return null;
    }

    return json.data;
  } catch (error) {
    console.error('[API Failure] addCluster:', error);
    return null;
  }
};

export const updateCluster = async (clusterId: string, payload: AddClusterPayload): Promise<BackendClusterConfig | null> => {
  try {
    const url = `${API_BASE_URL}/cluster/${encodeURIComponent(clusterId)}`;
    console.log(`[API] Updating Cluster: ${url}`, payload);

    const response = await fetchWithAuth(url, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      console.error(`[API Error] Status: ${response.status} ${response.statusText}`);
      return null;
    }

    const json: ApiResponse<BackendClusterConfig> = await response.json();

    if (json.code !== 0) {
      console.error('[API Error] Backend returned non-zero code:', json.message);
      return null;
    }

    return json.data;
  } catch (error) {
    console.error('[API Failure] updateCluster:', error);
    return null;
  }
};

export const deleteCluster = async (clusterId: string): Promise<boolean> => {
  try {
    const url = `${API_BASE_URL}/cluster/${encodeURIComponent(clusterId)}`;
    console.log(`[API] Deleting Cluster: ${url}`);

    const response = await fetchWithAuth(url, {
      method: 'DELETE'
    });

    if (!response.ok) {
      console.error(`[API Error] Status: ${response.status} ${response.statusText}`);
      return false;
    }

    const json: ApiResponse<boolean> = await response.json();

    if (json.code !== 0) {
      console.error('[API Error] Backend returned non-zero code:', json.message);
      return false;
    }

    return true;
  } catch (error) {
    console.error('[API Failure] deleteCluster:', error);
    return false;
  }
};

// --- ES Sync Operations ---

export const fetchESSyncTasks = async (): Promise<BackendSyncTask[]> => {
  try {
    const url = `${API_BASE_URL}/es/tasks`;
    console.log(`[API] Fetching Sync Tasks: ${url}`);

    const response = await fetchWithAuth(url);

    if (!response.ok) {
      console.error(`[API Error] Status: ${response.status} ${response.statusText}`);
      return [];
    }

    const json: ApiResponse<BackendSyncTask[]> = await response.json();

    if (json.code !== 0) {
      console.error('[API Error] Backend returned non-zero code:', json.message);
      return [];
    }

    if (!json.data || !Array.isArray(json.data)) {
      console.warn('[API Warning] Response data is not an array:', json.data);
      return [];
    }

    return json.data;
  } catch (error) {
    console.error('[API Failure] fetchESSyncTasks:', error);
    return [];
  }
};

export const fetchESSyncTaskById = async (taskId: string): Promise<BackendSyncTask | null> => {
  try {
    const url = `${API_BASE_URL}/es/tasks/${encodeURIComponent(taskId)}`;
    console.log(`[API] Fetching Sync Task Status: ${url}`);

    const response = await fetchWithAuth(url);
    if (!response.ok) {
      console.error(`[API Error] Status: ${response.status} ${response.statusText} | URL: ${url}`);
      return null;
    }

    const json: ApiResponse<BackendSyncTask> = await response.json();
    return json.data || null;
  } catch (error) {
    console.error(`[API Failure] fetchESSyncTaskById for ${taskId}:`, error);
    return null;
  }
};

export interface CreateSyncTaskPayload {
  indices: string[];
  sync_settings: boolean;
  sync_mappings: boolean;
  sync_data: boolean;
}

export const createESSyncTask = async (
  sourceId: string,
  targetId: string,
  payload: CreateSyncTaskPayload
): Promise<BackendSyncTask | null> => {
  try {
    // URL: /api/v1/es/create/syncTask?source=...&target=...
    const url = new URL(`${API_BASE_URL}/es/create/syncTask`);
    url.searchParams.append('source', sourceId);
    url.searchParams.append('target', targetId);

    console.log(`[API] Creating Sync Task: ${url.toString()}`, payload);

    const response = await fetchWithAuth(url.toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      console.error(`[API Error] Status: ${response.status} ${response.statusText}`);
      return null;
    }

    const json: ApiResponse<BackendSyncTask> = await response.json();

    if (json.code !== 0) {
      console.error('[API Error] Backend returned non-zero code:', json.message);
      return null;
    }

    return json.data;
  } catch (error) {
    console.error('[API Failure] createESSyncTask:', error);
    return null;
  }
};

// Update Sync Task Configuration
// REVISED: Only accepts task_id in query param, rest in body
export const updateESSyncTask = async (
  taskId: string,
  payload: { indices: string[]; sync_data?: boolean; sync_settings?: boolean; sync_mappings?: boolean }
): Promise<boolean> => {
  try {
    const url = new URL(`${API_BASE_URL}/es/update/syncTask`);

    // Only task_id is required in query params according to new spec
    url.searchParams.append('task_id', taskId);

    console.log(`[API] Updating Sync Task: ${url.toString()}`, payload);

    const response = await fetchWithAuth(url.toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      console.error(`[API Error] Status: ${response.status} ${response.statusText}`);
      try {
        const errorBody = await response.json();
        console.error('[API Error Body]', errorBody);
      } catch (e) { }
      return false;
    }

    const json: ApiResponse<any> = await response.json();

    if (json.code !== 0) {
      console.error('[API Error] Backend returned non-zero code:', json.message);
      return false;
    }

    return true;
  } catch (error) {
    console.error('[API Failure] updateESSyncTask:', error);
    return false;
  }
};

// --- KAFKA API CALLS ---

interface BackendKafkaCluster {
  id?: string; // Potential field name
  cluster_id?: string; // Current field name
  name: string;
  bootstrap_servers: string;
}

export const fetchKafkaClusters = async (): Promise<KafkaCluster[]> => {
  try {
    // curl -X POST "http://localhost:8000/api/v1/kafka/cluster/list"
    const url = `${API_BASE_URL}/kafka/cluster/list`;
    console.log(`[API] Fetching Kafka Clusters: ${url}`);

    const response = await fetchWithAuth(url, {
      method: 'POST'
    });

    if (!response.ok) {
      console.error(`[API Error] Status: ${response.status} ${response.statusText}`);
      return [];
    }

    const json: ApiResponse<BackendKafkaCluster[]> = await response.json();

    if (json.code !== 0) {
      console.error('[API Error] Backend returned non-zero code:', json.message);
      return [];
    }

    if (!json.data || !Array.isArray(json.data)) {
      console.warn('[API Warning] Kafka Response data is not an array:', json.data);
      return [];
    }

    return json.data.map(k => {
      // Split bootstrap servers to get a host/port for display
      let displayHost = 'unknown';
      let displayPort = 9092;

      if (k.bootstrap_servers) {
        const parts = k.bootstrap_servers.split(','); // handle multiple seeds
        const firstSeed = parts[0];
        const hostPort = firstSeed.split(':');
        if (hostPort.length >= 2) {
          displayHost = hostPort[0];
          displayPort = parseInt(hostPort[1]) || 9092;
        } else {
          displayHost = firstSeed;
        }
      }

      // Prioritize explicit ID fields (uuid) over name
      const effectiveId = k.cluster_id || k.id || k.name;

      return {
        id: effectiveId,
        name: k.name,
        type: ComponentType.KAFKA,
        host: displayHost,
        port: displayPort,
        version: 'Unknown',
        status: Status.RUNNING,
        uptime: 'Unknown',
        region: 'default',
        brokerCount: 0,
        topicCount: 0,
        partitionCount: 0,
        controllerType: 'KRaft'
      };
    });

  } catch (error) {
    console.error('[API Failure] fetchKafkaClusters:', error);
    return [];
  }
};

export const addKafkaCluster = async (name: string, bootstrapServers: string): Promise<BackendKafkaCluster | null> => {
  try {
    // curl -X POST "http://localhost:8000/api/v1/kafka/cluster/add?name=...&bootstrap_servers=..."
    const url = new URL(`${API_BASE_URL}/kafka/cluster/add`);
    url.searchParams.append('name', name);
    url.searchParams.append('bootstrap_servers', bootstrapServers);

    console.log(`[API] Adding Kafka Cluster: ${url.toString()}`);

    const response = await fetchWithAuth(url.toString(), {
      method: 'POST'
    });

    if (!response.ok) {
      console.error(`[API Error] Status: ${response.status} ${response.statusText}`);
      return null;
    }

    const json: ApiResponse<BackendKafkaCluster> = await response.json();

    if (json.code !== 0) {
      console.error('[API Error] Backend returned non-zero code:', json.message);
      return null;
    }

    return json.data;
  } catch (error) {
    console.error('[API Failure] addKafkaCluster:', error);
    return null;
  }
};

export const updateKafkaCluster = async (clusterId: string, name: string, bootstrapServers: string): Promise<BackendKafkaCluster | null> => {
  try {
    // POST /api/v1/kafka/cluster/update
    // Body: { "cluster_id": "...", "name": "...", "bootstrap_servers": "..." }
    const url = `${API_BASE_URL}/kafka/cluster/update`;
    const payload = {
      cluster_id: clusterId,
      name: name,
      bootstrap_servers: bootstrapServers
    };

    console.log(`[API] Updating Kafka Cluster (JSON): ${url}`, payload);

    const response = await fetchWithAuth(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      console.error(`[API Error] Status: ${response.status} ${response.statusText}`);
      return null;
    }

    const json: ApiResponse<BackendKafkaCluster> = await response.json();

    if (json.code !== 0) {
      console.error('[API Error] Backend returned non-zero code:', json.message);
      return null;
    }

    return json.data;
  } catch (error) {
    console.error('[API Failure] updateKafkaCluster:', error);
    return null;
  }
};

export const deleteKafkaCluster = async (clusterId: string): Promise<boolean> => {
  try {
    // DELETE /api/v1/kafka/cluster/{cluster_id}
    const url = `${API_BASE_URL}/kafka/cluster/${encodeURIComponent(clusterId)}`;
    console.log(`[API] Deleting Kafka Cluster: ${url}`);

    const response = await fetchWithAuth(url, {
      method: 'DELETE'
    });

    if (!response.ok) {
      console.error(`[API Error] Status: ${response.status} ${response.statusText}`);
      return false;
    }

    const json: ApiResponse<any> = await response.json();

    if (json.code !== 0) {
      console.error('[API Error] Backend returned non-zero code:', json.message);
      return false;
    }

    return true;
  } catch (error) {
    console.error('[API Failure] deleteKafkaCluster:', error);
    return false;
  }
};

export interface BackendKafkaTopic {
  topic: string;
  partitions: number; // It is a number (count) in the actual response
  replication_factor?: number;
  retention?: string;
  message_count?: number; // Added
  size_bytes?: number;    // Added
}

export const fetchKafkaTopics = async (clusterId: string): Promise<KafkaTopic[]> => {
  try {
    if (!clusterId) return [];

    // GET /api/v1/kafka/{cluster_id}/topics
    // STRICT REQUIREMENT: Kafka uses ID (UUID)
    const url = `${API_BASE_URL}/kafka/${encodeURIComponent(clusterId)}/topics`;
    console.log(`[API] Fetching Kafka Topics: ${url}`);

    const response = await fetchWithAuth(url);

    if (!response.ok) {
      console.error(`[API Error] Status: ${response.status} ${response.statusText}`);
      return [];
    }

    const json: ApiResponse<BackendKafkaTopic[]> = await response.json();

    if (json.code !== 0) {
      console.warn('[API Warning] Backend returned non-zero code:', json.message);
      return [];
    }

    if (!json.data || !Array.isArray(json.data)) {
      console.warn('[API Warning] Data is not an array:', json.data);
      return [];
    }

    return json.data.map(bt => ({
      name: bt.topic,
      partitionCount: bt.partitions,
      replicationFactor: bt.replication_factor || 0, // Fallback if missing
      messageCount: bt.message_count || 0, // Map new field
      sizeBytes: bt.size_bytes || 0,       // Map new field
      // Use the actual retention from backend
      retentionBytes: bt.retention || 'Unknown',
      cleanupPolicy: 'delete', // Defaulting as not provided in snippet
      isrPercentage: 100
    }));

  } catch (error) {
    console.error('[API Failure] fetchKafkaTopics:', error);
    return [];
  }
};

export const fetchKafkaTopicConsumers = async (clusterId: string, topicName: string): Promise<KafkaConsumerOffset[]> => {
  try {
    // GET /api/v1/kafka/{cluster_id}/topics/{topic_name}/groups
    const url = `${API_BASE_URL}/kafka/${encodeURIComponent(clusterId)}/topics/${encodeURIComponent(topicName)}/groups`;
    console.log(`[API] Fetching Topic Consumers: ${url}`);

    const response = await fetchWithAuth(url);

    if (!response.ok) {
      console.error(`[API Error] Status: ${response.status} ${response.statusText}`);
      return [];
    }

    const json: ApiResponse<KafkaConsumerOffset[]> = await response.json();

    if (json.code !== 0) {
      console.warn('[API Warning] Backend returned non-zero code:', json.message);
      return [];
    }

    if (!json.data || !Array.isArray(json.data)) {
      console.warn('[API Warning] Data is not an array:', json.data);
      return [];
    }

    return json.data;
  } catch (error) {
    console.error('[API Failure] fetchKafkaTopicConsumers:', error);
    return [];
  }
};

// NEW: Batch Create Topics
export interface CreateKafkaTopicsPayload {
  topics: string; // "topicA,topicB"
  partitions: number;
  replication_factor: number;
  cleanup_policy: 'delete' | 'compact';
}

export const createKafkaTopics = async (clusterId: string, payload: CreateKafkaTopicsPayload): Promise<boolean> => {
  try {
    // POST /api/v1/kafka/{cluster_id}/topics/create
    const url = `${API_BASE_URL}/kafka/${encodeURIComponent(clusterId)}/topics/create`;
    console.log(`[API] Creating Kafka Topics: ${url}`, payload);

    const response = await fetchWithAuth(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      console.error(`[API Error] Status: ${response.status} ${response.statusText}`);
      return false;
    }

    const json = await response.json();
    if (json.code !== 0) {
      console.error('[API Error] Backend returned non-zero code:', json.message);
      return false;
    }

    return true;
  } catch (error) {
    console.error('[API Failure] createKafkaTopics:', error);
    return false;
  }
};

export const deleteKafkaTopics = async (clusterId: string, topics: string[]): Promise<boolean> => {
  try {
    // POST /api/v1/kafka/{cluster_id}/topics/delete
    const url = `${API_BASE_URL}/kafka/${encodeURIComponent(clusterId)}/topics/delete`;
    console.log(`[API] Deleting Kafka Topics: ${url}`, topics);

    const response = await fetchWithAuth(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ topics })
    });

    if (!response.ok) {
      console.error(`[API Error] Status: ${response.status} ${response.statusText}`);
      return false;
    }

    const json = await response.json();
    if (json.code !== 0) {
      console.error('[API Error] Backend returned non-zero code:', json.message);
      return false;
    }

    return true;
  } catch (error) {
    console.error('[API Failure] deleteKafkaTopics:', error);
    return false;
  }
};



export interface KafkaMessageFetchResult {
  messages: KafkaMessage[];
  downloadUrl?: string; // URL to download the full result
}

export const fetchKafkaMessages = async (
  clusterId: string,
  topicName: string,
  params: KafkaMessageFetchParams
): Promise<KafkaMessageFetchResult> => {
  try {
    // GET /api/v1/kafka/{cluster_id}/topics/{topic_name}/fetch
    const url = new URL(`${API_BASE_URL}/kafka/${encodeURIComponent(clusterId)}/topics/${encodeURIComponent(topicName)}/fetch`);

    // Append params
    url.searchParams.append('mode', params.mode);
    if (params.limit) url.searchParams.append('limit', params.limit.toString());
    if (params.partition !== undefined) url.searchParams.append('partition', params.partition.toString());

    if (params.mode === 'offset_range') {
      if (params.start_offset !== undefined) url.searchParams.append('start_offset', params.start_offset.toString());
      if (params.end_offset !== undefined) url.searchParams.append('end_offset', params.end_offset.toString());
    } else if (params.mode === 'time_range') {
      if (params.start !== undefined) url.searchParams.append('start_time', params.start.toString());
      if (params.end !== undefined) url.searchParams.append('end_time', params.end.toString());
    } else {
      // For other modes, we might not need start/end, or use generic ones if defined
      // Current requirement seems specific to offset/time range
    }

    console.log(`[API] Fetching Kafka Messages: ${url.toString()}`);

    const response = await fetchWithAuth(url.toString(), {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      console.error(`[API Error] Status: ${response.status} ${response.statusText}`);
      return { messages: [] };
    }

    const json = await response.json();

    if (json.code !== 0) {
      console.error('[API Error] Backend returned non-zero code:', json.message);
      return { messages: [] };
    }

    // Response structure: { data: { preview: KafkaMessage[], file_url: string, total: number } }

    let messages: KafkaMessage[] = [];
    let downloadUrl: string | undefined = undefined;

    if (json.data && typeof json.data === 'object') {
      // Handle "preview" array
      if (Array.isArray(json.data.preview)) {
        messages = json.data.preview;
      }
      // Fallback or other formats just in case
      else if (Array.isArray(json.data.messages)) {
        messages = json.data.messages;
      } else if (Array.isArray(json.data)) {
        messages = json.data;
      }

      // Handle "file_url"
      if (json.data.file_url) {
        downloadUrl = json.data.file_url;
      } else if (json.data.download_url) {
        downloadUrl = json.data.download_url;
      }
    } else if (Array.isArray(json.data)) {
      messages = json.data;
    }

    return { messages, downloadUrl };

  } catch (error) {
    console.error('[API Failure] fetchKafkaMessages:', error);
    return { messages: [] };
  }
};

// ==========================================
// OpenVPN Management APIs
// ==========================================

export interface OvpnConfig {
  id: string;
  name: string;
  originalFilename: string;
  status: 'CONNECTED' | 'DISCONNECTED' | 'CONNECTING' | 'FAILED';
  uploadTime: string;
  lastConnectTime?: string;
  ipAddress?: string;
  lastError?: string;
  configPath?: string;
}

export const uploadOvpnConfig = async (file: File): Promise<OvpnConfig | null> => {
  try {
    const formData = new FormData();
    formData.append('file', file);
    const response = await fetchWithAuth(`${API_BASE_URL}/network/openvpn/upload`, {
      method: 'POST',
      body: formData,
    });
    const res = await response.json();
    return res.code === 0 ? res.data : null;
  } catch (e) {
    console.error(e);
    return null;
  }
};

export const fetchOvpnConfigs = async (): Promise<OvpnConfig[]> => {
  try {
    const response = await fetchWithAuth(`${API_BASE_URL}/network/openvpn/list`);
    const res = await response.json();
    return res.code === 0 ? res.data : [];
  } catch (e) {
    console.error(e);
    return [];
  }
};

export const connectOvpn = async (id: string): Promise<OvpnConfig | null> => {
  try {
    const response = await fetchWithAuth(`${API_BASE_URL}/network/openvpn/${id}/connect`, { method: 'POST' });
    const res = await response.json();
    return res.code === 0 ? res.data : null;
  } catch (e) {
    console.error(e);
    return null;
  }
};

export const disconnectOvpn = async (id: string): Promise<OvpnConfig | null> => {
  try {
    const response = await fetchWithAuth(`${API_BASE_URL}/network/openvpn/${id}/disconnect`, { method: 'POST' });
    const res = await response.json();
    return res.code === 0 ? res.data : null;
  } catch (e) {
    console.error(e);
    return null;
  }
};

export const deleteOvpnConfig = async (id: string): Promise<boolean> => {
  try {
    const response = await fetchWithAuth(`${API_BASE_URL}/network/openvpn/${id}`, { method: 'DELETE' });
    const res = await response.json();
    return res.code === 0;
  } catch (e) {
    console.error(e);
    return false;
  }
};

export const fetchOvpnStatus = async (id: string): Promise<OvpnConfig | null> => {
  try {
    const response = await fetchWithAuth(`${API_BASE_URL}/network/openvpn/${id}/status`);
    const res = await response.json();
    return res.code === 0 ? res.data : null;
  } catch (e) {
    console.error(e);
    return null;
  }
};

export const fetchOvpnLogs = async (id: string, lines: number = 200): Promise<string[]> => {
  try {
    const response = await fetchWithAuth(`${API_BASE_URL}/network/openvpn/${id}/logs?lines=${lines}`);
    const res = await response.json();
    return res.code === 0 ? res.data : [];
  } catch (e) {
    console.error(e);
    return [];
  }
};

// ==========================================
// System Backup APIs
// ==========================================

export const exportSystemArchive = (): void => {
  // Standard browser download for files
  window.location.href = `${API_BASE_URL}/system/backup/export`;
};

export const importSystemArchive = async (file: File): Promise<boolean> => {
  try {
    const formData = new FormData();
    formData.append('file', file);
    const response = await fetchWithAuth(`${API_BASE_URL}/system/backup/import`, {
      method: 'POST',
      body: formData,
    });
    const res = await response.json();
    if (response.ok && res.message) {
      return true;
    }
    return false;
  } catch (e) {
    console.error(e);
    return false;
  }
};

export const getSystemConfig = async (): Promise<any> => {
  try {
    const response = await fetchWithAuth(`${API_BASE_URL}/system/config`);
    return await response.json();
  } catch (e) {
    console.error(e);
    return null;
  }
};

export const testDbConnection = async (mysqlConfig: any): Promise<{ success: boolean, message: string }> => {
  try {
    const response = await fetchWithAuth(`${API_BASE_URL}/system/config/test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(mysqlConfig),
    });
    return await response.json();
  } catch (e: any) {
    console.error(e);
    return { success: false, message: e.message || 'Connection test failed' };
  }
};

export const initSystemConfig = async (prefs: any): Promise<{ success: boolean, message: string }> => {
  try {
    const response = await fetchWithAuth(`${API_BASE_URL}/system/config/init`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(prefs),
    });
    return await response.json();
  } catch (e: any) {
    console.error(e);
    return { success: false, message: e.message || 'Failed to initialize settings' };
  }
};

// ==========================================
// User Management APIs
// ==========================================

export interface SystemUser {
  id: number;
  username: string;
  email: string;
  role: string;
  createdAt?: string;
}

export const fetchUsers = async (): Promise<SystemUser[]> => {
  try {
    // Point directly to the Centralized Auth Center, scoped by clientId via Env
    const env = getEnvConfig();
    const host = getHost();
    const authApiUrl = env.VITE_AUTH_API_URL || `http://${host}:8081`;
    const clientId = env.VITE_AUTH_CLIENT_ID || '231814316654413e';
    const url = `${authApiUrl}/api/auth/users?clientId=${clientId}`;
    console.log(`[API] Fetching users: ${url}`);

    const response = await fetchWithAuth(url);
    if (!response.ok) {
      console.error(`[API Error] Status: ${response.status} ${response.statusText}`);
      return [];
    }

    const data = await response.json();
    return data || [];
  } catch (error) {
    console.error('[API Failure] fetchUsers:', error);
    return [];
  }
};

export const deleteUser = async (userId: number): Promise<boolean> => {
  try {
    // Point strictly to Auth Center via Env
    const env = getEnvConfig();
    const host = getHost();
    const authApiUrl = env.VITE_AUTH_API_URL || `http://${host}:8081`;
    const url = `${authApiUrl}/api/auth/users/${userId}`;
    console.log(`[API] Deleting user: ${url}`);

    const response = await fetchWithAuth(url, { method: 'DELETE' });
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[API Error] Delete failed: ${errorText}`);
      return false;
    }

    return true;
  } catch (error) {
    console.error('[API Failure] deleteUser:', error);
    return false;
  }
};

export const updateUserPassword = async (userId: number, newPassword: string): Promise<boolean> => {
  try {
    // Point strictly to Auth Center via Env
    const env = getEnvConfig();
    const host = getHost();
    const authApiUrl = env.VITE_AUTH_API_URL || `http://${host}:8081`;
    const url = `${authApiUrl}/api/auth/users/${userId}/password`;
    console.log(`[API] Updating password for user: ${url}`);

    const response = await fetchWithAuth(url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ newPassword })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[API Error] Update password failed: ${errorText}`);
      return false;
    }

    return true;
  } catch (error) {
    console.error('[API Failure] updateUserPassword:', error);
    return false;
  }
};

