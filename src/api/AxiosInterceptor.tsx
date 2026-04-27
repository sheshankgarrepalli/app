import React from 'react';

// This component is now a pass-through as the interceptor logic 
// has been moved to src/api/api.ts using the global window.Clerk object
// for absolute synchronization reliability.
export const AxiosInterceptor = ({ children }: { children: React.ReactNode }) => {
  return <>{children}</>;
};

export default AxiosInterceptor;
