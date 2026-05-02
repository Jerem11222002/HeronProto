import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../../context/authContext';
import "./adminSidebar.scss";

// Import icons from react-icons
import { 
  MdDashboard, 
  MdEvent, 
  MdAnalytics, 
  MdPeople, 
  MdMonitor,
  MdSettings,
  MdSwapHoriz,
  MdLogout,
  MdReport
} from 'react-icons/md';
import { MdManageAccounts } from 'react-icons/md';

const AdminSidebar = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser, adminLogout } = useAuth();

  // Permission helpers
  const isSuperAdmin = currentUser?.adminRole === 'super';
  const canAccess = (perm) => !!currentUser?.adminPermissions?.[perm];

  // Define menu items with permission checks
  const menuItems = [
    { 
      path: '/admin/dashboard',
      label: 'Dashboard',
      icon: <MdDashboard />,
      show: true
    },
    { 
      path: '/admin/events',
      label: 'Events',
      icon: <MdEvent />,
      show: canAccess('canManageEvents')
    },
    { 
      path: '/admin/analytics',
      label: 'Analytics',
      icon: <MdAnalytics />,
      show: isSuperAdmin
    },
    { 
      path: '/admin/participants',
      label: 'Participants',
      icon: <MdPeople />,
      show: canAccess('canManageUsers')
    },
    {
      path: '/admin/accounts',
      label: 'Accounts',
      icon: <MdManageAccounts />,
      show: isSuperAdmin // only visible to super admins
    },
    {
      path: '/admin/monitoring',
      label: 'User Monitoring',
      icon: <MdMonitor />,
      show: isSuperAdmin || canAccess('canAccessUserMonitoring')
    },
    {
      path: '/admin/bug-reports',
      label: 'Bug Reports',
      icon: <MdReport />,
      show: isSuperAdmin || canAccess('canAccessUserMonitoring')
    },
    {
      path: '/admin/settings',
      label: 'Settings',
      icon: <MdSettings />,
      show: canAccess('canManageSettings')
    },
  ];

  const handleLogout = async () => {
    try {
      await adminLogout();
      navigate('/login');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const handleSwitchView = () => {
    if (currentUser?.isAdmin) {
      navigate('/');
    }
  };

  return (
    <div className={`adminSidebar ${isOpen ? 'open' : ''}`}>
      <div className="logo">
        <h2>Heron Admin</h2>
      </div>
      
      <nav className="menuItems">
        {menuItems.filter(item => item.show).map((item) => (
          <Link 
            key={item.path}
            to={item.path}
            className={`menuItem ${location.pathname === item.path ? 'active' : ''}`}
            title={`Go to ${item.label}`}
            onClick={onClose} // Close sidebar on navigation
          >
            <span className="menuIcon">{item.icon}</span>
            <span className="menuLabel">{item.label}</span>
          </Link>
        ))}
      </nav>

      <div className="bottomMenu">
        <button 
          onClick={() => { handleSwitchView(); onClose(); }} 
          className="actionButton switchButton"
          title="Switch to user view"
        >
          <MdSwapHoriz />
          <span>Switch to User View</span>
        </button>
        <button 
          onClick={() => { handleLogout(); onClose(); }} 
          className="actionButton logoutButton"
          title="Logout from admin panel"
        >
          <MdLogout />
          <span>Logout</span>
        </button>
      </div>
    </div>
  );
};

export default AdminSidebar;