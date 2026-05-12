import React, { useState, useEffect } from 'react';
import { timetableService } from '../services/firebaseService';
import { Card, CardContent } from '@mui/material';
import { FaCalendarAlt, FaClock, FaBook, FaMapMarkerAlt } from 'react-icons/fa';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const PERIODS = [
  { id: 1, time: '09:00 – 09:50' },
  { id: 2, time: '09:50 – 10:40' },
  { id: 3, time: '10:55 – 11:45' },
  { id: 4, time: '11:45 – 12:35' },
  { id: 5, time: '01:15 – 02:05' },
  { id: 6, time: '02:05 – 02:55' },
  { id: 7, time: '03:10 – 04:00' },
  { id: 8, time: '04:00 – 04:50' },
];

const FacultyTimetable = () => {
  const [timetable, setTimetable] = useState({});
  const [loading, setLoading] = useState(true);
  const facultyId = localStorage.getItem('userId');

  useEffect(() => {
    const fetchMyTimetable = async () => {
      if (!facultyId) return;
      try {
        const data = await timetableService.getFacultyWeekly(facultyId);
        const mapped = {};
        data.forEach(item => {
          mapped[`${item.day}-${item.period_id}`] = item;
        });
        setTimetable(mapped);
      } catch (error) {
        console.error("Failed to fetch personal timetable");
      } finally {
        setLoading(false);
      }
    };
    fetchMyTimetable();
  }, [facultyId]);

  if (loading) return <div className="p-8 text-center text-luxury-blue-300 font-bold uppercase tracking-widest text-xs">Loading Schedule...</div>;

  return (
    <Card sx={{ borderRadius: '24px', border: '1px solid', borderColor: 'divider', boxShadow: 'none', overflow: 'hidden' }}>
      <div className="p-8 border-b border-luxury-blue-50 flex items-center justify-between bg-luxury-blue-950 text-white">
        <h3 className="text-xl font-black flex items-center gap-3">
          <span className="w-8 h-8 rounded-lg bg-alertic-yellow flex items-center justify-center text-luxury-blue-950 shadow-lg shadow-alertic-yellow/20"><FaCalendarAlt size={14}/></span>
          My Timetable
        </h3>
        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-alertic-yellow opacity-60">Synchronized View</span>
      </div>
      <CardContent sx={{ p: 0 }}>
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-luxury-blue-50/50">
                <th className="p-4 border-b border-r border-luxury-blue-100 text-[10px] font-black uppercase text-luxury-blue-300">Day</th>
                {PERIODS.map(period => (
                  <th key={period.id} className="p-4 border-b border-r border-luxury-blue-100 text-[10px] font-black uppercase text-luxury-blue-900 tracking-widest text-center">
                    P{period.id}
                    <div className="text-[7px] font-bold text-luxury-blue-300 mt-1 lowercase">{period.time}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {DAYS.map((day) => (
                <tr key={day}>
                  <td className="p-4 border-b border-r border-luxury-blue-100 text-center bg-luxury-blue-50/20">
                    <p className="text-[10px] font-black text-luxury-blue-950 uppercase tracking-tight">{day}</p>
                  </td>
                  {PERIODS.map(period => {
                    const cell = timetable[`${day}-${period.id}`];
                    return (
                      <td key={`${day}-${period.id}`} className={`p-4 border-b border-r border-luxury-blue-100 min-w-[150px] transition-all ${cell ? 'bg-alertic-yellow/5' : ''}`}>
                        {cell ? (
                          <div className="space-y-1.5">
                            <div className="flex items-center gap-2">
                              <FaBook className="text-alertic-yellow" size={9} />
                              <span className="text-[9px] font-black text-luxury-blue-950 uppercase line-clamp-1">{cell.subject_name}</span>
                            </div>
                            <div className="flex flex-col gap-1 pl-1 border-l border-luxury-blue-100">
                               <p className="text-[8px] font-bold text-luxury-blue-400 uppercase tracking-widest leading-tight">{cell.program}</p>
                               <div className="flex items-center justify-between mt-1">
                                  <span className="text-[8px] font-black text-blue-600 bg-blue-50/50 px-1 py-0.5 rounded uppercase tracking-tighter">Sec {cell.section}</span>
                                  <div className="flex items-center gap-1 text-[8px] font-bold text-luxury-blue-300">
                                    <FaMapMarkerAlt size={8}/> {cell.classroom || 'R-101'}
                                  </div>
                               </div>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center justify-center opacity-10 py-4">
                             <div className="w-1 h-1 rounded-full bg-luxury-blue-900"></div>
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
};

export default FacultyTimetable;
