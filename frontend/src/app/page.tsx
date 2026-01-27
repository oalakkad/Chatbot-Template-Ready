import ChatWidget from '../components/ChatWidget';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[#0B0F19] text-slate-200 p-24">
      <div className="text-center max-w-2xl">
        <div className="mb-8 flex justify-center">
          <div className="w-24 h-24 bg-white/5 backdrop-blur-xl rounded-2xl flex items-center justify-center shadow-2xl shadow-blue-500/10 p-2 overflow-hidden border border-white/10">
            <img
              src="/logo.jpg"
              alt="AL-TIJARIA Logo"
              className="w-full h-full object-contain brightness-110 drop-shadow-md"
            />
          </div>
        </div>
        <h1 className="text-4xl font-bold tracking-tight text-white sm:text-6xl mb-6">
          AL-TIJARIA Employee Portal
        </h1>
        <p className="text-lg leading-8 text-slate-400 mb-10">
          Welcome to the AL-TIJARIA dashboard. Access your resources, apply for leave, or view policies via the Help Desk.
        </p>
        <div className="flex gap-4 justify-center">
          <button className="px-6 py-3 bg-white/5 border border-white/10 rounded-lg text-slate-200 hover:bg-white/10 font-medium transition-all hover:border-white/20">
            View Documents
          </button>
          <button className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium">
            Admin Portal
          </button>
        </div>
      </div>

      {/* The Chat Widget lives here */}
      <ChatWidget />
    </main>
  );
}
