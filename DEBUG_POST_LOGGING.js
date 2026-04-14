// Add this to Post.jsx right after the component function declaration (after line 190)
// This will log what data the component receives

const DEBUG_POST_RENDER = true;

const debugLog = (label, data) => {
  if (DEBUG_POST_RENDER) {
    console.log(`[Post Debug] ${label}:`, data);
  }
};

// Then add this inside the Post component, right at the start of the render:
/*
  // ADD THIS AFTER LINE 200 (after const Post = ...)
  
  useEffect(() => {
    if (DEBUG_POST_RENDER && post) {
      console.log('=== POST COMPONENT DEBUG ===');
      console.log('Post ID:', post._id);
      console.log('Post Desc:', post.desc?.substring(0, 50));
      console.log('Has mediaArray:', !!post.mediaArray);
      console.log('mediaArray length:', post.mediaArray?.length || 0);
      console.log('mediaArray first URL:', post.mediaArray?.[0]?.url?.substring(0, 80));
      console.log('Has img field:', !!post.img);
      console.log('img value:', post.img?.substring(0, 80));
      console.log('Has media field:', !!post.media);
      console.log('media value:', post.media);
      console.log('hasValidMedia result:', hasValidMedia(post));
      console.log('normalizeMediaArray result:', normalizeMediaArray(post.mediaArray));
      console.log('=== END DEBUG ===');
    }
  }, [post]);
*/
