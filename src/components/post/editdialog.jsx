import React, { useState, useRef, useEffect } from "react";
import axios from "axios";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import IconButton from "@mui/material/IconButton";
import CloseIcon from "@mui/icons-material/Close";
import Divider from "@mui/material/Divider";
import Snackbar from "@mui/material/Snackbar";
import MuiAlert from "@mui/material/Alert";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import InfoIcon from "@mui/icons-material/Info";
import EmojiEmotionsIcon from "@mui/icons-material/EmojiEmotions";
import Popover from "@mui/material/Popover";
import "./editdialog.scss";

const getMediaUrl = (media, img) => {
  const path = media || img;
  if (!path) return null;
  if (typeof path !== 'string') return null;
  if (/^https?:\/\/.*/i.test(path)) return path;
  const base = process.env.REACT_APP_API_URL || 'http://localhost:5000';
  if (path.startsWith('/')) return `${base}${path}`;
  return `${base}/uploads/${path.split(/[/\\]/).pop()}`;
};

const EditDialog = ({ open, onClose, post, onEdit }) => {
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState("");
  const [loading, setLoading] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [emojiAnchor, setEmojiAnchor] = useState(null);
  const descriptionRef = useRef(null);
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: "",
    severity: "success"
  });

  const MAX_DESC_LENGTH = 2000;
  const MAX_TAGS = 10;

  // Common emojis for quick access
  const COMMON_EMOJIS = [
    '😀', '😂', '😍', '😘', '😎', '🤔', '😢', '🎉',
    '🔥', '💯', '👍', '👏', '🙏', '💪', '🎨', '🎵',
    '📸', '🌟', '✨', '💝', '🌈', '🚀', '⚡', '🎯',
    '🍕', '🍔', '☕', '🎂', '🍰', '🍓', '🌺', '🌸',
    '🐕', '🐈', '🦋', '🐝', '🌍', '🏖️', '❤️', '💔'
  ];

  useEffect(() => {
    if (open && post) {
      setDescription(post.desc || "");
      setTags(post.tags ? post.tags.join(", ") : "");
      setHasChanges(false);
      if (descriptionRef.current) {
        descriptionRef.current.focus();
      }
    }
  }, [open, post]);

  const handleDescriptionChange = (e) => {
    const value = e.target.value;
    if (value.length <= MAX_DESC_LENGTH) {
      setDescription(value);
      setHasChanges(value !== (post?.desc || "") || tags !== (post?.tags?.join(", ") || ""));
    }
  };

  const handleTagsChange = (e) => {
    const value = e.target.value;
    setTags(value);
    setHasChanges(value !== (post?.tags?.join(", ") || "") || description !== (post?.desc || ""));
  };

  const showSnackbar = (message, severity = "success") => {
    setSnackbar({ open: true, message, severity });
  };

  const handleSnackbarClose = (event, reason) => {
    if (reason === "clickaway") return;
    setSnackbar({ ...snackbar, open: false });
  };

  const handleEmojiButtonClick = (event) => {
    setEmojiAnchor(event.currentTarget);
  };

  const handleEmojiClose = () => {
    setEmojiAnchor(null);
  };

  const handleEmojiSelect = (emoji) => {
    if (descriptionRef.current) {
      const textarea = descriptionRef.current.querySelector('textarea') || descriptionRef.current;
      const start = textarea.selectionStart || description.length;
      const newDescription = description.slice(0, start) + emoji + description.slice(start);
      
      if (newDescription.length <= MAX_DESC_LENGTH) {
        setDescription(newDescription);
        setHasChanges(newDescription !== (post?.desc || "") || tags !== (post?.tags?.join(", ") || ""));
        
        // Refocus and set cursor position
        setTimeout(() => {
          textarea.focus();
          const newPos = start + emoji.length;
          textarea.setSelectionRange(newPos, newPos);
        }, 0);
      }
    }
  };

  const parseAndValidateTags = () => {
    return tags
      .split(",")
      .map((tag) => tag.trim())
      .filter((tag) => tag.length > 0 && tag.length <= 30)
      .slice(0, MAX_TAGS);
  };

  const handleSave = async () => {
    if (!description.trim()) {
      showSnackbar("Description cannot be empty", "error");
      return;
    }

    const tagsArray = parseAndValidateTags();

    setLoading(true);
    try {
      const response = await axios.patch(
        `${process.env.REACT_APP_API_URL || "http://localhost:5000"}/api/posts/${post._id}`,
        {
          desc: description.trim(),
          tags: tagsArray
        },
        {
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
        }
      );

      if (response.data.success) {
        showSnackbar("Post updated successfully!", "success");
        if (typeof onEdit === "function") {
          onEdit(response.data.post);
        }
        setTimeout(() => {
          onClose();
        }, 500);
      } else {
        showSnackbar("Failed to update post", "error");
      }
    } catch (error) {
      showSnackbar(
        error.response?.data?.message || "Failed to update post",
        "error"
      );
    } finally {
      setLoading(false);
    }
  };

  const handleDiscard = () => {
    if (hasChanges && !window.confirm("Discard changes?")) {
      return;
    }
    onClose();
  };

  const mediaUrl = getMediaUrl(post?.media || post?.img);
  const isVideo =
    post?.mediaType === "video" ||
    (mediaUrl && mediaUrl.match(/\.(mp4|mov|avi|webm)$/i));

  const tagsArray = parseAndValidateTags();
  const descriptionLength = description.length;

  return (
    <>
      <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
        <DialogTitle
          sx={{
            p: "12px 16px 8px 16px",
            borderBottom: "1px solid",
            borderColor: "var(--border)",
            bgcolor: "var(--bg)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between"
          }}
        >
          <span style={{ fontWeight: 700, color: "var(--textColor)" }}>
            Edit Post
          </span>
          <IconButton onClick={onClose} size="small" disabled={loading}>
            <CloseIcon sx={{ color: "var(--textColorSoft)" }} />
          </IconButton>
        </DialogTitle>

        <DialogContent sx={{ p: "0 0 8px 0", bgcolor: "var(--bg)" }}>
          {/* Description Input with Character Count */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 8,
              padding: "16px 16px 8px 16px"
            }}
          >
            <div>
              <div style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 8
              }}>
                <label style={{
                  fontSize: "0.9rem",
                  fontWeight: 600,
                  color: "var(--textColor)"
                }}>
                  Description
                </label>
                <div style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8
                }}>
                  <IconButton
                    onClick={handleEmojiButtonClick}
                    size="small"
                    sx={{
                      color: "var(--primary)",
                      "&:hover": { bgcolor: "var(--bgSoft)" }
                    }}
                    title="Add emoji"
                  >
                    <EmojiEmotionsIcon sx={{ fontSize: "1.3rem" }} />
                  </IconButton>
                  <span style={{
                    fontSize: "0.8rem",
                    color: descriptionLength > MAX_DESC_LENGTH * 0.9 ? "#ff6b6b" : "var(--textColorSoft)"
                  }}>
                    {descriptionLength} / {MAX_DESC_LENGTH}
                  </span>
                </div>
              </div>
              <TextField
                inputRef={descriptionRef}
                value={description}
                onChange={handleDescriptionChange}
                placeholder="Edit your post description..."
                variant="outlined"
                multiline
                minRows={4}
                maxRows={8}
                fullWidth
                disabled={loading}
                sx={{
                  "& .MuiOutlinedInput-root": {
                    borderRadius: "12px",
                    bgcolor: "var(--bgSoft)",
                    fontSize: "1rem"
                  }
                }}
              />
            </div>

            {/* Tags Input with Count */}
            <div>
              <div style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 8
              }}>
                <label style={{
                  fontSize: "0.9rem",
                  fontWeight: 600,
                  color: "var(--textColor)"
                }}>
                  Tags
                </label>
                <span style={{
                  fontSize: "0.8rem",
                  color: tagsArray.length > MAX_TAGS * 0.8 ? "#ff6b6b" : "var(--textColorSoft)"
                }}>
                  {tagsArray.length} / {MAX_TAGS}
                </span>
              </div>
              <TextField
                value={tags}
                onChange={handleTagsChange}
                placeholder="Add tags separated by commas (e.g. nature, travel, photography)"
                variant="outlined"
                fullWidth
                disabled={loading}
                sx={{
                  "& .MuiOutlinedInput-root": {
                    borderRadius: "12px",
                    bgcolor: "var(--bgSoft)",
                    fontSize: "0.95rem"
                  }
                }}
              />
              {tagsArray.length > 0 && (
                <div style={{
                  marginTop: 10,
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 8
                }}>
                  {tagsArray.map((tag, idx) => (
                    <span
                      key={idx}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        padding: "6px 12px",
                        borderRadius: "20px",
                        backgroundColor: "var(--primary)",
                        color: "var(--buttonText)",
                        fontSize: "0.85rem",
                        fontWeight: 500
                      }}
                    >
                      #{tag}
                      <CheckCircleIcon sx={{ fontSize: "0.9rem" }} />
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Media Preview */}
          {mediaUrl && (
            <>
              <Divider sx={{ my: 2, borderColor: "var(--border)" }} />
              <div style={{
                padding: "12px 16px",
                display: "flex",
                alignItems: "center",
                gap: 8,
                borderRadius: "8px",
                backgroundColor: "var(--bgSoft)",
                marginBottom: 12
              }}>
                <InfoIcon sx={{ color: "var(--primary)", fontSize: "1.2rem" }} />
                <span style={{
                  fontSize: "0.85rem",
                  color: "var(--textColorSoft)"
                }}>
                  Media cannot be changed in edit dialog. To change media, please delete and recreate the post.
                </span>
              </div>
              <div
                style={{
                  padding: "0 16px 12px 16px",
                  borderRadius: "10px",
                  background: "var(--cardBg)",
                  border: "1px solid var(--border)",
                  boxShadow: "0 2px 8px var(--cardShadow)",
                  overflow: "hidden"
                }}
              >
                <div
                  style={{
                    position: "relative",
                    paddingTop: "56.25%",
                    backgroundColor: "var(--bgSoft)"
                  }}
                >
                  {isVideo ? (
                    <video
                      src={mediaUrl}
                      style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        width: "100%",
                        height: "100%",
                        objectFit: "cover"
                      }}
                      controls
                    />
                  ) : (
                    <img
                      src={mediaUrl}
                      alt="Post preview"
                      style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        width: "100%",
                        height: "100%",
                        objectFit: "cover"
                      }}
                    />
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>

        <DialogActions
          sx={{
            p: "14px 16px",
            bgcolor: "var(--bgSoft)",
            borderTop: "1px solid var(--border)",
            display: "flex",
            justifyContent: "space-between",
            gap: 1
          }}
        >
          <Button
            onClick={handleDiscard}
            disabled={loading}
            sx={{
              color: "var(--textColorSoft)",
              fontWeight: 600,
              borderRadius: "10px",
              textTransform: "none",
              "&:hover": {
                backgroundColor: "var(--bgHover)"
              }
            }}
          >
            {hasChanges ? "Discard" : "Cancel"}
          </Button>
          <div style={{ display: "flex", gap: 8 }}>
            <Button
              onClick={() => {
                setDescription(post?.desc || "");
                setTags(post?.tags ? post.tags.join(", ") : "");
                setHasChanges(false);
              }}
              disabled={loading || !hasChanges}
              sx={{
                color: "var(--textColorSoft)",
                fontWeight: 600,
                borderRadius: "10px",
                textTransform: "none",
                border: "1px solid var(--border)",
                "&:hover": {
                  backgroundColor: "var(--bgHover)"
                }
              }}
            >
              Reset
            </Button>
            <Button
              onClick={handleSave}
              disabled={loading || !hasChanges}
              variant="contained"
              sx={{
                bgcolor: "var(--primary)",
                color: "var(--buttonText)",
                borderRadius: "10px",
                textTransform: "none",
                px: "24px",
                fontWeight: 600,
                '&:hover': { bgcolor: "var(--primaryHover)" },
                '&:disabled': {
                  opacity: 0.6
                }
              }}
            >
              {loading ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={handleSnackbarClose}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <MuiAlert
          elevation={6}
          variant="filled"
          onClose={handleSnackbarClose}
          severity={snackbar.severity}
          sx={{ width: "100%" }}
        >
          {snackbar.message}
        </MuiAlert>
      </Snackbar>

      {/* Emoji Picker Popover */}
      <Popover
        open={Boolean(emojiAnchor)}
        anchorEl={emojiAnchor}
        onClose={handleEmojiClose}
        anchorOrigin={{
          vertical: "bottom",
          horizontal: "center"
        }}
        transformOrigin={{
          vertical: "top",
          horizontal: "center"
        }}
        disableRestoreFocus
        PopperProps={{
          sx: {
            "& .MuiPopover-paper": {
              maxWidth: "90vw !important",
              width: "auto !important",
              left: "50% !important",
              transform: "translateX(-50%) !important"
            }
          }
        }}
        PaperProps={{
          sx: {
            borderRadius: "12px",
            border: "1px solid var(--border)",
            bgcolor: "var(--bg)",
            boxShadow: "0 8px 24px var(--shadow)",
            maxWidth: "100vw",
            overflow: "visible",
            p: 0
          }
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "8px 12px",
            borderBottom: "1px solid var(--border)"
          }}
        >
          <span style={{ fontSize: "0.85rem", color: "var(--textColorSoft)", fontWeight: 500 }}>
            Select emoji
          </span>
          <IconButton
            onClick={handleEmojiClose}
            size="small"
            sx={{
              color: "var(--textColorSoft)",
              "&:hover": { bgcolor: "var(--bgSoft)" }
            }}
          >
            <CloseIcon sx={{ fontSize: "1rem" }} />
          </IconButton>
        </div>
        <div
          className="emoji-grid-wrapper"
          style={{
            display: "flex",
            flexDirection: "column",
            maxHeight: "60vh",
            overflowY: "auto",
            overflowX: "hidden",
            WebkitOverflowScrolling: "touch"
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(8, 1fr)",
              gap: "8px",
              padding: "12px",
              width: "320px"
            }}
            className="emoji-grid-container emoji-picker-desktop"
          >
          {COMMON_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              onClick={() => handleEmojiSelect(emoji)}
              style={{
                fontSize: "1.5rem",
                border: "1px solid var(--border)",
                borderRadius: "8px",
                backgroundColor: "var(--bgSoft)",
                cursor: "pointer",
                padding: "8px",
                transition: "all 0.2s ease",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                minHeight: "40px",
                flexShrink: 0,
                minWidth: "40px"
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = "var(--primary)";
                e.currentTarget.style.transform = "scale(1.1)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "var(--bgSoft)";
                e.currentTarget.style.transform = "scale(1)";
              }}
            >
              {emoji}
            </button>
          ))}
          </div>
        </div>
      </Popover>
    </>
  );
};

export default EditDialog;
