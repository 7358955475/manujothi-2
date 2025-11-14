/**
 * ADMIN PANEL INTEGRATION EXAMPLE
 *
 * This file shows how to integrate ImagePreview and FocalPointSelector
 * into your existing Books.tsx, AudioBooks.tsx, or Videos.tsx admin pages.
 *
 * Copy the relevant parts to your actual admin panel components.
 */

import React, { useState, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { Plus, Upload, Eye, Target } from 'lucide-react';
import { booksApi } from '../services/api';
import ImagePreview from '../components/ImagePreview';
import FocalPointSelector from '../components/FocalPointSelector';

const BooksWithImageFeatures: React.FC = () => {
  const [showModal, setShowModal] = useState(false);
  const [selectedCoverFile, setSelectedCoverFile] = useState<File | null>(null);
  const [coverPreviewUrl, setCoverPreviewUrl] = useState<string>('');
  const [focalPoint, setFocalPoint] = useState<{ x: number; y: number } | null>(null);

  // New state for preview components
  const [showImagePreview, setShowImagePreview] = useState(false);
  const [showFocalPointSelector, setShowFocalPointSelector] = useState(false);

  const coverFileRef = useRef<HTMLInputElement>(null);
  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm();

  /**
   * STEP 1: Handle Cover Image Selection
   * Creates preview URL and optionally shows preview modal
   */
  const handleCoverChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      alert('Please upload a JPEG, PNG, or WebP image');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      alert('Image must be less than 10MB');
      return;
    }

    setSelectedCoverFile(file);

    // Create preview URL
    const previewUrl = URL.createObjectURL(file);
    setCoverPreviewUrl(previewUrl);

    // Optionally auto-show preview
    // setShowImagePreview(true);
  };

  /**
   * STEP 2: Submit Form with Focal Point
   * Includes focal point data in upload
   */
  const handleCreateBook = async (data: any) => {
    try {
      const formData = new FormData();

      // Add basic fields
      formData.append('title', data.title);
      formData.append('author', data.author);
      formData.append('language', data.language);
      formData.append('description', data.description);

      // Add files
      if (selectedCoverFile) {
        formData.append('cover', selectedCoverFile);
      }
      if (data.pdfFile) {
        formData.append('pdf', data.pdfFile[0]);
      }

      // IMPORTANT: Add focal point if set
      if (focalPoint) {
        formData.append('focalPoint', JSON.stringify(focalPoint));
      }

      // Submit
      const response = await booksApi.create(formData, {
        onUploadProgress: (progressEvent) => {
          const progress = Math.round(
            (progressEvent.loaded * 100) / (progressEvent.total || 100)
          );
          console.log('Upload progress:', progress);
        }
      });

      console.log('Book created:', response.data);

      // Reset form
      setShowModal(false);
      setSelectedCoverFile(null);
      setCoverPreviewUrl('');
      setFocalPoint(null);

      // Refresh books list
      // fetchBooks();

    } catch (error) {
      console.error('Error creating book:', error);
      alert('Failed to create book');
    }
  };

  /**
   * STEP 3: Handle Focal Point Change
   * Called when user finishes selecting focal point
   */
  const handleFocalPointChange = (newFocalPoint: { x: number; y: number } | null) => {
    setFocalPoint(newFocalPoint);
    console.log('Focal point updated:', newFocalPoint);
  };

  return (
    <div className="p-6">
      {/* Header with Add Button */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Books</h1>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600"
        >
          <Plus size={20} />
          Add Book
        </button>
      </div>

      {/* Upload Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-40 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h2 className="text-2xl font-bold mb-4">Add New Book</h2>

              <form onSubmit={handleSubmit(handleCreateBook)}>
                {/* Title Field */}
                <div className="mb-4">
                  <label className="block text-sm font-medium mb-2">Title *</label>
                  <input
                    {...register('title', { required: true })}
                    className="w-full px-3 py-2 border rounded-lg"
                    placeholder="Enter book title"
                  />
                  {errors.title && (
                    <p className="text-red-500 text-sm mt-1">Title is required</p>
                  )}
                </div>

                {/* Author Field */}
                <div className="mb-4">
                  <label className="block text-sm font-medium mb-2">Author *</label>
                  <input
                    {...register('author', { required: true })}
                    className="w-full px-3 py-2 border rounded-lg"
                    placeholder="Enter author name"
                  />
                </div>

                {/* Language Field */}
                <div className="mb-4">
                  <label className="block text-sm font-medium mb-2">Language *</label>
                  <select
                    {...register('language', { required: true })}
                    className="w-full px-3 py-2 border rounded-lg"
                  >
                    <option value="">Select language</option>
                    <option value="tamil">Tamil</option>
                    <option value="english">English</option>
                    <option value="telugu">Telugu</option>
                    <option value="hindi">Hindi</option>
                  </select>
                </div>

                {/* Cover Image Upload with NEW FEATURES */}
                <div className="mb-4">
                  <label className="block text-sm font-medium mb-2">
                    Cover Image * (3:4 Portrait)
                  </label>

                  <div className="flex gap-2">
                    {/* File Input */}
                    <input
                      ref={coverFileRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={handleCoverChange}
                      className="hidden"
                    />

                    {/* Upload Button */}
                    <button
                      type="button"
                      onClick={() => coverFileRef.current?.click()}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                    >
                      <Upload size={18} />
                      Choose Cover
                    </button>

                    {/* FEATURE 1: WYSIWYG Preview Button */}
                    {coverPreviewUrl && (
                      <button
                        type="button"
                        onClick={() => setShowImagePreview(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600"
                      >
                        <Eye size={18} />
                        Preview
                      </button>
                    )}

                    {/* FEATURE 2: Focal Point Selector Button */}
                    {coverPreviewUrl && (
                      <button
                        type="button"
                        onClick={() => setShowFocalPointSelector(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600"
                      >
                        <Target size={18} />
                        Set Focal Point
                      </button>
                    )}
                  </div>

                  {/* Show selected file name */}
                  {selectedCoverFile && (
                    <div className="mt-2 p-3 bg-gray-50 rounded-lg">
                      <p className="text-sm text-gray-700">
                        Selected: {selectedCoverFile.name}
                      </p>
                      <p className="text-xs text-gray-500">
                        Size: {(selectedCoverFile.size / 1024).toFixed(2)} KB
                      </p>
                    </div>
                  )}

                  {/* Show focal point status */}
                  {focalPoint && (
                    <div className="mt-2 p-3 bg-purple-50 border border-purple-200 rounded-lg">
                      <p className="text-sm text-purple-800 font-medium">
                        ✓ Focal point set: X: {(focalPoint.x * 100).toFixed(0)}%,
                        Y: {(focalPoint.y * 100).toFixed(0)}%
                      </p>
                      <button
                        type="button"
                        onClick={() => setFocalPoint(null)}
                        className="text-xs text-purple-600 underline mt-1"
                      >
                        Clear focal point
                      </button>
                    </div>
                  )}

                  {/* Preview thumbnail */}
                  {coverPreviewUrl && (
                    <div className="mt-3">
                      <p className="text-sm text-gray-600 mb-2">Current selection:</p>
                      <div className="w-32 h-42 rounded-lg overflow-hidden border-2 border-gray-300">
                        <img
                          src={coverPreviewUrl}
                          alt="Cover preview"
                          className="w-full h-full object-cover"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* PDF Upload (existing) */}
                <div className="mb-4">
                  <label className="block text-sm font-medium mb-2">PDF File *</label>
                  <input
                    {...register('pdfFile', { required: true })}
                    type="file"
                    accept=".pdf"
                    className="w-full"
                  />
                </div>

                {/* Description */}
                <div className="mb-4">
                  <label className="block text-sm font-medium mb-2">Description</label>
                  <textarea
                    {...register('description')}
                    className="w-full px-3 py-2 border rounded-lg"
                    rows={4}
                    placeholder="Enter book description"
                  />
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3 justify-end mt-6">
                  <button
                    type="button"
                    onClick={() => {
                      setShowModal(false);
                      setSelectedCoverFile(null);
                      setCoverPreviewUrl('');
                      setFocalPoint(null);
                    }}
                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 font-medium"
                  >
                    Create Book
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* FEATURE 1: WYSIWYG Image Preview Modal */}
      {showImagePreview && coverPreviewUrl && (
        <ImagePreview
          imageUrl={coverPreviewUrl}
          mediaType="book"
          title={watch('title') || 'Book Preview'}
          focalPoint={focalPoint || undefined}
          onClose={() => setShowImagePreview(false)}
        />
      )}

      {/* FEATURE 2: Focal Point Selector Modal */}
      {showFocalPointSelector && coverPreviewUrl && (
        <FocalPointSelector
          imageUrl={coverPreviewUrl}
          initialFocalPoint={focalPoint || undefined}
          mediaType="book"
          onFocalPointChange={handleFocalPointChange}
          onClose={() => setShowFocalPointSelector(false)}
        />
      )}

      {/* Rest of your component (books list, etc.) */}
    </div>
  );
};

export default BooksWithImageFeatures;

/**
 * INTEGRATION NOTES:
 *
 * 1. Import the components at the top of your file:
 *    import ImagePreview from '../components/ImagePreview';
 *    import FocalPointSelector from '../components/FocalPointSelector';
 *
 * 2. Add state variables:
 *    const [showImagePreview, setShowImagePreview] = useState(false);
 *    const [showFocalPointSelector, setShowFocalPointSelector] = useState(false);
 *    const [focalPoint, setFocalPoint] = useState<{x: number, y: number} | null>(null);
 *
 * 3. Add buttons to your upload form (see lines 206-227)
 *
 * 4. Include focal point in FormData when submitting (see lines 103-106)
 *
 * 5. Render the modals conditionally (see lines 274-296)
 *
 * 6. Adjust mediaType based on your content:
 *    - Books: mediaType="book" (3:4 aspect ratio)
 *    - Audio: mediaType="audio" (1:1 aspect ratio)
 *    - Videos: mediaType="video" (16:9 aspect ratio)
 */

/**
 * BACKEND INTEGRATION:
 *
 * Make sure your backend controller handles the focalPoint field:
 *
 * // In bookController.ts
 * const focalPoint = req.body.focalPoint
 *   ? JSON.parse(req.body.focalPoint)
 *   : undefined;
 *
 * const variants = await imageProcessingService.processUploadedImage(
 *   coverFile.path,
 *   {
 *     aspectRatio: '3:4',
 *     outputDir: path.join(__dirname, '../../public/images'),
 *     quality: 85,
 *     format: 'webp',
 *     focalPoint  // Pass it here
 *   }
 * );
 */
