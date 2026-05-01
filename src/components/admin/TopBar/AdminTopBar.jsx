import React, { useState, useCallback, useEffect, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import PropTypes from 'prop-types';
import { useAuth } from '../../../context/authContext';
import { toast } from 'react-toastify';
import {
  Search as SearchIcon,
  Close as CloseIcon,
  Menu as MenuIcon
} from '@mui/icons-material';
import AdminNotificationBell from '../AdminNotificationBell/AdminNotificationBell';
import "./adminTopBar.scss";

const AdminTopBar = memo(({ onToggleSidebar }) => {
  const navigate = useNavigate();
  const { currentUser, adminLogout } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');

  const handleSearch = useCallback((e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      // Implement search functionality
      toast.info('Search functionality coming soon!');
    }
  }, [searchQuery]);

  const handleClearSearch = useCallback(() => {
    setSearchQuery('');
  }, []);

  return (
    <nav className="adminTopBar" role="navigation" aria-label="Admin navigation">
      <button 
        className="menuToggle"
        onClick={onToggleSidebar}
        aria-label="Toggle sidebar menu"
      >
        <MenuIcon className="menuIcon" />
      </button>
      
      <form className="searchBar" onSubmit={handleSearch} role="search">
        <SearchIcon className="searchIcon" aria-hidden="true" />
        <input 
          type="text" 
          placeholder="Search in admin panel..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          aria-label="Search in admin panel"
        />
        {searchQuery && (
          <button
            type="button"
            className="clearButton"
            onClick={handleClearSearch}
            aria-label="Clear search"
          >
            <CloseIcon className="clearIcon" />
          </button>
        )}
      </form>

      <div className="rightSection">
        <AdminNotificationBell />
      </div>
    </nav>
  );
});

AdminTopBar.propTypes = {
  currentUser: PropTypes.shape({
    username: PropTypes.string,
    profilePic: PropTypes.string
  })
};

AdminTopBar.displayName = 'AdminTopBar';

export default AdminTopBar;