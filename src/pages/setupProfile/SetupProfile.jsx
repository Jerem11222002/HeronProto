import React, { useState, useContext, useEffect } from "react";
import { AuthContext } from "../../context/authContext";
import { DarkModeContext } from "../../context/darkModeContext";
import { useNavigate, useLocation } from "react-router-dom";
import "./SetupProfile.scss";

const BASE_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";

const SetupProfile = () => {
  const { currentUser, setCurrentUser } = useContext(AuthContext);
  const { darkMode } = useContext(DarkModeContext);
  const navigate = useNavigate();
  const location = useLocation();
  const [file, setFile] = useState(null);
  const [name, setName] = useState(currentUser?.name || "");
  const [bio, setBio] = useState(currentUser?.bio || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [previewUrl, setPreviewUrl] = useState(currentUser?.profilePicture || null);
  const [isDragging, setIsDragging] = useState(false);

  // Add check to ensure this page only shows after interests selection
  // Update the initial useEffect
useEffect(() => {
  if (!currentUser) {
    navigate("/login");
    return;
  }

  // If user has already completed profile setup, redirect to home
  if (currentUser.profileSetup) {
    navigate("/");
    return;
  }

  // If interests aren't selected, redirect to interests
  if (!currentUser.interestsSelected) {
    navigate(`/interests/${currentUser.id}`);
    return;
  }
}, [currentUser, navigate]);

  useEffect(() => {
    const message = location.state?.message;
    if (message) {
      console.log(message);
    }
  }, [location]);

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDragIn = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragOut = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files?.[0]) {
      handleFileSelection(files[0]);
    }
  };

  const handleFileSelection = (selectedFile) => {
    if (!selectedFile.type.startsWith('image/')) {
      setError("Please select an image file");
      return;
    }
    if (selectedFile.size > 5 * 1024 * 1024) {
      setError("File size should be less than 5MB");
      return;
    }
    setError("");
    setFile(selectedFile);
    setPreviewUrl(URL.createObjectURL(selectedFile));
  };

  const handleImageChange = (e) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      handleFileSelection(selectedFile);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
  
    try {
      const formData = new FormData();
      if (file) formData.append("profilePicture", file);
      formData.append("name", name.trim());
      formData.append("bio", bio.trim());
      formData.append("interestsSelected", "true"); // Maintain interests flag
      formData.append("profileSetup", "true");
  
      const token = localStorage.getItem("token");
      const response = await fetch(`${BASE_URL}/api/auth/setup-profile`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });
  
      const data = await response.json();
  
      if (!response.ok) {
        throw new Error(data.message || "Failed to update profile");
      }
  
      // Update user data maintaining both flags
      const updatedUser = {
        ...data.user,
        interestsSelected: true,
        profileSetup: true
      };
      setCurrentUser(updatedUser);
      localStorage.setItem("currentUser", JSON.stringify(updatedUser));
      
      navigate("/", { 
        state: { message: "Profile setup completed successfully!" } 
      });
  
    } catch (error) {
      console.error("Profile setup error:", error);
      setError(error.message || "Failed to set up profile. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${BASE_URL}/api/auth/setup-profile`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: currentUser.name,
          interestsSelected: true,
          profileSetup: true
        }),
      });
  
      if (!response.ok) {
        throw new Error("Failed to skip profile setup");
      }
  
      const updatedUser = {
        ...currentUser,
        interestsSelected: true,
        profileSetup: true
      };
      setCurrentUser(updatedUser);
      localStorage.setItem("currentUser", JSON.stringify(updatedUser));
  
      navigate("/", { 
        state: { message: "You can always update your profile later from settings." } 
      });
    } catch (error) {
      console.error("Skip error:", error);
      navigate("/");
    }
  };

  return (
    <div className={`setup-profile ${darkMode ? "dark" : "light"}`}>
      <div className="container">
        <h1>Set Up Your Profile</h1>
        <p className="subtitle">Customize your profile to help others know you better</p>

        {error && (
          <div className="error">
            <p>{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="profile-picture-section">
            <div 
              className={`profile-card ${isDragging ? "dragging" : ""}`}
              style={{ backgroundImage: `url(${previewUrl})` }}
              onDragEnter={handleDragIn}
              onDragLeave={handleDragOut}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              {!previewUrl && (
                <div className="upload-overlay">
                  <span className="icon">ðŸ“¸</span>
                  <h3>Add Photo</h3>
                  <p>Drag & Drop or Click to Upload</p>
                </div>
              )}
              <input
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                className="file-input"
              />
            </div>
            <p className="hint">
              {file ? file.name : "Maximum file size: 5MB"}
            </p>
          </div>

          <div className="form-section">
            <div className="input-group">
              <label>Display Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter your display name"
                required
                maxLength={50}
              />
            </div>

            <div className="input-group">
              <label>Bio</label>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Tell us about yourself (optional)"
                maxLength={150}
              />
              <span className="char-count">{bio.length}/150</span>
            </div>
          </div>

          <div className="button-group">
            <button 
              type="submit" 
              className={`submit-button ${loading ? "loading" : ""} ${
                !name.trim() ? "disabled" : ""
              }`}
              disabled={loading || !name.trim()}
            >
              {loading ? (
                <>
                  <span className="spinner"></span>
                  <span>Saving...</span>
                </>
              ) : (
                "Continue"
              )}
            </button>
            
            <button 
              type="button" 
              className="skip-button"
              onClick={handleSkip}
              disabled={loading}
            >
              Skip for now
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SetupProfile;
