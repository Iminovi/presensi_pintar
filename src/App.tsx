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
  getDocs,
  where,
  limit,
  deleteDoc
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
  Circle,
  Activity,
  Download,
  Smartphone,
  MapPin,
  Lock,
  Compass,
  Loader2,
  User
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// Import Types and Components
import { Employee, Attendance, DeviceConfig, UserProfile, OfficeConfig } from './types';
import MobileAttendanceView from './components/MobileAttendanceView';

// --- Main App Component ---
export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [activeTab, setActiveTab] = useState<'attendance' | 'employees' | 'device' | 'users' | 'absen-mobile' | 'my-profile'>('attendance');
  const [loading, setLoading] = useState(true);
  const [deviceConfig, setDeviceConfig] = useState<DeviceConfig | null>(null);
  const [isDeviceConnected, setIsDeviceConnected] = useState<boolean>(false);

  // Office GPS Geofence boundary configuration
  const [officeConfig, setOfficeConfig] = useState<OfficeConfig>({
    latitude: -6.175392,
    longitude: 106.827153,
    radius: 5,
    locationName: "Kantor Pusat"
  });

  // Track office config from cloud
  useEffect(() => {
    if (!user) return;
    const unsubOffice = onSnapshot(doc(db, 'office', 'config'), (snap) => {
      if (snap.exists()) {
        setOfficeConfig(snap.data() as OfficeConfig);
      } else {
        setDoc(doc(db, 'office', 'config'), {
          latitude: -6.175392,
          longitude: 106.827153,
          radius: 5,
          locationName: "Kantor Pusat"
        });
      }
    });

    return () => unsubOffice();
  }, [user]);

  useEffect(() => {
    let unsubDoc: (() => void) | null = null;
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      if (unsubDoc) {
        unsubDoc();
        unsubDoc = null;
      }
      
      setUser(u);
      if (u) {
        const docRef = doc(db, 'users', u.uid);
        unsubDoc = onSnapshot(docRef, async (docSnap) => {
          if (docSnap.exists()) {
            setProfile({ uid: u.uid, ...docSnap.data() } as UserProfile);
            setLoading(false);
          } else {
            try {
              const usersQuery = query(collection(db, 'users'), where('role', '==', 'admin'), limit(1));
              const usersSnap = await getDocs(usersQuery);
              const isEmpty = usersSnap.empty;
              
              const isOwner = u.email === 'yminato617@gmail.com';
              const shouldBeAdmin = isEmpty || isOwner;
              
              const newProfile = {
                email: u.email || '',
                name: u.displayName || 'Akun Google',
                status: shouldBeAdmin ? 'approved' : 'pending',
                role: shouldBeAdmin ? 'admin' : 'user',
                createdAt: serverTimestamp()
              };
              
              await setDoc(docRef, newProfile);
            } catch (error) {
              console.error('Error auto-creating profile:', error);
              setLoading(false);
            }
          }
        }, (error) => {
          console.error("Profile listen error:", error);
          setLoading(false);
        });
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => {
      unsubscribe();
      if (unsubDoc) unsubDoc();
    };
  }, []);

  // Monitor device configs and last active time
  useEffect(() => {
    if (!user) {
      setDeviceConfig(null);
      setIsDeviceConnected(false);
      return;
    }

    const docRef = doc(db, 'deviceConfigs', 'main-nodedcu');
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        setDeviceConfig(docSnap.data() as DeviceConfig);
      } else {
        // Initialize if not exists
        setDoc(docRef, { mode: 'verify', enrollTargetId: 1, message: 'Ready' });
      }
    }, (error) => {
      console.error("Device config listen error:", error);
    });

    return unsubscribe;
  }, [user]);

  // Handle dynamic connected / disconnected calculation
  useEffect(() => {
    const checkConnection = () => {
      if (!deviceConfig || !deviceConfig.lastActive) {
        setIsDeviceConnected(false);
        return;
      }
      
      let lastActiveMs = 0;
      if (deviceConfig.lastActive?.toDate) {
        lastActiveMs = deviceConfig.lastActive.toDate().getTime();
      } else if (deviceConfig.lastActive?.seconds) {
        lastActiveMs = deviceConfig.lastActive.seconds * 1000;
      } else if (typeof deviceConfig.lastActive === 'number') {
        lastActiveMs = deviceConfig.lastActive;
      } else if (typeof deviceConfig.lastActive === 'string') {
        lastActiveMs = new Date(deviceConfig.lastActive).getTime();
      } else {
        setIsDeviceConnected(false);
        return;
      }

      const now = new Date().getTime();
      // If last active was within the last 60 seconds, we count it as CONNECTED
      setIsDeviceConnected(now - lastActiveMs < 60000);
    };

    checkConnection();
    const interval = setInterval(checkConnection, 5000);
    return () => clearInterval(interval);
  }, [deviceConfig]);

  if (loading || (user && !profile)) {
    return (
      <div className="min-h-screen bg-[#0f172a] flex items-center justify-center">
        <Activity className="animate-spin text-cyan-500" />
      </div>
    );
  }

  if (!user) {
    return <LoginScreen />;
  }

  if (profile && (profile.status === 'pending' || profile.status === 'rejected')) {
    return (
      <div className="min-h-screen bg-[#0f172a] flex items-center justify-center p-6 relative overflow-hidden text-slate-100">
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(#22d3ee 1px, transparent 0)', backgroundSize: '40px 40px' }}></div>
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bento-card max-w-md w-full text-center relative z-10 border-cyan-500/10"
        >
          {profile.status === 'pending' ? (
            <>
              <div className="bg-amber-500/25 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-amber-500/40">
                <Clock className="text-amber-400 w-8 h-8 font-bold" />
              </div>
              <h1 className="text-2xl font-bold mb-2 text-slate-100">Menunggu Persetujuan</h1>
              <p className="text-slate-400 text-sm leading-relaxed mb-6">
                Halo, <span className="text-cyan-400 font-bold">{profile.name}</span>. Akun Anda telah didaftarkan dan saat ini sedang menunggu persetujuan (approval) dari Administrator sistem.
              </p>
              <div className="bg-slate-900/50 p-4 rounded-xl text-left border border-slate-700/30 text-xs font-mono space-y-2 mb-8">
                <div className="flex justify-between"><span className="text-slate-500">EMAIL:</span> <span>{profile.email}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">STATUS:</span> <span className="text-amber-400 font-bold">PENDING APPROVAL</span></div>
              </div>
            </>
          ) : (
            <>
              <div className="bg-red-500/25 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-red-500/40">
                <ShieldCheck className="text-red-400 w-8 h-8" />
              </div>
              <h1 className="text-2xl font-bold mb-2 text-slate-100">Akses Ditolak</h1>
              <p className="text-slate-400 text-sm leading-relaxed mb-6">
                Maaf, akses Anda ke sistem dinonaktifkan atau ditolak oleh Administrator. Hubungi admin untuk memulihkan akses Anda.
              </p>
            </>
          )}
          
          <button 
            onClick={logOut}
            className="w-full flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-white p-3 rounded-xl transition-all font-semibold border border-slate-700"
          >
            <LogOut size={16} />
            Keluar / Ganti Akun
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-100 flex flex-col md:flex-row">
      {/* Sidebar */}
      <nav className="w-full md:w-64 bg-slate-900 border-r border-slate-800 p-6 flex flex-col justify-between">
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
              active={activeTab === 'absen-mobile'} 
              onClick={() => setActiveTab('absen-mobile')}
              icon={<Smartphone size={20} />}
              label="Absen Mobile" 
            />
            <NavButton 
              active={activeTab === 'my-profile'} 
              onClick={() => setActiveTab('my-profile')}
              icon={<User size={20} />}
              label="Profil Saya" 
            />
            {profile && profile.role === 'admin' && (
              <>
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
                  active={activeTab === 'users'} 
                  onClick={() => setActiveTab('users')}
                  icon={<Users size={20} />}
                  label="Persetujuan" 
                />
              </>
            )}
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
      <main className="flex-1 p-6 md:p-12 overflow-y-auto">
        <header className="mb-10">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-[10px] uppercase tracking-[0.2em] font-mono text-slate-500 mb-1">DASHBOARD</p>
              <h2 className="text-4xl font-bold text-slate-100">
                {activeTab === 'attendance' ? 'Log Kehadiran' : activeTab === 'absen-mobile' ? 'Absen Smartphone' : activeTab === 'employees' ? 'Daftar Karyawan' : activeTab === 'device' ? 'Konfigurasi Alat' : activeTab === 'users' ? 'Persetujuan Akun' : 'Profil Saya'}
              </h2>
            </div>
            <div className="hidden md:flex items-center gap-4 text-right">
              <div className="text-right">
                <div className="text-xl font-medium font-mono text-slate-100">{format(new Date(), 'HH:mm:ss')}</div>
                <div className="text-[10px] text-slate-500 uppercase tracking-widest">{format(new Date(), 'EEEE, MMM dd')}</div>
              </div>
              <div className="h-8 w-[1px] bg-slate-700"></div>
              {isDeviceConnected ? (
                <div className="flex items-center gap-2 bg-emerald-500/10 text-emerald-400 px-3 py-1 rounded-full border border-emerald-500/20 text-[10px] font-bold">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></div>
                  NODEMCU CONNECTED
                </div>
              ) : (
                <div className="flex items-center gap-2 bg-red-500/10 text-red-500 px-3 py-1 rounded-full border border-red-500/20 text-[10px] font-bold">
                  <div className="w-1.5 h-1.5 rounded-full bg-red-500"></div>
                  NODEMCU DISCONNECTED
                </div>
              )}
            </div>
          </div>
        </header>

        <AnimatePresence mode="wait">
          {activeTab === 'attendance' && <AttendanceView key="att" />}
          {activeTab === 'employees' && profile?.role === 'admin' && <EmployeeView key="emp" />}
          {activeTab === 'device' && profile?.role === 'admin' && <DeviceView key="dev" config={deviceConfig} isConnected={isDeviceConnected} officeConfig={officeConfig} profile={profile} />}
          {activeTab === 'users' && profile?.role === 'admin' && <UsersApprovalView key="usr" />}
          {activeTab === 'absen-mobile' && profile && <MobileAttendanceView key="mob" userProfile={profile} officeConfig={officeConfig} />}
          {activeTab === 'my-profile' && profile && <MyProfileView key="prof" profile={profile} />}
        </AnimatePresence>
      </main>
    </div>
  );
}

// --- Sub-components ---

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

  const handleExportCSV = () => {
    if (logs.length === 0) return;

    // Prepare CSV rows and format them
    const headers = ['ID Log', 'ID Karyawan', 'Nama Karyawan', 'Tanggal', 'Jam', 'Tipe Presensi', 'Status'];
    const rows = logs.map(log => {
      const dateObj = log.timestamp?.toDate ? log.timestamp.toDate() : null;
      const dateStr = dateObj ? format(dateObj, 'yyyy-MM-dd') : '-----';
      const timeStr = dateObj ? format(dateObj, 'HH:mm:ss') : '--:--:--';
      const typeStr = log.type === 'in' ? 'Check In' : 'Check Out';
      
      // Escape names and handle possible commas
      const escapedName = log.employeeName ? `"${log.employeeName.replace(/"/g, '""')}"` : '""';
      
      return [
        log.id || '',
        log.employeeId || '',
        escapedName,
        dateStr,
        timeStr,
        typeStr,
        'Terverifikasi'
      ];
    });

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    // Generate blob and trigger file download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    const fileName = `Laporan_Kehadiran_${format(new Date(), 'yyyy-MM-dd_HHmmss')}.csv`;
    link.setAttribute('download', fileName);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="bento-card overflow-hidden"
    >
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Recent Presence Logs</h2>
          <p className="text-[10px] text-slate-500 font-mono mt-1">Total: {logs.length} Log Kehadiran</p>
        </div>
        <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-start">
          <button
            onClick={handleExportCSV}
            disabled={logs.length === 0}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider font-mono transition-all border shrink-0 ${
              logs.length === 0
                ? 'bg-slate-800 border-slate-700 text-slate-600 cursor-not-allowed'
                : 'bg-cyan-600/10 hover:bg-cyan-600/20 border-cyan-500/30 text-cyan-400 hover:text-white cursor-pointer active:scale-95'
            }`}
          >
            <Download size={14} />
            Export to CSV
          </button>
          <div className="flex gap-1 shrink-0">
            {[1, 2, 3, 4].map(i => <div key={i} className={`h-1.5 w-6 rounded-full ${i < 4 ? 'bg-cyan-500' : 'bg-slate-700'}`}></div>)}
          </div>
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
  const [newPos, setNewPos] = useState('');

  useEffect(() => {
    const q = query(collection(db, 'employees'), orderBy('name', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const e = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Employee));
      setEmployees(e);
    });
    return unsubscribe;
  }, []);

  const nextFpId = employees.length > 0 ? Math.max(...employees.map(e => e.fingerprintId)) + 1 : 1;

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, 'employees'), {
        name: newName,
        fingerprintId: nextFpId,
        position: newPos,
        createdAt: serverTimestamp()
      });
      setNewName('');
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
            <label className="text-[10px] uppercase font-mono tracking-widest text-slate-500">Auto FP ID</label>
            <input 
              disabled
              value={nextFpId}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 outline-none text-sm font-mono font-bold text-cyan-400"
              title="ID dihasilkan otomatis oleh sistem"
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
                      await deleteDoc(doc(db, 'employees', emp.id));
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

function MyProfileView({ profile }: { profile: UserProfile }) {
  const [logs, setLogs] = useState<Attendance[]>([]);
  const [employeeData, setEmployeeData] = useState<Employee | null>(null);

  useEffect(() => {
    if (!profile.employeeId) return;
    
    // Ambil data profil karyawan yang terhubung
    const unsubEmp = onSnapshot(doc(db, 'employees', profile.employeeId), (docSnap) => {
      if (docSnap.exists()) {
        setEmployeeData({ id: docSnap.id, ...docSnap.data() } as Employee);
      }
    });

    // Ambil riwayat absen khusus untuk ID karyawan ini
    const q = query(collection(db, 'attendance'), where('employeeId', '==', profile.employeeId));
    const unsubLogs = onSnapshot(q, (snapshot) => {
      const l = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Attendance));
      // Urutkan dari yang paling baru di sisi klien (agar tidak perlu buat composite index di Firebase)
      l.sort((a, b) => {
         const timeA = a.timestamp?.toMillis?.() || 0;
         const timeB = b.timestamp?.toMillis?.() || 0;
         return timeB - timeA;
      });
      setLogs(l);
    });

    return () => {
      unsubEmp();
      unsubLogs();
    };
  }, [profile.employeeId]);

  if (!profile.employeeId) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bento-card border-amber-500/30 text-center py-16">
        <User size={48} className="mx-auto text-amber-500 mb-4 opacity-50" />
        <h2 className="text-xl font-bold text-slate-100 mb-2">Profil Belum Terhubung</h2>
        <p className="text-slate-400 text-sm">Akun Anda belum dikaitkan dengan data karyawan manapun.</p>
        <p className="text-xs text-slate-500 mt-2">Buka menu <strong className="text-slate-300">Absen Mobile</strong> untuk menghubungkan profil Anda.</p>
      </motion.div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="space-y-6"
    >
      {/* Header Profile Card */}
      <div className="bento-card flex flex-col md:flex-row gap-6 items-center md:items-start border-cyan-500/20">
        <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-cyan-500/50 shrink-0 bg-slate-800 flex items-center justify-center">
          {employeeData?.facePhoto ? (
              <img src={employeeData.facePhoto} alt="Profil" className="w-full h-full object-cover" />
          ) : (
              <User size={40} className="text-slate-500" />
          )}
        </div>
        <div className="flex-1 text-center md:text-left">
          <h2 className="text-2xl font-bold text-slate-100">{employeeData?.name || profile.name}</h2>
          <p className="text-sm font-mono text-cyan-400 uppercase tracking-widest mb-4">{employeeData?.position || 'KARYAWAN'}</p>
          
          <div className="flex flex-wrap gap-4 justify-center md:justify-start">
            <div className="bg-slate-900/50 border border-slate-700/50 rounded-xl px-4 py-2">
              <p className="text-[10px] text-slate-500 uppercase font-mono tracking-widest">ID Sidik Jari</p>
              <p className="font-bold font-mono text-slate-200">#{employeeData?.fingerprintId?.toString().padStart(3, '0') || '---'}</p>
            </div>
            <div className="bg-slate-900/50 border border-slate-700/50 rounded-xl px-4 py-2">
              <p className="text-[10px] text-slate-500 uppercase font-mono tracking-widest">Total Rekam Absen</p>
              <p className="font-bold font-mono text-emerald-400">{logs.length} Kali</p>
            </div>
          </div>
        </div>
      </div>

      {/* Logs List */}
      <div className="bento-card">
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-6">Riwayat Presensi Pribadi</h3>
        <div className="space-y-3">
          {logs.length === 0 ? (
            <div className="p-10 text-center text-slate-500 italic font-mono text-sm">Belum ada riwayat kehadiran yang tercatat.</div>
          ) : logs.map((log) => (
            <div key={log.id} className="flex items-center gap-4 p-4 bg-slate-900/40 rounded-xl border border-slate-700/30 hover:border-cyan-500/30 transition-all">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${log.type === 'in' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}`}>
                {log.type === 'in' ? 'IN' : 'OUT'}
              </div>
              <div className="flex-1">
                <div className="text-sm font-semibold text-slate-100">
                  {log.type === 'in' ? 'Check In' : 'Check Out'}
                </div>
                <div className="text-[10px] text-slate-500 flex gap-2 items-center">
                  {log.isMobile ? <Smartphone size={10} /> : <Fingerprint size={10} />}
                  {log.isMobile ? 'Melalui Mobile / GPS' : 'Melalui Scanner Alat'}
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm font-bold font-mono text-slate-200">
                  {log.timestamp?.toDate ? format(log.timestamp.toDate(), 'HH:mm:ss') : '--:--:--'}
                </div>
                <div className="text-[10px] text-cyan-400 font-mono tracking-widest uppercase mt-0.5">
                  {log.timestamp?.toDate ? format(log.timestamp.toDate(), 'dd MMM yyyy') : '---'}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

function DeviceView({ config, isConnected, officeConfig, profile }: { config: DeviceConfig | null, isConnected: boolean, officeConfig: OfficeConfig, profile: UserProfile | null, key?: any }) {
  const [latInput, setLatInput] = useState(officeConfig.latitude.toString());
  const [lngInput, setLngInput] = useState(officeConfig.longitude.toString());
  const [radiusInput, setRadiusInput] = useState(officeConfig.radius.toString());
  const [locNameInput, setLocNameInput] = useState(officeConfig.locationName || 'Kantor Pusat');
  const [isUpdating, setIsUpdating] = useState(false);
  const [isLocating, setIsLocating] = useState(false);

  useEffect(() => {
    if (officeConfig) {
      setLatInput(officeConfig.latitude.toString());
      setLngInput(officeConfig.longitude.toString());
      setRadiusInput(officeConfig.radius.toString());
      setLocNameInput(officeConfig.locationName || 'Kantor Pusat');
    }
  }, [officeConfig]);

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

  const handleUpdateOffice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || profile.role !== 'admin') {
      alert("Hanya Administrator yang diperbolehkan mengubah jangkauan GPS kantor!");
      return;
    }
    setIsUpdating(true);
    try {
      await setDoc(doc(db, 'office', 'config'), {
        latitude: parseFloat(latInput),
        longitude: parseFloat(lngInput),
        radius: parseFloat(radiusInput),
        locationName: locNameInput
      }, { merge: true });
      alert("Koordinat GPS dan radius kehadiran kantor berhasil diperbarui!");
    } catch (err) {
      console.error("Error updating office location:", err);
      alert("Gagal memperbarui konfigurasi kantor.");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleSetCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert("Browser Anda tidak mendukung Geolocation.");
      return;
    }

    setIsLocating(true);

    const options = {
      enableHighAccuracy: true,
      timeout: 8000,
      maximumAge: 0
    };

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLatInput(pos.coords.latitude.toString());
        setLngInput(pos.coords.longitude.toString());
        setIsLocating(false);
      },
      (err) => {
        console.warn("Gagal mendapatkan lokasi dengan akurasi tinggi, mencoba akurasi rendah...", err);
        // Fallback to low-accuracy immediately if high accuracy times out/fails
        navigator.geolocation.getCurrentPosition(
          (fallbackPos) => {
            setLatInput(fallbackPos.coords.latitude.toString());
            setLngInput(fallbackPos.coords.longitude.toString());
            setIsLocating(false);
          },
          (fallbackErr) => {
            setIsLocating(false);
            alert(`Gagal membaca GPS saat ini.\nDetail: ${fallbackErr.message} (Code: ${fallbackErr.code})\n\nPastikan Anda telah menyetujui izin lokasi di browser Anda.`);
          },
          { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 }
        );
      },
      options
    );
  };

  const isAdmin = profile?.role === 'admin';

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="grid grid-cols-1 lg:grid-cols-12 gap-6"
    >
      {/* Col 1: Hardware Link */}
      <div className="lg:col-span-4 bento-card border-cyan-500/30 flex flex-col justify-between h-full">
        <div>
          <h2 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-6">Live Hardware Status</h2>
          <div className="flex items-center gap-2 mb-8">
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-red-500'}`} />
            <span className={`text-xs font-mono uppercase tracking-widest ${isConnected ? 'text-emerald-400' : 'text-red-500'}`}>
              ESP8266 {isConnected ? 'CONNECTED' : 'DISCONNECTED'}
            </span>
          </div>

          <div className="bg-slate-900/50 rounded-2xl p-8 border border-slate-700/30 flex flex-col items-center justify-center relative overflow-hidden mb-6">
            <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(#22d3ee 1px, transparent 0)', backgroundSize: '15px 15px' }}></div>
            <Fingerprint className={`w-20 h-20 mb-4 transition-all ${isConnected ? 'text-cyan-500/40 animate-pulse' : 'text-slate-700/30'}`} strokeWidth={1} />
            <div className={`text-[10px] font-mono tracking-widest uppercase ${isConnected ? 'text-cyan-400 animate-pulse' : 'text-slate-500'}`}>
              {isConnected ? 'Scanner Active' : 'Scanner Offline'}
            </div>
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

      {/* Col 2: Hardware Control */}
      <div className="lg:col-span-4 bento-card space-y-8 flex flex-col justify-between h-full">
        <div>
          <h2 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-6">Hardware Control Panel</h2>
          
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
                <p className="font-mono text-xs text-cyan-400 truncate">{config?.message || 'Ready'}</p>
              </div>
              <div className="p-4 bg-slate-900 rounded-2xl border border-slate-700/50">
                <p className="text-[10px] uppercase font-mono tracking-widest text-slate-500 mb-1">Target ID</p>
                <p className="font-mono text-xs text-slate-100">{config?.enrollTargetId || '--'}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-slate-900/40 p-4 rounded-xl mt-4">
           <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Diagnostics</h3>
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

      {/* Col 3: GPS Geofence Settings */}
      <div className="lg:col-span-4 bento-card border-cyan-500/10 flex flex-col justify-between h-full">
        <div>
          <h2 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-6">Konfigurasi Radius Kantor</h2>
          
          <form onSubmit={handleUpdateOffice} className="space-y-4">
            <div>
              <label className="text-[10px] font-mono text-slate-400 block mb-1 uppercase">Nama Lokasi</label>
              <input
                disabled={!isAdmin}
                type="text"
                required
                value={locNameInput}
                onChange={(e) => setLocNameInput(e.target.value)}
                className="w-full text-xs font-mono bg-slate-900 border border-slate-750 p-2.5 rounded-xl text-slate-200 outline-none focus:border-cyan-500/50"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-mono text-slate-400 block mb-1 uppercase">Latitude</label>
                <input
                  disabled={!isAdmin}
                  type="number"
                  step="any"
                  required
                  value={latInput}
                  onChange={(e) => setLatInput(e.target.value)}
                  className="w-full text-xs font-mono bg-slate-900 border border-slate-750 p-2.5 rounded-xl text-slate-200 outline-none focus:border-cyan-500/50"
                />
              </div>
              <div>
                <label className="text-[10px] font-mono text-slate-400 block mb-1 uppercase">Longitude</label>
                <input
                  disabled={!isAdmin}
                  type="number"
                  step="any"
                  required
                  value={lngInput}
                  onChange={(e) => setLngInput(e.target.value)}
                  className="w-full text-xs font-mono bg-slate-900 border border-slate-750 p-2.5 rounded-xl text-slate-200 outline-none focus:border-cyan-500/50"
                />
              </div>
            </div>

            <div>
              <label className="text-[10px] font-mono text-slate-400 block mb-1 uppercase">Radius Valid (Meter)</label>
              <input
                disabled={!isAdmin}
                type="number"
                min="2"
                max="500"
                required
                value={radiusInput}
                onChange={(e) => setRadiusInput(e.target.value)}
                className="w-full text-xs font-mono bg-slate-900 border border-slate-750 p-2.5 rounded-xl text-slate-200 outline-none focus:border-cyan-500/50"
              />
            </div>

            {isAdmin && (
              <div className="flex flex-col gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleSetCurrentLocation}
                  disabled={isLocating}
                  className="w-full py-2 bg-slate-800 hover:bg-slate-750 hover:text-cyan-400 text-slate-300 font-bold rounded-xl text-[10px] uppercase font-mono transition-all border border-slate-700/60 flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  {isLocating ? (
                    <>
                      <Loader2 size={12} className="animate-spin text-cyan-400" />
                      Membaca GPS...
                    </>
                  ) : (
                    <>
                      <Compass size={12} className="animate-pulse" />
                      Gunakan GPS Saya Saat Ini
                    </>
                  )}
                </button>
                <button
                  type="submit"
                  disabled={isUpdating}
                  className="w-full py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-xl text-[10px] uppercase font-mono transition-all tracking-wider disabled:opacity-50"
                >
                  {isUpdating ? 'Menyimpan...' : 'Simpan Lokasi Kantor'}
                </button>
              </div>
            )}
          </form>
        </div>

        <div className="mt-4 pt-3 border-t border-cyan-500/10">
           <div className="p-3 bg-slate-900 rounded-xl border border-slate-705">
             <div className="text-[8px] text-slate-500 uppercase mb-1 font-mono">Status Sistem</div>
             <div className="font-mono text-[9px] text-cyan-400">
               {isAdmin ? 'ADMIN MODE - EDIT ENABLED' : 'USER MODE - SECURE READ ONLY'}
             </div>
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

function UsersApprovalView() {
  const [userList, setUserList] = useState<UserProfile[]>([]);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');

  useEffect(() => {
    const q = query(collection(db, 'users'), orderBy('email', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const u = snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile));
      setUserList(u);
    });
    return unsubscribe;
  }, []);

  const handleUpdateStatus = async (uid: string, newStatus: 'approved' | 'pending' | 'rejected') => {
    if (uid === auth.currentUser?.uid) {
      alert("Anda tidak bisa mengubah status akun Anda sendiri!");
      return;
    }
    try {
      await setDoc(doc(db, 'users', uid), { status: newStatus }, { merge: true });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${uid}`);
    }
  };

  const handleToggleRole = async (uid: string, currentRole: 'admin' | 'user') => {
    if (uid === auth.currentUser?.uid) {
      alert("Anda tidak bisa mengubah peran Anda sendiri!");
      return;
    }
    const newRole = currentRole === 'admin' ? 'user' : 'admin';
    try {
      await setDoc(doc(db, 'users', uid), { role: newRole }, { merge: true });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${uid}`);
    }
  };

  const filteredUsers = userList.filter(u => {
    if (filter === 'all') return true;
    return u.status === filter;
  });

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="space-y-6"
    >
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-900/50 p-4 rounded-xl border border-slate-800">
        <div className="text-xs font-mono text-slate-500 pl-2">FILTER STATUS AKUN</div>
        <div className="flex gap-2">
          {(['all', 'pending', 'approved', 'rejected'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-xl text-xs font-mono uppercase font-bold tracking-wider transition-all ${
                filter === f
                  ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-900/40'
                  : 'bg-slate-800 border border-slate-700 text-slate-400 hover:text-slate-100'
              }`}
            >
              {f === 'all' ? 'Semua' : f === 'pending' ? 'Pending' : f === 'approved' ? 'Disetujui' : 'Ditolak'}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredUsers.length === 0 ? (
          <div className="col-span-full bento-card text-center p-12 text-slate-500 italic">
            Tidak ada akun dengan status ini.
          </div>
        ) : filteredUsers.map(u => {
          const isSelf = u.uid === auth.currentUser?.uid;
          return (
            <div key={u.uid} className={`bento-card relative overflow-hidden group transition-all ${isSelf ? 'border-cyan-500/40 bg-slate-800/90' : ''}`}>
              <div className="flex justify-between items-start mb-6">
                <div className={`p-3 rounded-2xl ${u.role === 'admin' ? 'bg-cyan-500/10 text-cyan-400' : 'bg-slate-700/50 text-slate-400'}`}>
                  <Users size={24} />
                </div>
                <div className="text-right flex items-center gap-2">
                  <span className={`inline-block text-[9px] font-bold tracking-widest font-mono uppercase px-2.5 py-1 rounded-full ${
                    u.status === 'approved' 
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                      : u.status === 'pending'
                      ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20 animate-pulse'
                      : 'bg-red-500/10 text-red-400 border border-red-500/20'
                  }`}>
                    {u.status}
                  </span>
                  {!isSelf && (
                    <button 
                      onClick={async () => {
                        if (confirm('Hapus akses login akun ini secara permanen?')) {
                          try {
                            await deleteDoc(doc(db, 'users', u.uid));
                          } catch (e) {
                            console.error(e);
                          }
                        }
                      }}
                      className="p-1.5 rounded-lg text-slate-500 hover:bg-red-500/10 hover:text-red-400 transition-colors"
                      title="Hapus Akses Login"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </div>

              <h3 className="text-lg font-bold mb-1 truncate flex items-center gap-2">
                {u.name} 
                {isSelf && <span className="text-[9px] bg-cyan-400 text-slate-900 px-1.5 py-0.5 rounded font-mono font-bold">YOU</span>}
              </h3>
              <p className="text-xs font-mono text-slate-500 mb-6 truncate">{u.email}</p>

              <div className="pt-4 border-t border-slate-700/50 flex flex-col gap-3">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500 font-mono">PERAN / ROLE:</span>
                  <button 
                    disabled={isSelf}
                    onClick={() => handleToggleRole(u.uid, u.role || 'user')}
                    className={`font-mono text-xs font-bold uppercase transition-all px-2 py-1 rounded ${
                      u.role === 'admin' 
                        ? 'text-cyan-400 hover:bg-cyan-500/10' 
                        : 'text-slate-400 hover:bg-slate-700'
                    } ${isSelf ? 'cursor-not-allowed opacity-70' : ''}`}
                  >
                    {u.role || 'user'}
                  </button>
                </div>

                <div className="flex gap-2 mt-2">
                  <button
                    disabled={isSelf || u.status === 'approved'}
                    onClick={() => handleUpdateStatus(u.uid, 'approved')}
                    className={`flex-1 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all border ${
                      u.status === 'approved'
                        ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 cursor-not-allowed opacity-60'
                        : 'bg-emerald-600/20 hover:bg-emerald-600 hover:text-white border-emerald-500/30 text-emerald-400'
                    } ${isSelf ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    Setujui
                  </button>
                  <button
                    disabled={isSelf || u.status === 'rejected'}
                    onClick={() => handleUpdateStatus(u.uid, 'rejected')}
                    className={`flex-1 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all border ${
                      u.status === 'rejected'
                        ? 'bg-red-500/10 border-red-500/20 text-red-400 cursor-not-allowed opacity-60'
                        : 'bg-red-600/20 hover:bg-red-600 hover:text-white border-red-500/30 text-red-400'
                    } ${isSelf ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    Tolak
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}
