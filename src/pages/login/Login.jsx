import { useState, useContext, useRef, useEffect } from "react";
import { AuthContext } from "../../context/authContext";
import { useNavigate } from "react-router-dom";
import { saveAuthData, clearAuthData } from "../../utils/tokenManager";
import umakLogo from "../../assets/umak-logo-black-r.png";
import "./login.scss";

const Login = () => {
  const { login, adminLogin, setCurrentUser } = useContext(AuthContext);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();
  const usernameRef = useRef(null);

  // Debug: Log error state changes
  useEffect(() => {
    if (error) {
      console.log(`📊 [State Update] Error state changed to: "${error}"`);
    }
  }, [error]);

  // Fallback: Check localStorage for errors that might not propagate via React state
  useEffect(() => {
    const storedError = localStorage.getItem("loginError");
    if (storedError && !error) {
      console.log("🔧 [Fallback] Found error in localStorage, updating state:", storedError);
      setError(storedError);
    }
  }, [error]);

  // Cleanup: Remove error from localStorage when error state clears
  useEffect(() => {
    if (!error) {
      localStorage.removeItem("loginError");
    }
  }, [error]);

  const handleLogin = async (e) => {
    e.preventDefault();
    
    // Clear any previous error
    localStorage.removeItem("loginError");
    setError("");
    
    setLoading(true);
  
    try {
      // Clear previous auth state
      clearAuthData();
      setCurrentUser(null);
  
      // Input validation
      const trimmedUsername = username.trim().toLowerCase();
      if (!trimmedUsername || !password) {
        const validationError = "❌ Please enter both username and password";
        console.log("✍️ Setting validation error:", validationError);
        setError(validationError);
        setLoading(false);
        usernameRef.current?.focus();
        return;
      }
  
      console.log('📝 Login attempt:', {
        isAdmin,
        username: trimmedUsername,
      });
  
      // Attempt login and get response with token and user data
      const response = isAdmin 
        ? await adminLogin(trimmedUsername, password)
        : await login(trimmedUsername, password);

      console.log('🔑 Raw login response:', response);

      // Validate response structure
      if (!response?.data?.token || !response?.data?.user) {
        console.error('❌ Invalid response structure:', response);
        const invalidError = "❌ Server response invalid. Please try again.";
        console.log("✍️ Setting invalid response error:", invalidError);
        setError(invalidError);
        setLoading(false);
        return;
      }

      // Save authentication data using token manager
      const authData = saveAuthData({
        token: response.data.token,
        user: response.data.user
      }, isAdmin);

      if (!authData) {
        const saveError = "❌ Failed to save login information. Please try again.";
        console.log("✍️ Setting save error:", saveError);
        setError(saveError);
        setLoading(false);
        return;
      }

      // Set current user from saved data
      const user = authData.user;
      setCurrentUser(user);

      console.log('👤 User authenticated:', {
        id: user._id,
        username: user.username,
        role: isAdmin ? user.adminRole : 'user'
      });
  
      // Handle navigation (only on successful login)
      if (isAdmin) {
        if (!user.isAdmin || !user.adminRole) {
          const adminError = "❌ Invalid admin account";
          console.log("✍️ Setting admin error:", adminError);
          setError(adminError);
          setLoading(false);
          return;
        }
        navigate("/admin/dashboard");
      } else {
        if (!user.interestsSelected) {
          navigate(`/interests/${user._id}`);
        } else if (!user.profileSetup) {
          navigate("/setup-profile");
        } else {
          navigate("/");
        }
      }
  
    } catch (err) {
      console.error("🚨 Login error caught:", {
        message: err?.message,
        status: err?.response?.status,
        responseData: err?.response?.data
      });

      let message = "Login failed - Please try again";

      // Prefer server-sent message shapes: { message } or { error } or { msg }
      const resData = err?.response?.data;
      console.log("📋 Response data object:", resData);
      console.log("📋 Type of resData:", typeof resData);
      
      if (resData && typeof resData === 'object') {
        const extractedMessage = resData.message || resData.error || resData.msg;
        console.log("📋 Extracted message from response:", extractedMessage);
        if (extractedMessage) {
          message = extractedMessage;
        }
      }
      
      // Handle specific HTTP status codes (only if no message from server)
      if (!resData?.message && !resData?.error && !resData?.msg) {
        if (err?.response?.status === 401) {
          message = "❌ Invalid username or password";
        } else if (err?.response?.status === 403) {
          message = "❌ Admin access denied. Please use regular login.";
        } else if (err?.response?.status === 404) {
          message = "❌ Account not found. Please check your username.";
        } else if (err?.response?.status === 429) {
          message = "❌ Too many login attempts. Please try again later.";
        } else if (err?.response?.status === 500) {
          message = "❌ Server error. Please try again later.";
        } else if (err?.message?.includes("Network")) {
          message = "❌ Network error. Please check your internet connection.";
        }
      }

      console.log("✍️ Final error message to display:", message);
      
      // Store error in both state AND localStorage as a backup
      // This ensures it displays even if React state update fails
      localStorage.setItem("loginError", message);
      setPassword("");
      
      // Ensure error is set and will display
      console.warn("⚠️ SETTING ERROR STATE - This should trigger a re-render:", message);
      setError(message);
      
      console.log("✅ Error stored in localStorage:", localStorage.getItem("loginError"));
      
      clearAuthData();
      setCurrentUser(null);
      
      // Focus on password field so user can retry
      setTimeout(() => usernameRef.current?.focus(), 100);
    } finally {
      setLoading(false);
    }
  };

  const handleLoginTypeSwitch = (adminMode) => {
    setIsAdmin(adminMode);
    setError("");
    setUsername("");
    setPassword("");
    setTimeout(() => usernameRef.current?.focus(), 50);
  };

  // keyboard shortcuts: Ctrl/Cmd+Shift+A => toggle admin mode; Ctrl/Cmd+Shift+S => go to register
  useEffect(() => {
    const onKey = (e) => {
      const meta = e.ctrlKey || e.metaKey;
      if (!meta || !e.shiftKey) return;
      if (e.key.toLowerCase() === 'a') {
        e.preventDefault();
        setIsAdmin(true);
        setTimeout(() => usernameRef.current?.focus(), 50);
      }
      if (e.key.toLowerCase() === 's') {
        e.preventDefault();
        navigate('/register');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [navigate]);

  return (
    <div className="login">
      <div className="card">
        <div className="left">
          <h1>Heron Fusion</h1>
          <p>Showcase your talent and connect with others!</p>
        </div>
        <div className="right">
          <img src={umakLogo} alt="UMak Logo" className="school-logo" />

          {/* panel-quick: use same structure/classes as register's login shortcut for consistent styling */}
          <div className="panel-quick">
            <span>Don't have an account?</span>
            <button
              type="button"
              className="quick-login"
              onClick={() => { navigate("/register"); setTimeout(() => usernameRef.current?.focus(), 50); }}
            >
              Sign up
            </button>
          </div>

          {/* compact toggle icon placed at the top-right of the right panel */}
          <button
            type="button"
            className="loginToggleIcon"
            onClick={() => handleLoginTypeSwitch(!isAdmin)}
            aria-pressed={isAdmin}
            aria-label={isAdmin ? 'Switch to user login' : 'Switch to admin login'}
            title={isAdmin ? 'Admin — click to switch to User' : 'User — click to switch to Admin'}
          >
            {isAdmin ? '🔒' : '👤'}
          </button>

          <h1>{isAdmin ? 'Admin Login' : 'Login'}</h1>
          <form onSubmit={handleLogin}>
            {/* Debug: Log error state to console on every render */}
            {(() => {
              if (error) {
                console.log(`📊 Rendering error message: "${error}"`);
              }
              return null;
            })()}
            
            {error && (
              <div className="error-message" role="alert">
                {error}
              </div>
            )}
            
            {/* Fallback: If error state isn't working, this will catch it */}
            {username && !error && loading && (
              <div className="processing-message">Processing...</div>
            )}
            <input
              type="text"
              placeholder="Username"
              ref={usernameRef}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoComplete="username"
              className={error ? 'error' : ''}
              disabled={loading}
            />
            <div className="password-input-wrapper">
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className={error ? 'error' : ''}
                disabled={loading}
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                title={showPassword ? "Hide password" : "Show password"}
                disabled={loading}
              >
                {showPassword ? "🙈" : "👁️"}
              </button>
            </div>
            <button 
              type="submit" 
              disabled={loading || !username || !password}
              className={loading ? "loading" : ""}
            >
              {loading ? "Logging in..." : (isAdmin ? "Login as Admin" : "Login")}
            </button>
            <p className="forgot-password-link">
              <a href="/forgot-password">Forgot your password?</a>
            </p>

            
          </form>
        </div>
      </div>
    </div>
  );
};

export default Login;