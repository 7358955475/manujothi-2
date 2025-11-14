import React, { useState, useEffect } from 'react';
import { TrendingUp, Users, Activity, Clock, BarChart3, RefreshCw } from 'lucide-react';
import { analyticsApi } from '../services/api';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

interface ContentPerformance {
  title: string;
  content_type: string;
  view_count: number;
  favorite_count: number;
  avg_progress: number;
}

interface UserEngagement {
  total_users: number;
  active_users: number;
  new_users: number;
  retention_rate: number;
  avg_session_duration: number;
  total_sessions: number;
}

interface ActivityTrend {
  period: string;
  views: number;
  favorites: number;
  completions: number;
}

interface PeakUsage {
  by_hour: Array<{ hour: number; activity_count: number }>;
  by_day: Array<{ day_name: string; activity_count: number }>;
}

interface ComparativeStats {
  current: {
    views: number;
    favorites: number;
    users: number;
    avg_progress: number;
  };
  previous: {
    views: number;
    favorites: number;
    users: number;
    avg_progress: number;
  };
  change: {
    views: number;
    favorites: number;
    users: number;
    avg_progress: number;
  };
}

interface RealTimeActivity {
  recent_activities: Array<{
    user_name: string;
    content_title: string;
    activity_type: string;
    created_at: string;
  }>;
  active_now: number;
}

const Analytics: React.FC = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('7d');
  const [contentPerformance, setContentPerformance] = useState<ContentPerformance[]>([]);
  const [userEngagement, setUserEngagement] = useState<UserEngagement | null>(null);
  const [activityTrends, setActivityTrends] = useState<ActivityTrend[]>([]);
  const [peakUsage, setPeakUsage] = useState<PeakUsage | null>(null);
  const [comparativeStats, setComparativeStats] = useState<ComparativeStats | null>(null);
  const [realTimeActivity, setRealTimeActivity] = useState<RealTimeActivity | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  useEffect(() => {
    fetchAllAnalytics();
  }, [timeRange]);

  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(() => {
        fetchRealTimeData();
      }, 30000); // Refresh every 30 seconds
      return () => clearInterval(interval);
    }
  }, [autoRefresh]);

  const fetchAllAnalytics = async () => {
    setIsLoading(true);
    try {
      const [
        contentRes,
        engagementRes,
        trendsRes,
        peakRes,
        compareRes,
        realTimeRes,
      ] = await Promise.all([
        analyticsApi.getContentPerformance({ timeRange, limit: 10 }),
        analyticsApi.getUserEngagement({ timeRange }),
        analyticsApi.getActivityTrends({ timeRange, groupBy: timeRange === '1h' ? 'minute' : timeRange === '7d' ? 'day' : 'week' }),
        analyticsApi.getPeakUsage({ timeRange }),
        analyticsApi.getComparativeStats({ timeRange }),
        analyticsApi.getRealTime(),
      ]);

      setContentPerformance(contentRes.data || []);
      setUserEngagement(engagementRes.data || null);
      setActivityTrends(trendsRes.data || []);
      setPeakUsage(peakRes.data || null);
      setComparativeStats(compareRes.data || null);
      setRealTimeActivity(realTimeRes.data || null);
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchRealTimeData = async () => {
    try {
      const realTimeRes = await analyticsApi.getRealTime();
      setRealTimeActivity(realTimeRes.data || null);
    } catch (error) {
      console.error('Error fetching real-time data:', error);
    }
  };

  const formatNumber = (num: number): string => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  };

  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  // const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];

  const StatCard: React.FC<{
    title: string;
    value: string | number;
    change?: number;
    icon: React.ElementType;
    color: string;
  }> = ({ title, value, change, icon: Icon, color }) => (
    <div className="bg-white p-6 rounded-lg shadow-md border-l-4" style={{ borderLeftColor: color }}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-gray-600 text-sm font-medium">{title}</p>
          <p className="text-3xl font-bold text-gray-900 mt-2">{value}</p>
          {change !== undefined && (
            <p className={`text-sm mt-2 flex items-center ${change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              <TrendingUp size={16} className="mr-1" />
              {change >= 0 ? '+' : ''}{Number(change || 0).toFixed(1)}% from previous period
            </p>
          )}
        </div>
        <Icon style={{ color }} size={40} />
      </div>
    </div>
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-xl">Loading analytics...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Analytics Dashboard</h1>
        <div className="flex items-center space-x-4">
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg ${
              autoRefresh ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
            }`}
          >
            <RefreshCw size={16} className={autoRefresh ? 'animate-spin' : ''} />
            <span>{autoRefresh ? 'Auto-refresh ON' : 'Auto-refresh OFF'}</span>
          </button>
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="1h">Last Hour</option>
            <option value="24h">Last 24 Hours</option>
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
            <option value="90d">Last 90 Days</option>
          </select>
        </div>
      </div>

      {/* Key Metrics */}
      {userEngagement && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard
            title="Total Users"
            value={formatNumber(userEngagement.total_users)}
            change={comparativeStats?.change.users}
            icon={Users}
            color="#3B82F6"
          />
          <StatCard
            title="Active Users"
            value={formatNumber(userEngagement.active_users)}
            icon={Activity}
            color="#10B981"
          />
          <StatCard
            title="Retention Rate"
            value={`${Number(userEngagement.retention_rate || 0).toFixed(1)}%`}
            icon={TrendingUp}
            color="#F59E0B"
          />
          <StatCard
            title="Avg Session Time"
            value={formatDuration(userEngagement.avg_session_duration)}
            icon={Clock}
            color="#8B5CF6"
          />
        </div>
      )}

      {/* Real-time Activity */}
      {realTimeActivity && (
        <div className="bg-white p-6 rounded-lg shadow-md">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold flex items-center">
              <Activity className="mr-2 text-green-500" size={24} />
              Real-time Activity
            </h2>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-gray-600">{realTimeActivity.active_now} users active now</span>
            </div>
          </div>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {realTimeActivity.recent_activities.map((activity, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                <div>
                  <p className="font-medium text-gray-900">{activity.user_name}</p>
                  <p className="text-sm text-gray-600">
                    {activity.activity_type} - {activity.content_title}
                  </p>
                </div>
                <span className="text-xs text-gray-500">
                  {new Date(activity.created_at).toLocaleTimeString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Activity Trends */}
      {activityTrends.length > 0 && (
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold mb-4 flex items-center">
            <BarChart3 className="mr-2 text-blue-500" size={24} />
            Activity Trends
          </h2>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={activityTrends}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="period" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="views" stroke="#3B82F6" strokeWidth={2} name="Views" />
              <Line type="monotone" dataKey="favorites" stroke="#10B981" strokeWidth={2} name="Favorites" />
              <Line type="monotone" dataKey="completions" stroke="#F59E0B" strokeWidth={2} name="Completions" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Peak Usage Times */}
      {peakUsage && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-xl font-semibold mb-4">Peak Usage by Hour</h2>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={peakUsage.by_hour}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="hour" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="activity_count" fill="#3B82F6" name="Activities" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-xl font-semibold mb-4">Peak Usage by Day</h2>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={peakUsage.by_day}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="day_name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="activity_count" fill="#10B981" name="Activities" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Content Performance */}
      {contentPerformance.length > 0 && (
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold mb-4">Top Content Performance</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Content
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Views
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Favorites
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Avg Progress
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {contentPerformance.map((content, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{content.title}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                        {content.content_type}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {content.view_count}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {content.favorite_count}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="w-full bg-gray-200 rounded-full h-2 mr-2">
                          <div
                            className="bg-green-500 h-2 rounded-full"
                            style={{ width: `${Number(content.avg_progress || 0)}%` }}
                          ></div>
                        </div>
                        <span className="text-sm text-gray-900">{Number(content.avg_progress || 0).toFixed(0)}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Comparative Stats */}
      {comparativeStats && (
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold mb-4">Comparative Statistics</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="p-4 bg-blue-50 rounded-lg">
              <p className="text-sm text-gray-600">Views</p>
              <p className="text-2xl font-bold text-gray-900">{formatNumber(comparativeStats.current.views)}</p>
              <p className={`text-sm mt-1 ${comparativeStats.change.views >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {comparativeStats.change.views >= 0 ? '+' : ''}{Number(comparativeStats.change.views || 0).toFixed(1)}%
              </p>
            </div>
            <div className="p-4 bg-green-50 rounded-lg">
              <p className="text-sm text-gray-600">Favorites</p>
              <p className="text-2xl font-bold text-gray-900">{formatNumber(comparativeStats.current.favorites)}</p>
              <p className={`text-sm mt-1 ${comparativeStats.change.favorites >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {comparativeStats.change.favorites >= 0 ? '+' : ''}{Number(comparativeStats.change.favorites || 0).toFixed(1)}%
              </p>
            </div>
            <div className="p-4 bg-purple-50 rounded-lg">
              <p className="text-sm text-gray-600">Active Users</p>
              <p className="text-2xl font-bold text-gray-900">{formatNumber(comparativeStats.current.users)}</p>
              <p className={`text-sm mt-1 ${comparativeStats.change.users >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {comparativeStats.change.users >= 0 ? '+' : ''}{Number(comparativeStats.change.users || 0).toFixed(1)}%
              </p>
            </div>
            <div className="p-4 bg-orange-50 rounded-lg">
              <p className="text-sm text-gray-600">Avg Progress</p>
              <p className="text-2xl font-bold text-gray-900">{Number(comparativeStats.current.avg_progress || 0).toFixed(1)}%</p>
              <p className={`text-sm mt-1 ${comparativeStats.change.avg_progress >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {comparativeStats.change.avg_progress >= 0 ? '+' : ''}{Number(comparativeStats.change.avg_progress || 0).toFixed(1)}%
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Analytics;
