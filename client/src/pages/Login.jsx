import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { auth, db } from '../firebase';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { FiMail, FiLock, FiEye, FiEyeOff } from 'react-icons/fi';
import { requestNotificationPermission } from '../services/pushService';

const Login = () => {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    
    if (!identifier || !password) {
      setError("Please fill in all security credentials.");
      return;
    }

    setLoading(true);
    try {
      let email = identifier;
      let userData = null;
      let role = null;

      // 1. Identify User Role & Email via multi-collection lookup
      if (!identifier.includes('@')) {
        // Search in Students
        const sQuery = query(collection(db, "students"), where("enroll_no", "==", identifier));
        const sSnap = await getDocs(sQuery);
        if (!sSnap.empty) {
          userData = { id: sSnap.docs[0].id, ...sSnap.docs[0].data() };
          email = userData.email;
          role = 'student';
        } else {
          // Search in Faculty
          const fQuery = query(collection(db, "faculties"), where("emp_id", "==", identifier));
          const fSnap = await getDocs(fQuery);
          if (!fSnap.empty) {
            userData = { id: fSnap.docs[0].id, ...fSnap.docs[0].data() };
            email = userData.email;
            role = 'faculty';
          }
        }
      }

      // 2. Perform Firebase Auth Login
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // 3. Fetch final metadata if not already found (for direct email login)
      if (!userData) {
        // Try to find in users (Admin)
        const uSnap = await getDocs(query(collection(db, "users"), where("email", "==", email)));
        if (!uSnap.empty) {
          userData = { id: uSnap.docs[0].id, ...uSnap.docs[0].data() };
          role = userData.role || 'admin';
        } else {
          // Try to find in faculties
          const fSnap = await getDocs(query(collection(db, "faculties"), where("email", "==", email)));
          if (!fSnap.empty) {
            userData = { id: fSnap.docs[0].id, ...fSnap.docs[0].data() };
            role = 'faculty';
          } else {
            // Try to find in students
            const sSnap = await getDocs(query(collection(db, "students"), where("email", "==", email)));
            if (!sSnap.empty) {
              userData = { id: sSnap.docs[0].id, ...sSnap.docs[0].data() };
              role = 'student';
            }
          }
        }
      }

      // 4. Setup Session
      const finalRole = role || 'admin';
      localStorage.clear();
      localStorage.setItem('isAuthenticated', 'true');
      localStorage.setItem('userRole', finalRole);
      localStorage.setItem('userEmail', email);
      localStorage.setItem('user', JSON.stringify({ ...userData, uid: user.uid }));
      
      if (finalRole === 'faculty') {
        localStorage.setItem('faculty_id', userData.id);
        navigate('/faculty-dashboard');
      } else if (finalRole === 'student') {
        localStorage.setItem('student', JSON.stringify(userData));
        navigate('/student-dashboard');
      } else {
        navigate('/dashboard');
      }

      toast.success("Authentication Successful.");
      requestNotificationPermission();
    } catch (error) {
      console.error("Login Error:", error);
      setError(error.code === 'auth/wrong-password' ? "Invalid credentials" : "Authorized Session Failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-screen h-screen bg-[#F8FAFC] flex items-center justify-center p-4 relative overflow-hidden font-sans">
      {/* Refined Background Blobs for Light Mode */}
      <div className="absolute top-[-10%] left-[-5%] w-[400px] h-[400px] bg-blue-500/10 blur-[100px] rounded-full pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-5%] w-[400px] h-[400px] bg-indigo-500/10 blur-[100px] rounded-full pointer-events-none"></div>
      
      {/* Layered Gradient Overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#F8FAFC] to-[#EFF6FF] opacity-90 pointer-events-none"></div>

      <div className="w-full max-w-[400px] animate-slide-up relative z-10 flex flex-col items-center justify-center">
        <div className="w-full bg-white/70 backdrop-blur-xl border border-white rounded-[2.25rem] p-8 md:p-10 shadow-2xl shadow-blue-900/5 transition-all duration-500 overflow-hidden">
          
          {/* Compact Unified Header */}
          <div className="mb-10 text-center relative">
            <h1 className="text-3xl font-extrabold text-[#1E293B] tracking-[0.2em] mb-1.5">
              ALERTIC
            </h1>
            <p className="text-slate-400 text-[10px] font-bold uppercase tracking-[0.3em] opacity-80">
              Unified Access Terminal
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            {/* Unified Identifier Input */}
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 ml-1">
                Access Identifier
              </label>
              <div className="relative group">
                <FiMail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-600 transition-colors z-10" />
                <input 
                  type="text" 
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="ID, Email or Phone"
                  className="w-full bg-slate-50/50 border border-slate-200 rounded-2xl pl-12 pr-6 py-4 text-sm font-medium text-slate-700 placeholder:text-slate-400 outline-none focus:border-blue-500 focus:bg-white transition-all shadow-sm"
                />
              </div>
            </div>

            {/* Unified Password Input */}
            <div className="space-y-2">
              <div className="flex justify-between items-center px-1">
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                  Access Secret
                </label>
                <button type="button" className="text-[10px] font-bold text-blue-600 hover:text-blue-800 transition-colors">
                  Forgot?
                </button>
              </div>
              <div className="relative group">
                <FiLock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-600 transition-colors z-10" />
                <input 
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-50/50 border border-slate-200 rounded-2xl pl-12 pr-12 py-4 text-sm font-medium text-slate-700 placeholder:text-slate-400 outline-none focus:border-blue-500 focus:bg-white transition-all shadow-sm"
                />
                <button 
                  type="button" 
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors z-10"
                >
                  {showPassword ? <FiEyeOff size={16} /> : <FiEye size={16} />}
                </button>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="bg-red-50 border border-red-100 text-[#EF4444] text-[10px] py-3 px-4 rounded-xl animate-fade-in font-bold text-center uppercase tracking-wider">
                {error}
              </div>
            )}

            {/* Unified Remember Me & Login Button */}
            <div className="pt-2 space-y-6">
              <div className="flex items-center gap-2.5 px-1">
                <input 
                  type="checkbox" 
                  id="remember" 
                  className="w-4 h-4 rounded-md border-slate-300 text-blue-600 focus:ring-0 focus:ring-offset-0 transition-all cursor-pointer"
                />
                <label htmlFor="remember" className="text-[11px] font-bold text-slate-400 cursor-pointer hover:text-slate-600 transition-colors">
                  Keep session persistent
                </label>
              </div>

              <button 
                type="submit"
                disabled={loading}
                className={`w-full bg-[#2563EB] text-white font-bold py-4.5 rounded-[1.25rem] shadow-xl shadow-blue-500/20 hover:bg-[#1D4ED8] hover:shadow-2xl hover:scale-[1.02] active:scale-95 transition-all duration-300 text-[11px] tracking-[0.2em] uppercase flex items-center justify-center gap-2 ${loading ? 'opacity-80 cursor-not-allowed' : ''}`}
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    <span>Authenticating...</span>
                  </>
                ) : (
                  "Authorize Access"
                )}
              </button>
            </div>
          </form>
        </div>
        
        <p className="mt-8 text-[10px] font-bold text-slate-400 uppercase tracking-[0.3em] opacity-80">
          Secured by Alertic Core v4.2.1
        </p>
      </div>
    </div>
  );
};

export default Login;
