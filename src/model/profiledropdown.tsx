import { FiUser, FiSettings, FiLogOut } from "react-icons/fi";

export default function ProfileMenuModal({
  isOpen,
  onClose,
  onProfile,
  onSettings,
  onLogout,
}: {
  isOpen: boolean;
  onClose: () => void;
  onProfile?: () => void;
  onSettings?: () => void;
  onLogout?: () => void;
}) {
  if (!isOpen) return null;

  const handleClick = (action?: () => void) => {
    action?.();
    onClose();
  };

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/50 z-40"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed right-4 top-18 z-50 w-[250px] rounded-lg bg-[#1D232B] border border-white/15 shadow-xl overflow-hidden">
        <div className="flex flex-col">
          <button
            className="flex items-center gap-3 px-4 py-4 text-gray-300 text-sm hover:bg-white/5 transition-all"
            onClick={() => handleClick(onProfile)}
          >
            <FiUser className="w-5 h-5" />
            <span>My Profile</span>
          </button>

          {/* <button
            className="flex items-center gap-3 px-4 py-4 text-gray-300 text-sm hover:bg-white/5 transition-all"
            onClick={() => handleClick(onSettings)}
          >
            <FiSettings className="w-5 h-5" />
            <span>Account Settings</span>
          </button> */}

          <div className="h-px bg-white/15 mx-2" />

          <button
            className="flex items-center gap-3 px-4 py-4 text-red-500 text-sm hover:bg-white/5 transition-all"
            onClick={() => handleClick(onLogout)}
          >
            <FiLogOut className="w-5 h-5" />
            <span>Log Out</span>
          </button>
        </div>
      </div>
    </>
  );
}
