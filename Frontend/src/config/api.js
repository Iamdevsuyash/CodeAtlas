// API Configuration for production and development
const API_CONFIG = {
  // Use environment variable or fallback to production URL
  BASE_URL: process.env.REACT_APP_API_URL || 'https://codeatlas1.onrender.com',
  GUN_URL: process.env.REACT_APP_GUN_URL || 'https://codeatlas-gunjs.onrender.com'
};

// Helper function to get API URL
export const getApiUrl = (endpoint = '') => {
  const baseUrl = API_CONFIG.BASE_URL.replace(/\/$/, ''); // Remove trailing slash
  return `${baseUrl}${endpoint}`;
};

// Helper function to get Gun.js URL
export const getGunUrl = () => {
  return API_CONFIG.GUN_URL;
};

// Default fetch options for API calls
export const defaultFetchOptions = {
  credentials: 'include',
  headers: {
    'Content-Type': 'application/json'
  }
};

export default API_CONFIG;
