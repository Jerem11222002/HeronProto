// src/hooks/useSearchCache.js
/**
 * Custom hook for caching search results with TTL (Time To Live)
 * 
 * This implements frontend query result caching to avoid re-fetching
 * the same search results repeatedly. It's a pattern called "memoization"
 * or "request deduplication" in web development.
 * 
 * Example:
 * const { searchUsers, clearCache } = useSearchCache();
 * const results = await searchUsers("john");  // API call
 * const results2 = await searchUsers("john"); // Returns cached result!
 */

import { useCallback, useRef } from 'react';
import axios from 'axios';

const useSearchCache = (options = {}) => {
  const {
    ttl = 5 * 60 * 1000,  // 5 minutes default cache time
    apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:5000',
    maxCacheSize = 50     // Max number of queries to cache
  } = options;

  const cacheRef = useRef(new Map());
  const requestsInFlightRef = useRef(new Map());

  /**
   * Search users with frontend caching
   * Multiple requests for same query reuse first request (request deduplication)
   */
  const searchUsers = useCallback(async (query, token) => {
    if (!query?.trim()) {
      return { users: [], totalCount: 0, hasMore: false, cached: false };
    }

    const normalizedQuery = query.toLowerCase().trim();
    
    // Check cache first
    const cached = cacheRef.current.get(normalizedQuery);
    if (cached && Date.now() - cached.timestamp < ttl) {
      console.log(`🎯 [SEARCH CACHE HIT] "${normalizedQuery}" - returning cached results`);
      return { ...cached.data, cached: true };
    }

    // Check if request is already in flight
    if (requestsInFlightRef.current.has(normalizedQuery)) {
      console.log(`⏳ [SEARCH DEDUP] "${normalizedQuery}" - waiting for in-flight request`);
      return requestsInFlightRef.current.get(normalizedQuery);
    }

    // Make API request and cache it
    console.log(`🌐 [SEARCH API CALL] "${normalizedQuery}" - fetching from server`);
    const requestPromise = axios.get(`${apiUrl}/api/search/users`, {
      params: { q: query },
      headers: { Authorization: `Bearer ${token}` }
    }).then(response => {
      const data = response.data;
      
      // Store in cache
      cacheRef.current.set(normalizedQuery, {
        data,
        timestamp: Date.now()
      });

      // Limit cache size (LRU-style, just delete oldest if too big)
      if (cacheRef.current.size > maxCacheSize) {
        const firstKey = cacheRef.current.keys().next().value;
        cacheRef.current.delete(firstKey);
      }

      return { ...data, cached: false };
    });

    // Store in-flight request
    requestsInFlightRef.current.set(normalizedQuery, requestPromise);

    // Remove from in-flight when done
    try {
      const result = await requestPromise;
      return result;
    } finally {
      requestsInFlightRef.current.delete(normalizedQuery);
    }
  }, [apiUrl, ttl, maxCacheSize]);

  /**
   * Get suggestions with caching
   */
  const getSuggestions = useCallback(async (limit = 5, token) => {
    const cacheKey = `suggestions-${limit}`;
    
    // Check cache
    const cached = cacheRef.current.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < ttl) {
      console.log(`🎯 [SUGGESTIONS CACHE HIT]`);
      return { data: cached.data, cached: true };
    }

    // Check in-flight
    if (requestsInFlightRef.current.has(cacheKey)) {
      console.log(`⏳ [SUGGESTIONS DEDUP] - waiting for in-flight request`);
      return requestsInFlightRef.current.get(cacheKey);
    }

    console.log(`🌐 [SUGGESTIONS API CALL]`);
    const requestPromise = axios.get(`${apiUrl}/api/search/suggestions`, {
      params: { limit },
      headers: { Authorization: `Bearer ${token}` }
    }).then(response => {
      cacheRef.current.set(cacheKey, {
        data: response.data,
        timestamp: Date.now()
      });
      return { data: response.data, cached: false };
    });

    requestsInFlightRef.current.set(cacheKey, requestPromise);
    try {
      return await requestPromise;
    } finally {
      requestsInFlightRef.current.delete(cacheKey);
    }
  }, [apiUrl, ttl]);

  /**
   * Clear all cached search results
   */
  const clearCache = useCallback(() => {
    console.log('🗑️ [SEARCH CACHE CLEARED]');
    cacheRef.current.clear();
  }, []);

  /**
   * Clear specific query from cache
   */
  const clearQueryFromCache = useCallback((query) => {
    const normalizedQuery = query.toLowerCase().trim();
    cacheRef.current.delete(normalizedQuery);
    console.log(`🗑️ [SEARCH CACHE CLEARED] "${normalizedQuery}"`);
  }, []);

  /**
   * Get cache statistics (for debugging)
   */
  const getCacheStats = useCallback(() => {
    const stats = {
      cachedQueries: cacheRef.current.size,
      entries: []
    };

    for (const [key, value] of cacheRef.current.entries()) {
      stats.entries.push({
        query: key,
        resultCount: value.data?.users?.length || 0,
        age: Date.now() - value.timestamp,
        expired: Date.now() - value.timestamp > ttl
      });
    }

    return stats;
  }, [ttl]);

  return {
    searchUsers,
    getSuggestions,
    clearCache,
    clearQueryFromCache,
    getCacheStats
  };
};

export default useSearchCache;
