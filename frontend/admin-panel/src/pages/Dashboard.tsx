import React, { useState, useEffect } from 'react';
import { Users, Book, Video, Headphones } from 'lucide-react';
import { usersApi, booksApi, videosApi, audioBooksApi } from '../services/api';

const Dashboard: React.FC = () => {
  const [stats, setStats] = useState({
    users: 0,
    books: 0,
    videos: 0,
    audioBooks: 0
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const [usersRes, booksRes, videosRes, audioBooksRes] = await Promise.all([
        usersApi.getAll({ limit: 1 }),
        booksApi.getAll({ limit: 1 }),
        videosApi.getAll({ limit: 1 }),
        audioBooksApi.getAll({ limit: 1 })
      ]);

      setStats({
        users: usersRes.data.pagination.total,
        books: booksRes.data.pagination.total,
        videos: videosRes.data.pagination.total,
        audioBooks: audioBooksRes.data.pagination.total
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const StatCard: React.FC<{ title: string; count: number; icon: React.ElementType; color: string }> = 
    ({ title, count, icon: Icon, color }) => (
    <div className={`bg-white p-6 rounded-lg shadow-md border-l-4 border-${color}-500`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-gray-600 text-sm font-medium">{title}</p>
          <p className="text-3xl font-bold text-gray-900">{count}</p>
        </div>
        <Icon className={`text-${color}-500`} size={32} />
      </div>
    </div>
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-xl">Loading dashboard...</div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Dashboard</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard title="Total Users" count={stats.users} icon={Users} color="blue" />
        <StatCard title="Total Books" count={stats.books} icon={Book} color="green" />
        <StatCard title="Total Videos" count={stats.videos} icon={Video} color="purple" />
        <StatCard title="Total Audio Books" count={stats.audioBooks} icon={Headphones} color="orange" />
      </div>

      <div className="bg-white p-6 rounded-lg shadow-md">
        <h2 className="text-xl font-semibold mb-4">Welcome to MANUJOTHI Admin Panel</h2>
        <p className="text-gray-600 mb-4">
          Manage your media library, users, and content from this centralized dashboard.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="border border-gray-200 p-4 rounded">
            <h3 className="font-medium mb-2">Quick Actions</h3>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>• Add new books, videos, or audio content</li>
              <li>• Manage user accounts and permissions</li>
              <li>• Monitor content statistics</li>
              <li>• Review and moderate submissions</li>
            </ul>
          </div>
          <div className="border border-gray-200 p-4 rounded">
            <h3 className="font-medium mb-2">System Status</h3>
            <div className="flex items-center space-x-2 text-sm">
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              <span>System operational</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;