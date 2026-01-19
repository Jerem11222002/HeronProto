import React, { useContext, useEffect } from 'react';
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
import Dashboard from "./pages/dashboard/Dashboard";
import RegistrationDetail from "./pages/dashboard/RegistrationDetail";
import "./style.scss";
import "./layout.scss";
import { DarkModeContext, DarkModeContextProvider } from "./context/darkModeContext";
import { AuthContext, AuthContextProvider } from "./context/authContext";
import Interests from "./pages/interests/interests";
import { SocketProvider } from './context/SocketContext';
import ErrorBoundary from './components/ErrorBoundary/ErrorBoundary';
import { EventsProvider } from "./context/EventsContext";
import FullScreenPostPage from "./components/post/FullScreenPostPage"; // <-- add this import
import EventDetailPage from "./pages/admin/Dashboard/EventDetailPage";
import Landing from "./pages/Landing/Landing";

// Admin imports - standard format
import AdminLayout from "./components/admin/Layout/AdminLayout";
import AdminDashboard from "./pages/admin/Dashboard/AdminDashboard";
import AdminAnalytics from "./pages/admin/Analytics/AdminAnalytics";
import AdminEvents from "./pages/admin/Events/AdminEvents";
import AdminMonitoring from "./pages/admin/Monitoring/AdminMonitoring";
import AdminParticipants from "./pages/admin/Participants/AdminParticipants";
import AdminSettings from "./pages/admin/Settings/AdminSettings";
import AdminEventsArchive from './pages/admin/Events/AdminEventsArchive';
import AdminAccounts from "./pages/admin/Accounts/AdminAccounts";

// Terms and Conditions import
import Terms from "./pages/Pledge/Terms";
import Privacy from "./pages/Pledge/Privacy";
import ForgotPassword from "./pages/forgot-password/ForgotPassword";
import ResetPassword from "./pages/reset-password/ResetPassword";
// Landing import (disabled - will redirect to login instead)
// import Landing from "./pages/Landing/Landing";
const Layout = ({ darkMode }) => (
  <div className={`theme-${darkMode ? "dark" : "light"} app-layout`}>
    <div className="navbar">
      <Navbar />
    </div>
    {/* leftbar: add class to allow hiding on small screens via CSS (.mobile-hidden) */}
    <div className="leftbar mobile-hidden">
      <LeftBar />
    </div>
    {/* main-content should be flexible and take remaining space */}
    <div className="main-content">
      <ErrorBoundary>
        <Outlet />
      </ErrorBoundary>
    </div>
    {/* rightbar: add class to allow hiding on small screens */}
    <div className="rightbar mobile-hidden">
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

// Route that requires authentication but can be accessed from unauthenticated state
const AuthRequiredRoute = ({ children, redirectTo = "/login" }) => {
  const { currentUser, loading } = useContext(AuthContext);
  if (loading) return <div className="loading-spinner">Loading...</div>;
  if (!currentUser || !localStorage.getItem('token')) {
    return <Navigate to={redirectTo} replace />;
  }
  return <>{children}</>;
};

function AppContent() {
  const { currentUser, isAdmin, loading } = useContext(AuthContext);
  const { darkMode } = useContext(DarkModeContext);

  // Helper for admin permission checks
  const isSuperAdmin = isAdmin && currentUser?.adminRole === 'super';
  const isStandardAdmin = isAdmin && currentUser?.adminRole === 'admin';

  const canAccess = (perm) => !!currentUser?.adminPermissions?.[perm];
  console.log('currentUser', currentUser);
  console.log('isAdmin', isAdmin);
  console.log('adminRole', currentUser?.adminRole);
  console.log('adminPermissions', currentUser?.adminPermissions);

  // Create a temporary loading router while auth initializes to avoid
  // "No route matches URL" errors on refresh. Hooks must remain unconditional.
  const router = loading
    ? createBrowserRouter([
        { path: '*', element: <div className="loading-spinner">Loading...</div> }
      ])
    : createBrowserRouter([
    // User Routes: show app layout for authenticated users, redirect to login for anonymous
    {
      path: "/",
      element: currentUser ? <ProtectedRoute><Layout darkMode={darkMode} /></ProtectedRoute> : <Navigate to="/login" replace />,
      children: currentUser ? [
        {
          index: true,
          element: isAdmin ? <Navigate to="/admin/dashboard" replace /> :
                   !currentUser.interestsSelected ? <Navigate to={`/interests/${currentUser.id}`} /> :
                   !currentUser.profileSetup ? <Navigate to="/setup-profile" /> :
                   <Home />
        },
        { path: "profile/:userId", element: isAdmin ? <Navigate to="/admin/dashboard" replace /> : <Profile /> },
        { path: "dashboard", element: isAdmin ? <Navigate to="/admin/dashboard" replace /> : <Dashboard /> },
        { path: "dashboard/registration/:id", element: isAdmin ? <Navigate to="/admin/dashboard" replace /> : <RegistrationDetail /> },
        { path: "settings", element: isAdmin ? <Navigate to="/admin/settings" replace /> : <Settings /> },
        { path: "events", element: isAdmin ? <Navigate to="/admin/events" replace /> : <Events /> },
        { path: "pre-registration/:eventId", element: isAdmin ? <Navigate to="/admin/events" replace /> : <PreRegister /> }
      ] : []
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
        // Admin accounts management (list / create / edit UI to be implemented)
        { 
          path: "accounts",
          element: isSuperAdmin ? <AdminAccounts /> : <Navigate to="/admin/dashboard" replace />
        },
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
      path: "/events",
      element: currentUser && !isAdmin ? (
        <ProtectedRoute><Layout darkMode={darkMode}><Events /></Layout></ProtectedRoute>
      ) : currentUser && isAdmin ? (
        <Navigate to="/admin/events" replace />
      ) : (
        <Navigate to={`/login?redirect=/events`} replace />
      )
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
    {
      path: "/privacy",
      element: <Privacy />
    },
    // Add this route outside of admin/user routes:
    {
      path: "/post/:postId",
      element: <FullScreenPostPage />
    },
    // Password Reset Routes
    {
      path: '/forgot-password',
      element: <ForgotPassword />
    },
    {
      path: '/reset-password',
      element: <ResetPassword />
    },
    // Landing route disabled - uncomment Landing import and this route to re-enable
    // {
    //   path: "/landing",
    //   element: <Landing />
    // }
  ]);

  // DEV: runtime scan for CSS rules using fixed px units — logs warnings to console
  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return;
    try {
      const results = [];
      for (const sheet of Array.from(document.styleSheets)) {
        let rules;
        try { rules = sheet.cssRules; } catch (e) { continue; }
        if (!rules) continue;
        for (const r of Array.from(rules)) {
          const txt = r.cssText || '';
          // skip common 0px or border-left etc? we simply flag px usage for review
          if (txt.includes('px')) {
            results.push({ href: sheet.href || '<inline>', rule: txt.replace(/\s+/g, ' ').slice(0, 200) });
            if (results.length >= 50) break;
          }
        }
        if (results.length >= 50) break;
      }
      if (results.length) {
        console.warn(`CSS fixed-size scan: found ${results.length} rules using 'px' — consider using rem/%/vw or responsive utilities. Sample:`, results.slice(0, 10));
      } else {
        console.info('CSS fixed-size scan: no px usage found in loaded stylesheets.');
      }
    } catch (err) {
      console.debug('CSS scan failed', err);
    }
  }, []);

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