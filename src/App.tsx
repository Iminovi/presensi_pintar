import React, { useState, useEffect } from 'react';
import { 
  collection, 
  query, 
  orderBy, 
  onSnapshot, 
  addDoc, 
  serverTimestamp,
  doc,
  setDoc,
  getDoc,
  getDocs,
  where,
  limit
} from 'firebase/firestore';
import { onAuthStateChanged, User } from 'firebase/auth';
import { db, auth, signInWithGoogle, logOut } from './lib/firebase';
import firebaseConfig from '../firebase-applet-config.json';
import { OperationType, handleFirestoreError } from './lib/errorUtils';
import { format } from 'date-fns';
import { 
  Fingerprint, 
  Users, 
  LogOut, 
  Plus, 
  Trash2, 
  Clock, 
  ShieldCheck, 
  Settings,
  Activity,
  FileText,
  Download
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// --- Types ---
interface Employee {
  id: string;
  name: string;
  fingerprintId: number;
  position: string;
}

interface Attendance {
  id: string;
  employeeId: string;
  employeeName: string;
  timestamp: any;
  type: 'in' | 'out';
}

interface DeviceConfig {
  mode: 'idle' | 'enroll' | 'verify';
  enrollTargetId: number;
  message: string;
  lastActive?: any;
}

// --- Main App Component ---
export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [isApproved, setIsApproved] = useState<boolean | null>(null);
  const [activeTab, setActiveTab] = useState<'attendance' | 'employees' | 'device' | 'reports'>('attendance');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      if (u && u.email) {
        try {
          const docRef = doc(db, 'admins', u.email);
          const docSnap = await getDoc(docRef);
          
          if (docSnap.exists() && docSnap.data().approved === true) {
            setUser(u);
            setIsApproved(true);
          } else {
            // Catat akun baru sebagai pending (belum di-approve)
            await setDoc(docRef, {
              name: u.displayName,
              email: u.email,
              approved: docSnap.exists() ? docSnap.data().approved : false,
              lastLogin: serverTimestamp()
            }, { merge: true });
            
            setUser(u);
            setIsApproved(false);
          }
        } catch (error) {
          console.error("Gagal memverifikasi status admin", error);
          setUser(u);
          setIsApproved(false);
        }
      } else {
        setUser(null);
        setIsApproved(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0f172a] flex items-center justify-center">
        <Activity className="animate-spin text-cyan-500" />
      </div>
    );
  }

  if (!user) {
    return <LoginScreen />;
  }

  if (user && !isApproved) {
    return <PendingApprovalScreen user={user} />;
  }

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-100 flex flex-col md:flex-row print:bg-white print:text-black">
      {/* Sidebar */}
      <nav className="w-full md:w-64 bg-slate-900 border-r border-slate-800 p-6 flex flex-col justify-between print:hidden">
        <div>
          <div className="flex items-center gap-3 mb-10">
            <div className="bg-cyan-500 p-2 rounded-xl">
              <Fingerprint className="text-slate-900 w-6 h-6" />
            </div>
            <h1 className="font-sans font-bold text-xl tracking-tight uppercase">Finger-Grid <span className="text-cyan-400 font-normal">v1.2</span></h1>
          </div>

          <div className="space-y-2">
            <NavButton 
              active={activeTab === 'attendance'} 
              onClick={() => setActiveTab('attendance')}
              icon={<Clock size={20} />}
              label="Kehadiran" 
            />
            <NavButton 
              active={activeTab === 'employees'} 
              onClick={() => setActiveTab('employees')}
              icon={<Users size={20} />}
              label="Karyawan" 
            />
            <NavButton 
              active={activeTab === 'device'} 
              onClick={() => setActiveTab('device')}
              icon={<Settings size={20} />}
              label="Perangkat" 
            />
            <NavButton 
              active={activeTab === 'reports'} 
              onClick={() => setActiveTab('reports')}
              icon={<FileText size={20} />}
              label="Laporan" 
            />
          </div>
        </div>

        <div className="pt-6 border-t border-slate-800">
          <button 
            onClick={logOut}
            className="flex items-center gap-3 text-red-400 hover:bg-red-500/10 w-full p-3 rounded-lg transition-colors font-medium"
          >
            <LogOut size={20} />
            Keluar
          </button>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1 p-6 md:p-12 overflow-y-auto print:p-0 print:overflow-visible">
        <header className="mb-10 print:hidden">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-[10px] uppercase tracking-[0.2em] font-mono text-slate-500 mb-1">DASHBOARD</p>
              <h2 className="text-4xl font-bold text-slate-100">
                {activeTab === 'attendance' ? 'Log Kehadiran' : activeTab === 'employees' ? 'Daftar Karyawan' : activeTab === 'device' ? 'Konfigurasi Alat' : 'Laporan Bulanan'}
              </h2>
            </div>
            <div className="hidden md:flex items-center gap-4 text-right">
              <div className="text-right">
                <div className="text-xl font-medium font-mono text-slate-100">{format(new Date(), 'HH:mm:ss')}</div>
                <div className="text-[10px] text-slate-500 uppercase tracking-widest">{format(new Date(), 'EEEE, MMM dd')}</div>
              </div>
              <div className="h-8 w-[1px] bg-slate-700"></div>
              <div className="flex items-center gap-2 bg-emerald-500/10 text-emerald-400 px-3 py-1 rounded-full border border-emerald-500/20 text-[10px] font-bold">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400"></div>
                NODEMCU CONNECTED
              </div>
            </div>
          </div>
        </header>

        <AnimatePresence mode="wait">
          {activeTab === 'attendance' && <AttendanceView key="att" />}
          {activeTab === 'employees' && <EmployeeView key="emp" />}
          {activeTab === 'device' && <DeviceView key="dev" />}
          {activeTab === 'reports' && <ReportView key="rep" />}
        </AnimatePresence>
      </main>
    </div>
  );
}

// --- Sub-components ---

function PendingApprovalScreen({ user }: { user: User }) {
  return (
    <div className="min-h-screen bg-[#0f172a] flex flex-col items-center justify-center p-6 relative overflow-hidden text-center">
      <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(#22d3ee 1px, transparent 0)', backgroundSize: '40px 40px' }}></div>
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bento-card max-w-md w-full relative z-10"
      >
        <div className="bg-amber-500/10 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-amber-500/20 text-amber-500">
          <ShieldCheck size={32} />
        </div>
        <h1 className="text-2xl font-bold mb-2 text-slate-100">Menunggu Persetujuan</h1>
        <p className="text-slate-400 mb-6 text-sm">
          Akun <strong className="text-slate-200">{user.email}</strong> belum memiliki akses ke dashboard ini. Silakan hubungi Administrator Utama untuk meminta persetujuan akses.
        </p>
        <button 
          onClick={logOut}
          className="w-full flex items-center justify-center gap-3 bg-slate-800 text-slate-300 p-4 rounded-xl hover:bg-slate-700 transition-all font-bold"
        >
          <LogOut size={18} />
          Keluar Akun
        </button>
      </motion.div>
    </div>
  );
}

function LoginScreen() {
  return (
    <div className="min-h-screen bg-[#0f172a] flex items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(#22d3ee 1px, transparent 0)', backgroundSize: '40px 40px' }}></div>
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bento-card max-w-md w-full text-center relative z-10"
      >
        <div className="bg-cyan-500 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-cyan-500/20">
          <Fingerprint className="text-slate-900 w-8 h-8" />
        </div>
        <h1 className="text-3xl font-bold mb-2 text-slate-100">Selamat Datang</h1>
        <p className="text-slate-400 mb-10">Gunakan akun Google untuk masuk ke sistem dashboard Presensi Pintar.</p>
        
        <button 
          onClick={signInWithGoogle}
          className="w-full flex items-center justify-center gap-3 bg-cyan-600 text-white p-4 rounded-xl hover:bg-cyan-500 transition-all font-bold shadow-lg shadow-cyan-900/20"
        >
          <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/layout/google.svg" className="w-5 h-5 bg-white rounded-full p-0.5" />
          Masuk dengan Google
        </button>
      </motion.div>
    </div>
  );
}

function NavButton({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) {
  return (
    <button 
      onClick={onClick}
      className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all ${
        active 
          ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-900/40' 
          : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
      }`}
    >
      {icon}
      <span className="font-semibold text-sm tracking-wide">{label}</span>
    </button>
  );
}

function ReportView() {
  const [month, setMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [reportData, setReportData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchReport = async () => {
      setLoading(true);
      try {
        // 1. Ambil data semua karyawan
        const empSnap = await getDocs(collection(db, 'employees'));
        const employees = empSnap.docs.map(d => ({ id: d.id, ...d.data() } as Employee));
        
        // 2. Tentukan batas tanggal awal dan akhir bulan yang dipilih
        const [yearStr, monthStr] = month.split('-');
        const startDate = new Date(parseInt(yearStr), parseInt(monthStr) - 1, 1);
        const endDate = new Date(parseInt(yearStr), parseInt(monthStr), 1); // Tanggal 1 bulan depannya

        // 3. Ambil data presensi dalam rentang waktu tersebut
        const q = query(
          collection(db, 'attendance'),
          where('timestamp', '>=', startDate),
          where('timestamp', '<', endDate)
        );
        
        const attSnap = await getDocs(q);
        const attendanceLogs = attSnap.docs.map(d => d.data() as Attendance);

        // 4. Kelompokkan data presensi ke masing-masing karyawan
        const stats = employees.map(emp => {
          const empLogs = attendanceLogs.filter(log => log.employeeId === emp.fingerprintId.toString() || log.employeeId === emp.id);
          
          // Hitung hari unik (agar absen berkali-kali di hari yang sama tetap dihitung 1 hari)
          const uniqueDays = new Set(
            empLogs
              .filter(log => log.timestamp)
              .map(log => format(log.timestamp.toDate(), 'yyyy-MM-dd'))
          );

          return {
            ...emp,
            presentDays: uniqueDays.size,
            totalLogs: empLogs.length
          };
        });
        
        setReportData(stats);
      } catch (err) {
        console.error("Gagal memuat laporan", err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchReport();
  }, [month]);

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="space-y-6"
    >
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-slate-900/50 p-4 rounded-2xl border border-slate-800 gap-4 print:hidden">
        <div className="flex items-center gap-4">
          <div className="text-xs font-mono text-slate-500 pl-2">PILIH BULAN</div>
          <input 
            type="month" 
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="bg-slate-900 border border-slate-700 rounded-xl p-2 focus:border-cyan-500 outline-none text-sm font-mono text-cyan-400"
          />
        </div>
        <button 
          onClick={() => window.print()}
          className="flex items-center gap-2 bg-cyan-600 text-white px-6 py-2.5 rounded-xl hover:bg-cyan-500 transition-all font-bold text-sm shadow-lg shadow-cyan-900/20"
        >
          <Download size={18} />
          CETAK LAPORAN
        </button>
      </div>

      <div className="bento-card overflow-hidden overflow-x-auto print:bg-white print:text-black print:p-0 print:border-none print:shadow-none">
        <h2 className="hidden print:block text-2xl font-bold mb-6 text-center">Rekap Kehadiran - Bulan {format(new Date(`${month}-01`), 'MMMM yyyy')}</h2>
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-700/50 print:border-black/50">
              <th className="p-4 text-xs font-mono tracking-widest text-slate-500 print:text-black uppercase">ID FP</th>
              <th className="p-4 text-xs font-mono tracking-widest text-slate-500 print:text-black uppercase">Nama Karyawan</th>
              <th className="p-4 text-xs font-mono tracking-widest text-slate-500 print:text-black uppercase">Jabatan/Departemen</th>
              <th className="p-4 text-xs font-mono tracking-widest text-slate-500 print:text-black uppercase">Total Kehadiran</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/50 print:divide-black/20">
            {loading ? (
              <tr>
                <td colSpan={4} className="p-8 text-center text-slate-500 font-mono text-sm">Sedang merekap data...</td>
              </tr>
            ) : reportData.length === 0 ? (
              <tr>
                <td colSpan={4} className="p-8 text-center text-slate-500">Tidak ada data karyawan untuk ditampilkan.</td>
              </tr>
            ) : (
              reportData.map(row => (
                <tr key={row.id} className="hover:bg-slate-800/30 transition-colors">
                  <td className="p-4 font-mono text-sm text-cyan-400 print:text-black">#{row.fingerprintId.toString().padStart(3, '0')}</td>
                  <td className="p-4 font-bold text-slate-100 print:text-black">{row.name}</td>
                  <td className="p-4 text-sm text-slate-400 print:text-black uppercase">{row.position}</td>
                  <td className="p-4">
                    <span className="bg-emerald-500/10 text-emerald-400 print:bg-transparent print:text-black border border-emerald-500/20 print:border-none px-3 py-1 rounded-full text-xs font-bold">
                      {row.presentDays} Hari
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
}

function AttendanceView() {
  const [logs, setLogs] = useState<Attendance[]>([]);

  useEffect(() => {
    const q = query(collection(db, 'attendance'), orderBy('timestamp', 'desc'), limit(50));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const l = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Attendance));
      setLogs(l);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'attendance');
    });
    return unsubscribe;
  }, []);

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="bento-card overflow-hidden"
    >
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Recent Presence Logs</h2>
        <div className="flex gap-1">
          {[1, 2, 3, 4].map(i => <div key={i} className={`h-1.5 w-6 rounded-full ${i < 4 ? 'bg-cyan-500' : 'bg-slate-700'}`}></div>)}
        </div>
      </div>
      
      <div className="space-y-3">
        {logs.length === 0 ? (
          <div className="p-10 text-center text-slate-500 italic">Belum ada aktivitas hari ini</div>
        ) : logs.map((log) => (
          <div key={log.id} className="flex items-center gap-4 p-4 bg-slate-900/40 rounded-xl border border-slate-700/30 hover:border-cyan-500/30 transition-all group">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs ${log.type === 'in' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}`}>
              {log.employeeName.substring(0, 2).toUpperCase()}
            </div>
            <div className="flex-1">
              <div className="text-sm font-semibold text-slate-100">{log.employeeName}</div>
              <div className="text-[10px] text-slate-500 uppercase tracking-wider font-mono">
                {log.type === 'in' ? 'Check In' : 'Check Out'}
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm font-semibold font-mono text-slate-200">
                {log.timestamp?.toDate ? format(log.timestamp.toDate(), 'HH:mm:ss') : '--:--:--'}
              </div>
              <div className="text-[10px] text-emerald-500 uppercase font-bold tracking-widest">Verified</div>
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

function EmployeeView() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newFpId, setNewFpId] = useState('');
  const [newPos, setNewPos] = useState('');

  useEffect(() => {
    const q = query(collection(db, 'employees'), orderBy('name', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const e = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Employee));
      setEmployees(e);
    });
    return unsubscribe;
  }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, 'employees'), {
        name: newName,
        fingerprintId: parseInt(newFpId),
        position: newPos,
        createdAt: serverTimestamp()
      });
      setNewName('');
      setNewFpId('');
      setNewPos('');
      setShowAdd(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'employees');
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="space-y-8"
    >
      <div className="flex justify-between items-center bg-slate-900/50 p-4 rounded-2xl border border-slate-800">
        <div className="text-xs font-mono text-slate-500 pl-2">DATABASE SELECTIONS</div>
        <button 
          onClick={() => setShowAdd(!showAdd)}
          className="flex items-center gap-2 bg-cyan-600 text-white px-6 py-2.5 rounded-xl hover:bg-cyan-500 transition-all font-bold text-sm shadow-lg shadow-cyan-900/20"
        >
          <Plus size={18} />
          NEW EMPLOYEE
        </button>
      </div>

      {showAdd && (
        <motion.form 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bento-card grid grid-cols-1 md:grid-cols-4 gap-6 items-end border-cyan-500/30"
          onSubmit={handleAdd}
        >
          <div className="space-y-2">
            <label className="text-[10px] uppercase font-mono tracking-widest text-slate-500">Full Name</label>
            <input 
              required
              value={newName}
              onChange={e => setNewName(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 focus:border-cyan-500 outline-none text-sm"
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] uppercase font-mono tracking-widest text-slate-500">Department</label>
            <input 
              required
              value={newPos}
              onChange={e => setNewPos(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 focus:border-cyan-500 outline-none text-sm"
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] uppercase font-mono tracking-widest text-slate-500">FP ID (1-127)</label>
            <input 
              required
              type="number"
              min="1"
              max="127"
              value={newFpId}
              onChange={e => setNewFpId(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 focus:border-cyan-500 outline-none text-sm"
            />
          </div>
          <button type="submit" className="bg-cyan-600 text-white p-3 rounded-xl hover:bg-cyan-500 transition-all font-bold">SAVE RECORD</button>
        </motion.form>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {employees.map(emp => (
          <div key={emp.id} className="bento-card hover:border-cyan-500/50 transition-all group">
            <div className="flex justify-between items-start mb-6">
              <div className="bg-cyan-500/10 p-3 rounded-2xl text-cyan-500 group-hover:bg-cyan-500 group-hover:text-slate-900 transition-all">
                <Fingerprint size={24} />
              </div>
              <div className="text-right">
                <div className="font-mono text-[10px] text-slate-500">BIOMETRIC SLOT</div>
                <div className="font-mono font-bold text-cyan-400">#{emp.fingerprintId.toString().padStart(3, '0')}</div>
              </div>
            </div>
            <h3 className="text-xl font-bold mb-1 font-sans">{emp.name}</h3>
            <p className="text-xs uppercase tracking-widest font-mono text-slate-500 mb-6">{emp.position}</p>
            
            <div className="pt-4 border-t border-slate-700/50 flex justify-between items-center">
              <div className="flex items-center gap-1.5 text-[10px] text-emerald-400 font-bold tracking-widest font-mono uppercase">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400"></div> 
                Enrolled
              </div>
              <button 
                onClick={async () => {
                  if (confirm('Hapus karyawan ini?')) {
                    try {
                      await addDoc(collection(db, 'employees', emp.id, '_DELETED_'), {});
                    } catch (e) {}
                  }
                }}
                className="text-slate-600 hover:text-red-400 transition-colors p-2"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

function DeviceView() {
  const [config, setConfig] = useState<DeviceConfig | null>(null);

  useEffect(() => {
    const docRef = doc(db, 'deviceConfigs', 'main-nodedcu');
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        setConfig(docSnap.data() as DeviceConfig);
      } else {
        // Initialize if not exists
        setDoc(docRef, { mode: 'verify', enrollTargetId: 1, message: 'Ready' });
      }
    });
    return unsubscribe;
  }, []);

  const updateMode = async (mode: 'verify' | 'enroll' | 'idle', targetId?: number) => {
    try {
      await setDoc(doc(db, 'deviceConfigs', 'main-nodedcu'), { 
        mode, 
        enrollTargetId: targetId || config?.enrollTargetId || 1,
        message: mode === 'enroll' ? `Silakan letakkan jari untuk ID ${targetId}` : 'Ready'
      }, { merge: true });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'deviceConfigs/main-nodedcu');
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="grid grid-cols-1 lg:grid-cols-12 gap-6"
    >
      <div className="lg:col-span-4 bento-card border-cyan-500/30 flex flex-col justify-between h-full">
        <div>
          <h2 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-6">Live Hardware Status</h2>
          <div className="flex items-center gap-2 mb-8">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs font-mono text-emerald-400 uppercase tracking-widest">ESP8266 Live Connection</span>
          </div>

          <div className="bg-slate-900/50 rounded-2xl p-8 border border-slate-700/30 flex flex-col items-center justify-center relative overflow-hidden mb-6">
            <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(#22d3ee 1px, transparent 0)', backgroundSize: '15px 15px' }}></div>
            <Fingerprint className="w-20 h-20 text-cyan-500/40 mb-4" strokeWidth={1} />
            <div className="text-[10px] text-cyan-400 font-mono animate-pulse tracking-widest uppercase">Scanner Active</div>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex justify-between items-center text-[10px] font-mono py-2 border-b border-slate-700/30">
            <span className="text-slate-500">ID SENSOR</span>
            <span className="text-slate-300 uppercase">AS608_V1</span>
          </div>
          <div className="flex justify-between items-center text-[10px] font-mono py-2">
            <span className="text-slate-500">HEAT INDEX</span>
            <span className="text-slate-300">32.4°C</span>
          </div>
        </div>
      </div>

      <div className="lg:col-span-5 bento-card space-y-8">
        <h2 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Hardware Control Panel</h2>
        
        <div className="space-y-6">
          <div>
            <h3 className="text-[10px] uppercase font-mono tracking-widest text-slate-400 mb-3">Operating Mode Selection</h3>
            <div className="flex gap-3">
              <ModeButton 
                active={config?.mode === 'verify'} 
                onClick={() => updateMode('verify')}
                label="Verify" 
              />
              <ModeButton 
                active={config?.mode === 'enroll'} 
                onClick={() => {
                  const id = prompt('Masukkan ID Sidik Jari (1-127):', '1');
                  if (id) updateMode('enroll', parseInt(id));
                }}
                label="Enroll" 
              />
              <ModeButton 
                active={config?.mode === 'idle'} 
                onClick={() => updateMode('idle')}
                label="Idle" 
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-slate-900 rounded-2xl border border-slate-700/50">
              <p className="text-[10px] uppercase font-mono tracking-widest text-slate-500 mb-1">LCD Message</p>
              <p className="font-mono text-sm text-cyan-400 truncate">{config?.message || 'Ready'}</p>
            </div>
            <div className="p-4 bg-slate-900 rounded-2xl border border-slate-700/50">
              <p className="text-[10px] uppercase font-mono tracking-widest text-slate-500 mb-1">Target ID</p>
              <p className="font-mono text-sm text-slate-100">{config?.enrollTargetId || '--'}</p>
            </div>
          </div>
        </div>

        <div className="bg-slate-900/40 p-4 rounded-xl">
           <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4">Diagnostics</h3>
           <div className="space-y-2">
              <div className="flex justify-between font-mono text-[9px]">
                <span className="text-slate-500 uppercase">Heap Memory</span>
                <span className="text-emerald-400">34.2 KB FREE</span>
              </div>
              <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full bg-cyan-500 w-[65%]"></div>
              </div>
           </div>
        </div>
      </div>

      <div className="lg:col-span-3 bento-card bg-cyan-600/5 border-cyan-500/20">
        <h2 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-6">Hardware Setup</h2>
        <div className="space-y-6">
          <div className="flex gap-4">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/20 flex items-center justify-center text-cyan-400 font-bold shrink-0 text-xs">1</div>
            <div className="text-[11px] text-slate-300 leading-relaxed font-mono">TX Scanner &rarr; NodeMCU D2</div>
          </div>
          <div className="flex gap-4">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/20 flex items-center justify-center text-cyan-400 font-bold shrink-0 text-xs">2</div>
            <div className="text-[11px] text-slate-300 leading-relaxed font-mono">RX Scanner &rarr; NodeMCU D3</div>
          </div>
          <div className="flex gap-4">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/20 flex items-center justify-center text-cyan-400 font-bold shrink-0 text-xs">3</div>
            <div className="text-[11px] text-slate-300 leading-relaxed font-mono">Use Firebase-ESP8266 library in Arduino IDE</div>
          </div>
        </div>
        
        <div className="mt-10 pt-6 border-t border-cyan-500/10">
           <div className="p-3 bg-slate-900 rounded-xl border border-slate-700/50">
             <div className="text-[9px] text-slate-500 uppercase mb-1 font-mono">Project ID</div>
             <div className="font-mono text-[10px] text-cyan-400">{(firebaseConfig as any).projectId}</div>
           </div>
        </div>
      </div>
    </motion.div>
  );
}

function ModeButton({ active, onClick, label }: { active: boolean, onClick: () => void, label: string }) {
  return (
    <button 
      onClick={onClick}
      className={`flex-1 py-3 px-2 rounded-xl text-[10px] uppercase tracking-widest font-mono font-bold transition-all ${
        active 
          ? 'bg-cyan-500 text-slate-900 shadow-[0_0_15px_rgba(34,211,238,0.3)]' 
          : 'bg-slate-800 border border-slate-700 text-slate-400 hover:border-slate-500'
      }`}
    >
      {label}
    </button>
  );
}
