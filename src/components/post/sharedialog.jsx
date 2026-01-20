import React, { useState, useRef, useEffect } from "react";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import IconButton from "@mui/material/IconButton";
import CloseIcon from "@mui/icons-material/Close";
import Divider from "@mui/material/Divider";
import "./sharedialog.scss";
import logger from "../../utils/logger";

const getMediaUrl = (post) => {
  if (!post) return null;
  // If this is a shared post, use the original post's media
  if (post.sharedPost) {
    return post.sharedPost.media || post.sharedPost.img || post.sharedPost.mediaUrl || null;
  }
  // Otherwise, use the current post's media
  return post.media || post.img || post.mediaUrl || null;
};

const ShareDialog = ({ open, onClose, post, onShare, currentUser }) => {
  // Disabled debug logging to prevent console spam
  const mediaUrl = getMediaUrl(post);
  // logger.debug('ShareDialog', { postId: post?._id, mediaUrl, mediaType: post?.mediaType });
  const [caption, setCaption] = useState("");
  const captionRef = useRef(null);

  useEffect(() => {
    if (open && captionRef.current) {
      captionRef.current.focus();
    }
    if (!open) setCaption("");
  }, [open]);

  const shareOptions = [
    { label: "Your Story", icon: "🌞" },
    { label: "Messenger", icon: "💬" },
    { label: "WhatsApp", icon: "📱" },
    { label: "Copy Link", icon: "🔗" },
    { label: "Group", icon: "👥" },
    { label: "Page", icon: "📄" },
  ];

  const handleShare = () => {
    onShare(caption);
    onClose();
  };

  // Determine media type for preview
  const isVideo =
    post?.mediaType === "video" ||
    (mediaUrl && mediaUrl.match(/\.(mp4|mov|avi|webm)$/i));

  return (
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
        <span style={{ fontWeight: 700, color: "var(--textColor)" }}>Share</span>
        <IconButton onClick={onClose} size="small">
          <CloseIcon sx={{ color: "var(--textColorSoft)" }} />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ p: "0 0 8px 0", bgcolor: "var(--bg)" }}>
        {/* User avatar and caption */}
        <div style={{
          display: "flex",
          alignItems: "flex-start",
          gap: 10,
          padding: "16px 16px 8px 16px"
        }}>
          <img
            src={currentUser?.profilePic}
            alt={currentUser?.name}
            style={{
              width: 36,
              height: 36,
              borderRadius: "50%",
              objectFit: "cover",
              border: "1.5px solid var(--border)"
            }}
          />
          <TextField
            inputRef={captionRef}
            value={caption}
            onChange={e => setCaption(e.target.value)}
            placeholder="Say something about this post... (optional)"
            variant="outlined"
            multiline
            minRows={1}
            maxRows={3}
            fullWidth
            sx={{
              mt: 0,
              mb: 0,
              "& .MuiOutlinedInput-root": {
                borderRadius: "18px",
                bgcolor: "var(--bgSoft)",
                fontSize: "1rem",
                p: "8px 12px"
              }
            }}
          />
        </div>

        {/* Share options */}
        <div style={{ padding: "8px 16px 0 16px" }}>
          <div style={{
            fontSize: "0.92rem",
            color: "var(--textColorSoft)",
            marginBottom: 8,
            fontWeight: 500
          }}>
            Share to:
          </div>
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: "8px"
          }}>
            {shareOptions.map(option => (
              <Button
                key={option.label}
                variant="outlined"
                sx={{
                  borderRadius: "10px",
                  p: "10px",
                  display: "flex",
                  flexDirection: "column",
                  height: "64px",
                  borderColor: "var(--border)",
                  color: "var(--textColor)",
                  fontWeight: 500,
                  fontSize: "0.93rem",
                  minWidth: 0,
                  '&:hover': {
                    borderColor: "var(--primary)",
                    bgcolor: "var(--bgHover)"
                  }
                }}
              >
                <span style={{ fontSize: "22px", marginBottom: 2 }}>{option.icon}</span>
                <span style={{ fontSize: "0.8rem" }}>{option.label}</span>
              </Button>
            ))}
          </div>
        </div>

        {/* Content preview */}
        <Divider sx={{ my: 2, borderColor: "var(--border)" }} />
        <div style={{
          padding: "0 16px 12px 16px",
          borderRadius: "10px",
          background: "var(--cardBg)",
          border: "1px solid var(--border)",
          boxShadow: "0 2px 8px var(--cardShadow)",
          overflow: "hidden"
        }}>
          <div style={{
            position: "relative",
            paddingTop: "56.25%",
            backgroundColor: "var(--bgSoft)"
          }}>
            {mediaUrl ? (
              isVideo ? (
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
                  alt="Shared content"
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    height: "100%",
                    objectFit: "cover"
                  }}
                />
              )
            ) : (
              <div style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--textColorSoft)"
              }}>
                No media to preview
              </div>
            )}
          </div>
        </div>
      </DialogContent>

      <DialogActions sx={{
        p: "14px 16px",
        bgcolor: "var(--bgSoft)",
        borderTop: "1px solid var(--border)"
      }}>
        <Button
          onClick={onClose}
          sx={{
            color: "var(--textColorSoft)",
            fontWeight: 600,
            borderRadius: "10px",
            textTransform: "none"
          }}
        >
          Cancel
        </Button>
        <Button
          onClick={handleShare}
          variant="contained"
          sx={{
            bgcolor: "var(--primary)",
            color: "var(--buttonText)",
            borderRadius: "10px",
            textTransform: "none",
            px: "24px",
            fontWeight: 600,
            '&:hover': { bgcolor: "var(--primaryHover)" }
          }}
        >
          Share Now
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ShareDialog;