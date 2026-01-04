import React from 'react';
import { Status } from '../types';

interface StatusBadgeProps {
  status: Status;
  health?: 'green' | 'yellow' | 'red'; // Optional, mainly for ES
}

const StatusBadge: React.FC<StatusBadgeProps> = ({ status, health }) => {
  const getColors = () => {
    // Priority to specific health for ES if provided
    if (health) {
      switch (health) {
        case 'green': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
        case 'yellow': return 'bg-amber-100 text-amber-700 border-amber-200';
        case 'red': return 'bg-rose-100 text-rose-700 border-rose-200';
      }
    }

    switch (status) {
      case Status.RUNNING:
        return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case Status.STOPPED:
        return 'bg-slate-100 text-slate-600 border-slate-200';
      case Status.DEGRADED:
        return 'bg-orange-100 text-orange-700 border-orange-200';
      case Status.MAINTENANCE:
        return 'bg-blue-100 text-blue-700 border-blue-200';
      default:
        return 'bg-gray-100 text-gray-600 border-gray-200';
    }
  };

  const getDotColor = () => {
     if (health) {
       return health === 'green' ? 'bg-emerald-500' : health === 'yellow' ? 'bg-amber-500' : 'bg-rose-500';
     }
     switch(status) {
        case Status.RUNNING: return 'bg-emerald-500';
        case Status.STOPPED: return 'bg-slate-500';
        case Status.DEGRADED: return 'bg-orange-500';
        case Status.MAINTENANCE: return 'bg-blue-500';
        default: return 'bg-gray-500';
     }
  }

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getColors()}`}>
      <span className={`w-1.5 h-1.5 mr-1.5 rounded-full ${getDotColor()}`}></span>
      {status}
      {health ? ` (${health.toUpperCase()})` : ''}
    </span>
  );
};

export default StatusBadge;