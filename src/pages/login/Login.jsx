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
  const navigate = useNavigate();
  const usernameRef = useRef(null);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
  
    try {
      // Clear previous auth state
      clearAuthData();
      setCurrentUser(null);
  
      // Input validation
      const trimmedUsername = username.trim().toLowerCase();
      if (!trimmedUsername || !password) {
        throw new Error("Username and password are required");
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
        throw new Error("Invalid server response");
      }

      // Save authentication data using token manager
      const authData = saveAuthData({
        token: response.data.token,
        user: response.data.user
      }, isAdmin);

      if (!authData) {
        throw new Error("Failed to save authentication data");
      }

      // Set current user from saved data
      const user = authData.user;
      setCurrentUser(user);

      console.log('👤 User authenticated:', {
        id: user._id,
        username: user.username,
        role: isAdmin ? user.adminRole : 'user'
      });
  
      // Handle navigation
      if (isAdmin) {
        if (!user.isAdmin || !user.adminRole) {
          throw new Error("Invalid admin account");
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
      console.error("🚨 Login error:", {
        message: err?.message,
        status: err?.response?.status,
        responseData: err?.response?.data
      });

      let message = "Login failed - Please try again";

      // Prefer server-sent message shapes: { message } or { error } or { msg }
      const resData = err?.response?.data;
      if (resData && typeof resData === 'object') {
        message = resData.message || resData.error || resData.msg || message;
      } else if (err?.response?.status === 401) {
        // Generic unauthorized fallback
        message = "Invalid username or password";
      } else if (err?.message) {
        message = err.message;
      }

      setError(message);
      clearAuthData();
      setCurrentUser(null);
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
            {error && <div className="error-message">{error}</div>}
            <input
              type="text"
              placeholder="Username"
              ref={usernameRef}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoComplete="username"
              className={error ? 'error' : ''}
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              className={error ? 'error' : ''}
            />
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