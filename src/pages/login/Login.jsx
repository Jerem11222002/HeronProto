import { useState, useContext } from "react";
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
        message: err.message,
        type: isAdmin ? 'admin' : 'user',
        error: err
      });
      
      setError(err.message || "Login failed - Please try again");
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
  };

  return (
    <div className="login">
      <img src={umakLogo} alt="UMak Logo" className="school-logo" /> 
      <div className="card">
        <div className="left">
          <h1>Heron Fusion</h1>
          <p>Showcase your talent and connect with others!</p>
          <div className="loginTypeSwitch">
            <button 
              className={!isAdmin ? 'active' : ''} 
              onClick={() => handleLoginTypeSwitch(false)}
            >
              User Login
            </button>
            <button 
              className={isAdmin ? 'active' : ''} 
              onClick={() => handleLoginTypeSwitch(true)}
            >
              Admin Login
            </button>
          </div>
          {!isAdmin && (
            <>
              <span>Don't have an account?</span>
              <button onClick={() => navigate("/register")}>Register</button>
            </>
          )}
        </div>
        <div className="right">
          <h1>{isAdmin ? 'Admin Login' : 'Login'}</h1>
          <form onSubmit={handleLogin}>
            {error && <div className="error-message">{error}</div>}
            <input
              type="text"
              placeholder="Username"
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
          </form>
        </div>
      </div>
    </div>
  );
};

export default Login;