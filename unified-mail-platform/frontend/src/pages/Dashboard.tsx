import { useState } from 'react';
import { Routes, Route } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import Inbox from '../components/Inbox';
import MessageDetail from '../components/MessageDetail';
import Accounts from '../components/Accounts';
import Search from '../components/Search';

export default function Dashboard() {
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);

  return (
    <div className="h-screen flex bg-gray-50">
      {/* Sidebar */}
      <Sidebar />

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />

        <main className="flex-1 overflow-hidden">
          <Routes>
            <Route
              path="/"
              element={
                <div className="h-full flex">
                  <Inbox onSelectMessage={setSelectedMessageId} />
                  {selectedMessageId && (
                    <MessageDetail
                      messageId={selectedMessageId}
                      onClose={() => setSelectedMessageId(null)}
                    />
                  )}
                </div>
              }
            />
            <Route path="/accounts" element={<Accounts />} />
            <Route path="/search" element={<Search />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}
