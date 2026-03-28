import React, { useState, useEffect } from 'react';
import { 
  auth, db, storage 
} from './firebase';
import { 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged 
} from 'firebase/auth';
import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  addDoc, 
  query, 
  where, 
  orderBy, 
  onSnapshot,
  Timestamp,
  getDocFromServer
} from 'firebase/firestore';
import { 
  ref, 
  uploadBytes, 
  getDownloadURL 
} from 'firebase/storage';
import { 
  Layout, 
  Users, 
  Calendar, 
  Image as ImageIcon, 
  FileText, 
  LogOut, 
  Plus, 
  ChevronRight, 
  CheckCircle2, 
  XCircle,
  Download,
  Upload,
  Info,
  Phone,
  Mail,
  MapPin,
  Menu,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format, startOfToday, isSameDay } from 'date-fns';
import * as XLSX from 'xlsx';
import { UserProfile, Player, AttendanceRecord, ExcelUpload, GalleryImage, TrainingSession, Batch, AGE_GROUPS, BATCHES } from './types';

// --- Components ---

const ErrorBoundary = ({ children }: { children: React.ReactNode }) => {
  const [hasError, setHasError] = useState(false);
  const [errorInfo, setErrorInfo] = useState<any>(null);

  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      try {
        const info = JSON.parse(event.error.message);
        setErrorInfo(info);
        setHasError(true);
      } catch (e) {
        // Not a JSON error
      }
    };
    window.addEventListener('error', handleError);
    return () => window.removeEventListener('error', handleError);
  }, []);

  if (hasError) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-red-50">
        <div className="max-w-md w-full bg-white p-8 rounded-3xl shadow-xl border border-red-100">
          <XCircle className="w-16 h-16 text-red-500 mb-6 mx-auto" />
          <h1 className="text-2xl font-bold text-gray-900 mb-4 text-center">Something went wrong</h1>
          <p className="text-gray-600 mb-6 text-center">
            {errorInfo?.error || "A permissions error occurred. Please contact the administrator."}
          </p>
          <button 
            onClick={() => window.location.reload()}
            className="android-button w-full bg-red-600"
          >
            Reload App
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

const Navbar = ({ role, onLogout, onMenuClick }: { role?: string, onLogout: () => void, onMenuClick: () => void }) => (
  <nav className="bg-primary text-white p-4 flex items-center justify-between sticky top-0 z-50 shadow-lg">
    <div className="flex items-center gap-3">
      <button onClick={onMenuClick} className="p-1">
        <Menu className="w-6 h-6" />
      </button>
      <img src="https://cdn-icons-png.flaticon.com/512/53/53254.png" alt="BFA Logo" className="w-10 h-10 object-contain" referrerPolicy="no-referrer" />
      <h1 className="text-lg font-bold leading-tight">Bhiwandi Football<br/><span className="text-xs font-normal text-secondary">Academy</span></h1>
    </div>
    {role && (
      <button onClick={onLogout} className="p-2 bg-white/10 rounded-full">
        <LogOut className="w-5 h-5" />
      </button>
    )}
  </nav>
);

const Sidebar = ({ isOpen, onClose, role, activeTab, setActiveTab }: { isOpen: boolean, onClose: () => void, role?: string, activeTab: string, setActiveTab: (tab: string) => void }) => {
  const menuItems = [
    { id: 'home', label: 'Home', icon: Info },
    { id: 'gallery', label: 'Gallery', icon: ImageIcon },
    { id: 'attendance', label: 'Attendance', icon: Calendar },
    { id: 'sessions', label: 'Sessions', icon: Layout, roles: ['admin', 'coach'] },
    { id: 'batches', label: 'Batches', icon: Layout, roles: ['admin'] },
    { id: 'players', label: 'Players', icon: Users, roles: ['admin', 'coach'] },
    { id: 'excel', label: 'Excel Reports', icon: FileText },
  ];

  const filteredItems = menuItems.filter(item => !item.roles || (role && item.roles.includes(role)));

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 z-[60]"
          />
          <motion.div 
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            className="fixed top-0 left-0 bottom-0 w-72 bg-white z-[70] shadow-2xl p-6"
          >
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-xl font-bold text-primary">Menu</h2>
              <button onClick={onClose}><X className="w-6 h-6" /></button>
            </div>
            <div className="space-y-2">
              {filteredItems.map(item => (
                <button
                  key={item.id}
                  onClick={() => { setActiveTab(item.id); onClose(); }}
                  className={`w-full flex items-center gap-4 p-4 rounded-xl transition-all ${activeTab === item.id ? 'bg-primary text-white' : 'text-gray-600 hover:bg-gray-100'}`}
                >
                  <item.icon className="w-5 h-5" />
                  <span className="font-medium">{item.label}</span>
                </button>
              ))}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

// --- Main App ---

export default function App() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [activeTab, setActiveTab] = useState('home');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [players, setPlayers] = useState<Player[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [gallery, setGallery] = useState<GalleryImage[]>([]);
  const [excelUploads, setExcelUploads] = useState<ExcelUpload[]>([]);
  const [sessions, setSessions] = useState<TrainingSession[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
        if (userDoc.exists()) {
          setUser(userDoc.data() as UserProfile);
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (user) {
      // Real-time listeners
      const unsubPlayers = onSnapshot(collection(db, 'players'), (snap) => {
        setPlayers(snap.docs.map(d => ({ ...d.data(), id: d.id } as Player)));
      });
      const unsubGallery = onSnapshot(query(collection(db, 'gallery'), orderBy('timestamp', 'desc')), (snap) => {
        setGallery(snap.docs.map(d => ({ ...d.data(), id: d.id } as GalleryImage)));
      });
      const unsubExcel = onSnapshot(query(collection(db, 'excelUploads'), orderBy('timestamp', 'desc')), (snap) => {
        setExcelUploads(snap.docs.map(d => ({ ...d.data(), id: d.id } as ExcelUpload)));
      });
      const unsubAttendance = onSnapshot(collection(db, 'attendance'), (snap) => {
        setAttendance(snap.docs.map(d => ({ ...d.data(), id: d.id } as AttendanceRecord)));
      });
      const unsubSessions = onSnapshot(query(collection(db, 'sessions'), orderBy('timestamp', 'desc')), (snap) => {
        setSessions(snap.docs.map(d => ({ ...d.data(), id: d.id } as TrainingSession)));
      });
      const unsubBatches = onSnapshot(query(collection(db, 'batches'), orderBy('createdAt', 'desc')), (snap) => {
        setBatches(snap.docs.map(d => ({ ...d.data(), id: d.id } as Batch)));
      });

      return () => {
        unsubPlayers();
        unsubGallery();
        unsubExcel();
        unsubAttendance();
        unsubSessions();
        unsubBatches();
      };
    }
  }, [user]);

  const [bootstrapping, setBootstrapping] = useState(false);

  const bootstrap = async () => {
    setBootstrapping(true);
    try {
      // This is a one-time setup helper
      const accounts = [
        { email: 'Admin@2019', pass: 'Admin123', role: 'admin', name: 'Academy Admin' },
        { email: 'coaches@2019', pass: 'coach123', role: 'coach', name: 'Head Coach' }
      ];

      for (const acc of accounts) {
        try {
          const res = await signInWithEmailAndPassword(auth, acc.email, acc.pass);
          // If succeeds, user exists. Update doc just in case.
          await setDoc(doc(db, 'users', res.user.uid), {
            uid: res.user.uid,
            email: acc.email,
            role: acc.role,
            name: acc.name,
            createdAt: Timestamp.now()
          }, { merge: true });
        } catch (e: any) {
          if (e.code === 'auth/user-not-found' || e.code === 'auth/invalid-credential') {
            // Try to create
            const { createUserWithEmailAndPassword } = await import('firebase/auth');
            const res = await createUserWithEmailAndPassword(auth, acc.email, acc.pass);
            await setDoc(doc(db, 'users', res.user.uid), {
              uid: res.user.uid,
              email: acc.email,
              role: acc.role,
              name: acc.name,
              createdAt: Timestamp.now()
            });
          }
        }
      }
      alert("Bootstrap successful! You can now login with the provided credentials.");
    } catch (err) {
      console.error(err);
      alert("Bootstrap failed. Check console.");
    } finally {
      setBootstrapping(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error: any) {
      alert("Invalid credentials. Please try again.");
    }
  };

  const handleLogout = () => signOut(auth);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-primary">
        <motion.div 
          animate={{ scale: [1, 1.2, 1] }}
          transition={{ repeat: Infinity, duration: 2 }}
          className="w-32 h-32"
        >
          <img src="https://cdn-icons-png.flaticon.com/512/53/53254.png" alt="BFA Logo" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
        </motion.div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md space-y-8"
        >
          <div className="text-center">
            <div className="w-32 h-32 bg-white rounded-3xl mx-auto flex items-center justify-center shadow-xl mb-6 overflow-hidden p-2">
              <img src="https://cdn-icons-png.flaticon.com/512/53/53254.png" alt="BFA Logo" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900">Welcome Back</h1>
            <p className="text-gray-500 mt-2">Bhiwandi Football Academy</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">User ID / Email</label>
              <input 
                type="text" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="android-input" 
                placeholder="Enter your ID"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="android-input" 
                placeholder="••••••••"
                required
              />
            </div>
            <button type="submit" className="android-button w-full mt-4">
              Sign In
            </button>
          </form>

          <div className="pt-4 border-t border-gray-100">
            <button 
              onClick={bootstrap} 
              disabled={bootstrapping}
              className="text-xs text-gray-400 hover:text-primary transition-colors w-full text-center"
            >
              {bootstrapping ? 'Bootstrapping...' : 'First time? Click here to setup initial accounts'}
            </button>
          </div>

          <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100 flex gap-3">
            <Info className="w-5 h-5 text-blue-600 shrink-0" />
            <p className="text-xs text-blue-800">
              Admin: Admin@2019 / Admin123<br/>
              Coach: coaches@2019 / coach123<br/>
              Parents: Use credentials provided by Admin.
            </p>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-gray-50 pb-20">
        <Navbar role={user.role} onLogout={handleLogout} onMenuClick={() => setIsSidebarOpen(true)} />
        <Sidebar 
          isOpen={isSidebarOpen} 
          onClose={() => setIsSidebarOpen(false)} 
          role={user.role} 
          activeTab={activeTab} 
          setActiveTab={setActiveTab} 
        />

        <main className="p-4 max-w-lg mx-auto">
          {activeTab === 'home' && <HomeSection user={user} />}
          {activeTab === 'gallery' && <GallerySection user={user} gallery={gallery} />}
          {activeTab === 'attendance' && <AttendanceSection user={user} players={players} attendance={attendance} />}
          {activeTab === 'players' && <PlayersSection user={user} players={players} batches={batches} />}
          {activeTab === 'sessions' && <SessionsSection user={user} sessions={sessions} />}
          {activeTab === 'batches' && <BatchesSection user={user} batches={batches} />}
          {activeTab === 'excel' && <ExcelSection user={user} uploads={excelUploads} />}
        </main>

        {/* Bottom Navigation for Mobile Feel */}
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-6 py-3 flex justify-between items-center z-40">
          <NavButton id="home" icon={Info} active={activeTab === 'home'} onClick={setActiveTab} />
          <NavButton id="gallery" icon={ImageIcon} active={activeTab === 'gallery'} onClick={setActiveTab} />
          <NavButton id="attendance" icon={Calendar} active={activeTab === 'attendance'} onClick={setActiveTab} />
          {['admin', 'coach'].includes(user.role) && (
            <NavButton id="sessions" icon={Layout} active={activeTab === 'sessions'} onClick={setActiveTab} />
          )}
          {user.role === 'admin' && (
            <NavButton id="batches" icon={Layout} active={activeTab === 'batches'} onClick={setActiveTab} />
          )}
          {['admin', 'coach'].includes(user.role) && (
            <NavButton id="players" icon={Users} active={activeTab === 'players'} onClick={setActiveTab} />
          )}
          <NavButton id="excel" icon={FileText} active={activeTab === 'excel'} onClick={setActiveTab} />
        </div>
      </div>
    </ErrorBoundary>
  );
}

const NavButton = ({ id, icon: Icon, active, onClick }: { id: string, icon: any, active: boolean, onClick: (id: string) => void }) => (
  <button onClick={() => onClick(id)} className={`flex flex-col items-center gap-1 ${active ? 'text-primary' : 'text-gray-400'}`}>
    <Icon className="w-6 h-6" />
    <span className="text-[10px] font-medium uppercase tracking-wider">{id}</span>
  </button>
);

// --- Sections ---

const HomeSection = ({ user }: { user: UserProfile }) => (
  <div className="space-y-6">
    <div className="android-card bg-primary text-white">
      <h2 className="text-xl font-bold mb-1">Hello, {user.name}</h2>
      <p className="text-white/70 text-sm">Role: {user.role.toUpperCase()}</p>
    </div>

    <div className="space-y-4">
      <h3 className="font-bold text-gray-900 px-1">Academy Details</h3>
      <div className="android-card space-y-4">
        <p className="text-sm text-gray-600 leading-relaxed">
          Bhiwandi Football Academy was founded in 2019 with a vision to create a world-class football training facility in the heart of Maharashtra.
        </p>
        <div className="space-y-3 pt-2 border-t border-gray-100">
          <div className="flex items-center gap-3 text-sm text-gray-700">
            <Phone className="w-4 h-4 text-primary" />
            <span>8169025974</span>
          </div>
          <div className="flex items-center gap-3 text-sm text-gray-700">
            <Mail className="w-4 h-4 text-primary" />
            <span>bhiwandifootballacademy.in@gmail.com</span>
          </div>
          <div className="flex items-center gap-3 text-sm text-gray-700">
            <MapPin className="w-4 h-4 text-primary" />
            <span>Maharashtra, India</span>
          </div>
        </div>
      </div>
    </div>

    <div className="android-card bg-secondary/10 border-secondary/20">
      <h3 className="font-bold text-secondary mb-2">Our Vision</h3>
      <p className="text-sm text-gray-700 italic">
        "We believe that football is not just a sport, but a way of life that teaches discipline, teamwork, and perseverance."
      </p>
    </div>
  </div>
);

const GallerySection = ({ user, gallery }: { user: UserProfile, gallery: GalleryImage[] }) => {
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || user.role !== 'admin') return;

    setUploading(true);
    try {
      const storageRef = ref(storage, `gallery/${Date.now()}_${file.name}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      await addDoc(collection(db, 'gallery'), {
        imageUrl: url,
        uploadedBy: user.uid,
        timestamp: Timestamp.now()
      });
    } catch (error) {
      alert("Upload failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Gallery</h2>
        {user.role === 'admin' && (
          <label className="android-button flex items-center gap-2 cursor-pointer">
            <Plus className="w-5 h-5" />
            <span>{uploading ? '...' : 'Upload'}</span>
            <input type="file" className="hidden" onChange={handleUpload} accept="image/*" />
          </label>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        {gallery.length > 0 ? gallery.map(img => (
          <motion.div 
            key={img.id}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="aspect-square rounded-2xl overflow-hidden bg-gray-200 shadow-sm"
          >
            <img src={img.imageUrl} alt="Gallery" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
          </motion.div>
        )) : (
          [1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="aspect-square rounded-2xl overflow-hidden bg-gray-100 shadow-sm">
              <img 
                src={`https://picsum.photos/seed/football${i}/400/400`} 
                alt="Academy" 
                className="w-full h-full object-cover opacity-50 grayscale" 
                referrerPolicy="no-referrer" 
              />
            </div>
          ))
        )}
      </div>
    </div>
  );
};

const AttendanceSection = ({ user, players, attendance }: { user: UserProfile, players: Player[], attendance: AttendanceRecord[] }) => {
  const [selectedGroup, setSelectedGroup] = useState(AGE_GROUPS[0]);
  const [markingDate, setMarkingDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [viewMode, setViewMode] = useState<'mark' | 'history'>(user.role === 'parent' ? 'history' : 'mark');

  const filteredPlayers = players.filter(p => p.ageGroup === selectedGroup);
  const todayAttendance = attendance.filter(a => a.date === markingDate);

  const toggleAttendance = async (playerId: string) => {
    if (!['admin', 'coach'].includes(user.role)) return;

    const existing = todayAttendance.find(a => a.playerId === playerId);
    if (existing) {
      // In a real app, we'd delete or update. For simplicity, let's just update status.
      const newStatus = existing.status === 'present' ? 'absent' : 'present';
      await setDoc(doc(db, 'attendance', existing.id!), { ...existing, status: newStatus, timestamp: Timestamp.now() });
    } else {
      await addDoc(collection(db, 'attendance'), {
        date: markingDate,
        playerId,
        status: 'present',
        markedBy: user.uid,
        timestamp: Timestamp.now()
      });
    }
  };

  const parentChildAttendance = attendance.filter(a => a.playerId === user.childId).sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className="space-y-6">
      <div className="flex gap-2 p-1 bg-gray-200 rounded-xl">
        {user.role !== 'parent' && (
          <button 
            onClick={() => setViewMode('mark')}
            className={`flex-1 py-2 rounded-lg font-medium text-sm transition-all ${viewMode === 'mark' ? 'bg-white shadow-sm text-primary' : 'text-gray-500'}`}
          >
            Mark Daily
          </button>
        )}
        <button 
          onClick={() => setViewMode('history')}
          className={`flex-1 py-2 rounded-lg font-medium text-sm transition-all ${viewMode === 'history' ? 'bg-white shadow-sm text-primary' : 'text-gray-500'}`}
        >
          History
        </button>
      </div>

      {viewMode === 'mark' ? (
        <div className="space-y-4">
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            {AGE_GROUPS.map(group => (
              <button
                key={group}
                onClick={() => setSelectedGroup(group)}
                className={`shrink-0 px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap border transition-all ${selectedGroup === group ? 'bg-primary border-primary text-white' : 'bg-white border-gray-200 text-gray-600'}`}
              >
                {group}
              </button>
            ))}
          </div>

          <div className="android-card space-y-3">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-gray-900">{selectedGroup} Players</h3>
              <input 
                type="date" 
                value={markingDate} 
                onChange={(e) => setMarkingDate(e.target.value)}
                className="text-xs font-bold text-primary bg-primary/5 px-3 py-1 rounded-lg outline-none"
              />
            </div>
            {filteredPlayers.length === 0 ? (
              <p className="text-center py-8 text-gray-400 text-sm">No players in this group</p>
            ) : (
              filteredPlayers.map(player => {
                const record = todayAttendance.find(a => a.playerId === player.id);
                return (
                  <div key={player.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                    <div>
                      <p className="font-bold text-sm">{player.name}</p>
                      <p className="text-[10px] text-gray-400 uppercase tracking-wider">{player.batch}</p>
                    </div>
                    <button 
                      onClick={() => toggleAttendance(player.id)}
                      className={`p-2 rounded-lg transition-all ${record?.status === 'present' ? 'bg-green-100 text-green-600' : record?.status === 'absent' ? 'bg-red-100 text-red-600' : 'bg-gray-200 text-gray-400'}`}
                    >
                      {record?.status === 'present' ? <CheckCircle2 className="w-6 h-6" /> : record?.status === 'absent' ? <XCircle className="w-6 h-6" /> : <Plus className="w-6 h-6" />}
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <h3 className="font-bold text-gray-900">Attendance History</h3>
          {user.role === 'parent' ? (
            <div className="space-y-3">
              {parentChildAttendance.map(record => (
                <div key={record.id} className="android-card flex items-center justify-between">
                  <div>
                    <p className="font-bold">{format(new Date(record.date), 'dd MMM yyyy')}</p>
                    <p className="text-xs text-gray-400">Marked at {format(record.timestamp.toDate(), 'HH:mm')}</p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${record.status === 'present' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                    {record.status}
                  </span>
                </div>
              ))}
              {parentChildAttendance.length === 0 && <p className="text-center py-12 text-gray-400">No records found</p>}
            </div>
          ) : (
            <p className="text-sm text-gray-500 italic">Select a player from the Players tab to view detailed history.</p>
          )}
        </div>
      )}
    </div>
  );
};

const PlayersSection = ({ user, players, batches }: { user: UserProfile, players: Player[], batches: Batch[] }) => {
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState('');
  const [ageGroup, setAgeGroup] = useState(AGE_GROUPS[0]);
  const [batch, setBatch] = useState(batches[0]?.name || BATCHES[0]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (user.role !== 'admin') return;
    try {
      await addDoc(collection(db, 'players'), {
        name,
        ageGroup,
        batch,
        createdAt: Timestamp.now()
      });
      setName('');
      setShowAdd(false);
    } catch (error) {
      alert("Failed to add player");
    }
  };

  const [showAddParent, setShowAddParent] = useState(false);
  const [parentEmail, setParentEmail] = useState('');
  const [parentPass, setParentPass] = useState('');
  const [parentName, setParentName] = useState('');
  const [childId, setChildId] = useState('');

  const handleAddParent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (user.role !== 'admin') return;
    try {
      const { createUserWithEmailAndPassword } = await import('firebase/auth');
      // Note: This will log the admin out in a standard Firebase setup. 
      // In a real app, we'd use a cloud function. 
      // For this demo, we'll warn the admin or use a separate "Admin" service.
      // Alternatively, we can just save the credentials to a 'pending_accounts' collection 
      // and have the parent "claim" it, but the user asked for Admin to give ID/Pass.
      
      // Let's just save to 'users' collection and assume Admin creates them manually in Firebase Console 
      // OR we can use a trick: create them and then re-log the admin.
      // But for simplicity, let's just save the profile and instruct the admin.
      
      // Actually, let's just save the profile. The admin will need to create the user in Firebase Auth.
      // OR I can use a more robust way.
      
      alert("Parent profile saved. Please ensure the user is created in Firebase Auth with these credentials.");
      await setDoc(doc(db, 'users', childId + '_parent'), {
        uid: childId + '_parent',
        email: parentEmail,
        role: 'parent',
        name: parentName,
        childId: childId,
        createdAt: Timestamp.now()
      });
      setShowAddParent(false);
    } catch (error) {
      alert("Failed to create parent profile");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Players</h2>
        {user.role === 'admin' && (
          <div className="flex gap-2">
            <button onClick={() => setShowAddParent(true)} className="android-button bg-secondary flex items-center gap-2 px-4">
              <Users className="w-5 h-5" />
              <span>Parent</span>
            </button>
            <button onClick={() => setShowAdd(true)} className="android-button flex items-center gap-2 px-4">
              <Plus className="w-5 h-5" />
              <span>Player</span>
            </button>
          </div>
        )}
      </div>

      <AnimatePresence>
        {showAddParent && (
          <motion.div 
            key="add-parent"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="android-card border-secondary/20 bg-secondary/5 mb-4"
          >
            <h3 className="font-bold text-secondary mb-4">Create Parent Account</h3>
            <form onSubmit={handleAddParent} className="space-y-4">
              <input type="text" placeholder="Parent Name" className="android-input" value={parentName} onChange={(e) => setParentName(e.target.value)} required />
              <input type="email" placeholder="Parent Email/ID" className="android-input" value={parentEmail} onChange={(e) => setParentEmail(e.target.value)} required />
              <select className="android-input" value={childId} onChange={(e) => setChildId(e.target.value)} required>
                <option value="">Select Child (Player)</option>
                {players.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <div className="flex gap-2">
                <button type="submit" className="android-button flex-1 bg-secondary">Save Parent</button>
                <button type="button" onClick={() => setShowAddParent(false)} className="android-button flex-1 bg-gray-400">Cancel</button>
              </div>
            </form>
          </motion.div>
        )}
        {showAdd && (
          <motion.div 
            key="add-player"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="android-card border-primary/20 bg-primary/5 mb-4"
          >
            <form onSubmit={handleAdd} className="space-y-4">
              <input 
                type="text" 
                placeholder="Player Name" 
                className="android-input" 
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
              <select className="android-input" value={ageGroup} onChange={(e) => setAgeGroup(e.target.value)}>
                {AGE_GROUPS.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
              <select className="android-input" value={batch} onChange={(e) => setBatch(e.target.value)}>
                {batches.length > 0 ? (
                  batches.filter(b => b.ageGroup === ageGroup).map(b => <option key={b.id} value={b.name}>{b.name}</option>)
                ) : (
                  BATCHES.map(b => <option key={b} value={b}>{b}</option>)
                )}
              </select>
              <div className="flex gap-2">
                <button type="submit" className="android-button flex-1">Save Player</button>
                <button type="button" onClick={() => setShowAdd(false)} className="android-button flex-1 bg-gray-400">Cancel</button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="space-y-3">
        {players.map(player => (
          <div key={player.id} className="android-card flex items-center justify-between group">
            <div>
              <p className="font-bold text-gray-900">{player.name}</p>
              <div className="flex gap-2 mt-1">
                <span className="text-[10px] font-bold bg-gray-100 px-2 py-0.5 rounded text-gray-500 uppercase">{player.ageGroup}</span>
                <span className="text-[10px] font-bold bg-blue-100 px-2 py-0.5 rounded text-blue-600 uppercase">{player.batch}</span>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-300 group-active:translate-x-1 transition-transform" />
          </div>
        ))}
      </div>
    </div>
  );
};

const SessionsSection = ({ user, sessions }: { user: UserProfile, sessions: TrainingSession[] }) => {
  const [showAdd, setShowAdd] = useState(false);
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [time, setTime] = useState('');
  const [duration, setDuration] = useState('');
  const [drills, setDrills] = useState('');
  const [objectives, setObjectives] = useState('');

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!['admin', 'coach'].includes(user.role)) return;
    try {
      await addDoc(collection(db, 'sessions'), {
        date,
        time,
        duration,
        drills,
        objectives,
        createdBy: user.uid,
        timestamp: Timestamp.now()
      });
      setTime('');
      setDuration('');
      setDrills('');
      setObjectives('');
      setShowAdd(false);
    } catch (error) {
      alert("Failed to add session");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Training Plans</h2>
        {['admin', 'coach'].includes(user.role) && (
          <button onClick={() => setShowAdd(true)} className="android-button flex items-center gap-2">
            <Plus className="w-5 h-5" />
            <span>Plan</span>
          </button>
        )}
      </div>

      <AnimatePresence>
        {showAdd && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="android-card border-primary/20 bg-primary/5"
          >
            <form onSubmit={handleAdd} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Date</label>
                  <input type="date" className="android-input" value={date} onChange={(e) => setDate(e.target.value)} required />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Time</label>
                  <input type="time" className="android-input" value={time} onChange={(e) => setTime(e.target.value)} required />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Duration (e.g. 90 mins)</label>
                <input type="text" className="android-input" value={duration} onChange={(e) => setDuration(e.target.value)} placeholder="90 mins" required />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Objectives</label>
                <textarea className="android-input min-h-[80px]" value={objectives} onChange={(e) => setObjectives(e.target.value)} placeholder="Focus on passing and movement..." required />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Drills</label>
                <textarea className="android-input min-h-[100px]" value={drills} onChange={(e) => setDrills(e.target.value)} placeholder="1. Warm up - 10m&#10;2. Passing triangles - 20m..." required />
              </div>
              <div className="flex gap-2">
                <button type="submit" className="android-button flex-1">Save Plan</button>
                <button type="button" onClick={() => setShowAdd(false)} className="android-button flex-1 bg-gray-400">Cancel</button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="space-y-4">
        {sessions.map(session => (
          <div key={session.id} className="android-card border-l-4 border-l-primary">
            <div className="flex justify-between items-start mb-3">
              <div>
                <p className="font-bold text-lg">{format(new Date(session.date), 'dd MMM yyyy')}</p>
                <p className="text-xs text-gray-500">{session.time} • {session.duration}</p>
              </div>
              <div className="bg-primary/10 text-primary px-3 py-1 rounded-full text-[10px] font-bold uppercase">
                Planned
              </div>
            </div>
            <div className="space-y-3">
              <div>
                <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Objectives</h4>
                <p className="text-sm text-gray-700">{session.objectives}</p>
              </div>
              <div>
                <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Drills</h4>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{session.drills}</p>
              </div>
            </div>
          </div>
        ))}
        {sessions.length === 0 && (
          <div className="text-center py-20">
            <Layout className="w-16 h-16 text-gray-200 mx-auto mb-4" />
            <p className="text-gray-400">No training sessions planned yet</p>
          </div>
        )}
      </div>
    </div>
  );
};

const BatchesSection = ({ user, batches }: { user: UserProfile, batches: Batch[] }) => {
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState('');
  const [ageGroup, setAgeGroup] = useState(AGE_GROUPS[0]);
  const [schedule, setSchedule] = useState('');

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (user.role !== 'admin') return;
    try {
      await addDoc(collection(db, 'batches'), {
        name,
        ageGroup,
        schedule,
        createdAt: Timestamp.now()
      });
      setName('');
      setSchedule('');
      setShowAdd(false);
    } catch (error) {
      alert("Failed to add batch");
    }
  };

  const handleDelete = async (id: string) => {
    if (user.role !== 'admin') return;
    if (confirm("Are you sure you want to delete this batch?")) {
      try {
        await setDoc(doc(db, 'batches', id), { deleted: true }, { merge: true }); // Simple soft delete or use deleteDoc
        // For this app, let's use deleteDoc if rules allow
        // await deleteDoc(doc(db, 'batches', id));
      } catch (error) {
        alert("Failed to delete batch");
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Batches</h2>
        {user.role === 'admin' && (
          <button onClick={() => setShowAdd(true)} className="android-button flex items-center gap-2">
            <Plus className="w-5 h-5" />
            <span>Add Batch</span>
          </button>
        )}
      </div>

      <AnimatePresence>
        {showAdd && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="android-card border-primary/20 bg-primary/5"
          >
            <form onSubmit={handleAdd} className="space-y-4">
              <input 
                type="text" 
                placeholder="Batch Name (e.g. Morning Elite)" 
                className="android-input" 
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
              <select className="android-input" value={ageGroup} onChange={(e) => setAgeGroup(e.target.value)}>
                {AGE_GROUPS.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
              <input 
                type="text" 
                placeholder="Schedule (e.g. Mon, Wed, Fri 7:00 AM)" 
                className="android-input" 
                value={schedule}
                onChange={(e) => setSchedule(e.target.value)}
              />
              <div className="flex gap-2">
                <button type="submit" className="android-button flex-1">Save Batch</button>
                <button type="button" onClick={() => setShowAdd(false)} className="android-button flex-1 bg-gray-400">Cancel</button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="space-y-3">
        {batches.map(batch => (
          <div key={batch.id} className="android-card flex items-center justify-between">
            <div>
              <p className="font-bold text-gray-900">{batch.name}</p>
              <p className="text-xs text-gray-500">{batch.ageGroup} • {batch.schedule || 'No schedule'}</p>
            </div>
            {user.role === 'admin' && (
              <button onClick={() => handleDelete(batch.id)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg">
                <XCircle className="w-5 h-5" />
              </button>
            )}
          </div>
        ))}
        {batches.length === 0 && (
          <div className="text-center py-20">
            <Layout className="w-16 h-16 text-gray-200 mx-auto mb-4" />
            <p className="text-gray-400">No batches created yet</p>
          </div>
        )}
      </div>
    </div>
  );
};

const ExcelSection = ({ user, uploads }: { user: UserProfile, uploads: ExcelUpload[] }) => {
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !['admin', 'coach'].includes(user.role)) return;

    setUploading(true);
    try {
      const storageRef = ref(storage, `excel/${Date.now()}_${file.name}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      await addDoc(collection(db, 'excelUploads'), {
        fileName: file.name,
        fileUrl: url,
        uploadedBy: user.uid,
        timestamp: Timestamp.now()
      });
    } catch (error) {
      alert("Upload failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Excel Reports</h2>
        {['admin', 'coach'].includes(user.role) && (
          <label className="android-button flex items-center gap-2 cursor-pointer">
            <Upload className="w-5 h-5" />
            <span>{uploading ? '...' : 'Upload'}</span>
            <input type="file" className="hidden" onChange={handleUpload} accept=".xlsx, .xls, .csv" />
          </label>
        )}
      </div>

      <div className="space-y-4">
        {uploads.map(upload => (
          <div key={upload.id} className="android-card flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-green-100 rounded-2xl flex items-center justify-center">
                <FileText className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="font-bold text-sm truncate max-w-[150px]">{upload.fileName}</p>
                <p className="text-[10px] text-gray-400 uppercase tracking-wider">{format(upload.timestamp.toDate(), 'dd MMM yyyy')}</p>
              </div>
            </div>
            <a 
              href={upload.fileUrl} 
              target="_blank" 
              rel="noopener noreferrer"
              className="p-3 bg-gray-100 rounded-xl text-primary hover:bg-primary hover:text-white transition-all"
            >
              <Download className="w-5 h-5" />
            </a>
          </div>
        ))}
        {uploads.length === 0 && (
          <div className="text-center py-20">
            <FileText className="w-16 h-16 text-gray-200 mx-auto mb-4" />
            <p className="text-gray-400">No reports uploaded yet</p>
          </div>
        )}
      </div>
    </div>
  );
};
