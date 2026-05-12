import React, { useState, useEffect, useRef } from 'react';
import * as XLSX from 'xlsx';
import { toast } from 'react-toastify';
import { feeService, studentService } from '../services/firebaseService';
import ClockLoader from '../components/ClockLoader';
import {
  FaDownload, FaFileImport, FaSpinner, FaMoneyBillWave,
  FaCheckCircle, FaExclamationCircle, FaClock, FaBell, FaFileExcel
} from 'react-icons/fa';

const CATEGORY_FEE = { Centac: 40000, Management: 60000 };

const STATUS_STYLE = {
  Paid:    'bg-emerald-50 text-emerald-700 border-emerald-200',
  Partial: 'bg-amber-50 text-amber-700 border-amber-200',
  Pending: 'bg-red-50 text-red-600 border-red-200',
};

const STATUS_ICON = {
  Paid:    <FaCheckCircle className="text-emerald-500" />,
  Partial: <FaExclamationCircle className="text-amber-500" />,
  Pending: <FaClock className="text-red-500" />,
};

const FeeManager = () => {
  const [students, setStudents]   = useState([]);
  const [feeData, setFeeData]     = useState({});
  const [loading, setLoading]     = useState(true);
  const [importing, setImporting] = useState(false);
  const [sending, setSending]     = useState(false);
  const [filter, setFilter]       = useState('All');
  const importRef = useRef(null);

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [studs, fees] = await Promise.all([
        studentService.getAll(),
        feeService.getAll(),
      ]);
      setStudents(studs);
      const map = {};
      fees.forEach(f => { map[f.student_id] = f; });
      setFeeData(map);
    } catch { toast.error('Failed to load fee data.'); }
    finally { setLoading(false); }
  };

  // ── Template Download ──────────────────────────────────────────────────────
  const handleDownloadTemplate = () => {
    const rows = students.map(s => {
      const sem = parseInt(s.semester) || 1;
      const year1Due = sem >= 1 ? (CATEGORY_FEE[feeData[s.id]?.category] || '') : '';
      const row = {
        enroll_no:  s.enroll_no,
        name:       s.name,
        semester:   s.semester,
        category:   feeData[s.id]?.category || '',
        year1_paid: feeData[s.id]?.year1_paid || 0,
      };
      if (sem >= 3) row.year2_paid = feeData[s.id]?.year2_paid || 0;
      return row;
    });

    const headers = [['enroll_no','name','semester','category','year1_paid','year2_paid']];
    const ws = XLSX.utils.aoa_to_sheet([
      ...headers,
      ...rows.map(r => [r.enroll_no, r.name, r.semester, r.category, r.year1_paid, r.year2_paid ?? ''])
    ]);
    ws['!cols'] = [20,25,10,15,15,20].map(w => ({ wch: w }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Fee Structure');
    XLSX.writeFile(wb, 'alertic_fee_template.xlsx');
    toast.success('Template downloaded!');
  };

  // ── Import Excel ───────────────────────────────────────────────────────────
  const handleImport = async (e) => {
    const file = e.target.files[0];
    if (importRef.current) importRef.current.value = '';
    if (!file) return;
    setImporting(true);
    try {
      const data = await file.arrayBuffer();
      const wb   = XLSX.read(data);
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
      if (!rows.length) return toast.warn('Excel is empty.');

      let success = 0, failed = 0;
      for (const row of rows) {
        try {
          const student = students.find(s => s.enroll_no === String(row.enroll_no));
          if (!student) { failed++; continue; }

          const sem      = parseInt(student.semester) || 1;
          const category = row.category || 'Centac';
          const yearlyFee = CATEGORY_FEE[category] || 40000;

          const year1_paid = parseFloat(row.year1_paid) || 0;
          const year2_paid = sem >= 3 ? (parseFloat(row.year2_paid) || 0) : 0;

          const year1_remaining = Math.max(yearlyFee - year1_paid, 0);
          const year2_remaining = sem >= 3 ? Math.max(yearlyFee - year2_paid, 0) : 0;

          const getStatus = (paid, due) =>
            paid >= due ? 'Paid' : paid > 0 ? 'Partial' : 'Pending';

          const feeRecord = {
            student_id:       student.id,
            enroll_no:        student.enroll_no,
            name:             student.name,
            semester:         student.semester,
            category,
            yearly_fee:       yearlyFee,
            year1_paid,       year1_remaining,
            year1_status:     getStatus(year1_paid, yearlyFee),
            year2_paid,       year2_remaining,
            year2_status:     sem >= 3 ? getStatus(year2_paid, yearlyFee) : 'N/A',
            telegram_id:      student.telegramId || '',
            contact_email:    student.contactEmail || student.email || '',
          };

          await feeService.save(student.id, feeRecord);
          success++;
        } catch { failed++; }
      }

      toast.success(`Imported: ${success} records${failed ? `, ${failed} failed` : ''}`);
      fetchAll();
    } catch { toast.error('Failed to read Excel.'); }
    finally { setImporting(false); }
  };

  // ── Send Reminders ─────────────────────────────────────────────────────────
  const handleSendReminders = async () => {
    setSending(true);
    try {
      const res = await fetch('https://alertic-notifier.onrender.com/fee-reminder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-cron-secret': 'alertic_cron_2024' },
      });
      const json = await res.json();
      toast.success(`Reminders sent to ${json.sent} students!`);
    } catch { toast.error('Failed to send reminders.'); }
    finally { setSending(false); }
  };

  // ── Export Defaulters ──────────────────────────────────────────────────────
  const handleExportDefaulters = () => {
    const defaulters = Object.values(feeData).filter(
      f => f.year1_status !== 'Paid' || (f.year2_status !== 'Paid' && f.year2_status !== 'N/A')
    );
    if (!defaulters.length) return toast.info('No defaulters found!');

    const rows = defaulters.map(f => ({
      Name:           f.name,
      'Enroll No':    f.enroll_no,
      Category:       f.category,
      'Year 1 Due':   f.yearly_fee,
      'Year 1 Paid':  f.year1_paid,
      'Year 1 Rem':   f.year1_remaining,
      'Year 1 Status':f.year1_status,
      'Year 2 Due':   f.year2_status !== 'N/A' ? f.yearly_fee : 'N/A',
      'Year 2 Paid':  f.year2_status !== 'N/A' ? f.year2_paid : 'N/A',
      'Year 2 Rem':   f.year2_status !== 'N/A' ? f.year2_remaining : 'N/A',
      'Year 2 Status':f.year2_status,
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = Object.keys(rows[0]).map(() => ({ wch: 16 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Defaulters');
    XLSX.writeFile(wb, 'alertic_defaulters.xlsx');
    toast.success('Defaulter list exported!');
  };

  // ── Filtered list ──────────────────────────────────────────────────────────
  const filtered = students.filter(s => {
    const f = feeData[s.id];
    if (filter === 'All') return true;
    if (filter === 'Centac' || filter === 'Management') return f?.category === filter;
    if (filter === 'Paid')    return f?.year1_status === 'Paid' && (f?.year2_status === 'Paid' || f?.year2_status === 'N/A');
    if (filter === 'Partial') return f?.year1_status === 'Partial' || f?.year2_status === 'Partial';
    if (filter === 'Pending') return f?.year1_status === 'Pending' || f?.year2_status === 'Pending';
    return true;
  });

  if (loading) return <ClockLoader />;

  return (
    <div className="w-full h-full bg-[#F8FAFC] flex flex-col overflow-hidden font-sans">

      {/* Header */}
      <header className="shrink-0 bg-white border-b border-slate-200 px-4 lg:px-8 py-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center text-white shadow-lg shrink-0">
            <FaMoneyBillWave size={18} />
          </div>
          <div>
            <h3 className="text-lg font-black text-slate-900 tracking-tighter uppercase leading-none mb-1">Fee Manager</h3>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">MCA Fee Structure & Alerts</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button onClick={handleDownloadTemplate} className="px-3 py-2 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg font-bold text-[10px] uppercase tracking-widest hover:bg-emerald-100 transition-all flex items-center gap-1.5">
            <FaDownload size={10} /> <span className="hidden sm:inline">Template</span>
          </button>
          <label className={`px-3 py-2 rounded-lg font-bold text-[10px] uppercase tracking-widest transition-all flex items-center gap-1.5 cursor-pointer ${importing ? 'bg-slate-100 text-slate-400 pointer-events-none' : 'bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100'}`}>
            {importing ? <FaSpinner className="animate-spin" size={10} /> : <FaFileImport size={10} />}
            <span className="hidden sm:inline">{importing ? 'Importing...' : 'Import'}</span>
            <input ref={importRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleImport} disabled={importing} />
          </label>
          <button onClick={handleSendReminders} disabled={sending} className="px-3 py-2 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg font-bold text-[10px] uppercase tracking-widest hover:bg-blue-100 transition-all flex items-center gap-1.5 disabled:opacity-50">
            {sending ? <FaSpinner className="animate-spin" size={10} /> : <FaBell size={10} />}
            <span className="hidden sm:inline">{sending ? 'Sending...' : 'Send Reminders'}</span>
          </button>
          <button onClick={handleExportDefaulters} className="px-3 py-2 bg-red-50 text-red-600 border border-red-200 rounded-lg font-bold text-[10px] uppercase tracking-widest hover:bg-red-100 transition-all flex items-center gap-1.5">
            <FaFileExcel size={10} /> <span className="hidden sm:inline">Defaulters</span>
          </button>
        </div>
      </header>

      {/* Filter Bar */}
      <div className="shrink-0 px-4 lg:px-8 py-3 bg-white border-b border-slate-100 flex gap-2 overflow-x-auto">
        {['All','Paid','Partial','Pending','Centac','Management'].map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all ${filter === f ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
            {f}
          </button>
        ))}
      </div>

      {/* Student Cards */}
      <div className="flex-1 overflow-y-auto p-4 lg:p-8 custom-scrollbar">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-300">
            <FaMoneyBillWave size={48} className="opacity-20 mb-4" />
            <p className="text-[11px] font-black uppercase tracking-widest opacity-40">No records found</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(s => {
              const f = feeData[s.id];
              const sem = parseInt(s.semester) || 1;
              return (
                <div key={s.id} className="bg-white rounded-2xl border border-slate-200 p-5 hover:shadow-lg transition-all">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h4 className="text-sm font-black text-slate-900 uppercase truncate max-w-[160px]">{s.name}</h4>
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{s.enroll_no} · SEM {s.semester}</p>
                    </div>
                    {f?.category && (
                      <span className={`text-[8px] font-black px-2 py-1 rounded-lg border uppercase tracking-wider ${f.category === 'Centac' ? 'bg-blue-50 text-blue-600 border-blue-100' : 'bg-purple-50 text-purple-600 border-purple-100'}`}>
                        {f.category}
                      </span>
                    )}
                  </div>

                  {f ? (
                    <div className="space-y-3">
                      {/* Year 1 */}
                      <div className={`p-3 rounded-xl border ${STATUS_STYLE[f.year1_status]}`}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[9px] font-black uppercase tracking-widest">Year 1</span>
                          <div className="flex items-center gap-1">
                            {STATUS_ICON[f.year1_status]}
                            <span className="text-[9px] font-black uppercase">{f.year1_status}</span>
                          </div>
                        </div>
                        <div className="flex justify-between text-[10px] font-bold">
                          <span>Paid: ₹{f.year1_paid?.toLocaleString()}</span>
                          <span>Rem: ₹{f.year1_remaining?.toLocaleString()}</span>
                        </div>
                        <div className="mt-2 h-1.5 bg-white/60 rounded-full overflow-hidden">
                          <div className="h-full bg-current opacity-40 rounded-full" style={{ width: `${Math.min((f.year1_paid / f.yearly_fee) * 100, 100)}%` }} />
                        </div>
                      </div>

                      {/* Year 2 — only SEM 3+ */}
                      {sem >= 3 && f.year2_status !== 'N/A' && (
                        <div className={`p-3 rounded-xl border ${STATUS_STYLE[f.year2_status]}`}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[9px] font-black uppercase tracking-widest">Year 2</span>
                            <div className="flex items-center gap-1">
                              {STATUS_ICON[f.year2_status]}
                              <span className="text-[9px] font-black uppercase">{f.year2_status}</span>
                            </div>
                          </div>
                          <div className="flex justify-between text-[10px] font-bold">
                            <span>Paid: ₹{f.year2_paid?.toLocaleString()}</span>
                            <span>Rem: ₹{f.year2_remaining?.toLocaleString()}</span>
                          </div>
                          <div className="mt-2 h-1.5 bg-white/60 rounded-full overflow-hidden">
                            <div className="h-full bg-current opacity-40 rounded-full" style={{ width: `${Math.min((f.year2_paid / f.yearly_fee) * 100, 100)}%` }} />
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-center">
                      <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest">No fee data</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default FeeManager;
