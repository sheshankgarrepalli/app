import { SignIn } from '@clerk/react';
import { Shield } from 'lucide-react';

const Login = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50/50 relative overflow-hidden">
      {/* Decorative Background */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-blue-100/30 blur-3xl" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-blue-100/30 blur-3xl" />
      
      <div className="w-full max-w-md p-8 relative z-10 flex flex-col items-center">
        <div className="mb-8 flex flex-col items-center">
          <div className="w-12 h-12 rounded-xl bg-blue-600 flex items-center justify-center mb-4 shadow-lg shadow-blue-500/20">
            <Shield className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 text-center">Mobile ERP</h1>
          <p className="text-sm text-gray-500 text-center mt-2">Enterprise Resource Planning System</p>
        </div>

        <div className="w-full bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden flex justify-center p-6">
          <SignIn routing="path" path="/login" fallbackRedirectUrl="/" />
        </div>
      </div>
    </div>
  );
};

export default Login;
