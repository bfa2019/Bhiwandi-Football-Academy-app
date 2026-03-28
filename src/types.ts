export type UserRole = 'admin' | 'coach' | 'parent';

export interface UserProfile {
  uid: string;
  email: string;
  role: UserRole;
  name: string;
  childId?: string;
}

export interface Player {
  id: string;
  name: string;
  ageGroup: string;
  batch: string;
  parentId?: string;
}

export interface AttendanceRecord {
  id?: string;
  date: string;
  playerId: string;
  status: 'present' | 'absent';
  markedBy: string;
  timestamp: any;
}

export interface ExcelUpload {
  id: string;
  fileName: string;
  fileUrl: string;
  uploadedBy: string;
  timestamp: any;
}

export interface GalleryImage {
  id: string;
  imageUrl: string;
  caption?: string;
  uploadedBy: string;
  timestamp: any;
}

export interface TrainingSession {
  id: string;
  date: string;
  time: string;
  duration: string;
  drills: string;
  objectives: string;
  createdBy: string;
  timestamp: any;
}

export interface Batch {
  id: string;
  name: string;
  ageGroup: string;
  schedule?: string;
  createdAt: any;
}

export const AGE_GROUPS = [
  "Under 8",
  "Under 10",
  "Under 13",
  "Under 15",
  "Under 18",
  "Senior Men",
  "Senior Women"
];

export const BATCHES = [
  "Morning Batch",
  "Evening Batch",
  "Weekend Batch"
];
