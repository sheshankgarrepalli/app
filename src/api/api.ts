import axios from 'axios';

const isPreviewMode = typeof window !== 'undefined' && window.location.hostname.includes('vercel.app');

const baseURL = import.meta.env.VITE_API_URL || '';
const normalizedBaseURL = baseURL.replace(/([^:]\/)\/+/g, "$1").replace(/\/+$/, '');

const api = axios.create({
    baseURL: normalizedBaseURL,
    headers: {
        'Content-Type': 'application/json',
    },
});

api.interceptors.request.use(async (config) => {
    if (config.url) {
        config.url = config.url.replace(/([^:]\/)\/+/g, "$1");
        if (config.url.startsWith('//api')) {
            config.url = config.url.replace('//api', '/api');
        }
    }

    if (isPreviewMode) {
        config.headers.Authorization = 'Bearer preview-bypass-token';
        return config;
    }

    try {
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

axios.defaults.baseURL = api.defaults.baseURL;

axios.interceptors.request.use(async (config) => {
    if (config.url) {
        config.url = config.url.replace(/([^:]\/)\/+/g, "$1");
        if (config.url.startsWith('//api')) {
            config.url = config.url.replace('//api', '/api');
        }
    }

    if (isPreviewMode) {
        config.headers.Authorization = 'Bearer preview-bypass-token';
        return config;
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
