import React, { useEffect } from 'react';
import { useAuth } from '@clerk/react';
import axios from 'axios';
import api from './api';

export const AxiosInterceptor = ({ children }: { children: React.ReactNode }) => {
  const { getToken, isLoaded } = useAuth();

  useEffect(() => {
    // Interceptor for our centralized 'api' instance
    const apiInterceptor = api.interceptors.request.use(async (config) => {
      // 1. Sanitize URL to prevent protocol-relative double-slashes
      if (config.url) {
        config.url = config.url.replace(/([^:]\/)\/+/g, "$1");
        
        // Hard-catch for specific root bug causing the crash
        if (config.url.startsWith('//api')) {
          config.url = config.url.replace('//api', '/api');
        }
      }

      if (!isLoaded) return config;
      
      const token = await getToken();
      console.log(`[API Interceptor] Firing for ${config.url}. Token attached:`, !!token);
      
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });

    // Interceptor for global axios instance (legacy compatibility)
    const globalInterceptor = axios.interceptors.request.use(async (config) => {
      // 1. Sanitize URL to prevent protocol-relative double-slashes
      if (config.url) {
        config.url = config.url.replace(/([^:]\/)\/+/g, "$1");

        // Hard-catch for specific root bug causing the crash
        if (config.url.startsWith('//api')) {
          config.url = config.url.replace('//api', '/api');
        }
      }

      if (!isLoaded) return config;

      const token = await getToken();
      console.log(`[Global Interceptor] Firing for ${config.url}. Token attached:`, !!token);

      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });

    return () => {
      api.interceptors.request.eject(apiInterceptor);
      axios.interceptors.request.eject(globalInterceptor);
    };
  }, [getToken, isLoaded]);

  return <>{children}</>;
};

export default AxiosInterceptor;
