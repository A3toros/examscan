import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import LandingPage from './components/LandingPage';
import Dashboard from './components/Dashboard';
import Registration from './components/Registration';
import Login from './components/Login';
import PrivacyPolicy from './components/PrivacyPolicy';
import TermsOfService from './components/TermsOfService';
import AnswerSheetGenerator from './components/answer-sheet/AnswerSheetGenerator';
import AnswerSheetScanner from './components/answer-sheet/AnswerSheetScanner';
import SecurityMonitor from './components/SecurityMonitor';

function App() {
  return (
    <SecurityMonitor>
      <Router>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/register" element={<Registration />} />
          <Route path="/login" element={<Login />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/privacy" element={<PrivacyPolicy />} />
          <Route path="/terms" element={<TermsOfService />} />
          <Route path="/generate" element={<AnswerSheetGenerator />} />
          <Route path="/scan" element={<AnswerSheetScanner />} />
        </Routes>
      </Router>
    </SecurityMonitor>
  );
}

export default App;
