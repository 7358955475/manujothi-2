import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, Users, Book, Video, Headphones, LogOut } from 'lucide-react';

interface SidebarProps {
  user: any;
  onLogout: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ user, onLogout }) => {
  const location = useLocation();

  const navItems = [
    { path: '/', icon: Home, label: 'Dashboard' },
    { path: '/users', icon: Users, label: 'Users' },
    { path: '/books', icon: Book, label: 'Books' },
    { path: '/videos', icon: Video, label: 'Videos' },
    { path: '/audio-books', icon: Headphones, label: 'Audio Books' },
  ];

  return (
    <div className="w-64 bg-white shadow-lg flex flex-col">
      <div className="p-6 border-b">
        <h1 className="text-2xl font-bold text-primary-600">MANUJOTHI Admin</h1>
        <p className="text-sm text-gray-600 mt-1">
          Welcome, {user?.first_name}
        </p>
      </div>

      <nav className="flex-1 p-4">
        <ul className="space-y-2">
          {navItems.map((item) => (
            <li key={item.path}>
              <Link
                to={item.path}
                className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
                  location.pathname === item.path
                    ? 'bg-primary-50 text-primary-700 border-r-4 border-primary-500'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <item.icon size={20} />
                <span>{item.label}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <div className="p-4 border-t">
        <button
          onClick={onLogout}
          className="flex items-center space-x-3 px-4 py-3 text-red-600 hover:bg-red-50 rounded-lg transition-colors w-full"
        >
          <LogOut size={20} />
          <span>Logout</span>
        </button>
      </div>
    </div>
  );
};

export default Sidebar;