import axios from 'axios';

// Environment-aware Base URL
const baseURL = import.meta.env.VITE_API_URL || '';
const normalizedBaseURL = baseURL.replace(/([^:]\/)\/+/g, "$1").replace(/\/+$/, '');

const api = axios.create({
    baseURL: normalizedBaseURL,
    headers: {
        'Content-Type': 'application/json',
    },
});

api.interceptors.request.use(async (config) => {
    // 1. Sanitize URL to prevent protocol-relative double-slashes
    if (config.url) {
        config.url = config.url.replace(/([^:]\/)\/+/g, "$1");
        
        // Hard-catch for specific root bug causing the crash
        if (config.url.startsWith('//api')) {
            config.url = config.url.replace('//api', '/api');
        }
    }

    try {
        // Ensure we are in a browser environment and Clerk is loaded
        if (typeof window !== 'undefined' && window.Clerk && window.Clerk.session) {
            const token = await window.Clerk.session.getToken();
            if (token) {
                config.headers.Authorization = `Bearer ${token}`;
            }
        }
    } catch (error) {
        console.error("Error attaching Clerk token to request:", error);
    }
    return config;
}, (error) => {
    return Promise.reject(error);
});

// Configure global axios instance as well for legacy compatibility
axios.defaults.baseURL = api.defaults.baseURL;

// Apply the same bulletproof interceptor to the global axios instance
axios.interceptors.request.use(async (config) => {
    if (config.url) {
        config.url = config.url.replace(/([^:]\/)\/+/g, "$1");
        if (config.url.startsWith('//api')) {
            config.url = config.url.replace('//api', '/api');
        }
    }
    try {
        if (typeof window !== 'undefined' && window.Clerk && window.Clerk.session) {
            const token = await window.Clerk.session.getToken();
            if (token) {
                config.headers.Authorization = `Bearer ${token}`;
            }
        }
    } catch (error) {
        console.error("Error attaching Clerk token to global request:", error);
    }
    return config;
}, (error) => {
    return Promise.reject(error);
});

export default api;
