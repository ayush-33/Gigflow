import React from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Navigate } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import { getAccessToken } from "./utils/auth";
import { useEffect } from "react";
import { Toaster } from "react-hot-toast";
import ErrorBoundary from "./components/ErrorBoundary";

function PrivateRoute({ children }) {
  const { user, authReady } = useAuth();

  if (!authReady) return <div className="loading-screen"><div className="loading-spinner" /><p className="loading-text">Loading...</p></div>;

  const token = getAccessToken(); // 🔥 key fix

  if (!user || !token) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

import Navbar from './components/Navbar'
import Footer from './components/Footer'
import Home from './pages/Home'
import Login from './pages/Login'
import Signup from './pages/Signup'
import BecomeSeller from './pages/BecomeSeller'
import GigDetails from "./pages/GigDetails"
import Explore from "./pages/Explore"
import Profile from "./pages/Profile"   // ⭐ add this
import PlaceBid from "./pages/PlaceBid";
import EditGig from "./pages/EditGig";
import Notifications from "./pages/Notification";
import Checkout from "./pages/Checkout";
import Chat from "./pages/Chat";
import toast from "react-hot-toast";


function App() {
  const { user, socket } = useAuth();
  
  useEffect(() => {
    if (!user || !socket) return;
    
    socket.emit("register", user._id);

    const handleBidHired = (data) => {
      toast.success(`🎉 ${data.message}`);
    };

    socket.on("bidHired", handleBidHired);

    return () => {
      socket.off("bidHired", handleBidHired);
    };
  }, [user, socket]);

  return (
    <BrowserRouter>
      <div className="App">
        <Toaster
          position="bottom-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: '#1a1d27',
              color: '#f1f5f9',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '12px',
              fontFamily: "'Plus Jakarta Sans', sans-serif",
            },
          }}
        />

        <Navbar />

        <ErrorBoundary>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/gig/:id" element={<GigDetails />} />
            <Route path="/explore" element={<Explore />} />

            {/* 🔒 Protected Routes */}
            <Route path="/profile" element={
              <PrivateRoute>
                <ErrorBoundary>
                  <Profile />
                </ErrorBoundary>
              </PrivateRoute>
            } />

            <Route path="/become-seller" element={
              <PrivateRoute>
                <ErrorBoundary>
                  <BecomeSeller />
                </ErrorBoundary>
              </PrivateRoute>
            } />

            <Route path="/gigs/:id/bid" element={
              <PrivateRoute>
                <ErrorBoundary>
                  <PlaceBid />
                </ErrorBoundary>
              </PrivateRoute>
            } />

            <Route path="/edit-gig/:id" element={
              <PrivateRoute>
                <ErrorBoundary>
                  <EditGig />
                </ErrorBoundary>
              </PrivateRoute>
            } />

            <Route path="/notifications" element={
              <PrivateRoute>
                <ErrorBoundary>
                  <Notifications />
                </ErrorBoundary>
              </PrivateRoute>
            } />

            <Route path="/checkout" element={
              <PrivateRoute>
                <ErrorBoundary>
                  <Checkout />
                </ErrorBoundary>
              </PrivateRoute>
            } />

            <Route path="/chat" element={
              <PrivateRoute>
                <ErrorBoundary>
                  <Chat />
                </ErrorBoundary>
              </PrivateRoute>
            } />

            <Route path="/chat/:roomId" element={
              <PrivateRoute>
                <ErrorBoundary>
                  <Chat />
                </ErrorBoundary>
              </PrivateRoute>
            } />
          </Routes>
        </ErrorBoundary>

        <Footer />
      </div>
    </BrowserRouter>
  )
}

export default App