import React, { useState, useEffect, useRef } from 'react';
import { 
  collection, 
  doc, 
  onSnapshot, 
  addDoc, 
  setDoc, 
  query, 
  getDocs,
  serverTimestamp 
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Employee, UserProfile, OfficeConfig, Attendance } from '../types';
import { 
  Camera, 
  MapPin, 
  UserCheck, 
  CheckCircle2, 
  XCircle, 
  Compass, 
  ScanFace, 
  Lock, 
  Loader2,
  RefreshCw,
  ShieldAlert,
  Smartphone
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface MobileAttendanceViewProps {
  userProfile: UserProfile;
  officeConfig: OfficeConfig;
  key?: string;
}

export default function MobileAttendanceView({ userProfile, officeConfig }: MobileAttendanceViewProps) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [currentEmployee, setCurrentEmployee] = useState<Employee | null>(null);
  const [isLinking, setIsLinking] = useState(false);
  const [selectedEmpId, setSelectedEmpId] = useState('');
  
  // GPS State
  const [gpsLocation, setGpsLocation] = useState<GeolocationPosition | null>(null);
  const [gpsError, setGpsError] = useState('');
  const [gpsLoading, setGpsLoading] = useState(true);

  // Camera Capture Modal
  const [showCamera, setShowCamera] = useState(false);
  const [cameraMode, setCameraMode] = useState<'register' | 'attendance'>('attendance');
  const [attendanceType, setAttendanceType] = useState<'in' | 'out'>('in');

  // AI Verification State
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState<{
    success: boolean;
    verified: boolean;
    confidence: number;
    reason: string;
  } | null>(null);

  // Load all employees
  useEffect(() => {
    const q = query(collection(db, 'employees'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Employee));
      setEmployees(list);

      // Resolve linked employee
      if (userProfile.employeeId) {
        const found = list.find(e => e.id === userProfile.employeeId);
        if (found) {
          setCurrentEmployee(found);
        }
      } else {
        // Try to auto-link by exact name match
        const autoMatch = list.find(e => e.name.toLowerCase().trim() === userProfile.name.toLowerCase().trim());
        if (autoMatch) {
          handleLinkEmployee(autoMatch.id);
        }
      }
    });

    return unsubscribe;
  }, [userProfile.employeeId, userProfile.name]);

  // Track coordinates
  useEffect(() => {
    if (!navigator.geolocation) {
      setGpsError("Browser Anda tidak mendukung Geolocation.");
      setGpsLoading(false);
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        setGpsLocation(position);
        setGpsError('');
        setGpsLoading(false);
      },
      (err) => {
        console.error("GPS Error:", err);
        setGpsError("Gagal mendapatkan lokasi GPS. Pastikan izin lokasi aktif.");
        setGpsLoading(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, []);

  // Haversine Distance Formula
  const getDistance = (): number | null => {
    if (!gpsLocation) return null;
    const lat1 = gpsLocation.coords.latitude;
    const lon1 = gpsLocation.coords.longitude;
    const lat2 = officeConfig.latitude;
    const lon2 = officeConfig.longitude;

    const R = 6371000; // Earth's Radius in meters
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // distance in meters
  };

  const distance = getDistance();
  const isWithinRadius = distance !== null && distance <= officeConfig.radius;

  const handleLinkEmployee = async (employeeId: string) => {
    if (!employeeId) return;
    setIsLinking(true);
    try {
      await setDoc(doc(db, 'users', userProfile.uid), {
        employeeId: employeeId
      }, { merge: true });
    } catch (err) {
      console.error("Error linking employee profile:", err);
    } finally {
      setIsLinking(false);
    }
  };

  const handleUnlink = async () => {
    if (confirm("Putuskan hubungan akun dengan profil karyawan ini?")) {
      await setDoc(doc(db, 'users', userProfile.uid), {
        employeeId: null
      }, { merge: true });
      setCurrentEmployee(null);
    }
  };

  const startPhotoRegistration = () => {
    setCameraMode('register');
    setVerificationResult(null);
    setShowCamera(true);
  };

  const startAttendanceCheck = (type: 'in' | 'out') => {
    if (!isWithinRadius) {
      alert(`Anda berada di luar radius presensi kantor! Jarak Anda: ${distance ? distance.toFixed(1) : '---'}m (Radius max: ${officeConfig.radius}m)`);
      return;
    }
    setCameraMode('attendance');
    setAttendanceType(type);
    setVerificationResult(null);
    setShowCamera(true);
  };

  const onCameraCapture = async (base64Data: string) => {
    setShowCamera(false);
    
    if (cameraMode === 'register') {
      // Register face reference in Firestore
      if (!currentEmployee) return;
      setIsVerifying(true);
      try {
        await setDoc(doc(db, 'employees', currentEmployee.id), {
          facePhoto: base64Data
        }, { merge: true });
        
        setVerificationResult({
          success: true,
          verified: true,
          confidence: 100,
          reason: "Referensi wajah Anda berhasil didaftarkan ke sistem biometrik cloud."
        });
      } catch (err: any) {
        setVerificationResult({
          success: false,
          verified: false,
          confidence: 0,
          reason: "Gagal menyimpan foto: " + err.message
        });
      } finally {
        setIsVerifying(false);
      }
    } else {
      // Run AI Face Verification
      if (!currentEmployee || !currentEmployee.facePhoto) return;
      setIsVerifying(true);
      setVerificationResult(null);

      try {
        const response = await fetch('/api/verify-face', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            livePhoto: base64Data,
            profilePhoto: currentEmployee.facePhoto
          })
        });

        const data = await response.json();
        
        if (response.ok && data.success && data.comparison) {
          const comp = data.comparison;
          setVerificationResult({
            success: true,
            verified: comp.verified,
            confidence: comp.confidence,
            reason: comp.reason
          });

          // If AI confirms verification is successful, record the attendance log
          if (comp.verified) {
            await addDoc(collection(db, 'attendance'), {
              employeeId: currentEmployee.id,
              employeeName: currentEmployee.name,
              type: attendanceType,
              timestamp: serverTimestamp(),
              isMobile: true,
              photoUrl: base64Data,
              verifiedByAI: true,
              aiConfidence: comp.confidence
            });
          }
        } else {
          setVerificationResult({
            success: false,
            verified: false,
            confidence: 0,
            reason: data.error || "Gagal melakukan pencocokan wajah di server."
          });
        }
      } catch (err: any) {
        setVerificationResult({
          success: false,
          verified: false,
          confidence: 0,
          reason: "Masalah koneksi jaringan ke server: " + err.message
        });
      } finally {
        setIsVerifying(false);
      }
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="space-y-6"
    >
      {/* 1. Account Linking Panel */}
      {!currentEmployee ? (
        <div className="bento-card border-amber-500/30">
          <div className="flex items-start gap-4">
            <div className="bg-amber-500/10 p-3 rounded-2xl text-amber-500 shrink-0">
              <Smartphone size={24} />
            </div>
            <div className="space-y-2 flex-1">
              <h3 className="text-lg font-bold text-slate-100">Hubungkan Profil Karyawan</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Untuk melakukan presensi mandiri menggunakan HP, akun Anda harus dihubungkan terlebih dahulu dengan salah satu Profil Karyawan terdaftar di database.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-3 pt-3">
                <select
                  value={selectedEmpId}
                  onChange={(e) => setSelectedEmpId(e.target.value)}
                  className="bg-slate-900 border border-slate-700 text-slate-100 rounded-xl p-3 focus:border-cyan-500 outline-none text-xs flex-1"
                >
                  <option value="">-- Pilih Profil Anda --</option>
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id}>{emp.name} ({emp.position})</option>
                  ))}
                </select>
                <button
                  disabled={isLinking || !selectedEmpId}
                  onClick={() => handleLinkEmployee(selectedEmpId)}
                  className="px-6 py-3 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-xl text-xs uppercase font-mono tracking-wider transition-all disabled:opacity-50"
                >
                  {isLinking ? 'Menghubungkan...' : 'Hubungkan Profil'}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* 2. Left side: Geolocation details */}
          <div className="lg:col-span-4 bento-card space-y-6 flex flex-col justify-between">
            <div>
              <h4 className="text-[10px] font-mono uppercase tracking-widest text-slate-400">Geolokasi Kantor</h4>
              
              <div className="bg-slate-900/40 p-4 rounded-2xl border border-slate-700/30 mt-4 space-y-3">
                <div className="flex items-center gap-3">
                  <MapPin size={18} className="text-cyan-400 shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-slate-200">{officeConfig.locationName}</p>
                    <p className="text-[10px] font-mono text-slate-500">
                      {officeConfig.latitude.toFixed(6)}, {officeConfig.longitude.toFixed(6)}
                    </p>
                  </div>
                </div>
                
                <div className="text-[10px] space-y-1 font-mono text-slate-400">
                  <div className="flex justify-between">
                    <span>Radius Maks:</span>
                    <span className="text-cyan-400 font-bold">{officeConfig.radius} Meter</span>
                  </div>
                </div>
              </div>

              {/* GPS Tracker Feed */}
              <div className="mt-6 space-y-3">
                <h4 className="text-[10px] font-mono uppercase tracking-widest text-slate-400">Lokasi GPS HP Anda</h4>
                {gpsLoading ? (
                  <div className="flex items-center gap-2 py-4 justify-center text-xs text-slate-400 font-mono">
                    <Loader2 size={16} className="animate-spin text-cyan-400" />
                    Menyinkronkan Sinyal GPS...
                  </div>
                ) : gpsError ? (
                  <div className="p-3 bg-red-500/15 border border-red-500/30 rounded-xl flex items-start gap-2.5">
                    <ShieldAlert size={16} className="text-red-400 shrink-0 mt-0.5" />
                    <span className="text-[10px] text-red-400 leading-relaxed">{gpsError}</span>
                  </div>
                ) : (
                  <div className={`p-4 rounded-2xl border transition-all ${
                    isWithinRadius 
                      ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400' 
                      : 'bg-red-500/5 border-red-500/20 text-red-400'
                  }`}>
                    <div className="flex justify-between items-center mb-3">
                      <span className="text-[10px] font-mono font-bold tracking-widest uppercase">
                        Sinyal GPS Akurat
                      </span>
                      {isWithinRadius ? (
                        <CheckCircle2 size={16} className="text-emerald-400 animate-pulse" />
                      ) : (
                        <Lock size={16} className="text-red-400" />
                      )}
                    </div>
                    
                    <div className="space-y-2 font-mono">
                      <div className="flex justify-between text-xs">
                        <span className="opacity-80">Jarak ke Kantor:</span>
                        <span className="font-bold text-sm">
                          {distance !== null ? `${distance.toFixed(1)} Meter` : '---'}
                        </span>
                      </div>
                      <div className="flex justify-between text-[10px] opacity-70">
                        <span>Koordinat Anda:</span>
                        <span>
                          {gpsLocation?.coords.latitude.toFixed(6)}, {gpsLocation?.coords.longitude.toFixed(6)}
                        </span>
                      </div>
                      <div className="pt-2 text-center text-[10px] font-bold uppercase transition-all">
                        {isWithinRadius ? '✓ Berada Di Dalam Radius Kantor' : '⚠ Di Luar Radius Kantor (Min 5m)'}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="pt-4 border-t border-slate-700/50">
              <div className="flex justify-between items-center">
                <span className="text-[10px] text-slate-500 font-mono">Profil Linked:</span>
                <button 
                  onClick={handleUnlink}
                  className="text-xs font-semibold text-red-400 hover:underline"
                >
                  Unlink Profil
                </button>
              </div>
              <p className="text-sm font-bold mt-1 text-cyan-400">{currentEmployee.name}</p>
              <p className="text-[10px] text-slate-400 font-mono uppercase">{currentEmployee.position}</p>
            </div>
          </div>

          {/* 3. Center: Face Registration & Attendance Submission */}
          <div className="lg:col-span-8 space-y-6">
            {/* Template face registration */}
            {!currentEmployee.facePhoto ? (
              <div className="bento-card bg-cyan-600/5 border-cyan-500/25 flex flex-col items-center justify-center text-center p-8">
                <ScanFace size={48} className="text-cyan-400 mb-4 animate-bounce" strokeWidth={1} />
                <h3 className="text-lg font-bold text-slate-100 mb-2">Registrasi Biometrik Wajah</h3>
                <p className="text-xs text-slate-400 max-w-md leading-relaxed mb-6">
                  Untuk memulai absen lewat smartphone, Anda wajib meregistrasikan template foto wajah referensi Anda ke dalam sistem AI cloud.
                </p>
                <button
                  onClick={startPhotoRegistration}
                  className="px-6 py-3 bg-cyan-600 hover:bg-cyan-500 text-slate-900 font-bold rounded-xl text-xs uppercase tracking-wider font-mono shadow-lg shadow-cyan-900/30 relative overflow-hidden"
                >
                  Ambil Foto Referensi
                </button>
              </div>
            ) : (
              <div className="bento-card space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-mono font-bold uppercase tracking-widest text-slate-400">Presensi Face Recognition</h3>
                  <button 
                    onClick={startPhotoRegistration}
                    className="text-xs flex items-center gap-1.5 text-cyan-400 hover:text-cyan-300 font-semibold"
                  >
                    <RefreshCw size={12} />
                    Update Foto Wajah
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
                  <div className="md:col-span-4 flex flex-col items-center justify-center p-4 bg-slate-900/65 rounded-2xl border border-slate-700/30">
                    <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-cyan-500/50 shadow-inner mb-3">
                      <img 
                        src={currentEmployee.facePhoto} 
                        alt="Face Reference" 
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                    <span className="text-[10px] font-mono uppercase tracking-widest text-cyan-400 font-bold">Face Template</span>
                  </div>

                  <div className="md:col-span-8 space-y-4">
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Sistem akan mengambil foto silsilah wajah Anda secara real-time dan mencocokannya dengan <span className="text-cyan-400 font-bold">Teknologi Google Gemini AI</span> untuk memastikan kecocokan identitas Anda secara akurat serta memverifikasi lokasi GPS HP Anda.
                    </p>

                    <div className="flex gap-4">
                      <button
                        onClick={() => startAttendanceCheck('in')}
                        disabled={gpsLoading || !isWithinRadius}
                        className={`flex-1 flex flex-col items-center justify-center py-4 px-3 rounded-2xl border font-bold transition-all ${
                          !isWithinRadius 
                            ? 'bg-slate-800/40 border-slate-750 text-slate-500 cursor-not-allowed' 
                            : 'bg-emerald-600/10 hover:bg-emerald-600/20 border-emerald-500/30 text-emerald-400 active:scale-95'
                        }`}
                      >
                        <UserCheck size={20} className="mb-1" />
                        <span className="text-[11px] font-mono tracking-wider uppercase">Absen Check In</span>
                      </button>

                      <button
                        onClick={() => startAttendanceCheck('out')}
                        disabled={gpsLoading || !isWithinRadius}
                        className={`flex-1 flex flex-col items-center justify-center py-4 px-3 rounded-2xl border font-bold transition-all ${
                          !isWithinRadius 
                            ? 'bg-slate-800/40 border-slate-750 text-slate-500 cursor-not-allowed' 
                            : 'bg-amber-600/10 hover:bg-amber-600/20 border-amber-500/30 text-amber-400 active:scale-95'
                        }`}
                      >
                        <XCircle size={20} className="mb-1" />
                        <span className="text-[11px] font-mono tracking-wider uppercase">Absen Check Out</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Verification Loading Screen */}
            {isVerifying && (
              <div className="bento-card bg-slate-900 border-cyan-500/30 flex flex-col items-center justify-center p-12 text-center">
                <Loader2 size={48} className="animate-spin text-cyan-500 mb-4" />
                <h3 className="text-lg font-bold text-slate-100 font-sans">Menjalankan Verifikasi Biometrik AI</h3>
                <p className="text-xs text-slate-400 max-w-sm leading-relaxed mt-2 animate-pulse">
                  Gemini AI sedang membandingkan foto wajah live Anda dengan model database. Mohon tunggu beberapa detik...
                </p>
              </div>
            )}

            {/* 4. Verification Results */}
            <AnimatePresence>
              {verificationResult && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 15 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className={`bento-card border ${
                    verificationResult.verified 
                      ? 'bg-emerald-500/5 border-emerald-500/30' 
                      : 'bg-red-500/5 border-red-500/30'
                  }`}
                >
                  <div className="flex flex-col gap-4">
                    <div className="flex items-start gap-4">
                      {verificationResult.verified ? (
                        <div className="bg-emerald-500/20 text-emerald-400 p-3 rounded-2xl shrink-0">
                          <CheckCircle2 size={28} />
                        </div>
                      ) : (
                        <div className="bg-red-500/20 text-red-400 p-3 rounded-2xl shrink-0">
                          <ShieldAlert size={28} />
                        </div>
                      )}
                      <div className="space-y-1.5 flex-1">
                        <div className="flex justify-between items-center flex-wrap gap-2">
                          <h4 className={`text-md font-bold uppercase tracking-wide ${
                            verificationResult.verified ? 'text-emerald-400' : 'text-red-400'
                          }`}>
                            {verificationResult.verified ? 'Verifikasi Wajah Berhasil!' : 'Verifikasi Wajah Gagal'}
                          </h4>
                          {verificationResult.confidence > 0 && (
                            <span className={`px-2.5 py-1 text-[10px] font-mono font-bold rounded-lg border ${
                              verificationResult.verified 
                                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
                                : 'bg-red-500/10 border-red-500/20 text-red-500'
                            }`}>
                              Match: {verificationResult.confidence}%
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-300 leading-relaxed font-sans mt-2">
                          {verificationResult.reason}
                        </p>
                      </div>
                    </div>

                    {/* Quota Exceeded Helpful Banner */}
                    {!verificationResult.verified && (verificationResult.reason?.toLowerCase().includes('quota') || verificationResult.reason?.toLowerCase().includes('exceeded') || verificationResult.reason?.toLowerCase().includes('429') || verificationResult.reason?.toLowerCase().includes('exhausted')) && (
                      <div className="mt-2 p-4 bg-amber-500/10 border border-amber-500/25 rounded-xl text-slate-300 text-xs leading-relaxed space-y-3">
                        <div className="flex items-center gap-2 text-amber-400 font-bold uppercase tracking-wider text-[10px] font-mono">
                          <ShieldAlert size={14} className="animate-pulse" />
                          Informasi Limit Harian Google AI Studio (Free Tier)
                        </div>
                        <p>
                          Akun Anda saat ini menggunakan <strong className="text-amber-300">Free Tier (API Key Gratisan)</strong> untuk model <code className="bg-slate-900 px-1 py-0.5 rounded font-mono text-[11px] text-cyan-400">gemini-flash-latest</code>. Kuota harian untuk API gratisan sangat dibatasi oleh Google AI Studio.
                        </p>
                        <div className="pt-1.5 space-y-1 border-t border-amber-500/10 text-[11px]">
                          <p className="font-semibold text-slate-200">Bagaimana cara mengatasi ini?</p>
                          <ul className="list-disc pl-4 space-y-1 text-slate-300">
                            <li>
                              <strong className="text-slate-100">Beralih ke Paid Tier (Pay-As-You-Go):</strong> Admin dapat mengaktifkan billing kartu kredit/debit di akun Google AI Studio Anda untuk memperoleh limit kuota yang sangat besar (hampir tanpa batas untuk absen harian).
                            </li>
                            <li>
                              <strong className="text-slate-100">Menunggu Reset Kuota:</strong> Kuota harian Anda akan di-reset otomatis setiap hari oleh sistem Google Cloud.
                            </li>
                          </ul>
                        </div>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      )}

      {/* Camera modal popup */}
      {showCamera && (
        <WebcamCapture 
          onCapture={onCameraCapture} 
          onClose={() => setShowCamera(false)} 
        />
      )}
    </motion.div>
  );
}

// Sub-component: Webcam Capture Utility
function WebcamCapture({ onCapture, onClose }: { onCapture: (base64: string) => void, onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState('');
  const [loadingCamera, setLoadingCamera] = useState(true);

  useEffect(() => {
    let localStream: MediaStream | null = null;
    async function startCamera() {
      try {
        setLoadingCamera(true);
        const s = await navigator.mediaDevices.getUserMedia({ 
          video: { 
            facingMode: 'user',
            width: { ideal: 640 },
            height: { ideal: 480 }
          }, 
          audio: false 
        });
        localStream = s;
        setStream(s);
        setLoadingCamera(false);
      } catch (err: any) {
        console.error("Camera access error:", err);
        setError("Gagal mengakses kamera depan Anda. Pastikan izin kamera telah disetujui di iFrame/Browser.");
        setLoadingCamera(false);
      }
    }

    startCamera();

    return () => {
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // Menempelkan stream kamera ke elemen video SETELAH loading selesai dan video sudah dirender di layar
  useEffect(() => {
    if (!loadingCamera && !error && stream && videoRef.current) {
      videoRef.current.srcObject = stream;
    }
  }, [loadingCamera, error, stream]);

  const handleCapture = () => {
    if (videoRef.current) {
      const canvas = document.createElement('canvas');
      canvas.width = 640;
      canvas.height = 480;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        // Mirror horizontally
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
        ctx.setTransform(1, 0, 0, 1, 0, 0); // reset
        
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        onCapture(dataUrl);
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4 z-50">
      <div className="bg-slate-900 border border-slate-700/60 rounded-[32px] p-6 max-w-md w-full shadow-2xl relative">
        <h3 className="text-md font-bold font-mono uppercase tracking-widest text-slate-100 mb-4 text-center">
          Penyelarasan Wajah Live
        </h3>
        
        {loadingCamera && (
          <div className="aspect-video rounded-2xl bg-slate-950 flex flex-col items-center justify-center text-slate-500 font-mono text-xs border border-slate-800 mb-6">
            <Loader2 className="animate-spin text-cyan-400 mb-2" size={24} />
            Memuat Modul Kamera...
          </div>
        )}

        {error ? (
          <div className="aspect-video rounded-2xl bg-slate-950 flex flex-col items-center justify-center text-center p-4 border border-red-500/20 mb-6 text-red-400">
            <ShieldAlert size={28} className="mb-2" />
            <span className="text-[10px] leading-relaxed font-mono">{error}</span>
          </div>
        ) : (
          !loadingCamera && (
            <div className="relative aspect-video rounded-2xl overflow-hidden bg-slate-950 border border-slate-800 mb-6">
              <video 
                ref={videoRef} 
                autoPlay 
                playsInline 
                muted
                className="w-full h-full object-cover scale-x-[-1]"
              />
              <div className="absolute inset-0 border-2 border-dashed border-cyan-500/20 rounded-2xl pointer-events-none flex items-center justify-center">
                <div className="w-[150px] h-[190px] border border-dashed border-cyan-400/40 rounded-[100px] bg-cyan-400/5"></div>
              </div>
            </div>
          )
        )}

        <div className="flex gap-4 justify-center">
          <button 
            type="button"
            onClick={onClose} 
            className="flex-1 py-3 bg-slate-800 hover:bg-slate-750 border border-slate-700 text-slate-300 font-bold rounded-xl text-xs uppercase"
          >
            Batal
          </button>
          {!error && !loadingCamera && (
            <button 
              type="button"
              onClick={handleCapture}
              className="flex-1 py-3 bg-cyan-500 hover:bg-cyan-400 text-slate-900 font-bold rounded-xl text-xs uppercase"
            >
              Ambil Foto
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
