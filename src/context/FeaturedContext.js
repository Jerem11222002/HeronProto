import { createContext, useState, useContext, useEffect } from 'react';
import axios from 'axios';

const FeaturedContext = createContext();

export const FeaturedProvider = ({ children }) => {
  const [topArtists, setTopArtists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchTopArtists = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/posts/top-artists', {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
      });
      setTopArtists(response.data);
      setError(null);
    } catch (err) {
      setError('Failed to fetch top artists');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTopArtists();
    const interval = setInterval(fetchTopArtists, 30 * 60 * 1000); // Refresh every 30 mins
    return () => clearInterval(interval);
  }, []);

  return (
    <FeaturedContext.Provider value={{ topArtists, loading, error, fetchTopArtists }}>
      {children}
    </FeaturedContext.Provider>
  );
};

export const useFeatured = () => useContext(FeaturedContext);
