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
    const headers = ['enroll_no', 'name', 'semester', 'category', 'sem1_paid', 'sem2_paid', 'sem3_paid', 'sem4_paid'];
    const dataRows = students.map(s => {
      const sem = parseInt(s.semester) || 1;
      const f   = feeData[s.id] || {};
      return [
        s.enroll_no, s.name, s.semester,
        f.category || '',
        sem >= 1 ? (f.sem1_paid ?? 0) : '',
        sem >= 2 ? (f.sem2_paid ?? 0) : '',
        sem >= 3 ? (f.sem3_paid ?? 0) : '',
        sem >= 4 ? (f.sem4_paid ?? 0) : '',
      ];
    });
    const ws = XLSX.utils.aoa_to_sheet([headers, ...dataRows]);
    ws['!cols'] = headers.map(() => ({ wch: 18 }));
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

          const sem1_paid = parseFloat(row.sem1_paid) || 0;
          const sem2_paid = sem >= 2 ? (parseFloat(row.sem2_paid) || 0) : 0;
          const sem3_paid = sem >= 3 ? (parseFloat(row.sem3_paid) || 0) : 0;
          const sem4_paid = sem >= 4 ? (parseFloat(row.sem4_paid) || 0) : 0;

          const year1_paid      = sem1_paid + sem2_paid;
          const year2_paid      = sem3_paid + sem4_paid;
          const year1_remaining = Math.max(yearlyFee - year1_paid, 0);
          const year2_remaining = sem >= 3 ? Math.max(yearlyFee - year2_paid, 0) : 0;

          const getStatus = (paid, due) =>
            paid >= due ? 'Paid' : paid > 0 ? 'Partial' : 'Pending';

          const feeRecord = {
            student_id:    student.id,
            enroll_no:     student.enroll_no,
            name:          student.name,
            semester:      student.semester,
            category,
            yearly_fee:    yearlyFee,
            sem1_paid, sem2_paid, sem3_paid, sem4_paid,
            year1_paid,    year1_remaining,
            year1_status:  getStatus(year1_paid, yearlyFee),
            year2_paid,    year2_remaining,
            year2_status:  sem >= 3 ? getStatus(year2_paid, yearlyFee) : 'N/A',
            telegram_id:   student.telegramId || '',
            contact_email: student.contactEmail || student.email || '',
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

      {/* Table */}
      <div className="flex-1 overflow-y-auto p-4 lg:p-6 custom-scrollbar">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse min-w-[800px]">
              <thead className="bg-slate-50 border-b border-slate-100 sticky top-0">
                <tr>
                  <th className="px-4 py-3 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">#</th>
                  <th className="px-4 py-3 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Name</th>
                  <th className="px-4 py-3 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Enroll No</th>
                  <th className="px-4 py-3 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Sem</th>
                  <th className="px-4 py-3 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Category</th>
                  <th className="px-4 py-3 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Year 1 Paid</th>
                  <th className="px-4 py-3 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Y1 Rem</th>
                  <th className="px-4 py-3 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Y1 Status</th>
                  <th className="px-4 py-3 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Year 2 Paid</th>
                  <th className="px-4 py-3 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Y2 Rem</th>
                  <th className="px-4 py-3 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Y2 Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.length > 0 ? filtered.map((s, idx) => {
                  const f   = feeData[s.id];
                  const sem = parseInt(s.semester) || 1;
                  return (
                    <tr key={s.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-4 py-3 text-[11px] font-black text-slate-300">{(idx+1).toString().padStart(2,'0')}</td>
                      <td className="px-4 py-3 text-[12px] font-black text-slate-900 uppercase">{s.name}</td>
                      <td className="px-4 py-3">
                        <span className="text-[11px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-lg border border-blue-100">{s.enroll_no}</span>
                      </td>
                      <td className="px-4 py-3 text-[11px] font-bold text-slate-700">{s.semester}</td>
                      <td className="px-4 py-3">
                        {f?.category ? (
                          <span className={`text-[9px] font-black px-2 py-1 rounded-lg border uppercase ${
                            f.category === 'Centac' ? 'bg-blue-50 text-blue-600 border-blue-100' : 'bg-purple-50 text-purple-600 border-purple-100'
                          }`}>{f.category}</span>
                        ) : <span className="text-slate-300 text-[10px]">—</span>}
                      </td>
                      <td className="px-4 py-3 text-[11px] font-bold text-slate-700">{f ? `₹${(f.year1_paid||0).toLocaleString()}` : '—'}</td>
                      <td className="px-4 py-3 text-[11px] font-bold text-slate-700">{f ? `₹${(f.year1_remaining||0).toLocaleString()}` : '—'}</td>
                      <td className="px-4 py-3">
                        {f?.year1_status ? (
                          <span className={`text-[9px] font-black px-2 py-1 rounded-full uppercase ${
                            f.year1_status === 'Paid' ? 'bg-emerald-50 text-emerald-600' :
                            f.year1_status === 'Partial' ? 'bg-amber-50 text-amber-600' : 'bg-red-50 text-red-500'
                          }`}>{f.year1_status}</span>
                        ) : <span className="text-slate-300 text-[10px]">—</span>}
                      </td>
                      <td className="px-4 py-3 text-[11px] font-bold text-slate-700">
                        {f && sem >= 3 ? `₹${(f.year2_paid||0).toLocaleString()}` : '—'}
                      </td>
                      <td className="px-4 py-3 text-[11px] font-bold text-slate-700">
                        {f && sem >= 3 ? `₹${(f.year2_remaining||0).toLocaleString()}` : '—'}
                      </td>
                      <td className="px-4 py-3">
                        {f && sem >= 3 && f.year2_status !== 'N/A' ? (
                          <span className={`text-[9px] font-black px-2 py-1 rounded-full uppercase ${
                            f.year2_status === 'Paid' ? 'bg-emerald-50 text-emerald-600' :
                            f.year2_status === 'Partial' ? 'bg-amber-50 text-amber-600' : 'bg-red-50 text-red-500'
                          }`}>{f.year2_status}</span>
                        ) : <span className="text-slate-300 text-[10px]">—</span>}
                      </td>
                    </tr>
                  );
                }) : (
                  <tr>
                    <td colSpan={11} className="py-16 text-center">
                      <p className="text-[11px] font-black text-slate-300 uppercase tracking-widest">No records found</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FeeManager;
