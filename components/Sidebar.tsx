import React, { useState, useEffect, useMemo } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Settings,
  ChevronDown,
  ChevronRight,
  GitCompare,
  List,
  ArrowRightLeft,
  LayoutTemplate,
  Presentation,
  Workflow,
  LogOut,
  Wrench,
  Globe,
  Radio,
  Shield,
  HardDrive,
  Database,
  Users,
  DownloadCloud
} from 'lucide-react';
import { NavItem } from '../types';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';

const Sidebar: React.FC = () => {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const location = useLocation();

  // Define the navigation structure
  const navStructure: NavItem[] = useMemo(() => [
    {
      id: 'dashboard',
      label: t('dashboard'),
      path: '/',
      icon: LayoutDashboard
    },
    {
      id: 'ops-mgmt',
      label: t('componentManagement'),
      icon: Settings,
      children: [
        {
          id: 'elasticsearch',
          label: t('elasticsearch'),
          color: 'bg-blue-500',
          children: [
            { id: 'es-list', label: t('clusterList'), path: '/elasticsearch', icon: List },
            { id: 'es-compare', label: t('configCompare'), path: '/elasticsearch/compare', icon: GitCompare },
            { id: 'es-sync', label: t('syncIndex'), path: '/elasticsearch/sync', icon: ArrowRightLeft }
          ]
        },
        {
          id: 'kafka',
          label: t('kafka'),
          color: 'bg-purple-500',
          path: '/kafka'
        },
        {
          id: 'clickhouse',
          label: t('clickhouse'),
          color: 'bg-yellow-500',
          path: '/clickhouse'
        }
      ]
    },

    {
      id: 'network-mgmt',
      label: t('networkManagement'),
      icon: Shield,
      children: [
        {
          id: 'openvpn-manager',
          label: t('openVpnManager'),
          path: '/network/openvpn',
          icon: Shield
        }
      ]
    },
    {
      id: 'utilities',
      label: t('utilities'),
      icon: Wrench,
      children: [
        {
          id: 'data-app',
          label: t('dataApplication'),
          icon: LayoutTemplate,
          children: [
            { id: 'data-canvas', label: t('dataCanvas'), path: '/data-app/canvas', icon: Presentation },
            { id: 'data-lineage', label: t('dataLineage'), path: '/data-app/lineage', icon: Workflow }
          ]
        },
        {
          id: 'network-tools',
          label: t('networkTools'),
          icon: Globe,
          children: [
            {
              id: 'connectivity-check',
              label: t('connectivityCheck'),
              path: '/utilities/network/ping',
              icon: Radio
            }
          ]
        }
      ]
    },
    {
      id: 'system',
      label: t('systemSettings'),
      icon: HardDrive,
      children: [
        {
          id: 'sys-persistence',
          label: 'Persistence Engine',
          path: '/system/settings/persistence',
          icon: Database
        },
        {
          id: 'sys-users',
          label: 'User Management',
          path: '/system/settings/users',
          icon: Users
        },
        {
          id: 'sys-backup',
          label: 'Backup & Restore',
          path: '/system/settings/backup',
          icon: DownloadCloud
        }
      ]
    }
  ], [t]);

  // State to track expanded menus
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [activeItemId, setActiveItemId] = useState<string>('');

  // Helper: Find the parent ID for any given item ID
  const getParentMap = useMemo(() => {
    const map: Record<string, string> = {};
    const traverse = (items: NavItem[], parentId: string | null) => {
      for (const item of items) {
        if (parentId) map[item.id] = parentId;
        if (item.children) traverse(item.children, item.id);
      }
    };
    traverse(navStructure, null);
    return map;
  }, [navStructure]);

  // Effect: Calculate active item and auto-expand parents
  useEffect(() => {
    const currentPath = location.pathname;
    let bestMatchId = '';
    let maxMatchLength = -1;

    // 1. Find the best matching leaf node (Longest Prefix Match)
    const findBestMatch = (items: NavItem[]) => {
      for (const item of items) {
        // Calculate match score
        if (item.path) {
          const isExact = item.path === '/' && currentPath === '/';
          const isPrefix = item.path !== '/' && currentPath.startsWith(item.path);

          if (isExact || isPrefix) {
            // Prioritize longer (more specific) paths
            // e.g. /elasticsearch/compare (len 22) > /elasticsearch (len 14)
            if (item.path.length > maxMatchLength) {
              maxMatchLength = item.path.length;
              bestMatchId = item.id;
            }
          }
        }

        if (item.children) {
          findBestMatch(item.children);
        }
      }
    };

    findBestMatch(navStructure);
    setActiveItemId(bestMatchId);

    // 2. Auto-expand parents of the active item if needed
    if (bestMatchId) {
      setExpanded(prev => {
        const next = { ...prev };
        let curr = bestMatchId;
        let hasChanges = false;

        while (getParentMap[curr]) {
          const parentId = getParentMap[curr];
          if (!next[parentId]) {
            next[parentId] = true;
            hasChanges = true;
          }
          curr = parentId;
        }
        return hasChanges ? next : prev;
      });
    }
  }, [location.pathname, navStructure, getParentMap]);

  const toggleExpand = (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // Recursive function to render menu items
  const renderNavItem = (item: NavItem, depth = 0) => {
    const hasChildren = item.children && item.children.length > 0;
    const isExpanded = expanded[item.id];
    const isActive = activeItemId === item.id;

    // Dynamic padding for hierarchy visual
    // Depth 0: px-3
    // Depth 1: pl-10 (40px)
    // Depth 2: pl-14 (56px) - Increased indentation for 3rd level clarity
    const paddingLeft = depth === 0 ? 'px-3' : depth === 1 ? 'pl-10 pr-3' : 'pl-16 pr-3';

    if (hasChildren) {
      // Check if any child is active to highlight the parent group slightly
      const isChildActive = (node: NavItem): boolean => {
        if (node.id === activeItemId) return true;
        return node.children ? node.children.some(isChildActive) : false;
      };
      const childActive = isChildActive(item);

      return (
        <div key={item.id} className="mb-1">
          <button
            onClick={(e) => toggleExpand(item.id, e)}
            className={`w-full flex items-center justify-between py-2.5 ${paddingLeft} text-sm font-medium transition-colors rounded-lg group ${isActive ? 'text-white bg-slate-800' :
              childActive ? 'text-slate-200 bg-slate-800/40' : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
          >
            <div className="flex items-center">
              {item.icon && <item.icon size={18} className={`mr-3 ${isActive || childActive ? 'text-white' : 'text-slate-400 group-hover:text-white'}`} />}
              {item.color && <div className={`w-1.5 h-1.5 rounded-full mr-3 ${item.color}`}></div>}
              {item.label}
            </div>
            {isExpanded ? <ChevronDown size={14} className={childActive ? 'text-white' : ''} /> : <ChevronRight size={14} className={childActive ? 'text-white' : ''} />}
          </button>

          {/* Render Children */}
          <div className={`overflow-hidden transition-all duration-300 ease-in-out ${isExpanded ? 'max-h-[800px] opacity-100' : 'max-h-0 opacity-0'}`}>
            <div className="mt-1 space-y-1 relative">
              {/* Connector Line for visual hierarchy */}
              {isExpanded && depth === 0 && (
                <div className="absolute left-[1.15rem] top-0 bottom-2 w-px bg-slate-700/50"></div>
              )}
              {item.children!.map(child => renderNavItem(child, depth + 1))}
            </div>
          </div>
        </div>
      );
    } else {
      // Leaf Item (Link)
      return (
        <NavLink
          key={item.id}
          to={item.path!}
          className={() =>
            `flex items-center py-2 ${paddingLeft} text-sm transition-all rounded-lg mb-1 relative group ${isActive
              ? 'bg-indigo-600 text-white shadow-md font-medium'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            }`
          }
        >
          {depth > 0 && (
            <div className={`absolute left-[1.15rem] w-2 h-px bg-slate-700/50 ${isActive ? 'bg-indigo-400' : ''}`} style={{ display: depth === 1 ? 'block' : 'none' }}></div>
          )}

          {item.icon && <item.icon size={16} className={`mr-3 ${isActive ? 'text-indigo-100' : 'text-slate-500 group-hover:text-slate-300'}`} />}
          {item.color && <div className={`w-1.5 h-1.5 rounded-full mr-3 ${item.color}`}></div>}
          <span className="truncate">{item.label}</span>

          {/* Active indicator dot for deep nesting */}
          {isActive && depth > 1 && (
            <span className="absolute right-3 w-1.5 h-1.5 bg-white rounded-full"></span>
          )}
        </NavLink>
      );
    }
  };

  return (
    <div className="w-64 bg-slate-900 h-screen fixed left-0 top-0 text-white flex flex-col shadow-xl z-50">
      {/* Brand */}
      <div className="h-16 flex items-center px-6 border-b border-slate-800 bg-slate-950">
        <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center mr-3 shadow-lg shadow-indigo-900/50">
          <Settings className="text-white" size={20} />
        </div>
        <div>
          <h1 className="text-lg font-bold tracking-tight">DataOps Nexus</h1>
          <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">{t('enterpriseConsole')}</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-6 px-3 custom-scrollbar">
        {navStructure.map(item => renderNavItem(item))}
      </nav>

      {/* User Footer */}
      <div className="p-4 border-t border-slate-800 bg-slate-950">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-xs font-bold border-2 border-slate-800">
            {user?.name?.slice(0, 2).toUpperCase() || 'JD'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">{user?.name || 'Jane Doe'}</p>
            <p className="text-xs text-slate-500 truncate">{user?.role || t('devOpsLead')}</p>
          </div>
          <button
            onClick={logout}
            className="p-1.5 text-slate-500 hover:text-white hover:bg-slate-800 rounded-md transition-all"
            title={t('login.logout')}
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;