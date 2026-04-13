import React from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
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

function App() {
  return (
    <BrowserRouter>
      <div className="App">

        <Navbar />

        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/become-seller" element={<BecomeSeller />} />
          <Route path="/gig/:id" element={<GigDetails />} />
          <Route path="/explore" element={<Explore />} />

          {/* ⭐ Profile Route */}
          <Route path="/profile" element={<Profile />} />
          <Route path="/gigs/:id/bid" element={<PlaceBid />} />
          <Route path="/edit-gig/:id" element={<EditGig />} />
          <Route path="/notifications" element={<Notifications />} />
        </Routes>

        <Footer />

      </div>
    </BrowserRouter>
  )
}

export default App