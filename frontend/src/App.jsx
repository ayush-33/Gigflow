import React from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Navigate } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import { getAccessToken } from "./utils/auth";
import { getSocket } from "./utils/socket";
import { useEffect } from "react";

function PrivateRoute({ children }) {
  const { user, authReady } = useAuth();

  if (!authReady) return <div>Loading...</div>;

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


function App() {
  const { user } = useAuth();
  
  useEffect(() => {
    if (!user) return;
    const socket = getSocket();
    socket.emit("register", user._id);

    socket.on("bidHired", (data) => {
      alert(`🎉 ${data.message}`);
    });

    return () => {
      socket.off("bidHired");
    };
  }, [user]);

  return (
    <BrowserRouter>
      <div className="App">

        <Navbar />

<Routes>
  <Route path="/" element={<Home />} />
  <Route path="/login" element={<Login />} />
  <Route path="/signup" element={<Signup />} />
  <Route path="/gig/:id" element={<GigDetails />} />
  <Route path="/explore" element={<Explore />} />

  {/* 🔒 Protected Routes */}
  <Route path="/profile" element={
    <PrivateRoute><Profile /></PrivateRoute>
  } />

  <Route path="/become-seller" element={
    <PrivateRoute><BecomeSeller /></PrivateRoute>
  } />

  <Route path="/gigs/:id/bid" element={
    <PrivateRoute><PlaceBid /></PrivateRoute>
  } />

  <Route path="/edit-gig/:id" element={
    <PrivateRoute><EditGig /></PrivateRoute>
  } />

  <Route path="/notifications" element={
    <PrivateRoute><Notifications /></PrivateRoute>
  } />

  <Route path="/checkout" element={
    <PrivateRoute><Checkout /></PrivateRoute>
  } />

  <Route path="/chat" element={
  <PrivateRoute><Chat /></PrivateRoute>
} />

<Route path="/chat/:roomId" element={
  <PrivateRoute><Chat /></PrivateRoute>
} />
</Routes>
        <Footer />

      </div>
    </BrowserRouter>
  )
}

export default App