import React, { Suspense, memo, useState } from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import PropTypes from 'prop-types';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { useAuth } from '../../../context/authContext';
import AdminSidebar from '../Sidebar/AdminSidebar';
import AdminTopBar from '../TopBar/AdminTopBar';
import ErrorBoundary from '../../../components/ErrorBoundary/ErrorBoundary';
import LoadingSpinner from '../LoadingSpinner/LoadingSpinner';
import "./adminLayout.scss";

const AdminLayout = memo(() => {
  const { currentUser, loading } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Handle loading state
  if (loading) {
    return <LoadingSpinner message="Loading admin panel..." />;
  }

  // Redirect if not admin
  if (!currentUser?.isAdmin) {
    return <Navigate to="/login" replace />;
  }

  const toggleSidebar = () => setSidebarOpen(prev => !prev);
  const closeSidebar = () => setSidebarOpen(false);

  return (
    <div className="adminContainer" role="application">
      <ToastContainer
        position="top-right"
        autoClose={4000}
        hideProgressBar={false}
        newestOnTop
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="light"
      />
      
      <ErrorBoundary fallback={<div>Error loading sidebar</div>}>
        <AdminSidebar isOpen={sidebarOpen} onClose={closeSidebar} />
      </ErrorBoundary>
      
      {sidebarOpen && <div className="adminOverlay" onClick={closeSidebar} />}
      
      <div className="adminContent">
        <ErrorBoundary fallback={<div>Error loading top bar</div>}>
          <AdminTopBar onToggleSidebar={toggleSidebar} />
        </ErrorBoundary>
        
        <main className="mainContent" role="main">
          <ErrorBoundary 
            fallback={
              <div className="errorContainer">
                <h2>Something went wrong</h2>
                <p>There was an error loading this content.</p>
              </div>
            }
          >
            <Suspense fallback={<LoadingSpinner />}>
              <Outlet />
            </Suspense>
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
});

AdminLayout.propTypes = {
  children: PropTypes.node
};

AdminLayout.displayName = 'AdminLayout';

export default AdminLayout;