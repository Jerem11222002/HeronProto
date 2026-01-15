import React, { useState, useContext, useEffect } from "react";
import "./share.scss";
import Image from "../../assets/img.png";
import { AuthContext } from "../../context/authContext";
import axios from "axios";
import LocalOfferIcon from '@mui/icons-material/LocalOffer';
import VideocamIcon from '@mui/icons-material/Videocam';
import ImageIcon from '@mui/icons-material/Image';
import CloseIcon from '@mui/icons-material/Close';
import AddIcon from '@mui/icons-material/Add';
import EmojiEmotionsIcon from '@mui/icons-material/EmojiEmotions';
import data from '@emoji-mart/data';
import Picker from '@emoji-mart/react';

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB for videos
const MAX_VIDEO_DURATION = 300; // 5 minutes in seconds
const MAX_TAGS = 5;
const ALLOWED_FILE_TYPES = {
  image: ["image/jpeg", "image/png", "image/gif"],
  video: ["video/mp4", "video/quicktime", "video/x-msvideo"]
};
const ALLOWED_VIDEO_TYPES = ALLOWED_FILE_TYPES.video; // Add this line
const MAX_VIDEO_SIZE = MAX_FILE_SIZE; // 50MB for videos

const Share = ({ onAddPost }) => {
  const { currentUser } = useContext(AuthContext);
  const [postContent, setPostContent] = useState("");
  const [selectedImage, setSelectedImage] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState(0);
  const [tags, setTags] = useState([]);
  const [tagInput, setTagInput] = useState("");
  const [suggestedTags, setSuggestedTags] = useState([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [videoFile, setVideoFile] = useState(null);
  const [videoError, setVideoError] = useState(null);
  const [mediaType, setMediaType] = useState(null); // 'image' or 'video'
  const [successMessage, setSuccessMessage] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
    // Add these after existing state declarations
  const [charCount, setCharCount] = useState(0);
  const [isDragActive, setIsDragActive] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const getDefaultAvatar = () => {
    return currentUser?.gender === 'female' 
      ? '/assets/person/Female.jpg' 
      : '/assets/person/Male.jpg';
  };

  const validatePost = () => {
    if (!currentUser?._id || !currentUser?.name) {
      setError("User information missing");
      return false;
    }
    
    if (!postContent.trim() && !imageFile) {
      setError("Post must contain text or image");
      return false;
    }
    
    if (tags.length > MAX_TAGS) {
      setError(`Maximum ${MAX_TAGS} tags allowed`);
      return false;
    }

    return true;
  };

  const validateVideo = async (file) => {
    return new Promise((resolve, reject) => {
      // Check file type
      if (!ALLOWED_VIDEO_TYPES.includes(file.type)) {
        reject('❌ Invalid video format. Please upload MP4 files. (MOV and AVI files may work depending on codec)');
        return;
      }
  
      // Check file size
      if (file.size > MAX_VIDEO_SIZE) {
        reject(`❌ Video file is too large. Maximum size is ${MAX_VIDEO_SIZE/1024/1024}MB. Your file is ${(file.size/1024/1024).toFixed(2)}MB.`);
        return;
      }
  
      const video = document.createElement('video');
      video.preload = 'metadata';
  
      video.onloadedmetadata = () => {
        URL.revokeObjectURL(video.src);
        if (video.duration > MAX_VIDEO_DURATION) {
          reject(`❌ Video is too long. Maximum duration is ${MAX_VIDEO_DURATION/60} minutes. Your video is ${(video.duration/60).toFixed(1)} minutes.`);
          return;
        }
        resolve(true);
      };
  
      video.onerror = () => {
        URL.revokeObjectURL(video.src);
        reject('❌ Invalid video file or corrupted file. Please try another video.');
      };
  
      video.src = URL.createObjectURL(file);
    });
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
  
    // Reset states
    setError(null);
    setVideoError(null);
    setSelectedImage(null);
    setSelectedVideo(null);
    setImageFile(null);
    setVideoFile(null);
  
    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      setError(`❌ File is too large. Maximum size is ${MAX_FILE_SIZE/1024/1024}MB. Your file is ${(file.size/1024/1024).toFixed(2)}MB.`);
      return;
    }
  
    // Determine file type
    const isImage = ALLOWED_FILE_TYPES.image.includes(file.type);
    const isVideo = ALLOWED_FILE_TYPES.video.includes(file.type);
  
    if (!isImage && !isVideo) {
      setError("❌ Unsupported file type. Accepted formats: JPEG, PNG, GIF (images) and MP4, MOV, AVI (videos).");
      return;
    }
  
    try {
      if (isImage) {
        setSelectedImage(URL.createObjectURL(file));
        setImageFile(file);
        setMediaType('image');
      } else if (isVideo) {
        await validateVideo(file);
        setSelectedVideo(URL.createObjectURL(file));
        setVideoFile(file);
        setMediaType('video');
      }
    } catch (err) {
      setVideoError(err.message || 'Error processing video');
      setSelectedVideo(null);
      setVideoFile(null);
    }
  };

  const handleTagInput = (e) => {
    const value = e.target.value;
    if (!value.includes(',')) {
      setTagInput(value);
      return;
    }
    
    const newTags = value.split(',')
      .map(t => t.trim().toLowerCase().replace(/[^a-z0-9-]/g, ''))
      .filter(t => t.length > 0 && t.length <= 20);
    
    setTags(prev => [...new Set([...prev, ...newTags.slice(0, MAX_TAGS - prev.length)])]);
    setTagInput('');
  };

  const removeTag = (index) => {
    setTags(prev => prev.filter((_, i) => i !== index));
  };

  const resetForm = () => {
    setPostContent("");
    setSelectedImage(null);
    setImageFile(null);
    setSelectedVideo(null);
    setVideoFile(null);
    setError(null);
    setProgress(0);
    setTags([]);
    setTagInput("");
    setMediaType(null);
  };

  const createPost = async (formData) => {
    const token = localStorage.getItem("token");
    
    if (!token) {
      throw new Error("❌ Authentication failed. Please log in again.");
    }
    
    try {
      // Add metadata
      formData.append("userId", currentUser._id);
      formData.append("mediaType", mediaType);
      formData.append("engagementMetrics", JSON.stringify({
        views: 0,
        shares: 0,
        popularity: 0,
        recency: 1
      }));
  
      const response = await axios.post(
        `${API_URL}/api/posts`, 
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "multipart/form-data",
          },
          onUploadProgress: (progressEvent) => {
            const percentage = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            setProgress(percentage);
          },
          timeout: 300000 // 5 minutes
        }
      );
  
      // Check if response has data, even if success flag is missing
      if (response.data) {
        // Consider it successful if we have any data
        return {
          success: true,
          post: response.data.post || response.data
        };
      }
  
      throw new Error('No data received from server');
    } catch (error) {
      console.error("Post creation error:", error);
      
      // If we have a response with data, the upload might have succeeded
      if (error.response?.data?.post) {
        return {
          success: true,
          post: error.response.data.post
        };
      }
  
      // Handle specific error cases with user-friendly messages
      if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
        throw new Error("❌ Request timed out. Please check your internet connection and try again.");
      }
      if (error.response?.status === 413) {
        throw new Error("❌ File size too large. Please upload a smaller file (maximum 50MB).");
      }
      if (error.response?.status === 415) {
        throw new Error("❌ Unsupported file type. Accepted formats: JPEG, PNG, GIF (images) and MP4 (videos).");
      }
      if (error.response?.status === 401) {
        throw new Error("❌ Your session expired. Please log in again.");
      }
      if (error.response?.status === 500) {
        throw new Error("❌ Server error. Please try again later.");
      }
      if (!navigator.onLine) {
        throw new Error("❌ No internet connection. Please check your connection and try again.");
      }
      
      throw new Error(error.response?.data?.message || error.message || "❌ Failed to create post. Please try again.");
    }
  };

  const handleShare = async () => {
    if (!validatePost()) return;
  
    const formData = new FormData();
    
    try {
      formData.append("desc", postContent.trim());
      
      if (tags.length > 0) {
        formData.append("tags", JSON.stringify(tags));
      }
      
      if (imageFile || videoFile) {
        const mediaFile = imageFile || videoFile;
        
        if (mediaFile.size > MAX_FILE_SIZE) {
          throw new Error(`❌ File size should not exceed ${MAX_FILE_SIZE/1024/1024}MB`);
        }
        
        if (mediaType === 'video') {
          try {
            await validateVideo(videoFile);
          } catch (err) {
            throw new Error(`${err.message}`);
          }
        }
        
        formData.append("media", mediaFile);
      }
  
      setIsLoading(true);
      setError(null);
      setProgress(0);
  
      const result = await createPost(formData);
      
      // After successful post creation
      if (result.success && result.post) {
        setSuccessMessage("✅ Your post has been successfully shared!");
        setIsProcessing(false);
        resetForm();
        setTimeout(() => setSuccessMessage(null), 5000);
      } else {
        throw new Error("❌ Failed to create post. Please try again.");
      }
      
    } catch (err) {
      console.error("Share error:", err);
      setError(err.message || "❌ Failed to create post. Please try again.");
      // Don't reset form on error so user can try again
    } finally {
      setIsLoading(false);
      setProgress(0);
    }
  };

  const getContentTags = async (content) => {
    // Validate content before making the request
    if (!content || content.trim().length < 10) {
      console.log('Content too short for analysis');
      return;
    }
  
    setIsAnalyzing(true);
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        console.error("Authentication token missing");
        return;
      }
  
      const response = await axios.post(
        `${API_URL}/api/posts/analyze-content`,
        { 
          content: content.trim(),
          userId: currentUser._id 
        },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );
  
      if (response.data?.tags) {
        setSuggestedTags(response.data.tags);
      }
    } catch (error) {
      console.error("Error analyzing content:", error);
      // Don't show error to user, just silently fail
      setSuggestedTags([]);
    } finally {
      setIsAnalyzing(false);
    }
  };
  
  // Update the useEffect that calls getContentTags
  useEffect(() => {
    let timeoutId;
    
    if (postContent.trim().length >= 10) {
      timeoutId = setTimeout(() => {
        getContentTags(postContent);
      }, 1000);
    } else {
      setSuggestedTags([]); // Clear suggestions if content is too short
    }
  
    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [postContent]);

  useEffect(() => {
    if (!currentUser?.id && !currentUser?._id) {
      setError("Please log in to create posts");
    }
  }, [currentUser]);

    return (
    <div className="share">
      <div 
        className={`container ${isDragActive ? 'drag-active' : ''}`}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragActive(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          setIsDragActive(false);
        }}
        onDrop={async (e) => {
          e.preventDefault();
          setIsDragActive(false);
          const file = e.dataTransfer.files[0];
          if (file) {
            await handleFileChange({ target: { files: [file] }});
          }
        }}
      >
        <div className="top">
          <img 
            src={currentUser.profilePicture || getDefaultAvatar()} 
            alt={currentUser.name} 
            className="profile-pic"
          />
          <div className="input-wrapper">
            <label htmlFor="postContent" className="sr-only">Write a post</label>
            <input
              id="postContent"
              name="postContent"
              type="text"
              placeholder={`What's on your mind, ${currentUser.name || 'there'}?`}
              value={postContent}
              onChange={(e) => {
                setPostContent(e.target.value);
                setCharCount(e.target.value.length);
                setError(null);
              }}
              maxLength={500}
              disabled={isLoading}
            />
            <span className="char-count">{charCount}/500</span>
          </div>
        </div>
  
        <div className="middle">
          <div className="tag-input-container">
            <div className="tag-input-wrapper">
              <LocalOfferIcon className="tag-icon" />
              <label htmlFor="tagInput" className="sr-only">Add tags</label>
              <input
                id="tagInput"
                name="tagInput"
                type="text"
                placeholder="Add tags (comma separated) e.g., painting, digital-art"
                value={tagInput}
                onChange={handleTagInput}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && tagInput.trim()) {
                    handleTagInput({ target: { value: tagInput + ',' }});
                  }
                }}
                disabled={isLoading}
              />
            </div>
  
            {suggestedTags.length > 0 && (
              <div className="suggested-tags">
                <span className="suggestion-label">
                  Suggested tags:
                </span>
                {suggestedTags.map((tag, index) => (
                  <button
                    key={tag}
                    className="suggested-tag"
                    onClick={() => {
                      if (tags.length < MAX_TAGS && !tags.includes(tag)) {
                        setTags(prev => [...prev, tag]);
                      }
                    }}
                    disabled={tags.includes(tag) || tags.length >= MAX_TAGS}
                  >
                    #{tag}
                  </button>
                ))}
              </div>
            )}
  
            <div className="tag-list">
              {tags.map((tag, index) => (
                <div key={index} className="tag-item">
                  #{tag}
                  <button 
                    type="button" 
                    onClick={() => removeTag(index)}
                    disabled={isLoading}
                  >
                    &times;
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
  
        <hr />
  
        <div className="bottom">
          <div className="left">
            <input
              type="file"
              id="mediaFile"
              style={{ display: "none" }}
              accept="image/*,video/*"
              onChange={handleFileChange}
              disabled={isLoading}
              aria-label="Add image or video"
            />
            <label htmlFor="mediaFile">
              <div className="media-button">
                <div className="item">
                  <AddIcon />
                  <span>Add Media</span>
                  <span className="supported-formats">Images & Videos</span>
                </div>
              </div>
            </label>
            
            <button 
              className="emoji-button"
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              type="button"
              aria-label={showEmojiPicker ? "Close emoji picker" : "Open emoji picker"}
            >
              <EmojiEmotionsIcon />
            </button>
            
            {showEmojiPicker && (
              <div className="emoji-picker-wrapper">
                <Picker 
                  data={data} 
                  onEmojiSelect={(emoji) => {
                    setPostContent(prev => prev + emoji.native);
                    setShowEmojiPicker(false);
                  }}
                />
              </div>
            )}
          </div>
          
          <div className="right">
            <button 
              onClick={handleShare} 
              disabled={isLoading || (!postContent.trim() && !imageFile && !videoFile)}
              className={`share-button ${isLoading ? 'loading' : ''}`}
            >
              {isLoading ? (
                <>
                  <div className="spinner"></div>
                  <span>{progress > 0 ? `${progress}%` : 'Processing...'}</span>
                </>
              ) : 'Share'}
            </button>
          </div>
        </div>
  
        {/* Media Preview */}
        {(selectedImage || selectedVideo) && (
          <div className="media-preview-container">
            {selectedImage ? (
              <img src={selectedImage} alt="Selected" className="media-preview" />
            ) : (
              <video 
                controls 
                className="media-preview"
                src={selectedVideo}
              >
                Your browser does not support the video tag.
              </video>
            )}
            <button
              className="remove-button"
              onClick={() => {
                setSelectedImage(null);
                setSelectedVideo(null);
                setImageFile(null);
                setVideoFile(null);
                setMediaType(null);
              }}
              disabled={isLoading}
            >
              <CloseIcon />
            </button>
          </div>
        )}
  
        {/* Status Messages */}
        {error && <div className="error-message">{error}</div>}
        {videoError && <div className="error-message">{videoError}</div>}
        
        {isLoading && progress > 0 && (
          <div className="progress-container">
            <div 
              className="progress-bar" 
              style={{ width: `${progress}%` }}
            />
          </div>
        )}
  
        {successMessage && (
          <div className="success-message">
            <span>{successMessage}</span>
            {isProcessing && (
              <div className="processing-indicator">
                <div className="spinner"></div>
                <span>Processing media...</span>
              </div>
            )}
          </div>
        )}
  
        {isDragActive && (
          <div className="drag-overlay">
            <div className="drag-message">
              Drop media here to upload
            </div>
          </div>
        )}
      </div>
    </div>
  );
  };

export default Share;