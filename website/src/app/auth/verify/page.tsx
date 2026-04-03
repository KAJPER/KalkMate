export default function VerifyPage() {
  return (
    <div className="min-h-screen bg-[#F5F5F5] dark:bg-[#313338] flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white dark:bg-[#2B2D31] rounded-2xl p-8 border border-gray-100 dark:border-[#3F4147] text-center">
        <div className="w-16 h-16 bg-blue-100 dark:bg-blue-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-600 dark:text-blue-400">
            <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-[#1a1a1a] dark:text-[#E0E0E0] mb-2">
          Sprawdź swoją skrzynkę!
        </h1>
        <p className="text-[#1a1a1a]/60 dark:text-[#E0E0E0]/60 mb-6">
          Wysłaliśmy Ci link logowania. Sprawdź swoją skrzynkę email.
        </p>
        <p className="text-sm text-[#1a1a1a]/40 dark:text-[#E0E0E0]/40">
          Link jest ważny przez 24 godziny.
        </p>
      </div>
    </div>
  );
}
