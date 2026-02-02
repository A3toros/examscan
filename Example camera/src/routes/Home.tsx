import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { activities } from './activities/activityList'
import { SnowfallBackground } from '../components/ui/snowfall-background'

const Home = () => {
  return (
    <main className="min-h-screen text-white relative bg-[#c60f0f]">
      {/* Snowfall Background */}
      <SnowfallBackground density={0.3} />
      
      {/* Banner - Separate at the top */}
      <section className="relative z-10 w-full">
        <div className="relative w-full h-[40vh] min-h-[300px] max-h-[500px] overflow-hidden">
          <img
            src="/banner.png"
            alt="Christmas Banner"
            className="absolute inset-0 w-full h-full object-cover"
            loading="eager"
            fetchPriority="high"
            onError={(e) => {
              // Fallback if image doesn't exist
              e.currentTarget.style.display = 'none'
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[#c60f0f]/80" />
          <div className="absolute inset-0 flex items-center justify-center">
            <motion.h1
              className="text-4xl md:text-6xl font-bold tracking-wide text-white"
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
              style={{ textShadow: '0 0 20px rgba(0, 0, 0, 0.8), 0 0 40px rgba(0, 0, 0, 0.6)' }}
            >
              Christmas AI Miracle
            </motion.h1>
          </div>
        </div>
      </section>
      
      {/* Content Section */}
      <div className="px-6 py-10 md:px-12 lg:px-20 relative z-10">
        <div className="mx-auto max-w-6xl space-y-1 rounded-3xl bg-[#c60f0f]/20 p-8 shadow-[0_0_40px_rgba(220,38,38,0.1)] border-2 border-white relative z-10">
          
          {/* Header */}
          <section className="text-center rounded-2xl bg-[#c60f0f]/30 p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3, duration: 0.8 }}
              className="flex flex-col items-center gap-4"
            >
              <img
                src="/christmas.png"
                alt="Christmas Tree"
                className="w-36 md:w-44 h-auto"
                loading="lazy"
              />
              <motion.p
                className="text-xl md:text-2xl text-white/90"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5, duration: 0.8 }}
              >
                Merry Christmas from Mathayomwatsing!
              </motion.p>
            </motion.div>
          </section>

          {/* Activities Grid */}
          <section className="space-y-8 rounded-2xl bg-[#c60f0f]/30 p-6">
            <h2 className="font-display text-2xl text-white text-center">Activities</h2>
            <div className="grid gap-6 md:grid-cols-2">
              {activities.map((activity, index) => (
                <Link
                  key={activity.slug}
                  to={`/activity/${activity.slug}`}
                  className="block h-full"
                >
                  <motion.article
                    className="rounded-2xl border-2 border-white bg-[#00fa68]/60 p-6 transition hover:-translate-y-1 hover:border-white hover:bg-[#55e084]/90 hover:shadow-[0_0_30px_rgba(34,197,94,0.4)] cursor-pointer h-full flex flex-col"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: index * 0.1 }}
                  >
                    <div className={activity.slug === 'become-santa' || activity.slug === 'speak-with-santa' || activity.slug === 'give-santa-ride' || activity.slug === 'destroy-christmas' ? 'flex items-center gap-3 flex-1' : 'flex-1'}>
                      {(activity.slug === 'become-santa' || activity.slug === 'speak-with-santa' || activity.slug === 'give-santa-ride' || activity.slug === 'destroy-christmas') && (
                        <img
                          src={activity.slug === 'become-santa' ? '/santa.png' : activity.slug === 'speak-with-santa' ? '/speak.png' : activity.slug === 'give-santa-ride' ? '/deer.png' : '/evil-santa.png'}
                          alt={activity.slug === 'become-santa' ? 'Santa Claus' : activity.slug === 'speak-with-santa' ? 'Speak with Santa' : activity.slug === 'give-santa-ride' ? 'Give Santa a Ride' : 'Destroy Christmas'}
                          className="w-12 h-12 flex-shrink-0"
                          loading="lazy"
                        />
                      )}
                      <div>
                        <h3 className="font-display text-xl text-white mb-2">{activity.title}</h3>
                        <p className="text-sm text-white/80">{activity.description}</p>
                      </div>
                    </div>
                  </motion.article>
                </Link>
              ))}
            </div>
          </section>
        </div>
      </div>
      
      {/* Footer - Outside container */}
      <footer className="relative z-10 flex flex-col gap-2 text-center text-sm text-white/70 rounded-2xl bg-[#c60f0f]/30 p-6 mx-6 mb-6 md:mx-12 lg:mx-20">
        <span>Mathayomwatsing EP Christmas 2025</span>
      </footer>
    </main>
  )
}

export default Home

