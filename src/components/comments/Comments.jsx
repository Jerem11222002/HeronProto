import React, { useContext, useEffect, useRef, useState, memo } from "react";
import axios from "axios";
import { AuthContext } from "../../context/authContext";
import { useSocket } from "../../context/SocketContext";
import { Link } from "react-router-dom";
import "./comments.scss";
import { formatTimeAgo } from "../../utils/dateFormat";
import FavoriteBorderOutlinedIcon from "@mui/icons-material/FavoriteBorderOutlined";
import FavoriteOutlinedIcon from "@mui/icons-material/FavoriteOutlined";

function escapeHtml(text = '') {
  return text.replace(/[&<>"'`=\/]/g, function (s) {
    return ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
      '/': '&#47;',
      '`': '&#96;',
      '=': '&#61;'
    })[s];
  });
}

const Avatar = ({ src, name, size = 40 }) => {
  if (src) {
    return <img className="comment-avatar" src={src} alt={name || 'User avatar'} width={size} height={size} />;
  }
  const initials = (name || 'U').split(' ').map(n => n[0]).slice(0,2).join('').toUpperCase();
  return <div className="comment-avatar fallback" aria-hidden="true" style={{ width: size, height: size }}>{initials}</div>;
};

const CommentItem = memo(({ comment, currentUser, onDelete, onEdit }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(comment.text || comment.body || "");

  const handleEdit = async () => {
    if (await onEdit(comment._id, editText)) {
      setIsEditing(false);
    }
  };

  return (
    <div className="comment">
      <Avatar src={comment.profilePicture || comment.author?.profilePic} name={comment.name || comment.author?.name} />
      <div className="info">
        <Link to={`/profile/${comment.userId || comment.author?._id}`} className="name">
          {comment.name || comment.author?.name}
        </Link>
        {isEditing ? (
          <div className="edit-form">
            <input
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              maxLength={500}
              autoFocus
            />
            <div className="edit-actions">
              <button onClick={handleEdit}>Save</button>
              <button onClick={() => setIsEditing(false)}>Cancel</button>
            </div>
          </div>
        ) : (
          <>
            <div
              className="comment-text"
              dangerouslySetInnerHTML={{ __html: comment.text || comment.body }}
            />
            <div className="comment-footer">
              <span className="date" title={new Date(comment.createdAt).toLocaleString()}>
                {formatTimeAgo(comment.createdAt)}
                {comment.edited && " (edited)"}
              </span>
              {currentUser?._id === (comment.userId || comment.author?._id) && (
                <div className="actions">
                  <button onClick={() => setIsEditing(true)}>Edit</button>
                  <button onClick={() => onDelete(comment._id)}>Delete</button>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
});

/* ---------- Utilities for working with nested tree ---------- */

// normalize a comment node
function normalizeCommentNode(c) {
  if (!c) return null;
  return {
    _id: c._id || c.id,
    postId: c.postId,
    userId: String(c.userId || (c.author && c.author._id) || ""),
    name: c.name || (c.author && c.author.name) || "User",
    profilePicture: c.profilePicture || (c.author && c.author.profilePic) || null,
    text: c.text || c.body || "",
    body: c.text || c.body || "",
    createdAt: c.createdAt,
    edited: c.edited || false,
    likes: Array.isArray(c.likes) ? c.likes.map(String) : [],
    likeCount: typeof c.likeCount === 'number' ? c.likeCount : (Array.isArray(c.likes) ? c.likes.length : 0),
    replyTo: c.replyTo || null,
    depth: typeof c.depth === 'number' ? c.depth : 0,
    replies: [], // will be filled by normalizeTree
    repliesCount: typeof c.repliesCount === 'number' ? c.repliesCount : 0,
    pending: !!c.pending,
    isDeleted: !!c.isDeleted
  };
}

// recursively normalize tree returned by backend
function normalizeTree(arr = []) {
  return (arr || []).map(node => {
    const normalized = normalizeCommentNode(node);
    if (Array.isArray(node.replies) && node.replies.length) {
      normalized.replies = normalizeTree(node.replies);
      // ensure repliesCount is correct if server didn't include it
      normalized.repliesCount = normalized.repliesCount || normalized.replies.reduce((s, r) => s + 1 + (r.repliesCount || 0), 0);
    } else {
      normalized.replies = [];
    }
    return normalized;
  });
}

// deep clone map-safe helper
const clone = (v) => JSON.parse(JSON.stringify(v));

// find and update a node in the tree by id (returns new tree)
function findAndUpdateInTree(tree, id, updater) {
  let changed = false;
  const walk = (nodes) => {
    return nodes.map(node => {
      if (String(node._id) === String(id)) {
        const newNode = updater(clone(node)) || clone(node);
        changed = true;
        return newNode;
      }
      if (node.replies && node.replies.length) {
        const newReplies = walk(node.replies);
        if (newReplies !== node.replies) {
          node = { ...clone(node), replies: newReplies };
          changed = true;
        }
      }
      return node;
    });
  };
  const out = walk(tree);
  return { tree: out, changed };
}

// insert comment into tree under parentId (if parentId null -> unshift top-level)
function insertCommentInTree(tree, parentId, comment) {
  const node = normalizeCommentNode(comment);
  node.replies = normalizeTree(comment.replies || []);
  if (!parentId) {
    return [node, ...tree];
  }

  let inserted = false;
  const walk = (nodes) => {
    return nodes.map(n => {
      if (String(n._id) === String(parentId)) {
        const newReplies = [node, ...(n.replies || [])];
        inserted = true;
        return { ...n, replies: newReplies, repliesCount: (n.repliesCount || 0) + 1 + (node.repliesCount || 0) };
      }
      if (n.replies && n.replies.length) {
        return { ...n, replies: walk(n.replies) };
      }
      return n;
    });
  };
  const out = walk(tree);
  // if parent not found, append to top-level to avoid losing the comment
  if (!inserted) out.unshift(node);
  return out;
}

// set replies array for a parent node (replace existing replies)
function setRepliesForParent(tree, parentId, replies) {
  const walk = (nodes) => {
    return nodes.map(n => {
      if (String(n._id) === String(parentId)) {
        const normalized = normalizeTree(replies || []);
        const count = normalized.reduce((s, r) => s + 1 + (r.repliesCount || 0), 0);
        return { ...n, replies: normalized, repliesCount: count };
      }
      if (n.replies && n.replies.length) {
        return { ...n, replies: walk(n.replies) };
      }
      return n;
    });
  };
  return walk(tree);
}

// remove comment by id (mark isDeleted / remove)
function removeCommentFromTree(tree, id) {
  const walk = (nodes) => {
    return nodes.filter(Boolean).map(n => {
      if (String(n._id) === String(id)) {
        // mark deleted but keep placeholder so tree structure persists
        return { ...n, text: "[deleted]", isDeleted: true };
      }
      if (n.replies && n.replies.length) {
        return { ...n, replies: walk(n.replies) };
      }
      return n;
    });
  };
  return walk(tree);
}

/* ---------- Comments component ---------- */

const Comments = ({ postId, onCommentUpdate }) => {
  const { currentUser } = useContext(AuthContext);
  const { socket } = useSocket();
  const [comments, setComments] = useState([]); // top-level roots with nested replies
  const [newComment, setNewComment] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const textareaRef = useRef(null);
  const listRef = useRef(null);

  // replies / UI state
  const [replyOpen, setReplyOpen] = useState({});     // viewing replies per id
  const [replyBoxOpen, setReplyBoxOpen] = useState({}); // reply input open per id
  const [likeLoading, setLikeLoading] = useState({});  // flags per id

  // API paths
  const GET_COMMENTS_URL = (pid) => `/api/comments/posts/${pid}/comments`;
  const POST_COMMENT_URL = (pid) => `/api/comments/posts/${pid}/comments`;
  const COMMENT_ITEM_URL = (commentId) => `/api/comments/comments/${commentId}`; // PATCH / DELETE
  const COMMENT_LIKE_URL = (commentId) => `/api/comments/comments/${commentId}/like`;

  useEffect(() => {
    let mounted = true;
    const fetchComments = async () => {
      setLoading(true);
      try {
        const baseURL = process.env.REACT_APP_API_URL || 'http://localhost:5000';
        const token = localStorage.getItem("token");
        const config = {
          baseURL,
          headers: {}
        };
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        const res = await axios.get(GET_COMMENTS_URL(postId), config);
        if (!mounted) return;
        const raw = Array.isArray(res.data) ? res.data : res.data.comments || [];
        const top = normalizeTree(raw);
        setComments(top);
      } catch (err) {
        console.warn('Failed to load comments', err && (err.message || err.response?.data));
        setError('Failed to load comments');
      } finally {
        setLoading(false);
      }
    };
    if (postId) fetchComments();
    return () => { mounted = false; };
  }, [postId]);

  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = `${Math.min(300, ta.scrollHeight)}px`;
  }, [newComment]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submitComment();
    }
  };

  const submitComment = async () => {
    if (!newComment.trim() || submitting) return;
    setSubmitting(true);
    setError(null);
    const baseURL = process.env.REACT_APP_API_URL || 'http://localhost:5000';
    const tempId = `tmp_${Date.now()}`;
    const optimistic = {
      _id: tempId,
      body: escapeHtml(newComment.trim()),
      text: escapeHtml(newComment.trim()),
      createdAt: new Date().toISOString(),
      userId: currentUser?._id || null,
      name: currentUser?.name || 'You',
      profilePicture: currentUser?.profilePic || null,
      pending: true,
      replies: []
    };

    setComments(prev => [normalizeCommentNode(optimistic), ...prev]);
    setNewComment('');
    try {
      const res = await axios.post(POST_COMMENT_URL(postId), { text: optimistic.body }, {
        baseURL,
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
      });
      const saved = normalizeCommentNode(res.data);
      setComments(prev => {
        // replace temp with saved
        return prev.map(c => (String(c._id) === tempId ? saved : c));
      });
      setTimeout(() => { if (listRef.current) listRef.current.scrollTop = 0; }, 50);
      onCommentUpdate?.(n => (typeof n === 'number' ? n + 1 : n));
    } catch (err) {
      setComments(prev => prev.filter(c => String(c._id) !== tempId));
      setError(err.response?.data?.error || 'Failed to post comment');
      console.warn('post comment error', err);
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    if (!socket || !postId) return;

    const handleNewComment = (data) => {
      const incoming = normalizeCommentNode(data.comment || data);
      if (String(incoming.postId) !== String(postId)) return;

      setComments(prev => {
        // avoid duplicates: if id already exists anywhere, skip
        if (existsInTree(prev, incoming._id)) return prev;

        // If we have an optimistic pending node with same replyTo + text, replace it with server saved comment
        const tryReplaceOptimistic = (nodes) => {
          let replaced = false;
          const walk = (arr) => {
            return arr.map(n => {
              if (n && n.pending && String(n.replyTo || "") === String(incoming.replyTo || "") && (n.text === incoming.text || n.body === incoming.body)) {
                replaced = true;
                return incoming;
              }
              if (n.replies && n.replies.length) {
                return { ...n, replies: walk(n.replies) };
              }
              return n;
            });
          };
          const out = walk(nodes);
          return replaced ? out : null;
        };

        const replacedTree = tryReplaceOptimistic(prev);
        if (replacedTree) {
          return replacedTree;
        }

        if (!incoming.replyTo) {
          return [incoming, ...prev];
        }
        return insertCommentInTree(prev, incoming.replyTo, incoming);
      });
      onCommentUpdate?.(prev => (typeof prev === 'number' ? prev + 1 : prev));
    };

    const handleCommentDelete = (data) => {
      if (String(data.postId) !== String(postId)) return;
      setComments(prev => removeCommentFromTree(prev, data.commentId));
      onCommentUpdate?.(prev => (typeof prev === 'number' ? prev - 1 : prev));
    };

    const handleCommentEdit = (data) => {
      const updated = normalizeCommentNode(data.comment || data);
      if (String(updated.postId) !== String(postId)) return;
      setComments(prev => {
        const { tree } = findAndUpdateInTree(prev, updated._id, () => updated);
        return tree;
      });
    };

    socket.on('comment:new', handleNewComment);
    socket.on('comment:delete', handleCommentDelete);
    socket.on('comment:edit', handleCommentEdit);

    return () => {
      socket.off('comment:new', handleNewComment);
      socket.off('comment:delete', handleCommentDelete);
      socket.off('comment:edit', handleCommentEdit);
    };
  }, [socket, postId, onCommentUpdate]);

  const handleEdit = async (commentId, newText) => {
    if (!newText.trim()) return false;
    const baseURL = process.env.REACT_APP_API_URL || 'http://localhost:5000';
    try {
      const response = await axios.patch(
        COMMENT_ITEM_URL(commentId),
        { text: newText },
        { baseURL, headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } }
      );
      const updatedComment = normalizeCommentNode(response.data);
      setComments(prev => {
        const { tree } = findAndUpdateInTree(prev, updatedComment._id, () => updatedComment);
        return tree;
      });
      socket?.emit('comment:edit', { postId, comment: updatedComment });
      return true;
    } catch (error) {
      setError("Failed to edit comment.");
      console.error("Error editing comment:", error);
      return false;
    }
  };

  const handleDelete = async (commentId) => {
    if (!window.confirm("Are you sure you want to delete this comment?")) return;
    const baseURL = process.env.REACT_APP_API_URL || 'http://localhost:5000';
    try {
      await axios.delete(COMMENT_ITEM_URL(commentId), {
        baseURL,
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
      });
      setComments(prev => removeCommentFromTree(prev, commentId));
      onCommentUpdate?.(prev => (typeof prev === 'number' ? prev - 1 : prev));
      socket?.emit('comment:delete', { postId, commentId, count: Math.max(0, comments.length - 1) });
    } catch (error) {
      setError("Failed to delete comment.");
      console.error("Error deleting comment:", error);
    }
  };

  // fetch replies for parent and set them into the tree
  const fetchRepliesForParent = async (parentId) => {
    if (!parentId) return;
    const baseURL = process.env.REACT_APP_API_URL || 'http://localhost:5000';
    try {
      const res = await axios.get(COMMENT_ITEM_URL(parentId) + "/replies", { baseURL });
      const raw = Array.isArray(res.data) ? res.data : res.data.replies || [];
      setComments(prev => setRepliesForParent(prev, parentId, raw));
    } catch (err) {
      console.warn("Failed to fetch replies for", parentId, err && err.message);
    }
  };

  // submit a reply to parentId with provided text (used by ReplyBox)
  const submitReply = async (parentId, text) => {
    const key = String(parentId);
    const trimmed = (text || "").trim();
    if (!trimmed) return;

    // find parent depth in current tree
    const parentFinder = (nodes) => {
      for (const n of nodes) {
        if (String(n._id) === key) return n;
        if (n.replies && n.replies.length) {
          const found = parentFinder(n.replies);
          if (found) return found;
        }
      }
      return null;
    };
    const parentNode = parentFinder(comments);
    const parentDepth = parentNode ? (parentNode.depth || 0) : 0;
    const newDepth = parentDepth + 1;

    const tempId = `tmp_reply_${Date.now()}`;
    const optimistic = {
      _id: tempId,
      postId,
      userId: currentUser?._id,
      name: currentUser?.name,
      profilePicture: currentUser?.profilePic,
      text: trimmed,
      createdAt: new Date().toISOString(),
      replyTo: parentId,
      depth: newDepth,
      pending: true,
      replies: []
    };

    // insert optimistic reply
    setComments(prev => insertCommentInTree(prev, parentId, optimistic));

    try {
      const baseURL = process.env.REACT_APP_API_URL || 'http://localhost:5000';
      const res = await axios.post(POST_COMMENT_URL(postId), { text: trimmed, replyTo: parentId }, {
        baseURL,
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
      });
      const saved = normalizeCommentNode(res.data);

      // replace optimistic temp node with saved node
      setComments(prev => {
        const { tree, changed } = findAndUpdateInTree(prev, tempId, () => saved);
        if (changed) return tree;
        // fallback: ensure saved exists under parent
        return insertCommentInTree(prev, parentId, saved);
      });

      socket?.emit('comment:new', { postId, comment: saved });
    } catch (err) {
      // remove optimistic node on error
      setComments(prev => {
        const walk = (nodes) => {
          return nodes.map(n => ({
            ...n,
            replies: n.replies ? walk(n.replies).filter(r => String(r._id) !== tempId) : []
          })).filter(Boolean);
        };
        return walk(prev);
      });
      console.warn("Failed to post reply", err);
      setError(err.response?.data?.error || 'Failed to post reply');
    }
  };

  // Toggle viewing nested replies (separate from opening the Reply input)
  const toggleViewReplies = async (parentId) => {
    const key = String(parentId);
    setReplyOpen(prev => {
      const nextOpen = !prev[key];
      if (nextOpen) {
        // lazy-load replies if not present
        const found = (function find(nodes) {
          for (const n of nodes) {
            if (String(n._id) === key) return n;
            if (n.replies && n.replies.length) {
              const r = find(n.replies);
              if (r) return r;
            }
          }
          return null;
        })(comments);
        if (!found || !found.replies || found.replies.length === 0) {
          fetchRepliesForParent(parentId);
        }
      }
      return { ...prev, [key]: nextOpen };
    });
  };

  // Toggle reply input box (separate from view)
  const toggleReplyBoxOpen = (parentId) => {
    const key = String(parentId);
    setReplyBoxOpen(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleLike = async (commentId) => {
    const baseURL = process.env.REACT_APP_API_URL || 'http://localhost:5000';
    const cid = String(commentId);
    if (!currentUser) return;
    setLikeLoading(prev => ({ ...prev, [cid]: true }));

    // optimistic toggle in tree
    setComments(prev => {
      const { tree } = findAndUpdateInTree(prev, cid, (node) => {
        const userId = String(currentUser._id);
        const liked = (node.likes || []).includes(userId);
        const newLikes = liked ? (node.likes || []).filter(id => id !== userId) : [userId, ...(node.likes || [])];
        return { ...node, likes: newLikes, likeCount: newLikes.length };
      });
      return tree;
    });

    try {
      const url = COMMENT_ITEM_URL(commentId) + "/like";
      const res = await axios.post(url, {}, { baseURL, headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } });
      const updated = normalizeCommentNode(res.data);
      setComments(prev => {
        const { tree } = findAndUpdateInTree(prev, updated._id, () => updated);
        return tree;
      });
    } catch (err) {
      console.warn("Like toggle failed", err);
      // rollback by refetching full comments list
      try {
        const res = await axios.get(GET_COMMENTS_URL(postId), { baseURL });
        const raw = Array.isArray(res.data) ? res.data : res.data.comments || [];
        setComments(normalizeTree(raw));
      } catch (e) { /* ignore */ }
    } finally {
      setLikeLoading(prev => ({ ...prev, [cid]: false }));
    }
  };

  if (loading) {
    return (
      <div className="comments-loading" role="status">
        <span>Loading comments...</span>
      </div>
    );
  }

  // Recursive renderer using nested replies inside each node
  const ReplyThread = ({ replies, parentId, depth = 1 }) => {
    if (!replies || !replies.length) return null;
    return (
      <div className="replies-list">
        {replies.map(reply => {
          const rKey = String(reply._id);
          return (
            <article
              key={reply._id}
              className="reply-card"
              style={{ marginLeft: `${Math.min(depth, 10) * 16}px` }}
            >
              <Avatar src={reply.profilePicture} name={reply.name} size={36} />
              <div className="reply-body">
                <div className="reply-meta">
                  <strong>{reply.name}</strong>
                  <time>{formatTimeAgo(reply.createdAt)}</time>
                </div>
                <div className="reply-text" dangerouslySetInnerHTML={{ __html: reply.text }} />
                <div className="reply-actions">
                  <button
                    className={`link-btn like-btn ${(reply.likes||[]).includes(String(currentUser?._id)) ? 'liked' : ''}`}
                    onClick={() => handleLike(reply._id)}
                    aria-pressed={(reply.likes||[]).includes(String(currentUser?._id))}
                    disabled={!!likeLoading[rKey]}
                  >
                    {(reply.likes || []).includes(String(currentUser?._id)) ? (
                      <FavoriteOutlinedIcon fontSize="small" />
                    ) : (
                      <FavoriteBorderOutlinedIcon fontSize="small" />
                    )}
                    { (reply.likeCount || 0) > 0 && <span className="like-count">{reply.likeCount}</span> }
                  </button>

                  {/* Reply input toggle (opens local ReplyBox) */}
                  <button className="link-btn" onClick={() => toggleReplyBoxOpen(reply._id)}>
                    { replyBoxOpen[rKey] ? "Cancel" : "Reply" }
                  </button>

                  {/* View / Hide nested replies toggle */}
                  { (reply.replies && reply.replies.length > 0) && (
                    <button className="link-btn" onClick={() => toggleViewReplies(reply._id)}>
                      { replyOpen[rKey] ? `Hide ${reply.repliesCount || reply.replies.length} replies` : `View ${reply.repliesCount || reply.replies.length} replies` }
                    </button>
                  )}
                </div>

                {/* Reply input local to this reply */}
                {replyBoxOpen[rKey] && (
                  <div className="replies-section">
                    <ReplyBox parentId={reply._id} onSubmit={submitReply} onClear={() => setReplyBoxOpen(prev => ({ ...prev, [rKey]: false }))} />
                  </div>
                )}

                {/* Nested replies view */}
                {replyOpen[rKey] && (
                  <div className="replies-section">
                    <ReplyThread replies={reply.replies} parentId={reply._id} depth={depth + 1} />
                  </div>
                )}

              </div>
            </article>
          );
        })}
      </div>
    );
  };

  const previewLimit = 3;
  const showPreview = comments.length > previewLimit;

  return (
    <section className="comments-root" aria-labelledby="comments-heading">
      <h3 id="comments-heading" className="comments-title">Comments</h3>

      <form
        className="comment-form"
        onSubmit={(e) => { e.preventDefault(); submitComment(); }}
        aria-label="Add a comment"
      >
        <Avatar src={currentUser?.profilePic} name={currentUser?.name} />
        <div className="comment-input-wrap">
          <textarea
            ref={textareaRef}
            className="comment-textarea"
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Write a thoughtful comment... (Enter to post, Shift+Enter for newline)"
            aria-label="Write a comment"
            rows={1}
            disabled={submitting}
          />
          <div className="comment-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setNewComment('')}
              aria-label="Clear comment"
            >
              Clear
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={submitting || !newComment.trim()}
              aria-label="Post comment"
            >
              {submitting ? 'Posting…' : 'Post'}
            </button>
          </div>
        </div>
      </form>

      {error && <div className="comment-error" role="alert">{error}</div>}

      <div ref={listRef} className="comments-list" role="list" aria-live="polite">
        {comments.length === 0 && <div className="no-comments">No comments yet — be the first to comment.</div>}
        {showPreview
          ? comments.slice(0, previewLimit).map((c) => {
            const cKey = String(c._id);
            return (
              <article key={c._id} className={`comment-card ${c.pending ? 'pending' : ''}`} role="listitem">
                <Avatar src={c.profilePicture} name={c.name} />
                <div className="comment-body">
                  <div className="comment-meta">
                    <strong className="comment-author">{c.name}</strong>
                    <time className="comment-time" dateTime={c.createdAt}>{formatTimeAgo(c.createdAt)}</time>
                  </div>
                  <div
                    className="comment-text"
                    dangerouslySetInnerHTML={{ __html: c.text || c.body }}
                  />
                  <div className="comment-footer">
                    {/* Reply input toggle */}
                    <button className="link-btn" aria-label="Reply" onClick={() => toggleReplyBoxOpen(c._id)}>
                      { replyBoxOpen[cKey] ? "Cancel" : "Reply" }
                    </button>

                    {/* View / Hide nested replies button */}
                    { (c.replies && c.replies.length > 0) && (
                      <button className="link-btn" onClick={() => toggleViewReplies(c._id)}>
                        { replyOpen[cKey] ? `Hide ${c.repliesCount || c.replies.length} replies` : `View ${c.repliesCount || c.replies.length} replies` }
                      </button>
                    )}

                    <button
                      className={`link-btn like-btn ${(c.likes||[]).includes(String(currentUser?._id)) ? 'liked' : ''}`}
                      aria-pressed={(c.likes||[]).includes(String(currentUser?._id))}
                      onClick={() => handleLike(c._id)}
                      disabled={!!likeLoading[cKey]}
                    >
                      {(c.likes || []).includes(String(currentUser?._id)) ? (
                        <FavoriteOutlinedIcon fontSize="small" />
                      ) : (
                        <FavoriteBorderOutlinedIcon fontSize="small" />
                      )}
                      { (c.likeCount || 0) > 0 && <span className="like-count">{c.likeCount}</span> }
                    </button>

                    {c.pending && <span className="muted">Sending…</span>}
                  </div>

                  {/* Reply input local to this top-level comment */}
                  {replyBoxOpen[cKey] && (
                    <div className="replies-section">
                      <ReplyBox parentId={c._id} onSubmit={submitReply} onClear={() => setReplyBoxOpen(prev => ({ ...prev, [cKey]: false }))} />
                    </div>
                  )}

                  {/* Nested replies view */}
                  {replyOpen[cKey] && (
                    <div className="replies-section">
                      <ReplyThread replies={c.replies} parentId={c._id} depth={1} />
                    </div>
                  )}

                  {/* replies preview when closed */}
                  { (c.replies && c.replies.length > 0) && !replyOpen[cKey] && (
                    <div className="replies-preview" onClick={() => toggleViewReplies(c._id)} role="button" tabIndex={0}>
                      {c.replies.slice(0,2).map(r => (
                        <div key={r._id} className="reply-preview-item">
                          <strong>{r.name}:</strong>&nbsp;
                          <span dangerouslySetInnerHTML={{ __html: r.text }} />
                        </div>
                      ))}
                      <div className="replies-summary">
                        View {c.repliesCount || (c.replies.length)} { (c.repliesCount || c.replies.length) === 1 ? 'reply' : 'replies'}
                      </div>
                    </div>
                  )}
                </div>
              </article>
            );
          })
          : comments.map((c) => {
            const cKey = String(c._id);
            return (
              <article key={c._id} className={`comment-card ${c.pending ? 'pending' : ''}`} role="listitem">
                <Avatar src={c.profilePicture} name={c.name} />
                <div className="comment-body">
                  <div className="comment-meta">
                    <strong className="comment-author">{c.name}</strong>
                    <time className="comment-time" dateTime={c.createdAt}>{formatTimeAgo(c.createdAt)}</time>
                  </div>
                  <div
                    className="comment-text"
                    dangerouslySetInnerHTML={{ __html: c.text || c.body }}
                  />
                  <div className="comment-footer">
                    {/* Reply input toggle */}
                    <button className="link-btn" aria-label="Reply" onClick={() => toggleReplyBoxOpen(c._id)}>
                      { replyBoxOpen[cKey] ? "Cancel" : "Reply" }
                    </button>

                    {/* View / Hide nested replies button */}
                    { (c.replies && c.replies.length > 0) && (
                      <button className="link-btn" onClick={() => toggleViewReplies(c._id)}>
                        { replyOpen[cKey] ? `Hide ${c.repliesCount || c.replies.length} replies` : `View ${c.repliesCount || c.replies.length} replies` }
                      </button>
                    )}

                    <button
                      className={`link-btn like-btn ${(c.likes||[]).includes(String(currentUser?._id)) ? 'liked' : ''}`}
                      aria-pressed={(c.likes||[]).includes(String(currentUser?._id))}
                      onClick={() => handleLike(c._id)}
                      disabled={!!likeLoading[cKey]}
                    >
                      {(c.likes || []).includes(String(currentUser?._id)) ? (
                        <FavoriteOutlinedIcon fontSize="small" />
                      ) : (
                        <FavoriteBorderOutlinedIcon fontSize="small" />
                      )}
                      { (c.likeCount || 0) > 0 && <span className="like-count">{c.likeCount}</span> }
                    </button>

                    {c.pending && <span className="muted">Sending…</span>}
                  </div>

                  {/* Reply input local to this top-level comment */}
                  {replyBoxOpen[cKey] && (
                    <div className="replies-section">
                      <ReplyBox parentId={c._id} onSubmit={submitReply} onClear={() => setReplyBoxOpen(prev => ({ ...prev, [cKey]: false }))} />
                    </div>
                  )}

                  {/* Nested replies view */}
                  {replyOpen[cKey] && (
                    <div className="replies-section">
                      <ReplyThread replies={c.replies} parentId={c._id} depth={1} />
                    </div>
                  )}

                  {/* replies preview when closed */}
                  { (c.replies && c.replies.length > 0) && !replyOpen[cKey] && (
                    <div className="replies-preview" onClick={() => toggleViewReplies(c._id)} role="button" tabIndex={0}>
                      {c.replies.slice(0,2).map(r => (
                        <div key={r._id} className="reply-preview-item">
                          <strong>{r.name}:</strong>&nbsp;
                          <span dangerouslySetInnerHTML={{ __html: r.text }} />
                        </div>
                      ))}
                      <div className="replies-summary">
                        View {c.repliesCount || (c.replies.length)} { (c.repliesCount || c.replies.length) === 1 ? 'reply' : 'replies'}
                      </div>
                    </div>
                  )}
                </div>
              </article>
            );
          })
        }
      </div>

      {showPreview && (
        <Link to={`/post/${postId}`} className="view-all-comments-btn">
          View all comments
        </Link>
      )}
    </section>
  );
};

export default memo(Comments);

/* ---------- NEW: small helper to check existence in tree (prevents duplicate insert) ---------- */
function existsInTree(tree, id) {
  if (!tree || !id) return false;
  const sid = String(id);
  const stack = [...tree];
  while (stack.length) {
    const n = stack.pop();
    if (!n) continue;
    if (String(n._id) === sid) return true;
    if (n.replies && n.replies.length) stack.push(...n.replies);
  }
  return false;
}

/* ---------- NEW: ReplyBox component (local input state prevents remount/typing issues) ---------- */
function ReplyBox({ parentId, placeholder = "Write a reply...", onSubmit, onClear }) {
  const [text, setText] = useState("");
  const [submittingLocal, setSubmittingLocal] = useState(false);
  const taRef = useRef(null);

  useEffect(() => {
    if (taRef.current) {
      taRef.current.style.height = "auto";
      taRef.current.style.height = `${Math.min(300, taRef.current.scrollHeight)}px`;
    }
  }, [text, submittingLocal]);

  const handleKeyDownLocal = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  const submit = async () => {
    const trimmed = (text || "").trim();
    if (!trimmed || submittingLocal) return;
    setSubmittingLocal(true);
    try {
      await onSubmit(parentId, trimmed);
      setText("");
      onClear?.(parentId);
    } finally {
      setSubmittingLocal(false);
    }
  };

  return (
    <div className="reply-input">
      <textarea
        ref={taRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDownLocal}
        placeholder={placeholder}
        rows={1}
      />
      <div className="reply-actions">
        <button type="button" onClick={() => { setText(""); onClear?.(parentId); }} disabled={submittingLocal}>Clear</button>
        <button type="button" onClick={submit} disabled={submittingLocal || !text.trim()}>Reply</button>
      </div>
    </div>
  );
}