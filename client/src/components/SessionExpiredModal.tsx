interface SessionExpiredModalProps {
  open: boolean;
  onConfirm: () => void;
}

export function SessionExpiredModal({
  open,
  onConfirm,
}: SessionExpiredModalProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" role="dialog" aria-modal="true" aria-labelledby="session-expired-title" aria-describedby="session-expired-desc">
      <div className="bg-white rounded-lg shadow-lg p-8 max-w-sm">
        <h2 id="session-expired-title" className="text-2xl font-bold text-gray-900 mb-4">
          Session Expired
        </h2>
        <p id="session-expired-desc" className="text-gray-600 mb-6">
          Your session has expired. Please log in again.
        </p>
        <button
          onClick={onConfirm}
          className="w-full px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors"
        >
          Log In
        </button>
      </div>
    </div>
  );
}
