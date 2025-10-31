import React from 'react';
import Login from "./pages/login/Login";
import Register from "./pages/register/Register";
import Settings from "./pages/settings/Settings";
import SetupProfile from "./pages/setupProfile/SetupProfile";
import PreRegister from "./pages/pre-registration/PreRegister"; // Note: folder stays as pre-registration
import {
  createBrowserRouter,
  RouterProvider,
  Outlet,
  Navigate,
} from "react-router-dom";
import Navbar from "./components/navbar/Navbar";
import LeftBar from "./components/leftBar/LeftBar";
import RightBar from "./components/rightBar/RightBar";
import Home from "./pages/home/Home";
import Profile from "./pages/profile/Profile";
import Events from "./pages/events/events";
import "./style.scss";
import { useContext } from "react";
import { DarkModeContext, DarkModeContextProvider } from "./context/darkModeContext";
import { AuthContext, AuthContextProvider } from "./context/authContext";
import Interests from "./pages/interests/interests";
import { SocketProvider } from './context/SocketContext';
import ErrorBoundary from './components/ErrorBoundary/ErrorBoundary';
import { useEffect } from 'react';
import { EventsProvider } from "./context/EventsContext";
import FullScreenPostPage from "./components/post/FullScreenPostPage"; // <-- add this import
import EventDetailPage from "./pages/admin/Dashboard/EventDetailPage";

// Admin imports - standard format
import AdminLayout from "./components/admin/Layout/AdminLayout";
import AdminDashboard from "./pages/admin/Dashboard/AdminDashboard";
import AdminAnalytics from "./pages/admin/Analytics/AdminAnalytics";
import AdminEvents from "./pages/admin/Events/AdminEvents";
import AdminMonitoring from "./pages/admin/Monitoring/AdminMonitoring";
import AdminParticipants from "./pages/admin/Participants/AdminParticipants";
import AdminSettings from "./pages/admin/Settings/AdminSettings";
import AdminEventsArchive from './pages/admin/Events/AdminEventsArchive';

// Terms and Conditions import
import Terms from "./pages/Pledge/Terms";

// Layout Components
const Layout = ({ darkMode }) => (
  <div className={`theme-${darkMode ? "dark" : "light"}`}>
    <Navbar />
    <div style={{ display: "flex" }}>
      <LeftBar />
      <div style={{ flex: 6 }}>
        <ErrorBoundary>
          <Outlet />
        </ErrorBoundary>
      </div>
      <RightBar />
    </div>
  </div>
);

// Simplified AdminLayoutWrapper
const AdminLayoutWrapper = ({ darkMode }) => (
  <div className={`theme-${darkMode ? "dark" : "light"}`}>
    <AdminLayout>
      <Outlet />
    </AdminLayout>
  </div>
);

// Route Guards
const ProtectedRoute = ({ children }) => {
  const { currentUser, loading } = useContext(AuthContext);
  if (loading) return <div className="loading-spinner">Loading...</div>;
  if (!currentUser || !localStorage.getItem('token')) return <Navigate to="/login" />;
  return <>{children}</>;
};

const AdminRoute = ({ children }) => {
  const { currentUser, loading, isAdmin } = useContext(AuthContext);
  if (loading) return <div className="loading-spinner">Loading...</div>;
  if (!currentUser || !isAdmin || !localStorage.getItem('adminToken')) return <Navigate to="/login" />;
  return <>{children}</>;
};

function AppContent() {
  const { currentUser, isAdmin } = useContext(AuthContext);
  const { darkMode } = useContext(DarkModeContext);

  // Helper for admin permission checks
  const isSuperAdmin = isAdmin && currentUser?.adminRole === 'super';
  const isStandardAdmin = isAdmin && currentUser?.adminRole === 'admin';

  const canAccess = (perm) => !!currentUser?.adminPermissions?.[perm];
  console.log('currentUser', currentUser);
  console.log('isAdmin', isAdmin);
  console.log('adminRole', currentUser?.adminRole);
  console.log('adminPermissions', currentUser?.adminPermissions);

  const router = createBrowserRouter([
    // User Routes
    {
      path: "/",
      element: <ProtectedRoute><Layout darkMode={darkMode} /></ProtectedRoute>,
      children: [
        {
          index: true,
          element: currentUser ? (
            isAdmin ? <Navigate to="/admin/dashboard" replace /> :
            !currentUser.interestsSelected ? <Navigate to={`/interests/${currentUser.id}`} /> :
            !currentUser.profileSetup ? <Navigate to="/setup-profile" /> :
            <Home />
          ) : <Navigate to="/login" />
        },
        {
          path: "profile/:userId",
          element: isAdmin ? <Navigate to="/admin/dashboard" replace /> : <Profile />
        },
        {
          path: "settings",
          element: isAdmin ? <Navigate to="/admin/settings" replace /> : <Settings />
        },
        {
          path: "events",
          element: isAdmin ? <Navigate to="/admin/events" replace /> : <Events />
        },
        {
          path: "pre-registration/:eventId",  // Changed to match the folder structure
          element: isAdmin ? <Navigate to="/admin/events" replace /> : <PreRegister />
        }
      ],
    },
    // Admin Routes
    {
      path: "/admin",
      element: (
        <ErrorBoundary>
          <AdminRoute>
            <AdminLayoutWrapper darkMode={darkMode} />
          </AdminRoute>
        </ErrorBoundary>
      ),
      children: [
        { index: true, element: <AdminDashboard /> },
        { path: "dashboard", element: <AdminDashboard /> },
        { path: "analytics", element: isSuperAdmin ? <AdminAnalytics /> : <Navigate to="/admin/dashboard" replace /> },
        // --- ARCHIVE ROUTE MUST COME FIRST ---
        { 
          path: "events/archive",
          element: isAdmin
            ? <AdminEventsArchive />
            : <Navigate to="/admin/dashboard" replace />
        },
        // --- THEN THE WILDCARD EVENTS ROUTE ---
        { 
          path: "events/*", 
          element: canAccess('canManageEvents') ? <Outlet /> : <Navigate to="/admin/dashboard" replace />,
          children: [
            { index: true, element: <AdminEvents /> },
            { path: "create", element: <AdminEvents mode="create" /> },
            { path: "edit/:eventId", element: <AdminEvents mode="edit" /> },
            { path: "view/:eventId", element: <AdminEvents mode="view" /> }
          ]
        },
        // Only superadmin can access monitoring
        { 
          path: "monitoring", 
          element: isSuperAdmin ? <AdminMonitoring /> : <Navigate to="/admin/dashboard" replace /> 
        },
        { 
          path: "participants", 
          element: canAccess('canManageUsers') ? <AdminParticipants /> : <Navigate to="/admin/dashboard" replace /> 
        },
        { 
          path: "settings", 
          element: canAccess('canManageSettings') ? <AdminSettings /> : <Navigate to="/admin/dashboard" replace /> 
        },
        {
          path: "events/:id",
          element: <EventDetailPage />
        },
      ]
    },
    // Auth Routes
    {
      path: "/login",
      element: currentUser ? (
        isAdmin ? <Navigate to="/admin/dashboard" replace /> :
        !currentUser.interestsSelected ? <Navigate to={`/interests/${currentUser.id}`} /> :
        !currentUser.profileSetup ? <Navigate to="/setup-profile" /> :
        <Navigate to="/" />
      ) : <Login />
    },
    {
      path: "/register",
      element: currentUser ? (
        isAdmin ? <Navigate to="/admin/dashboard" replace /> :
        <Navigate to={`/interests/${currentUser.id}`} />
      ) : <Register />
    },
    {
      path: "/interests/:userId",
      element: currentUser ? (
        isAdmin ? <Navigate to="/admin/dashboard" replace /> :
        currentUser.interestsSelected ? (
          !currentUser.profileSetup ? <Navigate to="/setup-profile" /> :
          <Navigate to="/" />
        ) : <Interests />
      ) : <Navigate to="/login" />
    },
    {
      path: "/setup-profile",
      element: currentUser ? (
        isAdmin ? <Navigate to="/admin/dashboard" replace /> :
        currentUser.profileSetup ? <Navigate to="/" /> :
        !currentUser.interestsSelected ? <Navigate to={`/interests/${currentUser.id}`} /> :
        <SetupProfile />
      ) : <Navigate to="/login" />
    },
    // Terms and Conditions Route
    {
      path: "/terms",
      element: <Terms />
    },
    // Add this route outside of admin/user routes:
    {
      path: "/post/:postId",
      element: <FullScreenPostPage />
    }
  ]);

  return <RouterProvider router={router} />;
}

function App() {
  return (
    <ErrorBoundary>
      {/* DarkModeContextProvider and AuthContextProvider are mounted in src/index.js */}
      <SocketProvider>
        <EventsProvider>
          <AppContent />
        </EventsProvider>
      </SocketProvider>
    </ErrorBoundary>
  );
}

export default App;