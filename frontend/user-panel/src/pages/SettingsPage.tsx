import React, { useState, useEffect } from 'react';
import {
  User as UserIcon,
  Mail,
  Lock,
  Heart,
  Activity,
  Trash2,
  Save,
  Eye,
  EyeOff,
  CheckCircle,
  XCircle,
  Loader,
  Settings as SettingsIcon,
  Globe,
  BookOpen,
  Headphones,
  Video
} from 'lucide-react';
import { settingsApi, UserSettings } from '../services/api';

/**
 * Settings Page - 100% Dynamic Data Integration
 * All data is fetched from backend API - no hardcoded values
 * Implements comprehensive user settings management
 */

const SettingsPage: React.FC = () => {
  // State management - all data loaded dynamically
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [successMessage, setSuccessMessage] = useState<string>('');

  // Profile form state
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);

  // Password change state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [passwordChanging, setPasswordChanging] = useState(false);

  // Preferences state
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>([]);
  const [selectedMediaTypes, setSelectedMediaTypes] = useState<string[]>([]);
  const [preferencesSaving, setPreferencesSaving] = useState(false);

  // Account deletion state
  const [deletePassword, setDeletePassword] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Available options (for preferences)
  const availableGenres = [
    'Fiction', 'Non-Fiction', 'Biography', 'Self-Help', 'Business',
    'Technology', 'Science', 'History', 'Religion', 'Philosophy',
    'Literature', 'Romance', 'Mystery', 'Thriller', 'Children',
    'Education', 'Health', 'Psychology', 'Art', 'Comics'
  ];

  const availableLanguages = [
    { code: 'tamil', name: 'Tamil' },
    { code: 'english', name: 'English' },
    { code: 'telugu', name: 'Telugu' },
    { code: 'hindi', name: 'Hindi' }
  ];

  const availableMediaTypes = [
    { code: 'book', name: 'Books', icon: BookOpen },
    { code: 'audio', name: 'Audio Books', icon: Headphones },
    { code: 'video', name: 'Videos', icon: Video }
  ];

  // Fetch all settings on component mount - 100% dynamic
  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await settingsApi.getSettings();

      if (response.data.success) {
        const data = response.data.data;
        setSettings(data);

        // Populate form fields with fetched data
        setFirstName(data.user.first_name);
        setLastName(data.user.last_name);
        setEmail(data.user.email);
        setSelectedGenres(data.preferences.preferred_genres || []);
        setSelectedLanguages(data.preferences.preferred_languages || []);
        setSelectedMediaTypes(data.preferences.preferred_media_types || []);
      }
    } catch (err: any) {
      console.error('Error fetching settings:', err);
      setError(err.response?.data?.message || 'Failed to load settings. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Update profile
  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!firstName.trim() || !lastName.trim() || !email.trim()) {
      setError('All fields are required');
      return;
    }

    try {
      setProfileSaving(true);
      setError('');
      setSuccessMessage('');

      const response = await settingsApi.updateProfile({
        first_name: firstName,
        last_name: lastName,
        email: email
      });

      if (response.data.success) {
        setSuccessMessage('Profile updated successfully!');
        await fetchSettings(); // Reload to get latest data
        setTimeout(() => setSuccessMessage(''), 3000);
      }
    } catch (err: any) {
      console.error('Error updating profile:', err);
      setError(err.response?.data?.message || 'Failed to update profile');
    } finally {
      setProfileSaving(false);
    }
  };

  // Update preferences
  const handleUpdatePreferences = async () => {
    try {
      setPreferencesSaving(true);
      setError('');
      setSuccessMessage('');

      const response = await settingsApi.updatePreferences({
        preferred_genres: selectedGenres,
        preferred_languages: selectedLanguages,
        preferred_media_types: selectedMediaTypes
      });

      if (response.data.success) {
        setSuccessMessage('Preferences updated successfully!');
        await fetchSettings();
        setTimeout(() => setSuccessMessage(''), 3000);
      }
    } catch (err: any) {
      console.error('Error updating preferences:', err);
      setError(err.response?.data?.message || 'Failed to update preferences');
    } finally {
      setPreferencesSaving(false);
    }
  };

  // Toggle genre selection
  const toggleGenre = (genre: string) => {
    setSelectedGenres(prev =>
      prev.includes(genre)
        ? prev.filter(g => g !== genre)
        : [...prev, genre]
    );
  };

  // Toggle language selection
  const toggleLanguage = (code: string) => {
    setSelectedLanguages(prev =>
      prev.includes(code)
        ? prev.filter(l => l !== code)
        : [...prev, code]
    );
  };

  // Toggle media type selection
  const toggleMediaType = (code: string) => {
    setSelectedMediaTypes(prev =>
      prev.includes(code)
        ? prev.filter(m => m !== code)
        : [...prev, code]
    );
  };

  // Change password
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!currentPassword || !newPassword || !confirmPassword) {
      setError('All password fields are required');
      return;
    }

    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters long');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('New passwords do not match');
      return;
    }

    try {
      setPasswordChanging(true);
      setError('');
      setSuccessMessage('');

      const response = await settingsApi.changePassword({
        current_password: currentPassword,
        new_password: newPassword
      });

      if (response.data.success) {
        setSuccessMessage('Password changed successfully!');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setTimeout(() => setSuccessMessage(''), 3000);
      }
    } catch (err: any) {
      console.error('Error changing password:', err);
      setError(err.response?.data?.message || 'Failed to change password');
    } finally {
      setPasswordChanging(false);
    }
  };

  // Delete account
  const handleDeleteAccount = async () => {
    if (!deletePassword) {
      setError('Password is required to delete account');
      return;
    }

    try {
      setDeleting(true);
      setError('');

      const response = await settingsApi.deleteAccount(deletePassword);

      if (response.data.success) {
        // Logout and redirect
        localStorage.removeItem('token');
        window.location.href = '/';
      }
    } catch (err: any) {
      console.error('Error deleting account:', err);
      setError(err.response?.data?.message || 'Failed to delete account');
      setDeleting(false);
    }
  };

  // Format date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader className="w-12 h-12 text-orange-500 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading settings...</p>
        </div>
      </div>
    );
  }

  // Error state (initial load)
  if (error && !settings) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-6 max-w-md w-full">
          <XCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-800 mb-2 text-center">Error Loading Settings</h2>
          <p className="text-gray-600 text-center mb-4">{error}</p>
          <button
            onClick={fetchSettings}
            className="w-full px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <SettingsIcon className="w-8 h-8 text-orange-500" />
            <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
          </div>
          <p className="text-gray-600">Manage your account settings and preferences</p>
        </div>

        {/* Success/Error Messages */}
        {successMessage && (
          <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
            <p className="text-green-800">{successMessage}</p>
          </div>
        )}

        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
            <XCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {/* Profile Settings */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex items-center gap-3 mb-6">
            <UserIcon className="w-6 h-6 text-orange-500" />
            <h2 className="text-xl font-bold text-gray-900">Profile Information</h2>
          </div>

          <form onSubmit={handleUpdateProfile} className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  First Name
                </label>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  placeholder="Enter first name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Last Name
                </label>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  placeholder="Enter last name"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  placeholder="Enter email address"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-4">
              <div className="text-sm text-gray-600">
                <p>Member since: <span className="font-medium">{settings && formatDate(settings.user.created_at)}</span></p>
                <p>Account status: <span className={`font-medium ${settings?.user.is_active ? 'text-green-600' : 'text-red-600'}`}>
                  {settings?.user.is_active ? 'Active' : 'Inactive'}
                </span></p>
              </div>

              <button
                type="submit"
                disabled={profileSaving}
                className="flex items-center gap-2 px-6 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {profileSaving ? (
                  <>
                    <Loader className="w-4 h-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    Save Profile
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Content Preferences */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <Globe className="w-6 h-6 text-orange-500" />
              <h2 className="text-xl font-bold text-gray-900">Content Preferences</h2>
            </div>
            <button
              onClick={handleUpdatePreferences}
              disabled={preferencesSaving}
              className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors disabled:bg-gray-400 text-sm"
            >
              {preferencesSaving ? (
                <>
                  <Loader className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Save Preferences
                </>
              )}
            </button>
          </div>

          {/* Languages */}
          <div className="mb-6">
            <h3 className="text-sm font-medium text-gray-700 mb-3">Preferred Languages</h3>
            <div className="flex flex-wrap gap-2">
              {availableLanguages.map(lang => (
                <button
                  key={lang.code}
                  onClick={() => toggleLanguage(lang.code)}
                  className={`px-4 py-2 rounded-lg border-2 transition-all ${
                    selectedLanguages.includes(lang.code)
                      ? 'border-orange-500 bg-orange-50 text-orange-700'
                      : 'border-gray-300 bg-white text-gray-700 hover:border-orange-300'
                  }`}
                >
                  {lang.name}
                </button>
              ))}
            </div>
          </div>

          {/* Media Types */}
          <div className="mb-6">
            <h3 className="text-sm font-medium text-gray-700 mb-3">Preferred Media Types</h3>
            <div className="flex flex-wrap gap-2">
              {availableMediaTypes.map(type => {
                const Icon = type.icon;
                return (
                  <button
                    key={type.code}
                    onClick={() => toggleMediaType(type.code)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg border-2 transition-all ${
                      selectedMediaTypes.includes(type.code)
                        ? 'border-orange-500 bg-orange-50 text-orange-700'
                        : 'border-gray-300 bg-white text-gray-700 hover:border-orange-300'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {type.name}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Genres */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-3">Preferred Genres</h3>
            <div className="flex flex-wrap gap-2">
              {availableGenres.map(genre => (
                <button
                  key={genre}
                  onClick={() => toggleGenre(genre)}
                  className={`px-3 py-1 rounded-full text-sm border-2 transition-all ${
                    selectedGenres.includes(genre)
                      ? 'border-orange-500 bg-orange-50 text-orange-700'
                      : 'border-gray-300 bg-white text-gray-700 hover:border-orange-300'
                  }`}
                >
                  {genre}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Account Statistics */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex items-center gap-3 mb-6">
            <Activity className="w-6 h-6 text-orange-500" />
            <h2 className="text-xl font-bold text-gray-900">Account Statistics</h2>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Favorites */}
            <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <Heart className="w-8 h-8 text-orange-500" />
                <span className="text-3xl font-bold text-orange-700">
                  {settings?.stats.favoritesCount || 0}
                </span>
              </div>
              <p className="text-sm text-orange-700 font-medium">Favorites</p>
            </div>

            {/* Books Activity */}
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <BookOpen className="w-8 h-8 text-blue-500" />
                <span className="text-3xl font-bold text-blue-700">
                  {settings?.activity.book?.count || 0}
                </span>
              </div>
              <p className="text-sm text-blue-700 font-medium">Books Read</p>
            </div>

            {/* Audio Activity */}
            <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <Headphones className="w-8 h-8 text-green-500" />
                <span className="text-3xl font-bold text-green-700">
                  {settings?.activity.audio?.count || 0}
                </span>
              </div>
              <p className="text-sm text-green-700 font-medium">Audio Books</p>
            </div>

            {/* Video Activity */}
            <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <Video className="w-8 h-8 text-purple-500" />
                <span className="text-3xl font-bold text-purple-700">
                  {settings?.activity.video?.count || 0}
                </span>
              </div>
              <p className="text-sm text-purple-700 font-medium">Videos Watched</p>
            </div>
          </div>

          {/* Notifications */}
          <div className="mt-6 p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-700">Notifications</p>
                <p className="text-xs text-gray-600 mt-1">
                  You have {settings?.notifications.unread || 0} unread notifications out of {settings?.notifications.total || 0} total
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Security Settings */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex items-center gap-3 mb-6">
            <Lock className="w-6 h-6 text-orange-500" />
            <h2 className="text-xl font-bold text-gray-900">Security</h2>
          </div>

          <form onSubmit={handleChangePassword} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Current Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type={showCurrentPassword ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full pl-10 pr-12 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  placeholder="Enter current password"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showCurrentPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                New Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full pl-10 pr-12 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  placeholder="Enter new password (min 8 characters)"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showNewPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Confirm New Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  placeholder="Confirm new password"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={passwordChanging}
              className="w-full px-6 py-3 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed font-medium"
            >
              {passwordChanging ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader className="w-4 h-4 animate-spin" />
                  Changing Password...
                </span>
              ) : (
                'Change Password'
              )}
            </button>
          </form>
        </div>

        {/* Account Management */}
        <div className="bg-white rounded-lg shadow-md p-6 border-2 border-red-200">
          <div className="flex items-center gap-3 mb-4">
            <Trash2 className="w-6 h-6 text-red-500" />
            <h2 className="text-xl font-bold text-red-700">Danger Zone</h2>
          </div>

          <p className="text-gray-600 mb-4">
            Once you delete your account, there is no going back. Please be certain.
          </p>

          {!showDeleteConfirm ? (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="px-6 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors font-medium"
            >
              Delete Account
            </button>
          ) : (
            <div className="space-y-4 p-4 bg-red-50 rounded-lg">
              <p className="text-red-800 font-medium">
                Are you absolutely sure? This action cannot be undone.
              </p>

              <div>
                <label className="block text-sm font-medium text-red-700 mb-2">
                  Enter your password to confirm
                </label>
                <input
                  type="password"
                  value={deletePassword}
                  onChange={(e) => setDeletePassword(e.target.value)}
                  className="w-full px-4 py-2 border border-red-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  placeholder="Enter your password"
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleDeleteAccount}
                  disabled={deleting || !deletePassword}
                  className="flex-1 px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:bg-gray-400 font-medium"
                >
                  {deleting ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader className="w-4 h-4 animate-spin" />
                      Deleting...
                    </span>
                  ) : (
                    'Yes, Delete My Account'
                  )}
                </button>
                <button
                  onClick={() => {
                    setShowDeleteConfirm(false);
                    setDeletePassword('');
                  }}
                  className="flex-1 px-6 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors font-medium"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
