export interface Employee {
  id: string;
  name: string;
  fingerprintId: number;
  position: string;
  facePhoto?: string; // Base64 registered facial profile photo
}

export interface Attendance {
  id: string;
  employeeId: string;
  employeeName: string;
  timestamp: any;
  type: 'in' | 'out';
  isMobile?: boolean; // Mark if done via mobile
  photoUrl?: string; // Captured live photo stored in Firebase
  verifiedByAI?: boolean;
  aiConfidence?: number;
}

export interface DeviceConfig {
  mode: 'idle' | 'enroll' | 'verify';
  enrollTargetId: number;
  message: string;
  lastActive?: any;
}

export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  status: 'pending' | 'approved' | 'rejected';
  role: 'admin' | 'user';
  employeeId?: string; // Linked employee ID
  createdAt?: any;
}

export interface OfficeConfig {
  latitude: number;
  longitude: number;
  radius: number; // in meters (default 5)
  locationName: string;
}
