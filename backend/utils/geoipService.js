/**
 * Simple GeoIP service for getting location data from IP addresses
 * Uses ip-api.com (free, no API key required for non-commercial use)
 * Falls back to ipapi.co for localhost/development testing
 */

const axios = require('axios');

// Cache for IP lookups to avoid repeated requests
const locationCache = new Map();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Get location data from IP address
 * @param {string} ip - IP address
 * @returns {Promise<Object>} Location data
 */
async function getLocationFromIP(ip) {
  // Handle localhost/private IPs
  if (!ip || ip === '127.0.0.1' || ip === 'localhost' || ip.startsWith('192.168.') || ip.startsWith('10.') || ip.startsWith('172.')) {
    return {
      country: 'Local',
      city: 'Development',
      region: 'Local',
      latitude: null,
      longitude: null,
      isLocal: true
    };
  }

  // Check cache
  const cached = locationCache.get(ip);
  if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
    return cached.data;
  }

  try {
    // Use ip-api.com (free tier: 45 requests per minute)
    const response = await axios.get(`http://ip-api.com/json/${ip}?fields=status,country,city,regionName,lat,lon,query`, {
      timeout: 3000
    });

    if (response.data.status === 'success') {
      const locationData = {
        country: response.data.country,
        city: response.data.city,
        region: response.data.regionName,
        latitude: response.data.lat,
        longitude: response.data.lon,
        ip: response.data.query
      };

      // Cache the result
      locationCache.set(ip, {
        data: locationData,
        timestamp: Date.now()
      });

      return locationData;
    }
  } catch (error) {
    console.warn(`[GeoIP] Failed to lookup IP ${ip}:`, error.message);
  }

  // Return empty location if lookup fails
  return {
    country: null,
    city: null,
    region: null,
    latitude: null,
    longitude: null
  };
}

/**
 * Get client IP from request object
 * Handles various proxy configurations
 * @param {Object} req - Express request object
 * @returns {string} Client IP address
 */
function getClientIP(req) {
  // Check for X-Forwarded-For header (common with proxies)
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    // X-Forwarded-For can be a comma-separated list; use the first IP
    const ips = forwarded.split(',').map(ip => ip.trim());
    return ips[0];
  }

  // Check other common headers
  const realIP = req.headers['x-real-ip'];
  if (realIP) {
    return realIP;
  }

  // Fall back to connection remote address
  return req.connection?.remoteAddress || 
         req.socket?.remoteAddress || 
         req.ip ||
         '127.0.0.1';
}

module.exports = {
  getLocationFromIP,
  getClientIP
};
