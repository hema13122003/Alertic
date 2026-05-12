import React, { useState, useEffect } from 'react';
import emailjs from '@emailjs/browser';
import { db } from '../firebase';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { Card, Button, FormControl, RadioGroup, FormControlLabel, Radio, Typography, Box } from '@mui/material';
import { FaBell, FaClock, FaCheckCircle, FaExclamationCircle, FaVolumeUp, FaPlay, FaMusic } from 'react-icons/fa';
import { toast } from 'react-toastify';
import { Slider, IconButton, Stack } from '@mui/material';
import ClockLoader from '../components/ClockLoader';

const SOUND_OPTIONS = [
  { name: 'Clinical Alert', url: 'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3' },
  { name: 'Modern Pager', url: 'https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3' },
  { name: 'Digital Signal', url: 'https://assets.mixkit.co/active_storage/sfx/2360/2360-preview.mp3' },
  { name: 'Minimal Beep', url: 'https://assets.mixkit.co/active_storage/sfx/2354/2354-preview.mp3' },
];

const AlertSettings = () => {
  const [interval, setIntervalValue] = useState(5);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [soundUrl, setSoundUrl] = useState(SOUND_OPTIONS[0].url);
  const [volume, setVolume] = useState(0.5);
  const [globalEnabled, setGlobalEnabled] = useState(true);
  const [telegramEnabled, setTelegramEnabled] = useState(false);
  const [emailEnabled, setEmailEnabled] = useState(false);
  const [telegramId, setTelegramId] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [testAudio, setTestAudio] = useState(null);
  const userRole = localStorage.getItem('userRole') || 'admin';

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        const studentData = JSON.parse(localStorage.getItem('student') || '{}');

        let userId = '';
        let collectionName = '';

        if (userRole === 'student') {
          userId = studentData.id || user.id;
          collectionName = 'students';
        } else if (userRole === 'faculty') {
          userId = localStorage.getItem('faculty_id') || user.id;
          collectionName = 'faculties';
        } else {
          userId = user.id || user.uid;
          collectionName = 'users';
        }

        if (userId) {
          const docRef = doc(db, collectionName, userId);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            const data = docSnap.data();
            // Explicit check: only true if explicitly saved as true (default OFF for new users)
            setGlobalEnabled(data.globalAlertEnabled === true);
            setIntervalValue(data.alertInterval || 5);
            setTelegramEnabled(data.telegramEnabled === true);
            setEmailEnabled(data.emailEnabled === true);
            setTelegramId(data.telegramId || '');
            setContactEmail(data.contactEmail || data.email || '');
          }
          // If doc doesn't exist yet → all defaults stay false (new user)
        }

        const localSound = localStorage.getItem('alert_sound');
        const localVolume = localStorage.getItem('alert_volume');
        if (localSound) setSoundUrl(localSound);
        if (localVolume) setVolume(parseFloat(localVolume));
      } catch (error) {
        console.error(error);
        toast.error('Failed to load alert settings.');
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, [userRole]);

  const handlePlayTest = () => {
    if (testAudio) {
      testAudio.pause();
      testAudio.currentTime = 0;
    }
    const audio = new Audio(soundUrl);
    audio.volume = volume;
    audio.play().catch(err => toast.error("Audio playback blocked."));
    setTestAudio(audio);
  };

  const handleSave = async () => {
    // If master switch is ON, at least one channel must be configured
    if (globalEnabled) {
      const telegramReady = telegramEnabled && telegramId.trim();
      const emailReady = emailEnabled && contactEmail.trim();
      if (!telegramReady && !emailReady) {
        toast.warn('Enable Telegram or Email and enter your ID/address to receive alerts.');
        return;
      }
    }

    setSaving(true);
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      const studentData = JSON.parse(localStorage.getItem('student') || '{}');

      let userId = '';
      let collectionName = '';

      if (userRole === 'student') {
        userId = studentData.id || user.id;
        collectionName = 'students';
      } else if (userRole === 'faculty') {
        userId = localStorage.getItem('faculty_id') || user.id;
        collectionName = 'faculties';
      } else {
        userId = user.id || user.uid;
        collectionName = 'users';
      }

      const docRef = doc(db, collectionName, userId);
      await setDoc(docRef, {
        globalAlertEnabled: globalEnabled,
        alertInterval: interval,
        telegramEnabled,
        emailEnabled,
        telegramId: telegramId.trim(),
        contactEmail: contactEmail.trim(),
        updatedAt: serverTimestamp()
      }, { merge: true });

      localStorage.setItem('alert_sound', soundUrl);
      localStorage.setItem('alert_volume', volume.toString());
      toast.success('Alert settings saved.');
    } catch (error) {
      toast.error('Failed to save alert settings.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <ClockLoader />;

  return (
    <div className="w-full h-full flex flex-col items-center bg-slate-50/50 overflow-y-auto custom-scrollbar px-4 py-6 sm:p-8">
      <div className="max-w-4xl w-full animate-slide-up pb-12">
        <div className="mb-4 text-center">
            <h2 className="text-xl font-black text-slate-900 tracking-tighter uppercase mb-0.5">Alert <span className="text-blue-600">Protocol</span></h2>
            <p className="text-[8px] font-black text-slate-400 uppercase tracking-[0.4em]">Synchronization Parameters</p>
        </div>

        <Card className="rounded-[2.25rem] border border-slate-200 shadow-xl p-4 sm:p-8 bg-white relative overflow-hidden">
          {/* Subtle Background Icon */}
          <FaBell className="absolute -bottom-6 -right-6 text-slate-50 text-[8rem] rotate-12 pointer-events-none" />
          
          <div className="relative z-10">
            <div className="flex items-center gap-3.5 mb-6">
               <div className="w-11 h-11 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600 border border-blue-100 shadow-sm">
                  <FaClock size={20} />
               </div>
               <div>
                  <h3 className="text-lg font-black text-slate-900 leading-none mb-1">Notification Interval</h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">Choose when to trigger the deployment alert</p>
               </div>
            </div>

            <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 mb-6 flex items-center justify-between gap-4">
               <div>
                  <h4 className="text-[14px] font-bold text-slate-800">Master Alert Protocol</h4>
                  <p className="text-[10px] font-medium text-slate-400 uppercase">Enable automatic period countdowns</p>
               </div>
               <button 
                  onClick={() => setGlobalEnabled(!globalEnabled)}
                  className={`w-14 h-8 rounded-full relative transition-all duration-300 ${globalEnabled ? 'bg-blue-600' : 'bg-slate-300'}`}
               >
                  <div className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-all duration-300 ${globalEnabled ? 'left-7' : 'left-1'}`}></div>
               </button>
            </div>

            <div className={`bg-slate-50 border border-slate-100 rounded-2xl p-4 mb-6 transition-opacity ${!globalEnabled ? 'opacity-40 pointer-events-none' : ''}`}>
               <FormControl component="fieldset" className="w-full">
                  <RadioGroup
                    value={interval}
                    onChange={(e) => setIntervalValue(Number(e.target.value))}
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(2, 1fr)',
                      gap: '8px',
                      '@media (min-width: 480px)': { gridTemplateColumns: 'repeat(4, 1fr)' },
                    }}
                  >
                    {[5, 10, 15, 30].map((val) => (
                      <FormControlLabel
                        key={val}
                        value={val}
                        control={<Radio sx={{ 
                           color: '#CBD5E1', 
                           '&.Mui-checked': { color: '#2563EB' },
                           padding: '4px' 
                        }} />}
                        label={
                          <div className="flex flex-col -ml-0.5">
                             <span className={`text-[13px] font-bold leading-none mb-1 ${interval === val ? 'text-blue-700' : 'text-slate-700'}`}>{val}m</span>
                             <span className="text-[8px] font-bold text-slate-400 uppercase whitespace-nowrap">Warning</span>
                          </div>
                        }
                        className={`m-0 px-3 py-4 border-2 rounded-xl transition-all ${
                          interval === val ? 'bg-white border-blue-500 shadow-sm' : 'border-transparent bg-slate-100/50 hover:bg-white hover:border-slate-200'
                        }`}
                        sx={{ width: '100%', ml: 0 }}
                      />
                    ))}
                  </RadioGroup>
               </FormControl>
            </div>

            <div className="flex items-center gap-3 p-3.5 bg-blue-50 border border-blue-100 rounded-xl mb-8">
               <FaExclamationCircle className="text-blue-600 shrink-0" size={14} />
               <p className="text-[9px] font-bold text-blue-800 leading-tight uppercase tracking-tight">
                 {globalEnabled
                   ? 'Alerts will be sent via Telegram or Email based on your channel settings below. At least one must be configured.'
                   : 'Master switch is OFF. No alerts will be sent until you enable it and configure a channel.'}
               </p>
            </div>

            <Button
              onClick={handleSave}
              fullWidth
              disabled={saving}
              className={`py-3.5 rounded-[1.25rem] font-bold tracking-widest transition-all duration-300 shadow-lg ${
                saving ? 'bg-slate-100 text-slate-400' : 'bg-slate-900 text-white hover:bg-black'
              }`}
              sx={{ 
                borderRadius: '1.25rem', 
                backgroundColor: '#1E293B', 
                color: '#FFFFFF',
                fontSize: '11px',
                '&:hover': { backgroundColor: '#000' }
              }}
            >
              {saving ? 'SYNCHRONIZING...' : 'UPDATE PROTOCOLS'}
            </Button>
          </div>
        </Card>

        {/* New Multi-Channel Routing Section */}
        <Card className="rounded-[2.25rem] border border-slate-200 shadow-xl p-4 sm:p-8 bg-white relative overflow-hidden mt-6">
           <div className="relative z-10">
              <div className="flex items-center gap-3.5 mb-8">
                 <div className="w-11 h-11 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600 border border-indigo-100 shadow-sm">
                    <FaBell size={20} />
                 </div>
                 <div>
                    <h3 className="text-lg font-black text-slate-900 leading-none mb-1">Multi-Channel Routing</h3>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">Configure external notification gateways</p>
                 </div>
              </div>

              <div className="space-y-6">
                 {/* Telegram Channel */}
                 <div className="p-4 sm:p-6 bg-slate-50 rounded-[1.5rem] border border-slate-100 transition-all hover:bg-white hover:shadow-md">
                    <div className="flex items-center justify-between mb-4">
                       <div className="flex items-center gap-3 min-w-0">
                          <div className="w-8 h-8 shrink-0 rounded-lg bg-[#0088cc]/10 text-[#0088cc] flex items-center justify-center font-bold text-xs">TG</div>
                          <p className="text-[13px] font-bold text-slate-800 truncate">Telegram Bot Gateway</p>
                       </div>
                       <button 
                          onClick={() => setTelegramEnabled(!telegramEnabled)}
                          className={`w-12 h-6 rounded-full relative transition-all ${telegramEnabled ? 'bg-[#0088cc]' : 'bg-slate-300'}`}
                       >
                          <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-all ${telegramEnabled ? 'left-6.5' : 'left-0.5'}`}></div>
                       </button>
                    </div>
                    {telegramEnabled && (
                       <div className="animate-fade-in">
                          <input 
                             type="text" 
                             placeholder="Enter Telegram Chat ID"
                             value={telegramId}
                             onChange={(e) => setTelegramId(e.target.value)}
                             className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold text-slate-700 outline-none focus:border-[#0088cc]"
                          />
                          <div className="flex items-center justify-between mt-2 px-1">
                             <p className="text-[8px] font-bold text-slate-400 uppercase tracking-wider">Required for mobile alerts</p>
                             <button 
                                onClick={() => {
                                   const helpMsg = "1. Open @ProjectAlerticbot on Telegram\n2. Click START\n3. Search for @getmyid_bot to get your numeric ID\n4. Paste it here!";
                                   alert(helpMsg);
                                }}
                                className="text-[8px] font-black text-[#0088cc] uppercase tracking-tighter hover:underline"
                             >
                                How to find my ID?
                             </button>
                          </div>
                       </div>
                    )}
                 </div>

                 {/* Email Channel */}
                 <div className="p-4 sm:p-6 bg-slate-50 rounded-[1.5rem] border border-slate-100 transition-all hover:bg-white hover:shadow-md">
                    <div className="flex items-center justify-between mb-4">
                       <div className="flex items-center gap-3 min-w-0">
                          <div className="w-8 h-8 shrink-0 rounded-lg bg-red-500/10 text-red-600 flex items-center justify-center font-bold text-xs">@</div>
                          <p className="text-[13px] font-bold text-slate-800 truncate">Email SMTP Relay</p>
                       </div>
                       <button 
                          onClick={() => setEmailEnabled(!emailEnabled)}
                          className={`w-12 h-6 rounded-full relative transition-all ${emailEnabled ? 'bg-red-500' : 'bg-slate-300'}`}
                       >
                          <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-all ${emailEnabled ? 'left-6.5' : 'left-0.5'}`}></div>
                       </button>
                    </div>
                    {emailEnabled && (
                       <div className="animate-fade-in">
                          <input 
                             type="email" 
                             placeholder="Enter Target Email Address"
                             value={contactEmail}
                             onChange={(e) => setContactEmail(e.target.value)}
                             className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold text-slate-700 outline-none focus:border-red-500"
                          />
                       </div>
                    )}
                 </div>
              </div>

              {/* Test Button */}
              <div className="mt-8 pt-6 border-t border-slate-100">
                 <Button
                    onClick={async () => {
                       if (!telegramEnabled && !emailEnabled) {
                          return toast.warn("Please enable at least one gateway to test.");
                       }
                       setSaving(true);
                       try {
                          emailjs.init("Yb3Z9vDtJ9YgtQuRW");
                          // 1. Telegram Test
                          if (telegramEnabled && telegramId) {
                             const botToken = "8679506521:AAF1OeZDhggD6tcYHEA3l-FY-2AM1r2Uyf0";
                             
                             let message = '';
                             if (userRole === 'student') {
                                message = `🎓 *STUDENT ALERT: CLASS REMINDER*\n\n` +
                                          `✅ *Status:* Attendance Sync Active\n` +
                                          `📅 *Date:* ${new Date().toLocaleDateString()}\n\n` +
                                          `📚 *Next Lecture:* MOBILE COMPUTING\n` +
                                          `📍 *Location:* ROOM 302 (SECOND FLOOR)\n` +
                                          `⏳ *Time:* Starting in 5 Minutes\n\n` +
                                          `_Don't be late! This is a test from Alertic._`;
                             } else {
                                message = `🚀 *ALERTIC: GATEWAY TEST*\n\n` +
                                          `✅ *Status:* System Operational\n` +
                                          `📅 *Date:* ${new Date().toLocaleDateString()}\n\n` +
                                          `📖 *Class:* MCA - SECTION B\n` +
                                          `📍 *Location:* ROOM 405 (LAB-1)\n` +
                                          `⏰ *Warning:* 5 Minutes to Deployment\n\n` +
                                          `_This is a verified test from your Alertic Terminal._`;
                             }
                             
                             await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                   chat_id: telegramId,
                                   text: message,
                                   parse_mode: 'Markdown'
                                })
                             });
                          }

                          // 2. Email Test (Using EmailJS)
                          if (emailEnabled && contactEmail) {
                             emailjs.init("Yb3Z9vDtJ9YgtQuRW");
                             const emailParams = {
                                to_email: contactEmail,
                                user_name: userRole === 'student' ? 'Student' : 'Professor',
                                subject_name: userRole === 'student' ? 'MOBILE COMPUTING' : 'MCA - SECTION B',
                                room_number: userRole === 'student' ? '302' : '405',
                                alert_time: '5 Minutes',
                                status: 'GATEWAY TEST'
                             };

                             await fetch('https://api.emailjs.com/api/v1.0/email/send', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                   service_id: 'service_npxig3j',
                                   template_id: 'template_3760ula',
                                   user_id: 'Yb3Z9vDtJ9YgtQuRW',
                                   template_params: emailParams
                                })
                             });
                             toast.info("Email Gateway: Test dispatched to " + contactEmail);
                          }

                          toast.success("Test Protocols Dispatched.");
                       } catch (err) {
                          toast.error("Gateway Verification Failed.");
                       } finally {
                          setSaving(false);
                       }
                    }}
                    fullWidth
                    variant="outlined"
                    disabled={saving}
                    sx={{
                       borderRadius: '1.25rem',
                       borderColor: '#E2E8F0',
                       color: '#64748B',
                       fontSize: '10px',
                       fontWeight: 'bold',
                       py: 1.5,
                       '&:hover': { borderColor: '#6366f1', color: '#6366f1', bgcolor: '#f5f3ff' }
                    }}
                 >
                    {saving ? 'VERIFYING GATES...' : 'TEST GATEWAY PROTOCOL'}
                 </Button>
              </div>
           </div>
        </Card>


        <Box className="mt-8 flex items-center justify-center gap-2 opacity-30">
           <FaCheckCircle className="text-emerald-500" size={9} />
           <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Global Sync: Operational</span>
        </Box>
      </div>
    </div>
  );
};

export default AlertSettings;
