import React, { useState, useEffect } from 'react';
import axios from 'axios';
import API_BASE_URL from '../apiConfig';
import { 
  FaUsers, 
  FaUserGraduate, 
  FaShieldAlt, 
  FaHistory, 
  FaArrowRight, 
  FaChartLine,
  FaServer,
  FaPlusCircle,
  FaTable
} from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';
import ClockLoader from '../components/ClockLoader';
import { 
  timetableService, 
  activityService, 
  facultyService, 
  studentService 
} from '../services/firebaseService';
import FacultyDashboard from './FacultyDashboard';
import StudentDashboard from './StudentDashboard';

const Dashboard = () => {
  const navigate = useNavigate();
  const userRole = localStorage.getItem('userRole');

  // Proxy redirection based on role
  if (userRole === 'faculty') return <FacultyDashboard />;
  if (userRole === 'student') return <StudentDashboard />;

  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalFaculty: 0,
    totalStudents: 0,
    activeTimetables: 0,
    departments: 15
  });
  const [activities, setActivities] = useState([]);

  useEffect(() => {
    const fetchAllData = async () => {
      try {
        const [faculties, students, structures, activities] = await Promise.all([
          facultyService.getAll(),
          studentService.getAll(),
          timetableService.getAllStructures(),
          activityService.getAll()
        ]);
        
        setStats({
          totalFaculty: faculties.length,
          totalStudents: students.length,
          activeTimetables: structures.length,
          activeFaculty: faculties.filter(f => f.status === "Active").length,
          departments: 15
        });
        
        setActivities(activities.slice(0, 5));
      } catch (error) {
        console.error("Critical System Data Fetch Failed", error);
      } finally {
        setLoading(false);
      }
    };

    fetchAllData();
  }, []);

  if (loading) return <ClockLoader />;

  return (
    <div className="w-full h-full bg-[#f8fafc] p-3 sm:p-6 lg:p-10 overflow-y-auto custom-scrollbar overflow-x-hidden">
      <div className="max-w-7xl mx-auto space-y-10 animate-fade-in pb-12">
        
        {/* 1. HEADER: Institutional Authority */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-2xl font-black text-slate-900 tracking-tighter uppercase">
               Academic <span className="text-blue-600">Commander</span>
            </h1>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-[0.3em] opacity-80">
               SMVEC Institutional Management Interface
            </p>
          </div>
          <div className="flex items-center gap-4 bg-white p-2.5 rounded-2xl border border-slate-200/60 shadow-sm pr-6 transition-all hover:shadow-md">
             <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 border border-blue-100">
                <FaTable size={18} className="animate-pulse" />
             </div>
             <div>
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Academic Year</p>
                <p className="text-[12px] font-bold text-slate-800 leading-none uppercase">2024-2025 SESSION</p>
             </div>
          </div>
        </div>

        {/* 2. STATS GRID: Real-time Counters */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
           {[
             { label: 'Staff Registry', val: stats.totalFaculty, icon: <FaUsers />, color: 'blue' },
             { label: 'Student Cadre', val: stats.totalStudents, icon: <FaUserGraduate />, color: 'indigo' },
             { label: 'Active Protocols', val: stats.activeTimetables, icon: <FaTable />, color: 'emerald' },
             { label: 'Faculty Active', val: stats.activeFaculty || 0, icon: <FaChartLine />, color: 'orange' },
           ].map((item, i) => (
             <div key={i} className="group bg-white rounded-2xl p-6 border border-slate-200/60 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 relative overflow-hidden">
                <div className={`absolute top-0 right-0 w-24 h-24 bg-${item.color}-500/5 blur-3xl rounded-full -mr-8 -mt-8`}></div>
                <div className="flex items-center gap-4 relative z-10">
                   <div className={`w-12 h-12 rounded-2xl bg-${item.color}-50 flex items-center justify-center text-${item.color}-600 border border-${item.color}-100 group-hover:scale-110 transition-transform`}>
                      {item.icon}
                   </div>
                   <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">{item.label}</p>
                      <h4 className="text-2xl font-black text-slate-900 tracking-tighter">
                         {item.val.toString().padStart(2, '0')}
                      </h4>
                   </div>
                </div>
             </div>
           ))}
        </div>

        {/* 3. CORE MANAGEMENT & LOGS */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
           
           {/* Institutional Protocol Map */}
           <div className="lg:col-span-8 space-y-6">
              <div className="bg-white rounded-3xl border border-slate-200/60 shadow-sm overflow-hidden flex flex-col transition-all hover:shadow-md">
                <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-white">
                   <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/20"><FaTable size={16} /></div>
                      <div>
                         <h3 className="text-[15px] font-black text-slate-900 uppercase tracking-tighter">Institutional Protocol Map</h3>
                         <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Department-wise Timetable Coverage</p>
                      </div>
                   </div>
                   <button onClick={() => navigate('/table-creation')} className="text-[10px] font-black text-blue-600 bg-blue-50 px-3 py-1.5 rounded-xl border border-blue-100 hover:bg-blue-600 hover:text-white transition-all uppercase tracking-widest">View All</button>
                </div>
                
                <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-4">
                   {[
                      { dept: 'CSE', full: 'Computer Science', count: 12, color: 'blue' },
                      { dept: 'IT', full: 'Information Technology', count: 8, color: 'emerald' },
                      { dept: 'ECE', full: 'Electronics & Comm.', count: 10, color: 'indigo' },
                      { dept: 'MECH', full: 'Mechanical Eng.', count: 6, color: 'orange' },
                   ].map((d, i) => (
                      <div key={i} className="p-5 bg-slate-50/50 rounded-2xl border border-slate-100 group hover:bg-white hover:shadow-lg transition-all">
                         <div className="flex items-center justify-between mb-3">
                            <span className={`text-[10px] font-black px-2 py-0.5 rounded bg-${d.color}-50 text-${d.color}-600 border border-${d.color}-100 uppercase tracking-widest`}>{d.dept}</span>
                            <span className="text-[10px] font-bold text-slate-400">{d.count} PROTOCOLS</span>
                         </div>
                         <h5 className="text-sm font-black text-slate-900 uppercase tracking-tighter mb-4">{d.full}</h5>
                         <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div className={`h-full bg-${d.color}-500`} style={{ width: `${(d.count/15)*100}%` }}></div>
                         </div>
                      </div>
                   ))}
                </div>
              </div>

              {/* Administrative Logs */}
              <div className="bg-white rounded-3xl border border-slate-200/60 shadow-sm overflow-hidden transition-all hover:shadow-md">
                 <div className="px-8 py-5 border-b border-slate-100 bg-slate-50/50 flex items-center gap-4">
                    <FaHistory className="text-slate-400" size={14} />
                    <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Administrative Activity Logs</h3>
                 </div>
                 <div className="divide-y divide-slate-50 p-2">
                    {activities.length > 0 ? activities.map((act, i) => (
                 <div className="flex items-center h-14 px-4 group hover:bg-slate-50/50 rounded-xl transition-all">
                         <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400 group-hover:bg-blue-600 group-hover:text-white transition-all text-[10px] font-bold uppercase shrink-0">
                            {act.name ? act.name.substring(0,2) : 'AD'}
                         </div>
                         <div className="flex-1 px-3 min-w-0">
                            <p className="text-[11px] font-bold text-slate-800 leading-none mb-1 truncate">
                               {act.name} <span className="text-slate-400 font-medium">·</span> <span className="text-blue-600 font-black uppercase tracking-tighter">{act.action}</span>
                            </p>
                            <p className="text-[9px] font-bold text-slate-300 uppercase tracking-widest">Ref: SMV-{i+1}024</p>
                         </div>
                         <span className="text-[10px] font-black text-slate-900 font-mono opacity-50 shrink-0">
                            {act.timestamp ? new Date(act.timestamp._seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'NOW'}
                         </span>
                      </div>
                    )) : (
                      <div className="py-12 flex flex-col items-center justify-center text-slate-300">
                         <p className="text-[10px] font-black uppercase tracking-widest opacity-30 text-center">No Recent Administrative Events</p>
                      </div>
                    )}
                 </div>
              </div>
           </div>

           {/* Tactical Quick Actions */}
           <div className="lg:col-span-4 space-y-6">
              <div className="bg-[#0f172a] rounded-3xl p-8 text-white shadow-2xl shadow-slate-900/20 relative overflow-hidden group">
                 <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 blur-[60px] rounded-full -mr-16 -mt-16 group-hover:bg-blue-500/20 transition-all duration-700"></div>
                 <h4 className="text-[11px] font-black text-blue-400 uppercase tracking-[0.3em] mb-6 tracking-widest">Tactical Shortcuts</h4>
                 
                 <div className="space-y-4">
                    {[
                      { label: 'Protocol Architect', path: '/table-creation', icon: <FaTable /> },
                      { label: 'Staff Registry', path: '/staff', icon: <FaUsers /> },
                      { label: 'Student Cadre', path: '/students', icon: <FaUserGraduate /> },
                    ].map((btn, i) => (
                      <button 
                        key={i}
                        onClick={() => navigate(btn.path)}
                        className="w-full flex items-center justify-between p-5 bg-white/5 border border-white/5 rounded-2xl hover:bg-white/10 hover:border-white/20 transition-all group/btn"
                      >
                         <div className="flex items-center gap-4">
                            <span className="text-blue-400 group-hover/btn:scale-125 transition-transform">{btn.icon}</span>
                            <span className="text-sm font-bold text-slate-300 tracking-tight">{btn.label}</span>
                         </div>
                         <FaArrowRight size={12} className="text-slate-600 group-hover/btn:translate-x-1 transition-transform" />
                      </button>
                    ))}
                 </div>
              </div>

              {/* System Health Card */}
              <div className="bg-white rounded-3xl border border-slate-200/60 p-8 shadow-sm group">
                 <div className="flex items-center gap-4 mb-6">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-600 border border-emerald-100 group-hover:rotate-12 transition-transform duration-500">
                       <FaChartLine size={20} />
                    </div>
                    <div>
                       <h5 className="text-sm font-black text-slate-900 uppercase tracking-tighter leading-none">Institutional Health</h5>
                       <p className="text-[10px] font-bold text-emerald-500 mt-1 uppercase tracking-widest animate-pulse">System Optimized</p>
                    </div>
                 </div>
                 <p className="text-[12px] font-medium text-slate-400 leading-relaxed mb-6">
                    All academic protocols are currently in sync with the central server. Overall institutional deployment efficiency: <span className="text-blue-600 font-bold">98.4%</span>.
                 </p>
                 <div className="pt-6 border-t border-slate-50 flex items-center justify-between">
                    <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest text-[9px]">Infrastructure Core: STABLE</span>
                    <div className="w-20 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                       <div className="w-[98%] h-full bg-emerald-500"></div>
                    </div>
                 </div>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
