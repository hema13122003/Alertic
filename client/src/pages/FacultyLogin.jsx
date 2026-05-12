import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { auth, db } from '../firebase';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { FiUserCheck, FiLock, FiEye, FiEyeOff, FiShield } from 'react-icons/fi';
import { requestNotificationPermission } from '../services/pushService';

const FacultyLogin = () => {
  const [empId, setEmpId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    
    if (!empId || !password) {
      setError("Employee ID and Access Secret are required.");
      return;
    }

    setLoading(true);
    try {
      // 1. Find user email by Employee ID in Firestore
      const q = query(collection(db, "faculties"), where("emp_id", "==", empId));
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        setError("Employee ID not found in registry.");
        setLoading(false);
        return;
      }

      const userData = { id: querySnapshot.docs[0].id, ...querySnapshot.docs[0].data() };
      const email = userData.email;

      // 2. Sign in with Firebase Auth
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // 3. Setup local session
      localStorage.setItem('isAuthenticated', 'true');
      localStorage.setItem('user', JSON.stringify({ ...userData, uid: user.uid }));
      localStorage.setItem('userRole', 'faculty');
      localStorage.setItem('faculty_id', userData.id);
      
      toast.success("Identity Verified. Welcome Prof. " + userData.name.split(' ')[0]);
      requestNotificationPermission();
      navigate('/faculty-dashboard');
    } catch (error) {
      console.error("Login Error:", error);
      setError(error.code === 'auth/wrong-password' ? "Invalid Access Secret" : "Authorized Session Failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-screen h-screen bg-[#0F172A] flex items-center justify-center p-4 relative overflow-hidden font-sans">
      {/* Refined Background Blobs for Force Portal */}
      <div className="absolute top-[-10%] left-[-5%] w-[350px] h-[350px] bg-emerald-600/10 blur-[80px] rounded-full pointer-events-none"></div>
      <div className="absolute top-[30%] right-[-5%] w-[400px] h-[400px] bg-blue-600/10 blur-[80px] rounded-full pointer-events-none"></div>
      
      {/* Layered Gradient Overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#0F172A] to-[#1E293B] opacity-90 pointer-events-none"></div>

      <div className="w-full max-w-[400px] animate-slide-up relative z-10 flex flex-col items-center justify-center">
        <div className="w-full glass-card rounded-[2.25rem] p-7 md:p-9 shadow-2xl transition-all duration-500 border-t-2 border-t-alertic-yellow overflow-hidden">
          
          {/* Compact Header */}
          <div className="mb-8 text-center relative">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-white/5 border border-white/10 mb-4 group-hover:bg-white/10 transition-colors">
              <FiShield className="text-alertic-yellow text-3xl" />
            </div>
            <h1 className="text-2xl font-extrabold text-white tracking-[0.15em] mb-1">
              ALERTIC <span className="text-alertic-yellow">FORCE</span>
            </h1>
            <p className="text-[#94A3B8] text-[9.5px] font-bold uppercase tracking-[0.3em] opacity-60">
              Faculty Authentication Gateway
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            {/* Compact Employee ID Input */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-widest text-white/40 ml-1">
                Employee Terminal ID
              </label>
              <div className="relative group/input">
                <FiUserCheck className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20 group-focus-within/input:text-alertic-yellow transition-colors" />
                <input 
                  type="text" 
                  value={empId}
                  onChange={(e) => setEmpId(e.target.value)}
                  placeholder="EMP-XXXX"
                  className="w-full input-glass rounded-xl pl-12 pr-6 py-3 text-sm text-white placeholder:text-white/20 focus:outline-none"
                />
              </div>
            </div>

            {/* Compact Password Input */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-widest text-white/40 ml-1">
                Personal Access Secret
              </label>
              <div className="relative group/input">
                <FiLock className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20 group-focus-within/input:text-alertic-yellow transition-colors" />
                <input 
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full input-glass rounded-xl pl-12 pr-12 py-3 text-sm text-white placeholder:text-white/20 focus:outline-none"
                />
                <button 
                  type="button" 
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-white/20 hover:text-white/60 transition-colors"
                >
                  {showPassword ? <FiEyeOff size={16} /> : <FiEye size={16} />}
                </button>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="bg-red-500/10 border border-red-500/20 text-[#EF4444] text-[10px] py-2 px-4 rounded-lg animate-fade-in font-semibold text-center italic">
                {error}
              </div>
            )}

            {/* Compact Submit Button */}
            <button 
              type="submit"
              disabled={loading}
              className={`w-full bg-alertic-yellow text-[#0f172a] font-black py-4 rounded-xl shadow-xl shadow-alertic-yellow/10 hover:shadow-alertic-yellow/25 hover:-translate-y-0.5 active:scale-[0.98] transition-all duration-300 text-xs tracking-[0.2em] uppercase flex items-center justify-center gap-2 mt-4 ${loading ? 'opacity-80 cursor-not-allowed' : ''}`}
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-[#0f172a]/30 border-t-[#0f172a] rounded-full animate-spin"></div>
                  <span>Verifying Identity...</span>
                </>
              ) : (
                "Authorize Session"
              )}
            </button>
          </form>

          {/* Compact Footer */}
          <div className="mt-8 flex justify-between items-center px-1">
            <div className="flex items-center gap-2">
               <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
               <span className="text-[9px] font-bold text-white/30 uppercase tracking-widest whitespace-nowrap">Sync: Active</span>
            </div>
            <button 
              onClick={() => navigate('/login')}
              className="text-[9px] font-black text-alertic-yellow/40 hover:text-alertic-yellow uppercase tracking-widest underline decoration-1 underline-offset-4 transition-all"
            >
              Standard Portal
            </button>
          </div>
        </div>
        <p className="mt-6 text-[9px] text-white/20 font-medium uppercase tracking-widest">
           Force Protocol Suite v4.5.1
        </p>
      </div>
    </div>
  );
};

export default FacultyLogin;
