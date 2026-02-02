import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Home from './routes/Home'
import { activities } from './routes/activities/activityList'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        {activities.map((activity) => (
          <Route key={activity.slug} path={`/activity/${activity.slug}`} element={<activity.component />} />
        ))}
      </Routes>
    </BrowserRouter>
  )
}

export default App

