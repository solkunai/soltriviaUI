
import React, { useState } from 'react';

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

  if (!isOpen) return null;

  const avatars = [
    'https://picsum.photos/id/237/400/400?grayscale',
    'https://picsum.photos/id/1025/400/400?grayscale',
    'https://picsum.photos/id/64/400/400?grayscale',
    'https://picsum.photos/id/168/400/400?grayscale',
    'https://picsum.photos/id/20/400/400?grayscale',
    'https://picsum.photos/id/111/400/400?grayscale',
  ];

  const handleSave = () => {
    onSave(username, avatar);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 backdrop-blur-3xl bg-black/90 animate-fade-in overflow-hidden">
      <div className="relative w-full max-w-lg bg-[#0D0D0D] border border-white/10 shadow-[0_0_100px_rgba(0,0,0,1)] overflow-hidden flex flex-col rounded-2xl">
        {/* Color Strip */}
        <div className="h-1.5 w-full bg-gradient-to-r from-[#a855f7] via-[#3b82f6] to-[#10b981]"></div>
        
        <div className="p-8">
          <div className="flex justify-between items-start mb-8">
            <div>
              <span className="text-[#00FFA3] text-[10px] font-black tracking-[0.4em] uppercase mb-1 block">Profile Protocol</span>
              <h2 className="text-3xl font-[1000] italic uppercase tracking-tighter text-white leading-none">EDIT <span className="sol-gradient-text">IDENTITY</span></h2>
            </div>
            <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors p-2">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="space-y-8">
            {/* Username Field */}
            <div>
              <label className="text-zinc-600 text-[9px] font-black uppercase tracking-widest block mb-2 italic">Handle</label>
              <input 
                type="text" 
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-black border border-white/5 p-4 text-white font-black italic uppercase text-lg focus:outline-none focus:border-[#00FFA3]/50 transition-colors"
                placeholder="USER_NAME"
              />
            </div>

            {/* Avatar Picker */}
            <div>
              <label className="text-zinc-600 text-[9px] font-black uppercase tracking-widest block mb-4 italic">Neural Avatar</label>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
                {avatars.map((url, idx) => (
                  <button 
                    key={idx}
                    onClick={() => setAvatar(url)}
                    className={`aspect-square relative overflow-hidden border-2 transition-all ${avatar === url ? 'border-[#00FFA3] scale-105' : 'border-white/5 grayscale hover:grayscale-0'}`}
                  >
                    <img src={url} alt="Avatar option" className="w-full h-full object-cover" />
                    {avatar === url && (
                      <div className="absolute inset-0 bg-[#00FFA3]/10 flex items-center justify-center">
                         <svg className="w-5 h-5 text-[#00FFA3]" fill="currentColor" viewBox="0 0 20 20">
                           <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                         </svg>
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-black/40 border border-white/5 p-4 rounded-xl flex items-start gap-4">
               <div className="w-10 h-10 bg-[#00FFA3]/5 border border-[#00FFA3]/20 flex items-center justify-center text-[#00FFA3] flex-shrink-0">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
               </div>
               <p className="text-[10px] text-zinc-500 font-medium leading-relaxed">
                 Identity synchronization occurs on the Brainy Layer. Changes may take up to 2 network blocks to propagate across the Protocol.
               </p>
            </div>

            <button 
              onClick={handleSave}
              className="w-full py-5 bg-[#00FFA3] text-black font-[1000] text-xl italic uppercase tracking-tighter shadow-[0_0_30px_rgba(0,255,163,0.3)] active:scale-95 transition-all"
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
