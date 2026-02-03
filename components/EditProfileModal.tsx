import React, { useState, useRef } from 'react';

interface EditProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUsername: string;
  currentAvatar: string;
  onSave: (username: string, avatar: string) => void;
}

const EditProfileModal: React.FC<EditProfileModalProps> = ({ isOpen, onClose, currentUsername, currentAvatar, onSave }) => {
  const [username, setUsername] = useState(currentUsername);
  const [avatar, setAvatar] = useState(currentAvatar);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // Generic themed emojis for Trivia and Solana/Crypto
  const genericIcons = [
    { label: 'BRAIN', value: '🧠' },
    { label: 'GEM', value: '💎' },
    { label: 'SOL', value: '⚡' },
    { label: 'ROCKET', value: '🚀' },
    { label: 'CHAIN', value: '⛓️' },
    { label: 'MONEY', value: '💰' },
    { label: 'LUCK', value: '🎰' },
    { label: 'GAME', value: '🎮' },
    { label: 'GLOBE', value: '🌐' },
    { label: 'SHIELD', value: '🛡️' },
    { label: 'CHART', value: '📈' },
    { label: 'LOCK', value: '🔒' },
    { label: 'KEY', value: '🔑' },
    { label: 'FIRE', value: '🔥' },
  ];

  const handleSave = () => {
    onSave(username, avatar);
    onClose();
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatar(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Convert emoji to a data URL avatar if it's an emoji
  const handleIconSelect = (emoji: string) => {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#0a0a0a';
      ctx.fillRect(0, 0, 128, 128);
      ctx.font = '80px serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(emoji, 64, 72);
      setAvatar(canvas.toDataURL());
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 backdrop-blur-3xl bg-black/90 animate-fade-in">
      <div className="relative w-full max-w-lg max-h-[90vh] bg-[#0D0D0D] border border-white/10 shadow-[0_0_100px_rgba(0,0,0,1)] flex flex-col rounded-2xl overflow-hidden">
        {/* Color Strip */}
        <div className="h-1.5 w-full bg-gradient-to-r from-[#a855f7] via-[#3b82f6] to-[#10b981] flex-shrink-0"></div>
        
        {/* Fixed Header */}
        <div className="p-8 pb-6 flex-shrink-0">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-[#00FFA3] text-[10px] font-black tracking-[0.4em] uppercase mb-1 block italic">DISPLAY CONFIGURATION</span>
              <h2 className="text-3xl font-[1000] italic uppercase tracking-tighter text-white leading-none">PROFILE <span className="sol-gradient-text">DISPLAY</span></h2>
            </div>
            <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors p-2 -mt-2 -mr-2">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="px-8 pb-8 overflow-y-auto flex-1 custom-scrollbar">
          <div className="space-y-8">
            {/* Username Field */}
            <div>
              <label className="text-zinc-300 text-[9px] font-black uppercase tracking-widest block mb-2 italic">Handle</label>
              <input 
                type="text" 
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-black border border-white/5 p-4 text-white font-black italic uppercase text-lg focus:outline-none focus:border-[#00FFA3]/50 transition-colors rounded-sm"
                placeholder="USER_NAME"
              />
            </div>

            {/* Avatar Picker */}
            <div>
              <div className="flex justify-between items-end mb-4">
                <label className="text-zinc-300 text-[9px] font-black uppercase tracking-widest italic">Identity Icon</label>
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="text-[#00FFA3] text-[9px] font-black uppercase tracking-widest italic hover:underline"
                >
                  Upload Custom +
                </button>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  className="hidden" 
                  accept="image/*"
                  onChange={handleFileUpload} 
                />
              </div>
              
              <div className="grid grid-cols-5 gap-3">
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="aspect-square relative overflow-hidden border border-dashed border-white/20 bg-white/5 flex flex-col items-center justify-center group hover:border-[#00FFA3]/50 transition-all rounded-sm"
                >
                  <svg className="w-5 h-5 text-zinc-500 group-hover:text-[#00FFA3]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  <span className="text-[7px] font-black uppercase tracking-tighter text-zinc-500 group-hover:text-[#00FFA3] mt-1">UPLOAD</span>
                </button>

                {genericIcons.map((icon, idx) => (
                  <button 
                    key={idx}
                    onClick={() => handleIconSelect(icon.value)}
                    className="aspect-square relative overflow-hidden border border-white/5 bg-white/5 hover:bg-white/10 flex items-center justify-center text-3xl transition-all rounded-sm hover:border-[#00FFA3]/20"
                    title={icon.label}
                  >
                    {icon.value}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-6 p-4 bg-black/40 border border-white/5 rounded-xl">
               <div className="w-16 h-16 rounded-lg overflow-hidden bg-zinc-900 border border-white/10 flex-shrink-0">
                  <img src={avatar} alt="Preview" className="w-full h-full object-cover grayscale" />
               </div>
               <div className="flex-1">
                  <span className="text-zinc-500 text-[8px] font-black uppercase block tracking-widest mb-1 italic">Protocol Shard Preview</span>
                  <span className="text-white font-black italic uppercase text-xs truncate max-w-[120px] inline-block">{username}</span>
               </div>
            </div>

            <button 
              onClick={handleSave}
              className="w-full py-5 bg-[#00FFA3] text-black font-[1000] text-xl italic uppercase tracking-tighter shadow-[0_0_30px_rgba(0,255,163,0.3)] active:scale-95 transition-all rounded-sm"
            >
              SAVE PROTOCOL IDENTITY
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EditProfileModal;
