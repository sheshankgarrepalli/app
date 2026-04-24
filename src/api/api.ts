import axios from 'axios';

// Environment-aware Base URL
// We set the baseURL to the origin. 
// All API calls in the app now start with '/api/...'
const baseURL = import.meta.env.VITE_API_URL || '';

// Remove any trailing slash and internal double slashes from baseURL
const normalizedBaseURL = baseURL.replace(/([^:]\/)\/+/g, "$1").replace(/\/+$/, '');

const api = axios.create({
  baseURL: normalizedBaseURL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Configure global axios instance as well for legacy compatibility
axios.defaults.baseURL = api.defaults.baseURL;

// Response interceptor for global error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      console.error('Unauthorized access - potential session expiry');
    }
    return Promise.reject(error);
  }
);

export default api;
