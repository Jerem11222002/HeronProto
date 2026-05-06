import React, { useState, useContext, useEffect } from "react";
import { AuthContext } from "../../context/authContext";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "react-toastify";
import "./interests.scss";

const BASE_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";

// Constants
const MIN_INTERESTS = 1;

// Update the interests array to match backend values and organization tags
const interests = [
  { id: 'music', name: "Music", icon: "🎵", description: "Music creation and performance", relatedTags: ['band','choir','vocal-arts','modern-music'] },
  { id: 'dance', name: "Dance", icon: "💃", description: "Contemporary and traditional dance", relatedTags: ['modern-dance','choreography','performance'] },
  { id: 'theatre', name: "Theatre", icon: "🎭", description: "Acting and stage performance", relatedTags: ['drama','acting','stage-performance','performance'] },
  { id: 'cultural-arts', name: "Cultural Arts", icon: "🏺", description: "Traditional and cultural arts", relatedTags: ['traditional-arts','folk-dance','cultural'] },
  { id: 'performance', name: "Performance", icon: "🎪", description: "Live performances and shows", relatedTags: ['stage-performance','concert','showcase'] },
  { id: 'visual-arts', name: "Visual Arts", icon: "🎨", description: "Visual arts and technical production", relatedTags: ['technical-production','multimedia','digital-art'] },

  // NEW additional interests to increase diversity
  { id: 'photography', name: "Photography", icon: "📷", description: "Photography and image arts", relatedTags: ['visual-arts','digital-art','editing'] },
  { id: 'film', name: "Film & Video", icon: "🎬", description: "Filmmaking and video production", relatedTags: ['video','multimedia','production'] },
  { id: 'fashion', name: "Fashion", icon: "👗", description: "Costume, styling and fashion design", relatedTags: ['design','visual-arts'] },
  { id: 'writing', name: "Creative Writing", icon: "✍️", description: "Poetry, prose and scriptwriting", relatedTags: ['literature','storytelling'] },
  { id: 'sculpture', name: "Sculpture", icon: "🗿", description: "3D and tactile arts", relatedTags: ['visual-arts','artwork'] },
  { id: 'animation', name: "Animation", icon: "🧩", description: "2D/3D animation and motion design", relatedTags: ['digital-art','multimedia'] },
  { id: 'photogrammetry', name: "Digital Production", icon: "🖥️", description: "Technical production and multimedia", relatedTags: ['technical-production','multimedia'] }
];

const ProgressBar = ({ current }) => (
  <div className="progress-bar">
    <div 
      className="progress" 
      style={{ width: `100%` }}
    />
    <span>{current} interests selected</span>
  </div>
);

const handleSkip = async (currentUser, setCurrentUser, navigate) => {
  try {
    const token = localStorage.getItem("token");
    
    const response = await fetch(`${BASE_URL}/api/auth/skip-interests`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({
        profileSetup: false  // Explicitly set profileSetup to false
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || "Failed to skip interests");
    }

    const data = await response.json();
    
    const updatedUser = {
      ...currentUser,
      interestsSelected: true,
      profileSetup: false, // Explicitly set profileSetup to false
      interests: []
    };

    localStorage.setItem("currentUser", JSON.stringify(updatedUser));
    setCurrentUser(updatedUser);
    
    // Show success toast
    toast.success("Interests saved successfully!", {
      position: "top-right",
      autoClose: 2000,
    });
    
    navigate("/setup-profile");
    
  } catch (error) {
    console.error("Error skipping interests:", error);
    alert("Failed to skip interests. Please try again.");
  }
};

const Interests = () => {
  const { currentUser, setCurrentUser } = useContext(AuthContext);
  const { userId } = useParams();
  const navigate = useNavigate();
  const [selectedInterests, setSelectedInterests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [availableInterests, setAvailableInterests] = useState([]);
  const [newInterestName, setNewInterestName] = useState("");
  const [newInterestDesc, setNewInterestDesc] = useState("");
  const [creatingInterest, setCreatingInterest] = useState(false);

  useEffect(() => {
    if (!currentUser) {
      navigate("/login");
      return;
    }

    // If user has already completed setup, redirect to home
    if (currentUser.profileSetup && currentUser.interestsSelected) {
      navigate("/");
      return;
    }

    // If interests are selected but profile isn't set up, go to profile setup
    if (currentUser.interestsSelected && !currentUser.profileSetup) {
      navigate("/setup-profile");
      return;
    }

    if (currentUser.id !== userId) {
      setError("User not found or mismatched. Please log in again.");
    }
    
    setLoading(false);
  }, [currentUser, userId, navigate]);

  useEffect(() => {
    // prepare default preset list in the same format used below
    const defaultList = interests.map(it => ({
      id: it.id,
      name: it.name,
      description: it.description || "",
      icon: it.icon || "🎯",
      approved: true,
      pending: false
    }));

    // load interests from backend and merge with defaults (defaults preserved if backend empty)
    (async () => {
      try {
        const res = await fetch(`${BASE_URL}/api/interests`);
        if (!res.ok) throw new Error('Failed to fetch interests');
        const data = await res.json();
        const format = (it) => ({
          id: it.slug || it._id || it.id,
          name: it.name || (it.slug && it.slug.replace(/[-_]/g,' ')),
          description: it.description || "",
          icon: it.icon || "🎯",
          approved: !!it.approved,
          pending: !it.approved
        });
        const remote = (data.interests || []).map(format);

        // merge remote and defaultList, prefer remote values, avoid duplicates by id
        const mergedMap = new Map();
        // add remote first so they take precedence
        remote.forEach(r => {
          if (r && r.id) mergedMap.set(String(r.id), r);
        });
        defaultList.forEach(d => {
          if (d && d.id && !mergedMap.has(String(d.id))) {
            mergedMap.set(String(d.id), d);
          }
        });

        const merged = Array.from(mergedMap.values());
        setAvailableInterests(merged);
      } catch (err) {
        console.error('Failed to load interests list, using presets fallback', err);
        // fallback to defaults so UI never empty
        setAvailableInterests(defaultList);
      }
    })();
  }, []);

  // simple slugify for new interest
  const slugify = (s) =>
    String(s || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");


  const handleCreateInterest = async () => {
    const name = (newInterestName || "").trim();
    if (!name) return alert("Enter a name for the interest");
    const slug = slugify(name);

    // prevent duplicate proposals / existing items
    if (availableInterests.some(it => String(it.id).toLowerCase() === slug)) {
      alert("This interest already exists in the list.");
      setNewInterestName("");
      return;
    }

    setCreatingInterest(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${BASE_URL}/api/interests`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ slug, name, description: newInterestDesc })
      });
      if (!res.ok) {
        const err = await res.json().catch(()=>({message:'Failed'}));
        throw new Error(err.message || "Create failed");
      }
      const { interest } = await res.json();
      // optimistic add: keep pending flag (backend created with approved:false)
      const added = {
        id: interest.slug || interest._id,
        name: interest.name || name,
        description: interest.description || newInterestDesc || "",
        icon: "✨",
        approved: !!interest.approved,
        pending: !interest.approved
      };
      setAvailableInterests(prev => [added, ...prev]);
      // auto-select newly created interest
      setSelectedInterests(prev => prev.includes(added.id) ? prev : [...prev, added.id]);
      setNewInterestName("");
      setNewInterestDesc("");
    } catch (err) {
      console.error("Create interest error:", err);
      alert("Failed to propose interest. Try again.");
    } finally {
      setCreatingInterest(false);
    }
  };

  const toggleInterest = (interestId) => {
    setSelectedInterests((prev) => {
      if (prev.includes(interestId)) {
        return prev.filter((id) => id !== interestId);
      }
      // No limit, just add
      return [...prev, interestId];
    });
  };
  
  const handleSubmit = async (e) => {
    e.preventDefault();
  
    if (selectedInterests.length < MIN_INTERESTS) {
      alert(`Please select at least ${MIN_INTERESTS} interest`);
      return;
    }
  
    const token = localStorage.getItem("token");
    const storedUser = JSON.parse(localStorage.getItem("currentUser"));
  
    if (!token || !storedUser) {
      console.error("Missing auth data:", { token, storedUser });
      setError("Authentication required. Please log in again.");
      navigate("/login");
      return;
    }
  
    setSubmitLoading(true);
  
    try {
      const response = await fetch(`${BASE_URL}/api/auth/interests`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          interests: selectedInterests,
          profileSetup: false  // Explicitly set profileSetup to false
        }),
      });
  
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to save interests");
      }
  
      const data = await response.json();
  
      const updatedUser = {
        ...storedUser,
        interestsSelected: true,
        profileSetup: false, // Explicitly set profileSetup to false
        interests: selectedInterests
      };
  
      localStorage.setItem("currentUser", JSON.stringify(updatedUser));
      setCurrentUser(updatedUser);
      
      // Show success toast
      toast.success("Interests saved successfully!", {
        position: "top-right",
        autoClose: 2000,
      });
      
      navigate("/setup-profile");
  
    } catch (err) {
      console.error("Error details:", err);
      setError(err.message || "Failed to save interests");
    } finally {
      setSubmitLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="interests loading">
        <div className="container">
          <h1>Loading...</h1>
          <div className="spinner"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="interests error">
        <div className="container">
          <h1>Error</h1>
          <p>{error}</p>
          <button onClick={() => navigate("/login")}>Back to Login</button>
        </div>
      </div>
    );
  }

  return (
    <div className="interests">
      <div className="container">
        <h1>Select Your Interests</h1>
        <p className="subtitle">Choose as many interests as you like</p>
        
        <div className="propose-row">
          <input
            className="propose-input"
            type="text"
            aria-label="Propose new interest"
            placeholder="Create or propose a new interest (e.g. 'street-photography')"
            value={newInterestName}
            onChange={(e) => setNewInterestName(e.target.value)}
          />
          <button
            aria-label="Propose interest"
            onClick={handleCreateInterest}
            disabled={creatingInterest}
            className="submit-button"
          >
            {creatingInterest ? "Proposing..." : "Propose"}
          </button>
        </div>
        
        <ProgressBar current={selectedInterests.length} />
        
        <div className="card-container">
          {availableInterests.map((interest) => (
            <div
              key={interest.id}
              className={`card ${selectedInterests.includes(interest.id) ? "selected" : ""}`}
              onClick={() => toggleInterest(interest.id)}
            >
              <span className="icon">{interest.icon}</span>
              <h3>
                {interest.name}{" "}
                {!interest.approved && interest.pending && <span className="pending-badge">pending</span>}
              </h3>
              <p>{interest.description}</p>
            </div>
          ))}
        </div>
        
        <div className="button-group">
          <button 
            onClick={handleSubmit}
            disabled={selectedInterests.length < MIN_INTERESTS || submitLoading}
            className={`submit-button ${
              selectedInterests.length < MIN_INTERESTS ? "disabled" : ""
            } ${submitLoading ? "loading" : ""}`}
          >
            {submitLoading ? "Saving..." : "Continue"}
          </button>
          
          <button 
            onClick={() => handleSkip(currentUser, setCurrentUser, navigate)}
            className="skip-button"
            disabled={submitLoading}
          >
            Skip for now
          </button>
        </div>
      </div>
    </div>
  );
};

export default Interests;