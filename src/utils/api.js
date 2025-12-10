import axios from 'axios';

//const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5000';
const API_BASE = process.env.REACT_APP_API_URL || 'https://heronproto-1.onrender.com/api';

const api = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' }
});

api.interceptors.request.use(cfg => {
  const token = localStorage.getItem('token');
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
}, err => Promise.reject(err));

export default api;
