'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { fetchAndCacheVideo } from '@/lib/videoCache'
import { cacheAsset } from '@/lib/assetCache'
import Button from './Button'
import VideoPlayer from './VideoPlayer'
import { CachedImage } from './CachedImage'

interface Slide {
  id: number
  type: 'image' | 'video' | 'content'
  src?: string
  title?: string
  content?: React.ReactNode
  autoPlay?: boolean
  loop?: boolean
}

interface PresentationProps {
  isOpen: boolean
  onClose: () => void
}

const slides: Slide[] = [
  {
    id: 1,
    type: 'content',
    title: 'TutorCat',
    content: (
      <div className="text-center space-y-4">
        <p className="text-slate-600 mb-6" style={{ fontSize: 'clamp(1rem, 2vw, 1.5rem)' }}>AI Powered Language Learning Web App</p>
        <div className="space-y-3">
          <p className="text-slate-700 font-semibold" style={{ fontSize: 'clamp(1rem, 2vw, 1.5rem)' }}>Developers:</p>
          <ul className="list-none space-y-3 text-slate-700 inline-block" style={{ fontSize: 'clamp(1rem, 2vw, 1.5rem)' }}>
            <li className="flex items-center justify-center gap-2">
              <span className="w-2 h-2 rounded-full bg-primary-500 flex-shrink-0"></span>
              <span>Mattcha Srirojwong</span>
            </li>
            <li className="flex items-center justify-center gap-2">
              <span className="w-2 h-2 rounded-full bg-secondary-500 flex-shrink-0"></span>
              <span>Jindaporn Tikomporn</span>
            </li>
            <li className="flex items-center justify-center gap-2">
              <span className="w-2 h-2 rounded-full bg-primary-500 flex-shrink-0"></span>
              <span>Nichapath Chunlawithet</span>
            </li>
            <li className="flex items-center justify-center gap-2">
              <span className="w-2 h-2 rounded-full bg-secondary-500 flex-shrink-0"></span>
              <span>Curator: Aleksandr Petrov</span>
            </li>
          </ul>
        </div>
      </div>
    )
  },
  {
    id: 2,
    type: 'image',
    src: '/slides/2 Book-to-dashboard-anim.gif',
    title: 'Problem We Address',
    content: (
      <div className="space-y-3">
        <ul className="list-none space-y-2 text-slate-700" style={{ fontSize: 'clamp(1rem, 2vw, 1.5rem)' }}>
          <li className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-primary-500 flex-shrink-0"></span>
            Low engagement in traditional ESL
          </li>
          <li className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-secondary-500 flex-shrink-0"></span>
            Limited feedback outside class
          </li>
          <li className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-primary-500 flex-shrink-0"></span>
            One-size-fits-all materials
          </li>
        </ul>
      </div>
    )
  },
  {
    id: 3,
    type: 'content',
    title: 'Objectives of the Project',
    content: (
      <div className="space-y-4 text-center">
        <ul className="list-none space-y-3 text-slate-700 inline-block text-left" style={{ fontSize: 'clamp(1rem, 2vw, 1.5rem)' }}>
          <li className="flex items-start gap-3">
            <span className="w-2 h-2 rounded-full bg-primary-500 mt-2 flex-shrink-0"></span>
            <span>Build an interactive English learning platform with AI feedback for speaking practice outside class</span>
          </li>
          <li className="flex items-start gap-3">
            <span className="w-2 h-2 rounded-full bg-secondary-500 mt-2 flex-shrink-0"></span>
            <span>Use gamification to increase motivation and engagement</span>
          </li>
          <li className="flex items-start gap-3">
            <span className="w-2 h-2 rounded-full bg-primary-500 mt-2 flex-shrink-0"></span>
            <span>Apply security and data protection to keep student data safe</span>
          </li>
        </ul>
      </div>
    )
  },
  {
    id: 4,
    type: 'content',
    title: 'Scope and Limitations',
    content: (
      <div className="space-y-3 text-center text-slate-700">
        <ul className="list-none space-y-3 inline-block" style={{ fontSize: 'clamp(1rem, 2vw, 1.5rem)' }}>
          <li className="flex items-start justify-center gap-2">
            <span className="w-2 h-2 rounded-full bg-primary-500 mt-2 flex-shrink-0"></span>
            <span>Free-tier hosting limits deployment to school level and restricts concurrent users</span>
          </li>
          <li className="flex items-start justify-center gap-2">
            <span className="w-2 h-2 rounded-full bg-secondary-500 mt-2 flex-shrink-0"></span>
            <span>Reliance on external AI APIs with no ability to train or modify models using student data</span>
          </li>
          <li className="flex items-start justify-center gap-2">
            <span className="w-2 h-2 rounded-full bg-primary-500 mt-2 flex-shrink-0"></span>
            <span>Risk of AI hallucinations in feedback despite prompt optimization</span>
          </li>
        </ul>
      </div>
    )
  },
  {
    id: 5,
    type: 'content',
    title: 'Target Users',
    content: (
      <div className="text-center space-y-4 text-slate-700">
        <ul className="list-none space-y-3 inline-block" style={{ fontSize: 'clamp(1rem, 2vw, 1.5rem)' }}>
          <li className="flex items-start justify-center gap-2">
            <span className="w-2 h-2 rounded-full bg-primary-500 mt-2 flex-shrink-0"></span>
            <span>Junior High & Senior High School Students - Our primary target audience learning English as part of their curriculum with interactive AI-powered lessons</span>
          </li>
          <li className="flex items-start justify-center gap-2">
            <span className="w-2 h-2 rounded-full bg-secondary-500 mt-2 flex-shrink-0"></span>
            <span>Adult Learners & Self-Study Enthusiasts - Self-learners seeking to improve English proficiency at their own pace with flexible learning options</span>
          </li>
        </ul>
      </div>
    )
  },
  {
    id: 6,
    type: 'content',
    title: 'Development Process',
    content: (
      <div className="space-y-3 text-center text-slate-700 flex flex-col items-center">
        <ul className="list-none space-y-3" style={{ fontSize: 'clamp(1rem, 2vw, 1.5rem)' }}>
          <li className="flex items-center justify-center gap-2">
            <span className="w-2 h-2 rounded-full bg-primary-500 flex-shrink-0"></span>
            <span>Planning</span>
          </li>
          <li className="flex items-center justify-center gap-2">
            <span className="w-2 h-2 rounded-full bg-secondary-500 flex-shrink-0"></span>
            <span>Design</span>
          </li>
          <li className="flex items-center justify-center gap-2">
            <span className="w-2 h-2 rounded-full bg-primary-500 flex-shrink-0"></span>
            <span>Development</span>
          </li>
          <li className="flex items-center justify-center gap-2">
            <span className="w-2 h-2 rounded-full bg-secondary-500 flex-shrink-0"></span>
            <span>Testing</span>
          </li>
        </ul>
      </div>
    )
  },
  {
    id: 7,
    type: 'content',
    title: 'Frontend',
    content: (
      <div className="space-y-4 text-center text-slate-700">
        <ul className="list-none space-y-3 inline-block" style={{ fontSize: 'clamp(1rem, 2vw, 1.5rem)' }}>
          <li className="flex items-start justify-center gap-2">
            <span className="w-2 h-2 rounded-full bg-primary-500 mt-2 flex-shrink-0"></span>
            <span>React - UI library</span>
          </li>
          <li className="flex items-start justify-center gap-2">
            <span className="w-2 h-2 rounded-full bg-secondary-500 mt-2 flex-shrink-0"></span>
            <span>TypeScript - Type safety</span>
          </li>
          <li className="flex items-start justify-center gap-2">
            <span className="w-2 h-2 rounded-full bg-primary-500 mt-2 flex-shrink-0"></span>
            <span>Tailwind CSS - Styling</span>
          </li>
          <li className="flex items-start justify-center gap-2">
            <span className="w-2 h-2 rounded-full bg-secondary-500 mt-2 flex-shrink-0"></span>
            <span>Framer Motion - Animations</span>
          </li>
          <li className="flex items-start justify-center gap-2">
            <span className="w-2 h-2 rounded-full bg-primary-500 mt-2 flex-shrink-0"></span>
            <span>Konva.js - Drag-and-drop interactions</span>
          </li>
          <li className="flex items-start justify-center gap-2">
            <span className="w-2 h-2 rounded-full bg-secondary-500 mt-2 flex-shrink-0"></span>
            <span>Clean, simple UI design</span>
          </li>
          <li className="flex items-start justify-center gap-2">
            <span className="w-2 h-2 rounded-full bg-primary-500 mt-2 flex-shrink-0"></span>
            <span>Responsive layouts</span>
          </li>
          <li className="flex items-start justify-center gap-2">
            <span className="w-2 h-2 rounded-full bg-secondary-500 mt-2 flex-shrink-0"></span>
            <span>Interactive components</span>
          </li>
        </ul>
      </div>
    )
  },
  {
    id: 8,
    type: 'content',
    title: 'Backend',
    content: (
      <div className="space-y-4 text-center text-slate-700">
        <ul className="list-none space-y-3 inline-block" style={{ fontSize: 'clamp(1rem, 2vw, 1.5rem)' }}>
          <li className="flex items-start justify-center gap-2">
            <span className="w-2 h-2 rounded-full bg-primary-500 mt-2 flex-shrink-0"></span>
            <span>Next.js - React framework</span>
          </li>
          <li className="flex items-start justify-center gap-2">
            <span className="w-2 h-2 rounded-full bg-secondary-500 mt-2 flex-shrink-0"></span>
            <span>Netlify Functions - Serverless API</span>
          </li>
          <li className="flex items-start justify-center gap-2">
            <span className="w-2 h-2 rounded-full bg-primary-500 mt-2 flex-shrink-0"></span>
            <span>PostgreSQL (Neon) - Database</span>
          </li>
          <li className="flex items-start justify-center gap-2">
            <span className="w-2 h-2 rounded-full bg-secondary-500 mt-2 flex-shrink-0"></span>
            <span>Authentification: 1100ms – high latency</span>
          </li>
          <li className="flex items-start justify-center gap-2">
            <span className="w-2 h-2 rounded-full bg-primary-500 mt-2 flex-shrink-0"></span>
            <span>Fetch functions: 200-400ms – low latency</span>
          </li>
          <li className="flex items-start justify-center gap-2">
            <span className="w-2 h-2 rounded-full bg-secondary-500 mt-2 flex-shrink-0"></span>
            <span>Write functions: 300-600ms – low latency</span>
          </li>
        </ul>
      </div>
    )
  },
  {
    id: 9,
    type: 'content',
    title: 'Security',
    content: (
      <div className="space-y-4 text-center text-slate-700">
        <ul className="list-none space-y-3 inline-block" style={{ fontSize: 'clamp(1rem, 2vw, 1.5rem)' }}>
          <li className="flex items-start justify-center gap-2">
            <span className="w-2 h-2 rounded-full bg-primary-500 mt-2 flex-shrink-0"></span>
            <span>JWT (jsonwebtoken) - Token-based authentication</span>
          </li>
          <li className="flex items-start justify-center gap-2">
            <span className="w-2 h-2 rounded-full bg-secondary-500 mt-2 flex-shrink-0"></span>
            <span>HTTP-only cookies - Enhanced security</span>
          </li>
          <li className="flex items-start justify-center gap-2">
            <span className="w-2 h-2 rounded-full bg-primary-500 mt-2 flex-shrink-0"></span>
            <span>Bcrypt.js - Password hashing</span>
          </li>
        </ul>
      </div>
    )
  },
  {
    id: 10,
    type: 'content',
    title: 'Web Design',
    content: (
      <div className="space-y-1 md:space-y-2 w-full">

        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 md:gap-3 lg:gap-4">
          <div>
            <h3 className="font-semibold mb-1 md:mb-2 text-slate-800" style={{ fontSize: 'clamp(1.5rem, 3vw, 2.25rem)' }}>Primary Colors</h3>
            <div className="space-y-0.5 md:space-y-1" style={{ fontSize: 'clamp(0.75rem, 1.5vw, 1rem)' }}>
              {[
                { name: 'Primary-50', color: '#fdf4ff' },
                { name: 'Primary-100', color: '#fae8ff' },
                { name: 'Primary-200', color: '#f5d0ff' },
                { name: 'Primary-300', color: '#f0abff' },
                { name: 'Primary-400', color: '#e879ff' },
                { name: 'Primary-500', color: '#d946ff' },
                { name: 'Primary-600', color: '#c026d3' },
                { name: 'Primary-700', color: '#a21caf' },
                { name: 'Primary-800', color: '#86198f' },
                { name: 'Primary-900', color: '#701a75' },
              ].map(({ name, color }) => (
                <div key={name} className="flex items-center gap-1.5 md:gap-2">
                  <div className="rounded border border-slate-300 flex-shrink-0" style={{ width: 'clamp(1rem, 2vw, 1.5rem)', height: 'clamp(1rem, 2vw, 1.5rem)', backgroundColor: color }}></div>
                  <span className="text-slate-700 truncate">{name}: {color}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <h3 className="font-semibold mb-1 md:mb-2 text-slate-800" style={{ fontSize: 'clamp(1.5rem, 3vw, 2.25rem)' }}>Secondary Colors</h3>
            <div className="space-y-0.5 md:space-y-1" style={{ fontSize: 'clamp(0.75rem, 1.5vw, 1rem)' }}>
              {[
                { name: 'Secondary-50', color: '#f0f4ff' },
                { name: 'Secondary-200', color: '#c7d4ff' },
                { name: 'Secondary-300', color: '#a5b9ff' },
                { name: 'Secondary-400', color: '#8399ff' },
                { name: 'Secondary-500', color: '#6175ff' },
                { name: 'Secondary-600', color: '#4a5fff' },
                { name: 'Secondary-700', color: '#3d4eff' },
                { name: 'Secondary-800', color: '#2f3fff' },
                { name: 'Secondary-900', color: '#1a2aff' },
              ].map(({ name, color }) => (
                <div key={name} className="flex items-center gap-1.5 md:gap-2">
                  <div className="rounded border border-slate-300 flex-shrink-0" style={{ width: 'clamp(1rem, 2vw, 1.5rem)', height: 'clamp(1rem, 2vw, 1.5rem)', backgroundColor: color }}></div>
                  <span className="text-slate-700 truncate">{name}: {color}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  },
  {
    id: 11,
    type: 'image',
    src: '/slides/Mobile-scroll.gif',
    title: 'Lesson Structure',
    content: (
      <div className="space-y-3 text-center text-slate-700">
        <ul className="list-none space-y-2 inline-block" style={{ fontSize: 'clamp(1rem, 2vw, 1.5rem)' }}>
          <li className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-primary-500 flex-shrink-0"></span>
            <span>Warm up - Speaking practice</span>
          </li>
          <li className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-secondary-500 flex-shrink-0"></span>
            <span>Vocabulary - Learn new words</span>
          </li>
          <li className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-primary-500 flex-shrink-0"></span>
            <span>Grammar introduction - Learn rules</span>
          </li>
          <li className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-secondary-500 flex-shrink-0"></span>
            <span>Grammar practice - Apply knowledge</span>
          </li>
          <li className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-primary-500 flex-shrink-0"></span>
            <span>Speaking - prompts with AI feedback</span>
          </li>
          <li className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-secondary-500 flex-shrink-0"></span>
            <span>Improved transcript by AI - Repeat practice</span>
          </li>
          <li className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-primary-500 flex-shrink-0"></span>
            <span>Pronunciation score - Get feedback</span>
          </li>
        </ul>
      </div>
    )
  },
  {
    id: 12,
    type: 'image',
    src: '/slides/Achievements2.png',
    title: 'Gamification',
    content: (
      <div className="space-y-3 text-center text-slate-700 flex flex-col items-center">
        <ul className="list-none space-y-3" style={{ fontSize: 'clamp(1rem, 2vw, 1.5rem)' }}>
          <li className="flex items-center justify-center gap-2">
            <span className="w-2 h-2 rounded-full bg-primary-500 flex-shrink-0"></span>
            <span>XP (Experience Points) - Earn points for completing activities</span>
          </li>
          <li className="flex items-center justify-center gap-2">
            <span className="w-2 h-2 rounded-full bg-secondary-500 flex-shrink-0"></span>
            <span>Titles - Unlock titles from "Tiny Whisker" to "TutorCat"</span>
          </li>
          <li className="flex items-center justify-center gap-2">
            <span className="w-2 h-2 rounded-full bg-primary-500 flex-shrink-0"></span>
            <span>Achievements - achievements to unlock</span>
          </li>
          <li className="flex items-center justify-center gap-2">
            <span className="w-2 h-2 rounded-full bg-secondary-500 flex-shrink-0"></span>
            <span>Daily streaks - Build learning habits</span>
          </li>
          <li className="flex items-center justify-center gap-2">
            <span className="w-2 h-2 rounded-full bg-primary-500 flex-shrink-0"></span>
            <span>Level progression - Advance through CEFR levels</span>
          </li>
        </ul>
      </div>
    )
  },
  {
    id: 13,
    type: 'content',
    title: 'AI Feedback',
    content: (
      <div className="space-y-4 text-center text-slate-700">
        <ul className="list-none space-y-3 inline-block" style={{ fontSize: 'clamp(1rem, 2vw, 1.5rem)' }}>
          <li className="flex items-start justify-center gap-2">
            <span className="w-2 h-2 rounded-full bg-primary-500 mt-2 flex-shrink-0"></span>
            <span>User records speech - Student speaks in response to prompts</span>
          </li>
          <li className="flex items-start justify-center gap-2">
            <span className="w-2 h-2 rounded-full bg-secondary-500 mt-2 flex-shrink-0"></span>
            <span>Speech-to-text transcription - AssemblyAI converts audio to text</span>
          </li>
          <li className="flex items-start justify-center gap-2">
            <span className="w-2 h-2 rounded-full bg-primary-500 mt-2 flex-shrink-0"></span>
            <span>AI analysis (GPT-4o-mini) - Analyzes grammar, vocabulary, pronunciation, and topic relevance</span>
          </li>
          <li className="flex items-start justify-center gap-2">
            <span className="w-2 h-2 rounded-full bg-secondary-500 mt-2 flex-shrink-0"></span>
            <span>Personalized feedback - Score, corrections, improved transcript, and CEFR level assessment</span>
          </li>
        </ul>
      </div>
    )
  },
  {
    id: 14,
    type: 'content',
    title: 'Testing',
    content: (
      <div className="space-y-4 text-center text-slate-700">
        <ul className="list-none space-y-3 inline-block" style={{ fontSize: 'clamp(1rem, 2vw, 1.5rem)' }}>
          <li className="flex items-start justify-center gap-2">
            <span className="w-2 h-2 rounded-full bg-primary-500 mt-2 flex-shrink-0"></span>
            <span>Functional Testing - Verified all features work correctly: lesson activities, authentication flows, database operations, and achievement system</span>
          </li>
          <li className="flex items-start justify-center gap-2">
            <span className="w-2 h-2 rounded-full bg-secondary-500 mt-2 flex-shrink-0"></span>
            <span>UI Testing - Tested user interface components, interactions, and visual elements for consistency and usability</span>
          </li>
          <li className="flex items-start justify-center gap-2">
            <span className="w-2 h-2 rounded-full bg-primary-500 mt-2 flex-shrink-0"></span>
            <span>API Testing - Validated all serverless function endpoints, response times, error handling, and data integrity</span>
          </li>
          <li className="flex items-start justify-center gap-2">
            <span className="w-2 h-2 rounded-full bg-secondary-500 mt-2 flex-shrink-0"></span>
            <span>Cross Device Compatibility - Playwright - Automated end-to-end testing across Chromium, Firefox, and Safari browsers with mobile emulation</span>
          </li>
          <li className="flex items-start justify-center gap-2">
            <span className="w-2 h-2 rounded-full bg-primary-500 mt-2 flex-shrink-0"></span>
            <span>Mobile Optimizations - Responsive design testing, touch interactions, mobile-specific UI adjustments, and performance optimization</span>
          </li>
        </ul>
      </div>
    )
  },
  {
    id: 15,
    type: 'content',
    title: 'Research',
    content: (
      <div className="space-y-4 text-center text-slate-700">
        <ul className="list-none space-y-3 inline-block" style={{ fontSize: 'clamp(1rem, 2vw, 1.5rem)' }}>
          <li className="flex items-start justify-center gap-2">
            <span className="w-2 h-2 rounded-full bg-primary-500 mt-2 flex-shrink-0"></span>
            <span>Research Methodology - Conducted a comprehensive study with Grade 7 students to measure the effectiveness of TutorCat</span>
          </li>
          <li className="flex items-start justify-center gap-2">
            <span className="w-2 h-2 rounded-full bg-secondary-500 mt-2 flex-shrink-0"></span>
            <span>Pre-test Assessment - Students took an initial English language proficiency test to establish baseline scores</span>
          </li>
          <li className="flex items-start justify-center gap-2">
            <span className="w-2 h-2 rounded-full bg-primary-500 mt-2 flex-shrink-0"></span>
            <span>One Month - Students used TutorCat platform for one month, completing lessons and activities at their own pace</span>
          </li>
          <li className="flex items-start justify-center gap-2">
            <span className="w-2 h-2 rounded-full bg-secondary-500 mt-2 flex-shrink-0"></span>
            <span>Post-test Assessment - Students retook the same proficiency test to measure improvement after using the platform</span>
          </li>
        </ul>
      </div>
    )
  },
  {
    id: 16,
    type: 'content',
    title: 'Results of Research',
    content: (
      <div className="space-y-4">
        <div className="bg-primary-50 rounded-lg p-4 border border-primary-200 mb-4">
          <ul className="list-none space-y-2 text-slate-700" style={{ fontSize: 'clamp(1rem, 2vw, 1.5rem)' }}>
            <li className="flex items-start gap-2">
              <span className="w-2 h-2 rounded-full bg-primary-500 mt-2 flex-shrink-0"></span>
              <span>Substantial improvement: Average score increased from 25 to 31 points</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="w-2 h-2 rounded-full bg-secondary-500 mt-2 flex-shrink-0"></span>
              <span>Consistent gains: All students showed improvement</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="w-2 h-2 rounded-full bg-primary-500 mt-2 flex-shrink-0"></span>
              <span>Significant progress: Point gain demonstrates measurable learning outcomes</span>
            </li>
          </ul>
        </div>
        <div className="bg-white rounded-lg p-3 md:p-4 border border-slate-200 max-h-[40vh] overflow-y-auto">
          <p className="text-xs md:text-sm font-semibold mb-2 text-center">Pre-test and Post-test Scores of Grade 7 Students</p>
          <div className="overflow-x-auto">
            <table className="min-w-full text-[10px] md:text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100">
                  <th className="border border-slate-300 px-1 md:px-2 py-1 text-left">Student ID</th>
                  <th className="border border-slate-300 px-1 md:px-2 py-1">Pre-test</th>
                  <th className="border border-slate-300 px-1 md:px-2 py-1">Post-test</th>
                  <th className="border border-slate-300 px-1 md:px-2 py-1">Improvement</th>
                </tr>
              </thead>
              <tbody>
                {[
                  [51032, 24, 30, 6], [51033, 26, 32, 6], [51034, 22, 27, 5],
                  [51035, 28, 34, 6], [51036, 25, 31, 6], [51037, 27, 33, 6],
                  [51038, 23, 29, 6], [51039, 29, 36, 7], [51040, 21, 26, 5],
                  [51041, 26, 32, 6], [51042, 24, 30, 6], [51043, 30, 37, 7],
                  [51044, 22, 28, 6], [51045, 27, 33, 6], [51046, 25, 31, 6],
                  [51047, 28, 35, 7], [51048, 23, 28, 5], [51049, 26, 32, 6],
                  [51050, 24, 30, 6], [51051, 29, 35, 6], [51052, 21, 27, 6],
                  [51053, 27, 33, 6]
                ].map(([id, pre, post, imp]) => (
                  <tr key={id} className="hover:bg-slate-50">
                    <td className="border border-slate-300 px-1 md:px-2 py-1">{id}</td>
                    <td className="border border-slate-300 px-1 md:px-2 py-1 text-center">{pre}</td>
                    <td className="border border-slate-300 px-1 md:px-2 py-1 text-center">{post}</td>
                    <td className="border border-slate-300 px-1 md:px-2 py-1 text-center text-green-600 font-semibold">+{imp}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 space-y-1 text-center" style={{ fontSize: 'clamp(1rem, 2vw, 1.5rem)' }}>
            <p><strong>Pre-test Mean:</strong> Baseline scores</p>
            <p><strong>Post-test Mean:</strong> Improved scores</p>
            <p className="text-green-600 font-semibold"><strong>Mean Gain:</strong> Significant point gain demonstrates measurable learning outcomes</p>
          </div>
        </div>
      </div>
    )
  },
  {
    id: 17,
    type: 'content',
    title: 'Benefits',
    content: (
      <div className="space-y-4 text-center text-slate-700">
        <ul className="list-none space-y-3 inline-block" style={{ fontSize: 'clamp(1rem, 2vw, 1.5rem)' }}>
          <li className="flex items-start justify-center gap-2">
            <span className="w-2 h-2 rounded-full bg-primary-500 mt-2 flex-shrink-0"></span>
            <span>Learn Any Time Anywhere - Access from any device - desktop, tablet, or mobile. No need to be in a classroom or follow a fixed schedule</span>
          </li>
          <li className="flex items-start justify-center gap-2">
            <span className="w-2 h-2 rounded-full bg-secondary-500 mt-2 flex-shrink-0"></span>
            <span>Go at Your Own Pace - Self-paced learning allows students to spend more time on difficult topics and move quickly through familiar material</span>
          </li>
          <li className="flex items-start justify-center gap-2">
            <span className="w-2 h-2 rounded-full bg-primary-500 mt-2 flex-shrink-0"></span>
            <span>Free for Our Students - No cost barriers - all students at our school have free access to comprehensive English learning resources</span>
          </li>
        </ul>
      </div>
    )
  },
  {
    id: 18,
    type: 'content',
    title: 'Scalability',
    content: (
      <div className="space-y-4 text-center text-slate-700">
        <ul className="list-none space-y-3 inline-block" style={{ fontSize: 'clamp(1rem, 2vw, 1.5rem)' }}>
          <li className="flex items-start justify-center gap-2">
            <span className="w-2 h-2 rounded-full bg-primary-500 mt-2 flex-shrink-0"></span>
            <span>Paid Tiers on Hosting and Database - Upgrade to premium hosting and database plans to support increased traffic and data storage needs</span>
          </li>
          <li className="flex items-start justify-center gap-2">
            <span className="w-2 h-2 rounded-full bg-secondary-500 mt-2 flex-shrink-0"></span>
            <span>Support More Users - Serverless architecture allows automatic scaling to handle thousands of concurrent users</span>
          </li>
          <li className="flex items-start justify-center gap-2">
            <span className="w-2 h-2 rounded-full bg-primary-500 mt-2 flex-shrink-0"></span>
            <span>Paid Plans for External Users - Offer subscription plans for students and learners outside our school to generate revenue</span>
          </li>
          <li className="flex items-start justify-center gap-2">
            <span className="w-2 h-2 rounded-full bg-secondary-500 mt-2 flex-shrink-0"></span>
            <span>Google Index - Optimize for search engines to increase discoverability and attract traffic</span>
          </li>
          <li className="flex items-start justify-center gap-2">
            <span className="w-2 h-2 rounded-full bg-primary-500 mt-2 flex-shrink-0"></span>
            <span>Promotion - Marketing campaigns, social media presence, and partnerships to expand user base</span>
          </li>
        </ul>
      </div>
    )
  },
  {
    id: 19,
    type: 'image',
    src: '/slides/Admin2.png',
    title: 'Conclusion',
    content: (
      <div className="space-y-3 text-center text-slate-700 flex flex-col items-center">
        <ul className="list-none space-y-3" style={{ fontSize: 'clamp(1rem, 2vw, 1.5rem)' }}>
          <li className="flex items-center justify-center gap-2">
            <span className="w-2 h-2 rounded-full bg-primary-500 flex-shrink-0"></span>
            <span>Built an interactive English learning platform with AI feedback for independent speaking practice</span>
          </li>
          <li className="flex items-center justify-center gap-2">
            <span className="w-2 h-2 rounded-full bg-secondary-500 flex-shrink-0"></span>
            <span>Implemented gamification features (XP points, achievements, daily streaks) to increase engagement</span>
          </li>
          <li className="flex items-center justify-center gap-2">
            <span className="w-2 h-2 rounded-full bg-primary-500 flex-shrink-0"></span>
            <span>Applied security measures (authentication and password protection) to keep student data safe</span>
          </li>
        </ul>
      </div>
    )
  }
]

export default function Presentation({ isOpen, onClose }: PresentationProps) {
  const [currentSlide, setCurrentSlide] = useState(0)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isMounted, setIsMounted] = useState(false)
  const [expandedImage, setExpandedImage] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const videoRefs = useRef<{ [key: number]: HTMLVideoElement | null }>({})

  // Ensure we're on the client before rendering
  useEffect(() => {
    setIsMounted(true)
  }, [])

  // Preload all media assets
  useEffect(() => {
    if (!isOpen) return

    const preloadAssets = async () => {
      setIsLoading(true)
      const promises: Promise<void>[] = []

      slides.forEach((slide) => {
        if (slide.type === 'video' && slide.src) {
          promises.push(
            fetchAndCacheVideo(slide.src).then(() => {}).catch(() => {
              console.warn(`Failed to preload video: ${slide.src}`)
            })
          )
        } else if (slide.type === 'image' && slide.src) {
          promises.push(
            cacheAsset(slide.src).then(() => {}).catch(() => {
              console.warn(`Failed to preload image: ${slide.src}`)
            })
          )
        }
      })

      await Promise.all(promises)
      setIsLoading(false)
    }

    preloadAssets()
  }, [isOpen])

  // Handle fullscreen
  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return

    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().then(() => {
        setIsFullscreen(true)
      }).catch(() => {
        console.warn('Failed to enter fullscreen')
      })
    } else {
      document.exitFullscreen().then(() => {
        setIsFullscreen(false)
      }).catch(() => {
        console.warn('Failed to exit fullscreen')
      })
    }
  }, [])

  // Handle fullscreen change events
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement)
    }

    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [])

  const goToNext = useCallback(() => {
    setCurrentSlide((prev) => {
      if (prev < slides.length - 1) {
        return prev + 1
      }
      return prev
    })
  }, [])

  const goToPrevious = useCallback(() => {
    setCurrentSlide((prev) => {
      if (prev > 0) {
        return prev - 1
      }
      return prev
    })
  }, [])

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return

    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        goToPrevious()
      } else if (e.key === 'ArrowRight') {
        goToNext()
      } else if (e.key === 'Escape') {
        if (expandedImage) {
          setExpandedImage(null)
        } else if (isFullscreen) {
          document.exitFullscreen()
        } else {
          onClose()
        }
      } else if (e.key === 'f' || e.key === 'F') {
        toggleFullscreen()
      }
    }

    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [isOpen, isFullscreen, onClose, toggleFullscreen, goToNext, goToPrevious, expandedImage])

  // Auto-play videos when slide changes
  useEffect(() => {
    const slide = slides[currentSlide]
    if (slide?.type === 'video' && slide.autoPlay) {
      const video = videoRefs.current[currentSlide]
      if (video) {
        video.play().catch(() => {
          console.warn('Failed to autoplay video')
        })
      }
    }

    // Pause other videos
    Object.values(videoRefs.current).forEach((video, index) => {
      if (video && index !== currentSlide) {
        video.pause()
        video.currentTime = 0
      }
    })
  }, [currentSlide])

  const goToSlide = (index: number) => {
    setCurrentSlide(index)
  }

  const handleRepeat = () => {
    setCurrentSlide(0)
  }

  const currentSlideData = slides[currentSlide]
  const isLastSlide = currentSlide === slides.length - 1

  // Lock body scroll when presentation is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isOpen])

  if (!isOpen || !isMounted) return null

  // Use portal for fullscreen presentation
  return createPortal(
    <div
      className="fixed inset-0 z-[9999] bg-secondary-50 flex flex-col"
      ref={containerRef}
    >
      {/* Header */}
      <div className="relative z-50 bg-white backdrop-blur-sm px-4 py-3 h-14 md:h-16 flex items-center justify-between border-b border-secondary-200 flex-shrink-0 shadow-sm">
          <div className="flex items-center gap-4">
            <span className="text-slate-800 text-sm font-medium">
              {currentSlide + 1} / {slides.length}
            </span>
            <span className="text-slate-600 text-sm">{currentSlideData.title}</span>
          </div>
          <button
            onClick={toggleFullscreen}
            className="text-slate-700 hover:text-primary-600 transition-colors p-2"
            aria-label="Toggle fullscreen"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {isFullscreen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
              )}
            </svg>
          </button>
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-y-auto min-h-0">
          <div className="flex items-center justify-center w-full p-2 md:p-4 py-4 md:py-6 min-h-full">
            {isLoading ? (
              <div className="text-center text-slate-700">
                <div className="animate-spin w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full mx-auto mb-4"></div>
                <p>Loading presentation...</p>
              </div>
            ) : (
              <div className="w-full max-w-7xl mx-auto flex items-center justify-center">
              <div className="bg-white rounded-lg shadow-2xl w-full flex flex-col">
                {/* Slide Content */}
                <div className={`relative flex flex-col justify-center p-2 md:p-4 lg:p-6 ${currentSlide === 10 ? 'bg-transparent' : 'bg-slate-100'}`}>
                  {/* Special layout for slide 2, 11, 12 & 19: media on left, text on right */}
                  {((currentSlideData.id === 2 && currentSlideData.type === 'image') || (currentSlideData.id === 11 && currentSlideData.type === 'image') || (currentSlideData.id === 12 && currentSlideData.type === 'image') || (currentSlideData.id === 19 && currentSlideData.type === 'image')) && currentSlideData.src && currentSlideData.content ? (
                    <div className="flex flex-col md:flex-row items-center justify-center gap-2 md:gap-4 lg:gap-6 w-full">
                      {/* Media on left */}
                      <div className="flex-1 flex items-center justify-center max-w-full md:max-w-[50%]">
                        <div className="w-full flex items-center justify-center">
                          <CachedImage
                            src={currentSlideData.src}
                            alt={currentSlideData.title || 'Slide image'}
                            className="object-contain cursor-pointer hover:opacity-90 transition-opacity"
                            style={
                              currentSlideData.id === 2 
                                ? { maxWidth: 'min(480px, 40vw)', width: '100%', maxHeight: '100%' }
                                : currentSlideData.id === 11
                                ? { maxWidth: 'min(300px, 25vw)', width: '100%', maxHeight: '100%' }
                                : currentSlideData.id === 12
                                ? { maxWidth: 'min(350px, 30vw)', width: '100%', maxHeight: '100%' }
                                : { maxWidth: '100%', maxHeight: '100%' }
                            }
                            onClick={() => setExpandedImage(currentSlideData.src!)}
                          />
                        </div>
                      </div>
                      {/* Text on right */}
                      <div className={`flex-1 flex flex-col justify-center max-w-full md:max-w-[50%] ${(currentSlideData.id === 12 || currentSlideData.id === 19) ? 'items-center' : ''}`}>
                        <h2 className={`font-bold mb-2 md:mb-3 lg:mb-4 text-primary-600 ${(currentSlideData.id === 12 || currentSlideData.id === 19) ? 'text-center' : 'text-left'}`} style={{ fontSize: 'clamp(2rem, 4vw, 3rem)' }}>
                          {currentSlideData.title}
                        </h2>
                        <div className={`text-slate-700 ${(currentSlideData.id === 12 || currentSlideData.id === 19) ? 'text-center flex flex-col items-center' : 'text-left'}`} style={{ fontSize: 'clamp(1rem, 2vw, 1.5rem)' }}>
                          {currentSlideData.content}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <>
                      {/* Media (Image or Video) */}
                      {(currentSlideData.type === 'video' || currentSlideData.type === 'image') && currentSlideData.src && (
                        <div className="relative w-full flex items-center justify-center flex-1 p-2 md:p-4 bg-transparent" style={{ maxHeight: currentSlideData.content ? '60%' : '100%', minHeight: 0 }}>
                          {currentSlideData.type === 'video' && (
                            <div className="flex items-center justify-center bg-transparent w-full h-full" style={currentSlide === 10 ? { maxWidth: 'min(200px, 15vw)', maxHeight: 'min(300px, 40vh)' } : { maxWidth: '100%', maxHeight: '100%' }}>
                              <VideoPlayer
                                src={currentSlideData.src}
                                autoPlay={currentSlideData.autoPlay}
                                loop={currentSlideData.loop}
                                className="w-full h-full object-contain bg-transparent"
                                style={currentSlide === 10 ? { maxWidth: 'min(200px, 15vw)', maxHeight: 'min(300px, 40vh)', background: 'transparent' } : { maxWidth: '100%', maxHeight: '100%', background: 'transparent' }}
                                onVideoRef={(video) => {
                                  videoRefs.current[currentSlide] = video
                                }}
                              />
                            </div>
                          )}
                          {currentSlideData.type === 'image' && (
                            <div className="w-full flex items-center justify-center h-full">
                              <CachedImage
                                src={currentSlideData.src}
                                alt={currentSlideData.title || 'Slide image'}
                                className="max-w-full object-contain cursor-pointer hover:opacity-90 transition-opacity"
                                style={{ maxHeight: '100%', maxWidth: '100%' }}
                                onClick={() => setExpandedImage(currentSlideData.src!)}
                              />
                            </div>
                          )}
                        </div>
                      )}
                      
                      {/* Content Section - Show below media if both exist */}
                      {currentSlideData.content && (currentSlideData.type === 'video' || currentSlideData.type === 'image') && (
                        <div className="w-full flex-shrink-0 p-2 md:p-4 lg:p-6 bg-gradient-to-b from-white to-primary-50/30 border-t border-primary-200">
                          <div className="max-w-4xl mx-auto flex flex-col justify-center">
                            <h2 className="font-bold text-center mb-2 md:mb-3 lg:mb-4 text-primary-600" style={{ fontSize: 'clamp(2rem, 4vw, 3rem)' }}>
                              {currentSlideData.title}
                            </h2>
                            <div className="text-center text-slate-700" style={{ fontSize: 'clamp(1rem, 2vw, 1.5rem)' }}>
                              {currentSlideData.content}
                            </div>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                  
                  {/* Content-only slides */}
                  {currentSlideData.type === 'content' && !currentSlideData.src && (
                    <div className="w-full flex-1 flex items-center justify-center p-1 md:p-2 lg:p-3 bg-gradient-to-br from-white via-primary-50/20 to-secondary-50/20">
                      <div className="max-w-4xl w-full flex flex-col justify-center" style={currentSlideData.id === 10 ? { transform: 'scale(0.9)', transformOrigin: 'center' } : {}}>
                        <h2 className="font-bold text-center mb-1 md:mb-2 lg:mb-3 text-primary-600 flex-shrink-0" style={{ fontSize: 'clamp(2rem, 4vw, 3rem)' }}>
                          {currentSlideData.title}
                        </h2>
                        <div className="text-center text-slate-700 flex-1 flex items-center justify-center" style={{ fontSize: 'clamp(1rem, 2vw, 1.5rem)' }}>
                          {currentSlideData.content}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
            )}
          </div>
        </div>

        {/* Navigation Arrows */}
        {!isLoading && (
          <>
            {currentSlide > 0 && (
              <button
                onClick={goToPrevious}
                className="absolute left-4 top-1/2 -translate-y-1/2 z-40 bg-white/90 hover:bg-white text-slate-800 rounded-full p-3 shadow-lg transition-all hover:scale-110"
                aria-label="Previous slide"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            )}
            {!isLastSlide && (
              <button
                onClick={goToNext}
                className="absolute right-4 top-1/2 -translate-y-1/2 z-40 bg-white/90 hover:bg-white text-slate-800 rounded-full p-3 shadow-lg transition-all hover:scale-110"
                aria-label="Next slide"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            )}
          </>
        )}

        {/* Footer with controls */}
        <div className="relative z-50 bg-white/90 backdrop-blur-sm px-4 py-3 border-t border-secondary-200 flex-shrink-0 shadow-sm">
          <div className="flex items-center justify-between max-w-7xl mx-auto gap-4">
            {/* Slide indicators */}
            <div className="flex gap-1 overflow-x-auto flex-1 min-w-0">
              {slides.map((_, index) => (
                <button
                  key={index}
                  onClick={() => goToSlide(index)}
                  className={`min-w-[8px] h-2 rounded-full transition-all ${
                    index === currentSlide
                      ? 'bg-primary-500 w-8'
                      : 'bg-white/30 hover:bg-white/50'
                  }`}
                  aria-label={`Go to slide ${index + 1}`}
                />
              ))}
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-2">
              {isLastSlide && (
                <Button
                  onClick={handleRepeat}
                  variant="primary"
                  size="sm"
                >
                  Repeat
                </Button>
              )}
              <Button
                onClick={onClose}
                variant="secondary"
                size="sm"
              >
                Close
              </Button>
            </div>
          </div>
        </div>

        {/* Expanded Image Modal */}
        {expandedImage && (
          <div
            className="fixed inset-0 z-[10000] bg-black/90 flex items-center justify-center p-4"
            onClick={() => setExpandedImage(null)}
          >
            <div className="relative max-w-full max-h-full" onClick={(e) => e.stopPropagation()}>
              <CachedImage
                src={expandedImage}
                alt="Expanded image"
                className="max-w-[100vw] max-h-[100vh] object-contain"
              />
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setExpandedImage(null)
                }}
                className="absolute top-4 right-4 text-white hover:text-primary-400 transition-colors p-2 bg-black/50 rounded-full"
                aria-label="Close expanded image"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        )}
    </div>,
    document.body
  )
}
