import React, { useState } from 'react';
import { supabase } from '../src/utils/supabase';

interface AvatarUploadProps {
  walletAddress: string;
  currentAvatar?: string;
  onUploadSuccess: (url: string) => void;
  onClose: () => void;
}

const AvatarUpload: React.FC<AvatarUploadProps> = ({
  walletAddress,
  currentAvatar,
  onUploadSuccess,
  onClose,
}) => {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file');
      return;
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      setError('Image must be less than 2MB');
      return;
    }

    setSelectedFile(file);
    setError(null);

    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setUploading(true);
    setError(null);

    try {
      // Create unique file name
      const fileExt = selectedFile.name.split('.').pop();
      const fileName = `${walletAddress}-${Date.now()}.${fileExt}`;
      const filePath = `avatars/${fileName}`;

      // Upload to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, selectedFile, {
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) {
        throw new Error(uploadError.message);
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      const avatarUrl = urlData.publicUrl;

      // Update player profile with new avatar URL
      const { error: updateError } = await supabase
        .from('player_profiles')
        .upsert({
          wallet_address: walletAddress,
          avatar_url: avatarUrl,
          updated_at: new Date().toISOString(),
        });

      if (updateError) {
        throw new Error(updateError.message);
      }

      // Success!
      onUploadSuccess(avatarUrl);
    } catch (err: any) {
      console.error('Upload error:', err);
      setError(err.message || 'Failed to upload avatar. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 backdrop-blur-xl bg-black/90">
      <div className="bg-[#0A0A0A] border border-white/10 rounded-2xl p-8 max-w-md w-full">
        <h2 className="text-2xl font-[1000] italic uppercase mb-6">Upload Avatar</h2>

        {/* Preview */}
        <div className="mb-6 flex justify-center">
          <div className="w-32 h-32 rounded-full overflow-hidden bg-zinc-900 border-4 border-[#14F195]/30">
            {preview ? (
              <img src={preview} alt="Preview" className="w-full h-full object-cover" />
            ) : currentAvatar ? (
              <img src={currentAvatar} alt="Current" className="w-full h-full object-cover grayscale" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-zinc-600 text-4xl">
                👤
              </div>
            )}
          </div>
        </div>

        {/* File Input */}
        <div className="mb-6">
          <label className="block text-sm font-black uppercase text-zinc-400 mb-2">
            Choose Image
          </label>
          <input
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            disabled={uploading}
            className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-lg text-white file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-[#14F195] file:text-black file:font-black file:text-xs file:uppercase hover:file:bg-[#14F195]/90 disabled:opacity-50"
          />
          <p className="text-xs text-zinc-600 mt-2">Max 2MB, JPG/PNG/GIF</p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        {/* Buttons */}
        <div className="flex gap-3">
          <button
            onClick={handleUpload}
            disabled={!selectedFile || uploading}
            className="flex-1 py-4 bg-[#14F195] hover:bg-[#14F195]/90 disabled:bg-zinc-800 disabled:text-zinc-500 text-black font-[1000] italic uppercase rounded-lg transition-all disabled:cursor-not-allowed"
          >
            {uploading ? 'Uploading...' : 'Upload'}
          </button>
          <button
            onClick={onClose}
            disabled={uploading}
            className="px-6 py-4 bg-white/5 hover:bg-white/10 text-white font-[1000] italic uppercase rounded-lg transition-all disabled:opacity-50"
          >
            Cancel
          </button>
        </div>

        {/* Note about Storage */}
        <p className="text-xs text-zinc-600 mt-4 text-center italic">
          💡 Avatars are stored in Supabase Storage
        </p>
      </div>
    </div>
  );
};

export default AvatarUpload;
