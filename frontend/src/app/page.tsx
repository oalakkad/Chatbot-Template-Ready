import ChatWidget from '../components/ChatWidget';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-24">
      <div className="text-center max-w-2xl">
        <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-6xl mb-6">
          Internal Employee Portal
        </h1>
        <p className="text-lg leading-8 text-gray-600 mb-10">
          Welcome to the company dashboard. Access your resources, apply for leave, or view policies via the Help Desk.
        </p>
        <div className="flex gap-4 justify-center">
          <button className="px-6 py-3 bg-white border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium">
            View Documents
          </button>
          <button className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium">
            HR Portal
          </button>
        </div>
      </div>

      {/* The Chat Widget lives here */}
      <ChatWidget />
    </main>
  );
}
