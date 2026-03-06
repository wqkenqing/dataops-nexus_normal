import React, { useState, useEffect } from 'react';
import { HashRouter as Router, Routes, Route, useLocation, Navigate } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import LoginPage from './components/LoginPage';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import ClusterTable from './components/ClusterTable';
import ESIndicesTable from './components/ESIndicesTable';
import ESCompareView from './components/ESCompareView';
import ESSyncView from './components/ESSyncView';
import KafkaTopicsTable from './components/KafkaTopicsTable';
import AIChatPanel from './components/AIChatPanel';
import DataCanvas from './components/DataCanvas';
import DataLineage from './components/DataLineage';
import NetworkCheckView from './components/NetworkCheckView';
import OpenVPNManager from './components/OpenVPNManager';
import SystemPersistence from './components/SystemPersistence';
import UserManagement from './components/UserManagement';
import SystemBackup from './components/SystemBackup';
import { clickHouseClusters } from './services/mockData';
import { fetchESClusterOverview, fetchKafkaClusters } from './services/api';
import { ComponentType, Status, AnyCluster, ESCluster, KafkaCluster, ClickHouseCluster } from './types';
import { Sparkles, Bell, Search, Menu, Server, Database, Activity, ShieldAlert, BarChart3, Clock, Loader2, LogOut } from 'lucide-react';
import './i18n';
import LanguageSwitcher from './components/LanguageSwitcher';
import BackendSwitcher from './components/BackendSwitcher';
import { useTranslation } from 'react-i18next';
import { BackendProvider, useBackend } from './contexts/BackendContext';

const DashboardHome: React.FC<{
  esCount: number,
  kafkaCount: number,
  chCount: number
}> = ({ esCount, kafkaCount, chCount }) => {
  const { t } = useTranslation();
  const totalClusters = esCount + kafkaCount + chCount;

  const stats = [
    {
      label: t('totalClusters'),
      value: totalClusters,
      icon: Server,
      color: 'text-indigo-600',
      bg: 'bg-indigo-50',
      trend: '+1 this week'
    },
    {
      label: t('healthyNodes'),
      value: 140 + (esCount * 3), // Mock calc
      icon: Activity,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
      trend: '98.5% Uptime'
    },
    {
      label: t('activeAlerts'),
      value: 3,
      icon: ShieldAlert,
      color: 'text-rose-600',
      bg: 'bg-rose-50',
      trend: '2 Critical'
    },
    {
      label: t('dataIngestion'),
      value: '2.4 GB/s',
      icon: Database,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
      trend: '+12% vs last week'
    }
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-500">

      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-indigo-900 to-slate-900 rounded-2xl p-8 text-white shadow-lg relative overflow-hidden">
        <div className="relative z-10">
          <h2 className="text-3xl font-bold mb-2">{t('welcome')}</h2>
          <p className="text-indigo-200 max-w-xl">
            {t('welcomeMessage', { count: totalClusters })}
          </p>
        </div>
        <div className="absolute right-0 top-0 h-full w-1/3 bg-white/5 skew-x-12 transform translate-x-10"></div>
        <div className="absolute right-20 bottom-0 h-32 w-32 bg-indigo-500/20 rounded-full blur-2xl"></div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, idx) => (
          <div key={idx} className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-all group">
            <div className="flex justify-between items-start mb-4">
              <div className={`p-3 rounded-lg ${stat.bg} ${stat.color} group-hover:scale-110 transition-transform duration-300`}>
                <stat.icon size={24} />
              </div>
              <span className="text-xs font-medium text-gray-400 bg-gray-50 px-2 py-1 rounded-full">{stat.trend}</span>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500 mb-1">{stat.label}</p>
              <h3 className="text-3xl font-bold text-gray-900">{stat.value}</h3>
            </div>
          </div>
        ))}
      </div>

      {/* Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Alerts Feed */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex flex-col">
          <div className="p-6 border-b border-gray-50 flex justify-between items-center">
            <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
              <ShieldAlert size={20} className="text-rose-500" /> {t('recentAlerts')}
            </h3>
            <button className="text-sm text-indigo-600 font-medium hover:text-indigo-800">{t('viewAll')}</button>
          </div>
          <div className="p-6 space-y-4">
            <div className="flex items-start gap-4 p-4 bg-rose-50/50 rounded-xl border border-rose-100 transition-colors hover:bg-rose-50">
              <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center flex-shrink-0 text-rose-600">
                <Activity size={20} />
              </div>
              <div className="flex-1">
                <div className="flex justify-between items-start">
                  <h4 className="text-sm font-bold text-gray-900">High Heap Usage</h4>
                  <span className="text-xs text-gray-400 flex items-center gap-1"><Clock size={12} /> 10m ago</span>
                </div>
                <p className="text-sm text-gray-600 mt-1">
                  Cluster <b>es-prod-01</b> JVM heap usage exceeded 90% for 5 minutes.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-4 p-4 bg-amber-50/50 rounded-xl border border-amber-100 transition-colors hover:bg-amber-50">
              <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0 text-amber-600">
                <Server size={20} />
              </div>
              <div className="flex-1">
                <div className="flex justify-between items-start">
                  <h4 className="text-sm font-bold text-gray-900">Replication Lag</h4>
                  <span className="text-xs text-gray-400 flex items-center gap-1"><Clock size={12} /> 2h ago</span>
                </div>
                <p className="text-sm text-gray-600 mt-1">
                  Kafka consumer group <b>warehouse-syncer</b> is lagging by 50k messages.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* System Load Mock Visualizer */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-6 border-b border-gray-50">
            <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
              <BarChart3 size={20} className="text-indigo-500" /> {t('systemLoad')}
            </h3>
          </div>
          <div className="p-6">
            <div className="space-y-6">
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-600 font-medium">Elasticsearch IOPS</span>
                  <span className="text-gray-900 font-bold">82%</span>
                </div>
                <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-indigo-500 w-[82%] rounded-full"></div>
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-600 font-medium">Kafka Throughput</span>
                  <span className="text-gray-900 font-bold">45%</span>
                </div>
                <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-purple-500 w-[45%] rounded-full"></div>
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-600 font-medium">ClickHouse CPU</span>
                  <span className="text-gray-900 font-bold">28%</span>
                </div>
                <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-yellow-500 w-[28%] rounded-full"></div>
                </div>
              </div>
            </div>

            <div className="mt-8 p-4 bg-gray-50 rounded-lg text-xs text-gray-500 text-center">
              Load average based on last 15 minutes across all regions.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const Layout: React.FC<{
  children: React.ReactNode,
  esData: ESCluster[],
  kafkaData: KafkaCluster[],
  chData: ClickHouseCluster[]
}> = ({ children, esData, kafkaData, chData }) => {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const [isChatOpen, setIsChatOpen] = useState(false);
  const location = useLocation();

  // Determine current data for context
  let currentContextData = t('dashboard');
  if (location.pathname.includes('elasticsearch')) {
    currentContextData = JSON.stringify(esData);
  } else if (location.pathname.includes('kafka')) {
    currentContextData = JSON.stringify(kafkaData);
  } else if (location.pathname.includes('clickhouse')) {
    currentContextData = JSON.stringify(chData);
  }

  // Format page title based on path
  const getPageTitle = () => {
    const path = location.pathname;
    if (path === '/') return t('dashboard');
    if (path.includes('/compare')) return t('configCompare');
    if (path.includes('/sync')) return t('syncIndex');
    if (path.includes('/elasticsearch')) return t('elasticsearch');
    if (path.includes('/kafka')) return t('kafka');
    if (path.includes('/clickhouse')) return t('clickhouse');
    if (path.includes('/network/openvpn')) return t('networkManagement');
    if (path.includes('/system/settings/persistence')) return 'Persistence Engine';
    if (path.includes('/system/settings/users')) return 'User Management';
    if (path.includes('/system/settings/backup')) return 'Backup & Restore';
    return 'Ops Console';
  };

  return (
    <div className="min-h-screen bg-gray-50 flex font-sans">
      <Sidebar />
      <div className="flex-1 ml-64 flex flex-col min-h-screen transition-all duration-300">
        {/* Header */}
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-8 sticky top-0 z-30 shadow-sm">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-bold text-gray-800">
              {getPageTitle()}
            </h1>
          </div>

          <div className="flex items-center gap-4">
            <div className="relative hidden md:block group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-indigo-500 transition-colors" size={16} />
              <input
                type="text"
                placeholder={t('searchPlaceholder')}
                className="pl-9 pr-4 py-1.5 bg-gray-100 border-none rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all w-64 outline-none"
              />
            </div>
            <div className="h-6 w-px bg-gray-200 mx-2"></div>
            <BackendSwitcher />
            <div className="h-6 w-px bg-gray-200 mx-2"></div>
            <LanguageSwitcher />

            <button
              onClick={() => setIsChatOpen(true)}
              className="flex items-center gap-2 px-3 py-2 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition-colors text-sm font-medium group"
            >
              <Sparkles size={16} className="text-indigo-600 group-hover:rotate-12 transition-transform" />
              <span>{t('askCopilot')}</span>
            </button>

            <div className="h-6 w-px bg-gray-200 mx-2"></div>

            <button className="relative p-2 text-gray-500 hover:text-indigo-600 transition-colors rounded-full hover:bg-gray-100">
              <Bell size={20} />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-rose-500 rounded-full border border-white"></span>
            </button>
            <div className="h-6 w-px bg-gray-200 mx-2"></div>
            <div className="flex items-center gap-3 pl-2">
              <div className="flex flex-col items-end hidden sm:flex">
                <span className="text-xs font-bold text-gray-900 leading-none">{user?.name}</span>
                <span className="text-[10px] text-gray-500 mt-1">{user?.role}</span>
              </div>
              <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs border border-indigo-200 shadow-sm">
                {user?.name?.slice(0, 2).toUpperCase() || 'JD'}
              </div>
              <button
                onClick={logout}
                className="p-2 text-gray-400 hover:text-rose-600 transition-colors rounded-lg hover:bg-rose-50"
                title={t('login.logout')}
              >
                <LogOut size={18} />
              </button>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="p-8 flex-1">
          {children}
        </main>
      </div>



      {/* AI Panel */}
      <AIChatPanel
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
        contextData={currentContextData}
      />
    </div>
  );
};

const RequireAuth: React.FC<{ children: React.ReactElement }> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-gray-50">
        <Loader2 className="animate-spin text-indigo-600" size={32} />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
};

// Inner component that lives INSIDE Router so useLocation() works
const AppRoutes: React.FC = () => {
  const { backend } = useBackend();
  const location = useLocation();

  const [esList, setEsList] = useState<ESCluster[]>([]);
  const [kafkaList, setKafkaList] = useState<KafkaCluster[]>([]);
  const [chList, setChList] = useState<ClickHouseCluster[]>(clickHouseClusters);

  const [esLoaded, setEsLoaded] = useState(false);
  const [kafkaLoaded, setKafkaLoaded] = useState(false);

  // Lazy load Elasticsearch data only when navigating to ES pages
  useEffect(() => {
    const loadESData = async () => {
      const realES = await fetchESClusterOverview();
      if (realES && realES.length > 0) {
        setEsList(prev => {
          const existingIds = new Set(prev.map(c => c.id));
          const newClusters = realES.filter(rc => !existingIds.has(rc.id));
          return [...prev, ...newClusters];
        });
      }
    };

    if (location.pathname.startsWith('/elasticsearch') && !esLoaded) {
      loadESData();
      setEsLoaded(true);
    }
  }, [location.pathname, backend, esLoaded]);

  // Lazy load Kafka data only when navigating to Kafka pages
  useEffect(() => {
    const loadKafkaData = async () => {
      const realKafka = await fetchKafkaClusters();
      if (realKafka && realKafka.length > 0) {
        setKafkaList(realKafka);
      }
    };

    if (location.pathname.startsWith('/kafka') && !kafkaLoaded) {
      loadKafkaData();
      setKafkaLoaded(true);
    }
  }, [location.pathname, backend, kafkaLoaded]);

  const handleAddCluster = (cluster: AnyCluster) => {
    switch (cluster.type) {
      case ComponentType.ELASTICSEARCH:
        setEsList(prev => [...prev, cluster as ESCluster]);
        break;
      case ComponentType.KAFKA:
        setKafkaList(prev => [...prev, cluster as KafkaCluster]);
        break;
      case ComponentType.CLICKHOUSE:
        setChList(prev => [...prev, cluster as ClickHouseCluster]);
        break;
    }
  };

  const handleUpdateCluster = (updatedCluster: AnyCluster) => {
    switch (updatedCluster.type) {
      case ComponentType.ELASTICSEARCH:
        setEsList(prev => prev.map(c => c.id === updatedCluster.id ? updatedCluster as ESCluster : c));
        break;
      case ComponentType.KAFKA:
        setKafkaList(prev => prev.map(c => c.id === updatedCluster.id ? updatedCluster as KafkaCluster : c));
        break;
      case ComponentType.CLICKHOUSE:
        setChList(prev => prev.map(c => c.id === updatedCluster.id ? updatedCluster as ClickHouseCluster : c));
        break;
    }
  };

  const handleDeleteCluster = (clusterId: string) => {
    setEsList(prev => prev.filter(c => c.id !== clusterId));
    setKafkaList(prev => prev.filter(c => c.id !== clusterId));
    setChList(prev => prev.filter(c => c.id !== clusterId));
  };

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route
        path="/*"
        element={
          <RequireAuth>
            <Layout esData={esList} kafkaData={kafkaList} chData={chList}>
              <Routes>
                <Route path="/" element={<DashboardHome esCount={esList.length} kafkaCount={kafkaList.length} chCount={chList.length} />} />
                <Route
                  path="/elasticsearch"
                  element={
                    <ClusterTable
                      type={ComponentType.ELASTICSEARCH}
                      data={esList}
                      onAddCluster={handleAddCluster}
                      onEditCluster={handleUpdateCluster}
                      onDeleteCluster={handleDeleteCluster}
                    />
                  }
                />
                <Route
                  path="/elasticsearch/:clusterId"
                  element={<ESIndicesTable clusters={esList} />}
                />
                <Route
                  path="/elasticsearch/compare"
                  element={<ESCompareView clusters={esList} />}
                />
                <Route
                  path="/elasticsearch/sync"
                  element={<ESSyncView clusters={esList} />}
                />
                <Route
                  path="/kafka"
                  element={
                    <ClusterTable
                      type={ComponentType.KAFKA}
                      data={kafkaList}
                      onAddCluster={handleAddCluster}
                      onEditCluster={handleUpdateCluster}
                      onDeleteCluster={handleDeleteCluster}
                    />
                  }
                />
                <Route
                  path="/kafka/:clusterId"
                  element={<KafkaTopicsTable clusters={kafkaList} />}
                />
                <Route
                  path="/clickhouse"
                  element={
                    <ClusterTable
                      type={ComponentType.CLICKHOUSE}
                      data={chList}
                      onAddCluster={handleAddCluster}
                      onEditCluster={handleUpdateCluster}
                      onDeleteCluster={handleDeleteCluster}
                    />
                  }
                />
                <Route
                  path="/data-app/canvas"
                  element={<DataCanvas />}
                />
                <Route
                  path="/data-app/lineage"
                  element={<DataLineage />}
                />
                <Route
                  path="/utilities/network/ping"
                  element={<NetworkCheckView />}
                />
                <Route
                  path="/network/openvpn"
                  element={<OpenVPNManager />}
                />
                <Route
                  path="/system/settings/persistence"
                  element={<SystemPersistence />}
                />
                <Route
                  path="/system/settings/users"
                  element={<UserManagement />}
                />
                <Route
                  path="/system/settings/backup"
                  element={<SystemBackup />}
                />
              </Routes>
            </Layout>
          </RequireAuth>
        }
      />
    </Routes>
  );
};

// Outer shell: provides Router context
const AppContent: React.FC = () => {
  return (
    <Router>
      <AppRoutes />
    </Router>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <BackendProvider>
        <AppContent />
      </BackendProvider>
    </AuthProvider>
  );
}