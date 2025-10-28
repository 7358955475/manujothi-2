export enum UserRole {
  ADMIN = 'admin',
  USER = 'user'
}

export enum MediaLanguage {
  TAMIL = 'tamil',
  ENGLISH = 'english',
  TELUGU = 'telugu',
  HINDI = 'hindi'
}

export interface User {
  id: string;
  email: string;
  password_hash: string;
  first_name: string;
  last_name: string;
  role: UserRole;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface Book {
  id: string;
  title: string;
  author: string;
  description?: string;
  cover_image_url?: string;
  pdf_url?: string;
  language: MediaLanguage;
  genre?: string;
  published_year?: number;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
  created_by: string;
}

export interface Video {
  id: string;
  title: string;
  description?: string;
  youtube_url: string;
  youtube_id: string;
  thumbnail_url?: string;
  language: MediaLanguage;
  category?: string;
  duration?: number;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
  created_by: string;
}

export interface AudioBook {
  id: string;
  title: string;
  author: string;
  narrator?: string;
  description?: string;
  cover_image_url?: string;
  audio_file_path: string;
  language: MediaLanguage;
  genre?: string;
  duration?: number;
  file_size?: number;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
  created_by: string;
}

export interface AuthRequest extends Request {
  user?: User;
}

export interface JWTPayload {
  userId: string;
  email: string;
  role: UserRole;
}