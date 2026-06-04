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

function attachAuthHeader(config: any) {
    if (isPreviewMode) {
        config.headers.Authorization = 'Bearer preview-bypass-token';
        return config;
    }
    try {
        const token = localStorage.getItem('amafah_token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
    } catch (error) {
        console.error("Error attaching auth token:", error);
    }
    return config;
}

api.interceptors.request.use((config) => {
    if (config.url) {
        config.url = config.url.replace(/([^:]\/)\/+/g, "$1");
        if (config.url.startsWith('//api')) {
            config.url = config.url.replace('//api', '/api');
        }
    }
    return attachAuthHeader(config);
}, (error) => Promise.reject(error));

axios.defaults.baseURL = api.defaults.baseURL;

api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401 && !isPreviewMode) {
            try {
                localStorage.removeItem('amafah_token');
                localStorage.removeItem('amafah_user');
                if (window.location.pathname !== '/login') {
                    window.location.href = '/login';
                }
            } catch { /* ignore */ }
        }
        return Promise.reject(error);
    }
);

export default api;
