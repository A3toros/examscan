import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { FileText, Camera, BarChart3 } from 'lucide-react';
import Button from './ui/Button';
import { logSecurityEvent } from '../utils/security';
import CookieConsent from './CookieConsent';

const LandingPage: React.FC = () => {
  useEffect(() => {
    logSecurityEvent('page_visit', {
      page: 'landing',
      userAgent: navigator.userAgent,
      timestamp: new Date().toISOString(),
    });
  }, []);

  const features = [
    {
      icon: FileText,
      title: 'Create answer sheets',
      description: 'Build clean multiple-choice sheets that scan reliably.',
    },
    {
      icon: Camera,
      title: 'Scan with any camera',
      description: 'Use a laptop or phone camera—no special hardware.',
    },
    {
      icon: BarChart3,
      title: 'Instant results',
      description: 'See scores and basic stats in minutes instead of hours.',
    },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 flex flex-col">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-950/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <Link to="/" className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/40 text-sm font-semibold">
              ES
            </span>
            <span className="text-lg font-semibold tracking-tight">
              Exam<span className="text-emerald-400">Scan</span>
            </span>
          </Link>
          <div className="flex items-center gap-3 text-sm">
            <Link to="/login" className="hidden text-slate-300 hover:text-emerald-300 sm:inline">
              Sign in
            </Link>
            <Link to="/register">
              <Button className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold px-4 py-2 text-xs sm:text-sm">
                Create free account
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 pb-16 pt-10 sm:px-6 lg:px-8">
        <div className="flex flex-1 flex-col items-start justify-center gap-10 md:flex-row md:items-center">
          {/* Left: copy */}
          <div className="max-w-xl space-y-6">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-400">
              Simple exam scanning
            </p>
            <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
              Scan paper tests.
              <br />
              Get grades in minutes.
            </h1>
            <p className="text-sm leading-relaxed text-slate-300">
              ExamScan turns printed answer sheets into instant results. Create a key, print sheets, scan with your
              camera, and see scores immediately.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Link to="/register" className="w-full sm:w-auto">
                <Button className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold px-6 py-2.5 text-sm">
                  Get started in 2 minutes
                </Button>
              </Link>
              <Link to="/login" className="w-full sm:w-auto">
                <Button
                  className="w-full bg-yellow-500 hover:bg-yellow-400 text-slate-950 font-semibold px-6 py-2.5 text-sm"
                >
                  I already have an account
                </Button>
              </Link>
            </div>

            <div className="grid gap-3 text-xs text-slate-300 sm:grid-cols-3">
              {features.map((f) => (
                <div key={f.title} className="flex items-start gap-2">
                  <div className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-md bg-slate-900 text-emerald-400">
                    <f.icon size={16} />
                  </div>
                  <p>{f.description}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Right: simple preview card */}
          <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900/80 p-5 shadow-2xl">
            <div className="mb-4 flex items-center justify-between text-xs text-slate-400">
              <span className="font-mono uppercase tracking-[0.18em] text-slate-500">Preview</span>
              <span>Demo exam · 25 questions</span>
            </div>
            <div className="mb-4 rounded-xl border border-slate-800 bg-slate-950 p-3">
              <div className="mb-2 flex items-center justify-between text-[11px] text-slate-400">
                <span>Scan status</span>
                <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-400">
                  Live
                </span>
              </div>
              <div className="h-24 rounded-lg bg-gradient-to-br from-slate-900 to-slate-800/90" />
              <p className="mt-2 text-[11px] text-slate-500">
                Camera view of the answer sheet. Bubbles are detected automatically as you scan.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-3 text-xs text-slate-200">
              <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3">
                <p className="text-[11px] text-slate-400">Average score</p>
                <p className="mt-1 text-lg font-semibold text-emerald-300">82%</p>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3">
                <p className="text-[11px] text-slate-400">Sheets scanned</p>
                <p className="mt-1 text-lg font-semibold">34</p>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3">
                <p className="text-[11px] text-slate-400">Time saved</p>
                <p className="mt-1 text-lg font-semibold">~2h</p>
              </div>
            </div>
          </div>
        </div>
      </main>

      <CookieConsent />
    </div>
  );
};

export default LandingPage;

