import React, { useState, useContext, useEffect } from "react";
import "./share.scss";
import Image from "../../assets/img.png";
import { AuthContext } from "../../context/authContext";
import { useLanguage } from "../../hooks/useLanguage";
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
const DRAFT_DB_NAME = "heronDrafts";
const DRAFT_DB_VERSION = 1;
const DRAFT_MEDIA_STORE = "draftMedia";
const MAX_DRAFT_INLINE_BYTES = 2 * 1024 * 1024; // 2MB inline fallback

const Share = ({ onAddPost }) => {
  const { currentUser } = useContext(AuthContext);
  const { t } = useLanguage();
  const [postContent, setPostContent] = useState("");
  const [mediaFiles, setMediaFiles] = useState([]); // Array of {file, preview, type}
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState(0);
  const [tags, setTags] = useState([]);
  const [tagInput, setTagInput] = useState("");
  const [suggestedTags, setSuggestedTags] = useState([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [videoError, setVideoError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [charCount, setCharCount] = useState(0);
  const [isDragActive, setIsDragActive] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showDraftsModal, setShowDraftsModal] = useState(false);
  const [drafts, setDrafts] = useState([]);
  const [currentMediaIndex, setCurrentMediaIndex] = useState(0);
  const [showMediaUploadModal, setShowMediaUploadModal] = useState(false);
  const [tempMediaFiles, setTempMediaFiles] = useState([]); // Temporary files in modal
  const [uploadDragActive, setUploadDragActive] = useState(false);

  const MAX_MEDIA_FILES = 10;
  
  // Helper function to convert File to base64
  const fileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
    });
  };
  
  // Helper function to convert data URL / blob URL back to File
  const base64ToFile = async (base64String, fileName, fileType) => {
    try {
      const response = await fetch(base64String);
      const blob = await response.blob();
      const resolvedType = fileType || blob.type || "application/octet-stream";
      const resolvedName = fileName || "media";
      return new File([blob], resolvedName, { type: resolvedType });
    } catch (e) {
      console.error('Error converting base64 to file:', e);
      return null;
    }
  };

  const openDraftMediaDB = () => {
    if (typeof window === "undefined" || !("indexedDB" in window)) {
      return Promise.resolve(null);
    }

    return new Promise((resolve) => {
      const request = indexedDB.open(DRAFT_DB_NAME, DRAFT_DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(DRAFT_MEDIA_STORE)) {
          db.createObjectStore(DRAFT_MEDIA_STORE);
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => {
        console.error("Error opening draft media DB:", request.error);
        resolve(null);
      };
    });
  };

  const saveMediaBlobToDb = async (mediaId, file) => {
    const db = await openDraftMediaDB();
    if (!db || !mediaId || !file) return false;

    return new Promise((resolve) => {
      const tx = db.transaction(DRAFT_MEDIA_STORE, "readwrite");
      tx.objectStore(DRAFT_MEDIA_STORE).put(file, mediaId);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => {
        console.error("Error saving media blob:", tx.error);
        resolve(false);
      };
    });
  };

  const loadMediaBlobFromDb = async (mediaId) => {
    const db = await openDraftMediaDB();
    if (!db || !mediaId) return null;

    return new Promise((resolve) => {
      const tx = db.transaction(DRAFT_MEDIA_STORE, "readonly");
      const request = tx.objectStore(DRAFT_MEDIA_STORE).get(mediaId);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => {
        console.error("Error loading media blob:", request.error);
        resolve(null);
      };
    });
  };

  const deleteMediaBlobFromDb = async (mediaId) => {
    const db = await openDraftMediaDB();
    if (!db || !mediaId) return false;

    return new Promise((resolve) => {
      const tx = db.transaction(DRAFT_MEDIA_STORE, "readwrite");
      tx.objectStore(DRAFT_MEDIA_STORE).delete(mediaId);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => {
        console.error("Error deleting media blob:", tx.error);
        resolve(false);
      };
    });
  };

  const getDefaultAvatar = () => {
    return currentUser?.gender === 'female' 
      ? '/assets/person/Female.jpg' 
      : '/assets/person/Male.jpg';
  };

  // Load drafts from sessionStorage (full data with media) on component mount
  useEffect(() => {
    let savedDrafts = null;
    
    // First try sessionStorage (current session with blob URLs)
    const sessionDrafts = sessionStorage.getItem('postDrafts');
    if (sessionDrafts) {
      try {
        savedDrafts = JSON.parse(sessionDrafts);
      } catch (e) {
        console.error('Error loading drafts from sessionStorage:', e);
      }
    }
    
    // If no sessionStorage drafts, try localStorage (persisted drafts)
    if (!savedDrafts || savedDrafts.length === 0) {
      const localDrafts = localStorage.getItem('postDrafts');
      if (localDrafts) {
        try {
          savedDrafts = JSON.parse(localDrafts);
        } catch (e) {
          console.error('Error loading drafts from localStorage:', e);
        }
      }
    }
    
    if (savedDrafts && Array.isArray(savedDrafts)) {
      setDrafts(savedDrafts);
    }
  }, []);

  const validatePost = () => {
    if (!currentUser?._id || !currentUser?.name) {
      setError("User information missing");
      return false;
    }
    
    if (!postContent.trim() && mediaFiles.length === 0) {
      setError("Post must contain text or media");
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
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
  
    const currentCount = mediaFiles.length;
    const canAdd = MAX_MEDIA_FILES - currentCount;
    
    if (canAdd <= 0) {
      setError(`Maximum ${MAX_MEDIA_FILES} media items allowed per post`);
      return;
    }

    if (files.length > canAdd) {
      setError(`Can only add ${canAdd} more media items. Maximum is ${MAX_MEDIA_FILES}`);
      return;
    }

    setError(null);
    setVideoError(null);
    
    const newMedia = [];
    
    for (const file of files) {
      // Validate file size
      if (file.size > MAX_FILE_SIZE) {
        setError(`❌ File "${file.name}" is too large. Maximum size is ${MAX_FILE_SIZE/1024/1024}MB.`);
        continue;
      }
    
      // Determine file type
      const isImage = ALLOWED_FILE_TYPES.image.includes(file.type);
      const isVideo = ALLOWED_FILE_TYPES.video.includes(file.type);
    
      if (!isImage && !isVideo) {
        setError(`❌ File "${file.name}" has unsupported format.`);
        continue;
      }
    
      try {
        if (isImage) {
          newMedia.push({
            file,
            preview: URL.createObjectURL(file),
            type: 'image',
            name: file.name,
            size: file.size,
            mimeType: file.type
          });
        } else if (isVideo) {
          await validateVideo(file);
          newMedia.push({
            file,
            preview: URL.createObjectURL(file),
            type: 'video',
            name: file.name,
            size: file.size,
            mimeType: file.type
          });
        }
      } catch (err) {
        setVideoError(err.message || 'Error processing video');
      }
    }

    setMediaFiles(prev => [...prev, ...newMedia]);
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

  const removeMedia = (index) => {
    const mediaToRemove = mediaFiles[index];
    if (mediaToRemove?.mediaId) {
      deleteMediaBlobFromDb(mediaToRemove.mediaId);
    }
    setMediaFiles(prev => {
      const updated = prev.filter((_, i) => i !== index);
      // Clean up object URL
      URL.revokeObjectURL(prev[index].preview);
      // Adjust current index if needed
      if (currentMediaIndex >= updated.length && updated.length > 0) {
        setCurrentMediaIndex(updated.length - 1);
      } else if (updated.length === 0) {
        setCurrentMediaIndex(0);
      }
      return updated;
    });
  };

  const removeTempMedia = (index) => {
    setTempMediaFiles(prev => {
      const updated = prev.filter((_, i) => i !== index);
      // Clean up object URL
      URL.revokeObjectURL(prev[index].preview);
      return updated;
    });
  };

  const handleMediaUploadModalChange = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    const currentCount = tempMediaFiles.length;
    const canAdd = MAX_MEDIA_FILES - currentCount;

    if (canAdd <= 0) {
      setError(`Maximum ${MAX_MEDIA_FILES} media items allowed per post`);
      return;
    }

    if (files.length > canAdd) {
      setError(`Can only add ${canAdd} more media items. Maximum is ${MAX_MEDIA_FILES}`);
      return;
    }

    setError(null);
    const newMedia = [];

    for (const file of files) {
      if (file.size > MAX_FILE_SIZE) {
        setError(`❌ File "${file.name}" is too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB.`);
        continue;
      }

      const isImage = ALLOWED_FILE_TYPES.image.includes(file.type);
      const isVideo = ALLOWED_FILE_TYPES.video.includes(file.type);

      if (!isImage && !isVideo) {
        setError(`❌ File "${file.name}" has unsupported format.`);
        continue;
      }

      try {
        if (isImage) {
          newMedia.push({
            file,
            preview: URL.createObjectURL(file),
            type: 'image',
            name: file.name,
            size: file.size,
            mimeType: file.type
          });
        } else if (isVideo) {
          await validateVideo(file);
          newMedia.push({
            file,
            preview: URL.createObjectURL(file),
            type: 'video',
            name: file.name,
            size: file.size,
            mimeType: file.type
          });
        }
      } catch (err) {
        setError(err.message || 'Error processing file');
      }
    }

    setTempMediaFiles(prev => [...prev, ...newMedia]);
  };

  const confirmMediaUpload = () => {
    setMediaFiles(prev => [...prev, ...tempMediaFiles]);
    setTempMediaFiles([]);
    setShowMediaUploadModal(false);
    setError(null);
  };

  const cancelMediaUpload = () => {
    // Clean up temp files
    tempMediaFiles.forEach(m => URL.revokeObjectURL(m.preview));
    setTempMediaFiles([]);
    setShowMediaUploadModal(false);
    setError(null);
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const saveDraft = async () => {
    if (!postContent.trim() && mediaFiles.length === 0) {
      setError("Draft must contain text or media");
      return;
    }

    try {
      setIsProcessing(true);
      setSuccessMessage("💾 Saving draft...");
      
      const draftId = Date.now();
      const storageWarnings = [];

      // Persist media blobs in IndexedDB; keep a small base64 fallback
      const mediaWithBase64 = await Promise.all(
        mediaFiles.map(async (m, index) => {
          const name = m.name || m.file?.name || `media-${index + 1}`;
          const size = typeof m.size === 'number' ? m.size : (m.file?.size ?? 0);
          const mimeType = m.mimeType || m.file?.type || (m.type === 'video' ? 'video/mp4' : 'image/png');
          const mediaId = m.mediaId || `${draftId}-${index}-${Math.random().toString(36).slice(2, 8)}`;
          const canInline = Boolean(m.file) && size > 0 && size <= MAX_DRAFT_INLINE_BYTES;
          let base64 = null;

          if (m.file && canInline) {
            try {
              base64 = await fileToBase64(m.file);
            } catch (e) {
              console.error('Error converting file to base64:', e);
            }
          }

          if (m.file) {
            const saved = await saveMediaBlobToDb(mediaId, m.file);
            if (!saved && !base64) {
              storageWarnings.push(name);
            }
          }

          return {
            type: m.type,
            name,
            size,
            mimeType,
            mediaId,
            preview: m.preview,
            base64: base64 // Small inline fallback only
          };
        })
      );

      setMediaFiles(prev => prev.map((m, index) => ({
        ...m,
        mediaId: mediaWithBase64[index]?.mediaId || m.mediaId,
        name: mediaWithBase64[index]?.name || m.name,
        size: typeof mediaWithBase64[index]?.size === "number" ? mediaWithBase64[index].size : m.size,
        mimeType: mediaWithBase64[index]?.mimeType || m.mimeType
      })));

      const draft = {
        id: draftId,
        content: postContent,
        tags: tags,
        media: mediaWithBase64,
        createdAt: new Date().toLocaleString()
      };

      const updatedDrafts = [draft, ...drafts.filter(d => d.id !== draft.id)];
      setDrafts(updatedDrafts);
      
      // Save draft data to sessionStorage (includes preview + base64 fallback)
      sessionStorage.setItem('postDrafts', JSON.stringify(
        updatedDrafts.map(d => ({
          ...d,
          media: d.media.map(m => ({
            type: m.type,
            name: m.name,
            size: m.size,
            mimeType: m.mimeType,
            mediaId: m.mediaId,
            preview: m.preview,
            base64: m.base64
          }))
        }))
      ));
      
      // Save metadata to localStorage for persistence across sessions
      localStorage.setItem('postDrafts', JSON.stringify(updatedDrafts.map(d => ({
        id: d.id,
        content: d.content,
        tags: d.tags,
        createdAt: d.createdAt,
        mediaCount: d.media.length,
        media: d.media.map(m => ({
          type: m.type,
          name: m.name,
          size: m.size,
          mimeType: m.mimeType,
          mediaId: m.mediaId,
          base64: m.base64
        }))
      }))));

      if (storageWarnings.length > 0) {
        setError("⚠️ Some media files could not be saved for reload. Please re-add them if they do not appear.");
      }
      
      setSuccessMessage("✅ Draft saved successfully!");
      setIsProcessing(false);
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (e) {
      console.error('Error saving draft:', e);
      setError('Failed to save draft. Please try again.');
      setIsProcessing(false);
    }
  };

  const loadDraft = async (draft) => {
    try {
      setSuccessMessage("⏳ Loading draft...");
      setError(null);
      setVideoError(null);

      const draftContent = (draft?.content ?? draft?.desc ?? draft?.text ?? "");
      setPostContent(draftContent);
      setCharCount(draftContent.length);
      setTags(Array.isArray(draft?.tags) ? draft.tags : []);
      setTagInput("");
      
      // Clear existing media
      mediaFiles.forEach(m => {
        if (m.preview && m.preview.startsWith('blob:')) {
          URL.revokeObjectURL(m.preview);
        }
      });
      
      // Restore media from draft
      const draftMedia = Array.isArray(draft?.media)
        ? draft.media
        : (Array.isArray(draft?.mediaFiles) ? draft.mediaFiles : []);

      if (draftMedia.length > 0) {
        const restoredMedia = await Promise.all(
          draftMedia.map(async (m, index) => {
            const name = m.name || `media-${index + 1}`;
            const mimeType = m.mimeType;
            let file = null;

            if (m.mediaId) {
              const blob = await loadMediaBlobFromDb(m.mediaId);
              if (blob) {
                const resolvedType = mimeType || blob.type || "application/octet-stream";
                file = new File([blob], name, { type: resolvedType });
              }
            }

            if (!file && (m.base64 || m.preview)) {
              const previewSource = m.base64 || m.preview;
              file = await base64ToFile(previewSource, name, mimeType);
            }

            if (!file) {
              return null;
            }

            const resolvedType = m.type || (file.type.startsWith('video') ? 'video' : 'image');
            return {
              file,
              preview: URL.createObjectURL(file),
              type: resolvedType,
              name,
              size: typeof m.size === 'number' ? m.size : file.size,
              mimeType: file.type,
              mediaId: m.mediaId
            };
          })
        );
        
        const validMedia = restoredMedia.filter(m => m !== null);
        
        if (validMedia.length === 0) {
          setError("⚠️ Media from this draft could not be restored. Please re-add the files.");
          setMediaFiles([]);
        } else if (validMedia.length < draftMedia.length) {
          setError(`⚠️ ${draftMedia.length - validMedia.length} media file(s) could not be restored. Please re-add them.`);
          setMediaFiles(validMedia);
        } else {
          setMediaFiles(validMedia);
        }
        setCurrentMediaIndex(0);
      } else {
        setMediaFiles([]);
        setCurrentMediaIndex(0);
        if (draft?.mediaCount > 0) {
          setError("⚠️ Media from this draft is no longer available. Please re-add the files.");
        }
      }
      
      setShowDraftsModal(false);
      setSuccessMessage("✅ Draft loaded successfully!");
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (e) {
      console.error('Error loading draft:', e);
      setError('Failed to load draft. Please try again.');
      setShowDraftsModal(false);
    }
  };

  const deleteDraft = async (draftId) => {
    const draftToDelete = drafts.find(d => d.id === draftId);
    if (draftToDelete?.media?.length) {
      await Promise.all(
        draftToDelete.media
          .filter(m => m.mediaId)
          .map(m => deleteMediaBlobFromDb(m.mediaId))
      );
    }

    const updatedDrafts = drafts.filter(d => d.id !== draftId);
    setDrafts(updatedDrafts);
    
    // Update both sessionStorage and localStorage
    sessionStorage.setItem('postDrafts', JSON.stringify(updatedDrafts));
    localStorage.setItem('postDrafts', JSON.stringify(updatedDrafts.map(d => ({
      id: d.id,
      content: d.content,
      tags: d.tags,
      createdAt: d.createdAt,
      mediaCount: d.media?.length || 0,
      media: (d.media || []).map(m => ({
        type: m.type,
        name: m.name,
        size: m.size,
        mimeType: m.mimeType,
        mediaId: m.mediaId,
        base64: m.base64
      }))
    }))));
  };

  const resetForm = () => {
    setPostContent("");
    setCharCount(0);
    // Clean up object URLs
    mediaFiles.forEach(m => URL.revokeObjectURL(m.preview));
    setMediaFiles([]);
    setError(null);
    setProgress(0);
    setTags([]);
    setTagInput("");
    setCurrentMediaIndex(0);
  };

  const createPost = async (formData) => {
    const token = localStorage.getItem("token");
    
    if (!token) {
      throw new Error("❌ Authentication failed. Please log in again.");
    }
    
    try {
      // Add metadata
      formData.append("userId", currentUser._id);
      formData.append("mediaCount", mediaFiles.length);
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
        throw new Error("❌ File size too large. Please upload smaller files (maximum 50MB each).");
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
      
      // Add all media files
      if (mediaFiles.length > 0) {
        mediaFiles.forEach((media, index) => {
          if (media.file.size > MAX_FILE_SIZE) {
            throw new Error(`❌ File size should not exceed ${MAX_FILE_SIZE/1024/1024}MB`);
          }
          
          if (media.type === 'video') {
            // Video validation already done on file selection
          }
          
          formData.append(`media`, media.file);
        });
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
          const files = e.dataTransfer.files;
          if (files.length > 0) {
            await handleFileChange({ target: { files }});
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
              placeholder={`${t('whats-on-your-mind')}, ${currentUser.name || 'there'}?`}
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
                placeholder={t('add-tags')}
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
            <button
              className="media-button-improved"
              onClick={() => setShowMediaUploadModal(true)}
              disabled={isLoading || mediaFiles.length >= MAX_MEDIA_FILES}
              type="button"
              title="Add images or videos"
            >
              <AddIcon />
              <span>{t('add-media')}</span>
              <span className="supported-formats">{t('images-videos')}</span>
              {mediaFiles.length > 0 && (
                <span className="media-count">({mediaFiles.length}/{MAX_MEDIA_FILES})</span>
              )}
            </button>
            
            <button 
              className="emoji-button"
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              type="button"
              aria-label={showEmojiPicker ? "Close emoji picker" : "Open emoji picker"}
            >
              <EmojiEmotionsIcon />
            </button>

            <button
              className="drafts-button"
              onClick={() => setShowDraftsModal(!showDraftsModal)}
              type="button"
              aria-label="View drafts"
              title={`${drafts.length} drafts`}
            >
              <span className="draft-icon">📋</span>
              {drafts.length > 0 && <span className="draft-badge">{drafts.length}</span>}
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
        </div>
  
        {/* Media Preview - Multiple Items */}
        {mediaFiles.length > 0 && (
          <div className="media-preview-container">
            <div className="media-carousel">
              {mediaFiles[currentMediaIndex].type === 'image' ? (
                <img 
                  src={mediaFiles[currentMediaIndex].preview} 
                  alt={`Media ${currentMediaIndex + 1}`}
                  className="media-preview" 
                />
              ) : (
                <video 
                  controls 
                  className="media-preview"
                  src={mediaFiles[currentMediaIndex].preview}
                >
                  Your browser does not support the video tag.
                </video>
              )}

              {mediaFiles.length > 1 && (
                <>
                  <button
                    className="carousel-nav prev"
                    onClick={() => setCurrentMediaIndex((i) => (i - 1 + mediaFiles.length) % mediaFiles.length)}
                    type="button"
                    aria-label="Previous media"
                  >
                    ❮
                  </button>
                  <button
                    className="carousel-nav next"
                    onClick={() => setCurrentMediaIndex((i) => (i + 1) % mediaFiles.length)}
                    type="button"
                    aria-label="Next media"
                  >
                    ❯
                  </button>
                  <div className="carousel-counter">
                    {currentMediaIndex + 1}/{mediaFiles.length}
                  </div>
                </>
              )}
            </div>

            {/* Media Thumbnails */}
            {mediaFiles.length > 1 && (
              <div className="media-thumbnails">
                {mediaFiles.map((media, index) => (
                  <div
                    key={index}
                    className={`thumbnail ${index === currentMediaIndex ? 'active' : ''}`}
                    onClick={() => setCurrentMediaIndex(index)}
                    title={`${media.type} ${index + 1}`}
                  >
                    {media.type === 'image' ? (
                      <img src={media.preview} alt={`Thumb ${index + 1}`} />
                    ) : (
                      <div className="video-thumb">
                        <span>🎥</span>
                      </div>
                    )}
                    <button
                      className="remove-thumb"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeMedia(index);
                      }}
                      disabled={isLoading}
                      type="button"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}

            {mediaFiles.length === 1 && (
              <button
                className="remove-button"
                onClick={() => removeMedia(0)}
                disabled={isLoading}
                type="button"
              >
                <CloseIcon />
              </button>
            )}
          </div>
        )}

        {/* Action Buttons - Below Media Preview */}
        <div className="bottom-actions">
          <div className="right">
            <button 
              onClick={saveDraft}
              disabled={isLoading || (!postContent.trim() && mediaFiles.length === 0)}
              className="draft-save-button"
              type="button"
              title="Save as draft"
            >
              💾 Draft
            </button>

            <button 
              onClick={handleShare} 
              disabled={isLoading || (!postContent.trim() && mediaFiles.length === 0)}
              className={`share-button ${isLoading ? 'loading' : ''}`}
            >
              {isLoading ? (
                <>
                  <div className="spinner"></div>
                  <span>{progress > 0 ? `${progress}%` : 'Processing...'}</span>
                </>
              ) : t('share')}
            </button>
          </div>
        </div>

        {/* Media Upload Modal */}
        {showMediaUploadModal && (
          <div className="media-upload-modal-overlay" onClick={cancelMediaUpload}>
            <div className="media-upload-modal" onClick={(e) => e.stopPropagation()}>
              <div className="upload-header">
                <h3>📸 Select Photos & Videos</h3>
                <button
                  className="close-modal"
                  onClick={cancelMediaUpload}
                  type="button"
                  title="Close"
                >
                  ✕
                </button>
              </div>

              <div className="upload-content">
                {/* Hidden File Input */}
                <input
                  type="file"
                  id="uploadInput"
                  style={{ display: "none" }}
                  accept="image/*,video/*"
                  onChange={handleMediaUploadModalChange}
                  multiple
                  disabled={tempMediaFiles.length >= MAX_MEDIA_FILES}
                />

                {tempMediaFiles.length === 0 ? (
                  // Drag & Drop Zone (when no files selected)
                  <div
                    className={`drag-drop-zone ${uploadDragActive ? 'active' : ''}`}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setUploadDragActive(true);
                    }}
                    onDragLeave={() => setUploadDragActive(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setUploadDragActive(false);
                      handleMediaUploadModalChange({ target: { files: e.dataTransfer.files }});
                    }}
                  >
                    <div className="drag-drop-content">
                      <div className="drag-icon">📁</div>
                      <h4>Drag & drop files here</h4>
                      <p>or</p>
                      <label htmlFor="uploadInput" className="browse-label">
                        Browse files
                      </label>
                      <p className="file-info">
                        JPG, PNG, GIF (images) • MP4 (videos) • Max 50MB each
                      </p>
                      <p className="count-info">
                        0/{MAX_MEDIA_FILES} items selected
                      </p>
                    </div>
                  </div>
                ) : (
                  // File Grid (when files are selected)
                  <div className="selected-files-section">
                    <h4>Selected Files ({tempMediaFiles.length}/{MAX_MEDIA_FILES})</h4>
                    <div className="files-grid-container">
                      <div className="files-grid">
                        {tempMediaFiles.map((media, index) => (
                          <div key={index} className="file-card">
                            <div className="file-preview">
                              {media.type === 'image' ? (
                                <img src={media.preview} alt={`Preview ${index + 1}`} />
                              ) : (
                                <div className="video-preview">
                                  <span>🎥</span>
                                </div>
                              )}
                            </div>
                            <div className="file-info-card">
                              <p className="file-name" title={media.name}>
                                {media.name.substring(0, 20)}
                                {media.name.length > 20 ? '...' : ''}
                              </p>
                              <p className="file-size">{formatFileSize(media.size)}</p>
                              <p className="file-type">{media.type}</p>
                            </div>
                            <button
                              className="remove-file"
                              onClick={() => removeTempMedia(index)}
                              type="button"
                              title="Remove file"
                            >
                              ✕
                            </button>
                          </div>
                        ))}

                        {/* Add More Button - Plus Icon */}
                        {tempMediaFiles.length < MAX_MEDIA_FILES && (
                          <label htmlFor="uploadInput" className="file-card add-more-card">
                            <div className="add-more-content">
                              <div className="plus-icon">+</div>
                              <p>Add More</p>
                              <span className="remaining-count">
                                {MAX_MEDIA_FILES - tempMediaFiles.length} left
                              </span>
                            </div>
                          </label>
                        )}
                      </div>
                    </div>

                    {/* Alternative Add Button */}
                    <label htmlFor="uploadInput" className="add-files-button-alt">
                      <span>+ Add More Files</span>
                    </label>
                  </div>
                )}

                {/* Error Messages */}
                {error && (
                  <div className="upload-error-message">
                    {error}
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="upload-footer">
                <button
                  className="cancel-btn"
                  onClick={cancelMediaUpload}
                  type="button"
                >
                  Cancel
                </button>
                <button
                  className="confirm-btn"
                  onClick={confirmMediaUpload}
                  disabled={tempMediaFiles.length === 0}
                  type="button"
                >
                  Add {tempMediaFiles.length} {tempMediaFiles.length === 1 ? 'File' : 'Files'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Drafts Modal */}
        {showDraftsModal && (
          <div className="drafts-modal-overlay" onClick={() => setShowDraftsModal(false)}>
            <div className="drafts-modal" onClick={(e) => e.stopPropagation()}>
              <div className="drafts-header">
                <h3>Saved Drafts ({drafts.length})</h3>
                <button
                  className="close-modal"
                  onClick={() => setShowDraftsModal(false)}
                  type="button"
                >
                  ✕
                </button>
              </div>
              
              {drafts.length === 0 ? (
                <div className="no-drafts">
                  <p>No drafts yet. Start writing and save your draft!</p>
                </div>
              ) : (
                <div className="drafts-list">
                  {drafts.map((draft) => (
                    <div key={draft.id} className="draft-item">
                      <div className="draft-content">
                        <p className="draft-text">
                          {(draft.content || draft.desc || draft.text || "").substring(0, 80)}...
                        </p>
                        <div className="draft-meta">
                          <span className="draft-date">{draft.createdAt}</span>
                          {draft.mediaCount > 0 && (
                            <span className="draft-media-count">{draft.mediaCount} media</span>
                          )}
                          {draft.tags && draft.tags.length > 0 && (
                            <span className="draft-tags">{draft.tags.length} tags</span>
                          )}
                        </div>
                      </div>
                      <div className="draft-actions">
                        <button
                          className="load-draft-btn"
                          onClick={() => loadDraft(draft)}
                          type="button"
                        >
                          Load
                        </button>
                        <button
                          className="delete-draft-btn"
                          onClick={() => deleteDraft(draft.id)}
                          type="button"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
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
              Drop media here to upload (max {MAX_MEDIA_FILES} items)
            </div>
          </div>
        )}
      </div>
    </div>
  );
  };

export default Share;
