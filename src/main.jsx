import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import MemberPortal from './MemberPortal'
import AdminPanel from './AdminPanel'
import GymDisplay from './GymDisplay'
import CheckIn from './CheckIn'

ReactDOM.createRoot(document.getElementById('root')).render(
  <BrowserRouter>
    <Routes>
      <Route path="/"        element={<MemberPortal />} />
      <Route path="/admin"   element={<AdminPanel />} />
      <Route path="/display" element={<GymDisplay />} />
      <Route path="/checkin" element={<CheckIn />} />
    </Routes>
  </BrowserRouter>
)
