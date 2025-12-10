import React, { useEffect, useState, useRef } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import Post from "./Post";
import Comments from "../comments/Comments";
import ShareOutlinedIcon from "@mui/icons-material/ShareOutlined";
import FileCopyOutlinedIcon from "@mui/icons-material/FileCopyOutlined";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import FullscreenIcon from "@mui/icons-material/Fullscreen";
import LocalOfferOutlinedIcon from "@mui/icons-material/LocalOfferOutlined";
import "./FullScreenPostPage.scss";

export default function FullScreenPostPage() {
  const { postId } = useParams();
  const navigate = useNavigate();
  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);
  const mediaRef = useRef(null);

  useEffect(() => {
    async function fetchPost() {
      setLoading(true);
      try {
        const token = localStorage.getItem("token");
        const res = await fetch(`/api/posts/${postId}`, {
          headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json"
          }
        });
        if (!res.ok) throw new Error("Failed to fetch post");
        const data = await res.json();
        setPost(data);
      } catch (e) {
        setPost(null);
      } finally {
        setLoading(false);
      }
    }
    fetchPost();
  }, [postId]);

  // keyboard: Esc to go back
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") navigate(-1);
      // optionally: other shortcuts here
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navigate]);

  if (loading) {
    return (
      <div className="fullscreen-post-root">
        <div className="fullscreen-post-header">
          <div className="header-left">
            <Link to="/" className="fullscreen-post-back">&larr; Back</Link>
            <span className="fullscreen-post-title">Post</span>
          </div>
          <div className="header-actions">
            <div className="skeleton-btn" />
            <div className="skeleton-btn short" />
          </div>
        </div>
        <div className="fullscreen-post-main">
          <div className="fullscreen-post-media">
            <div className="fullscreen-post-media-inner skeleton-media" />
          </div>
          <div className="fullscreen-post-comments">
            <div className="fullscreen-post-details skeleton-details" />
          </div>
        </div>
      </div>
    );
  }

  if (!post) return <div className="fullscreen-post-error">Post not found.</div>;

  const isShared = !!post.sharedPost && typeof post.sharedPost === "object";
  const originalPost = isShared ? (function getOriginalPost(p){ let cur=p; for(let i=0;i<6&&cur;i++){ if(cur.sharedPost && typeof cur.sharedPost==='object') cur = cur.sharedPost; else break;} return cur;})(post) : post;

  // build a details object that guarantees a `user` object for Post.details (so avatar uses original poster)
  const detailsPost = (() => {
    const u = originalPost.user || {};
    const normalizedUser = {
      _id: u._id || originalPost.userId || null,
      name: u.name || originalPost.name || "",
      profilePic: u.profilePic || u.profilePicture || originalPost.profilePic || originalPost.profilePicture || null,
      profilePicture: u.profilePicture || u.profilePic || originalPost.profilePicture || originalPost.profilePic || null, // <-- add this line
      gender: u.gender || u.sex || null
    };
    return { ...originalPost, user: normalizedUser };
  })();
  
  // header actions
  const copyPermalink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      // lightweight feedback (could be snackbar)
      console.info("Link copied");
    } catch {
      console.warn("Copy failed");
    }
  };

  const openOriginalInNewTab = () => {
    const targetId = originalPost._id || post._id;
    window.open(`${window.location.origin}/post/${targetId}`, "_blank");
  };

  const openMediaFullscreen = () => {
    // try to open media url in new tab
    const media = originalPost.media || originalPost.img;
    if (!media) return;
    const url = media.startsWith("http") ? media : `${window.location.origin}${media}`;
    window.open(url, "_blank");
  };

  const downloadMedia = () => {
    const media = originalPost.media || originalPost.img;
    if (!media) return;
    const url = media.startsWith("http") ? media : `${window.location.origin}${media}`;
    const a = document.createElement("a");
    a.href = url;
    a.download = url.split("/").pop() || "media";
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  return (
    <div className="fullscreen-post-root" role="dialog" aria-label="Full screen post">
      <div className="fullscreen-post-header">
        <div className="header-left">
          <button className="link-like back-btn" onClick={() => navigate(-1)}>&larr; Back to Feed</button>
          <span className="fullscreen-post-title">Post</span>
        </div>

        <div className="header-actions" aria-hidden={false}>
          <button className="icon-btn" onClick={copyPermalink} title="Copy link" aria-label="Copy link">
            <FileCopyOutlinedIcon fontSize="small" />
          </button>
          <button className="icon-btn" onClick={openOriginalInNewTab} title="Open original post" aria-label="Open original">
            <OpenInNewIcon fontSize="small" />
          </button>
          <button className="icon-btn" onClick={openMediaFullscreen} title="Open media" aria-label="Open media">
            <FullscreenIcon fontSize="small" />
          </button>
          <button className="icon-btn" onClick={downloadMedia} title="Download media" aria-label="Download media">
            â¤“
          </button>
          <button className="icon-btn" onClick={() => navigator.share ? navigator.share({ title: document.title, url: window.location.href }) : null} title="Share" aria-label="Share">
            <ShareOutlinedIcon fontSize="small" />
          </button>
        </div>
      </div>

      <div className="fullscreen-post-main">
        <div className="fullscreen-post-media" ref={mediaRef}>
          <div className="fullscreen-post-media-inner">
            <Post post={originalPost} showOnly="media" fullScreen />
          </div>
        </div>

        <div className="fullscreen-post-comments">
          <div className="fullscreen-post-details">
            <div className="userInfo">
              <div className="avatar-container">
                {/* Avatar logic from Post.jsx */}
                <Post post={detailsPost} showOnly="details" fullScreen showDesc={false} />
              </div>
              <div className="details">
                <span className="name">{detailsPost.user?.name || detailsPost.name}</span>
                <span className="date">{new Date(detailsPost.createdAt).toLocaleString()}</span>
              </div>
            </div>
            <div className="content">
              <p>{detailsPost.desc}</p>
              {detailsPost.tags?.length > 0 && (
                <div className="post-tags">
                  <LocalOfferOutlinedIcon className="tag-icon" />
                  {detailsPost.tags.map((tag) => (
                    <span key={tag} className="tag">
                      #{tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="comments-area" role="region" aria-label="Comments">
            <Comments postId={originalPost._id} />
          </div>
        </div>
      </div>
    </div>
  );
}
