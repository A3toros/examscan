import { Handler } from '@netlify/functions';
import { neon } from '@neondatabase/serverless';
import { validateJWT } from './auth-validate-jwt.js';

const handler: Handler = async (event, context) => {
  // Only allow GET requests
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: false, error: 'Method not allowed' })
    } as any;
  }

  try {
    // Validate authentication
    const cookies = event.headers?.cookie || '';
    const token = cookies.split(';').find(c => c.trim().startsWith('access_token='))?.split('=')[1];

    if (!token) {
      return {
        statusCode: 401,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: false, error: 'Authentication required' })
      } as any;
    }

    const auth = await validateJWT(token);
    if (!auth.isValid || !auth.user) {
      return {
        statusCode: 401,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: false, error: 'Invalid authentication' })
      } as any;
    }

    const userId = auth.user.id;

    // Get database connection
    const databaseUrl = process.env.NEON_DATABASE_URL;
    if (!databaseUrl) {
      console.error('NEON_DATABASE_URL not configured');
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: false, error: 'Database configuration error' })
      } as any;
    }

    const sql = neon(databaseUrl);

    // Get user's evaluation test result
    const userData = await sql`
      SELECT eval_test_result FROM users WHERE id = ${userId}
    `;
    const evalTestResult = userData.length > 0 ? userData[0].eval_test_result : null;

    // OPTIMIZED: Direct query filtered by user's level only
    // Get user progress data for lessons in the user's current level only
    const currentLevel = auth.user.level;
    
    const progressData = currentLevel && currentLevel !== 'Not Assessed'
      ? await sql`
        SELECT 
          l.id as lesson_id,
          l.level,
          l.topic,
          l.lesson_number,
          ${userId}::UUID as user_id,
          COALESCE(up.score, 0) as score,
          COALESCE(up.completed, FALSE) as completed,
          up.completed_at,
          COALESCE(up.attempts, 0) as attempts
        FROM lessons l
        LEFT JOIN user_progress up ON up.lesson_id = l.id AND up.user_id = ${userId}
        WHERE l.level = ${currentLevel}
        ORDER BY l.lesson_number
      `
      : []; // Return empty array if no level assigned

    // Calculate overall statistics
    const totalLessons = progressData.length;
    const completedLessons = progressData.filter((p: any) => p.completed).length;
    const totalStars = completedLessons; // 1 star per completed lesson

    // Calculate level progress (progressData is already filtered by level)
    const levelCompleted = progressData.filter((p: any) => p.completed).length;
    const levelTotal = progressData.length;
    const levelProgress = levelTotal > 0 ? Math.round((levelCompleted / levelTotal) * 100) : 0;

    // Get overall completion percentage
    const overallStats = progressData.length > 0 ? progressData[0] : null;
    const completionPercentage = overallStats?.completion_percentage || 0;

    // Get level-specific title using the database function
    let currentTitle = 'Tiny Whisker';
    let nextTitle = 'Soft Paw';
    let nextTitleLessonsNeeded: number | null = null;
    
    if (currentLevel) {
      // Get current title for the user's level
      const titleResult = await sql`
        SELECT get_user_title_by_level(${userId}, ${currentLevel}) as current_title
      `;
      currentTitle = titleResult[0]?.current_title || 'Tiny Whisker';

      // Get lessons needed for next title
      const nextTitleResult = await sql`
        SELECT get_next_title_lessons_needed(${userId}, ${currentLevel}) as lessons_needed
      `;
      nextTitleLessonsNeeded = nextTitleResult[0]?.lessons_needed || null;

      // Calculate next title name based on current title and level
      // Title sequences for each level (10 titles each)
      const titleSequences: Record<string, string[]> = {
        'A1': ['Tiny Whisker', 'Soft Paw', 'Curious Kitten', 'Bright Eyes', 'Happy Purr', 'Magic Meow', 'Wiggly Tail', 'Spark Paw', 'Charm Cat', 'Glow Whisker'],
        'A2': ['Sunny Purr', 'Twinkle Fur', 'Clever Kitty', 'Moon Meow', 'Gentle Spellcat', 'Starry Whisker', 'Dreamy Paws', 'Golden Meow', 'Lucky Cat', 'Whisper Whisker'],
        'B1': ['Silky Paws', 'Dancing Tail', 'Shimmer Cat', 'Velvet Purr', 'Crystal Eyes', 'Rainbow Whisker', 'Cosmic Kitty', 'Aurora Meow', 'Nebula Paws', 'Stardust Tail'],
        'B2': ['Galaxy Cat', 'Celestial Whisker', 'Ethereal Purr', 'Mystic Eyes', 'Enchanted Kitty', 'Sage Meow', 'Wise Whisker', 'Noble Paws', 'Royal Tail', 'Majestic Cat'],
        'C1': ['Regal Purr', 'Crown Whisker', 'Throne Kitty', 'Empire Meow', 'Legendary Paws', 'Mythic Tail', 'Ancient Cat', 'Timeless Whisker', 'Eternal Purr', 'Immortal Eyes'],
        'C2': ['Divine Kitty', 'Sacred Meow', 'Holy Whisker', 'Transcendent Paws', 'Ascended Tail', 'Enlightened Cat', 'Awakened Purr', 'Master Whisker', 'Grandmaster Kitty', 'TutorCat']
      };

      const levelTitles = titleSequences[currentLevel] || titleSequences['A1'];
      const currentIndex = levelTitles.indexOf(currentTitle);
      
      if (currentIndex >= 0 && currentIndex < levelTitles.length - 1) {
        nextTitle = levelTitles[currentIndex + 1];
      } else if (currentIndex === levelTitles.length - 1 && currentTitle === 'TutorCat') {
        // At max title (TutorCat) - no next title
        nextTitle = 'Max Level Reached';
        nextTitleLessonsNeeded = null;
      } else if (currentIndex === levelTitles.length - 1) {
        // At max title for this level, but not TutorCat yet
        // Check if there's a next level
        const levels = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
        const currentLevelIndex = levels.indexOf(currentLevel);
        if (currentLevelIndex >= 0 && currentLevelIndex < levels.length - 1) {
          // Next level's first title
          const nextLevel = levels[currentLevelIndex + 1];
          nextTitle = titleSequences[nextLevel][0];
        } else {
          // At max level, next is TutorCat
          nextTitle = 'TutorCat';
        }
      }
    }

    // Get recent lessons (last 5 completed)
    const recentLessons = progressData
      .filter((p: any) => p.completed)
      .sort((a: any, b: any) => new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime())
      .slice(0, 5)
      .map((lesson: any) => ({
        id: lesson.lesson_id,
        title: lesson.topic,
        level: lesson.level,
        score: lesson.score,
        completedAt: lesson.completed_at,
        stars: 1 // 1 star per completed lesson
      }));

    // Calculate weekly progress (count unique days with completed lessons this week)
    const weeklyGoal = 7; // days per week
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay()); // Sunday
    startOfWeek.setHours(0, 0, 0, 0);
    
    // Get unique days in current week where user completed at least one lesson
    const completedLessonsThisWeek = progressData
      .filter((p: any) => p.completed && p.completed_at)
      .map((p: any) => {
        const completedDate = new Date(p.completed_at);
        return completedDate >= startOfWeek ? completedDate.toDateString() : null;
      })
      .filter((date: string | null) => date !== null);
    
    const uniqueDaysThisWeek = new Set(completedLessonsThisWeek).size;
    const weeklyProgress = Math.min(uniqueDaysThisWeek, weeklyGoal);
    
    // Calculate current streak (consecutive days with at least one completed lesson)
    const completedDates = progressData
      .filter((p: any) => p.completed && p.completed_at)
      .map((p: any) => {
        const date = new Date(p.completed_at);
        date.setHours(0, 0, 0, 0);
        return date.toISOString().split('T')[0]; // YYYY-MM-DD format
      })
      .filter((date: string) => date !== null);
    
    const uniqueCompletedDates = [...new Set(completedDates)].sort().reverse(); // Most recent first
    
    let currentStreak = 0;
    if (uniqueCompletedDates.length > 0) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayStr = today.toISOString().split('T')[0];
      
      // Check if today or yesterday has a completion
      let checkDate = new Date(today);
      let checkDateStr = checkDate.toISOString().split('T')[0];
      
      // Start from today or yesterday (if today has no completion, streak can start from yesterday)
      if (!uniqueCompletedDates.includes(todayStr)) {
        checkDate.setDate(checkDate.getDate() - 1);
        checkDateStr = checkDate.toISOString().split('T')[0];
      }
      
      // Count consecutive days backwards
      for (let i = 0; i < uniqueCompletedDates.length; i++) {
        const expectedDate = new Date(checkDate);
        expectedDate.setDate(checkDate.getDate() - i);
        const expectedDateStr = expectedDate.toISOString().split('T')[0];
        
        if (uniqueCompletedDates.includes(expectedDateStr)) {
          currentStreak++;
        } else {
          break;
        }
      }
    }
    
    // Cap streak at 30 days
    currentStreak = Math.min(currentStreak, 30);

    // Get last 4 earned achievements
    let lastEarnedAchievements: Array<{
      code: string;
      name: string;
      icon: string;
      earnedAt: Date | string;
    }> = [];
    try {
      const lastAchievementsResult = await sql`
        SELECT 
          a.code,
          a.name,
          a.icon,
          ua.earned_at
        FROM user_achievements ua
        JOIN achievements a ON ua.achievement_id = a.id
        WHERE ua.user_id = ${userId}
        ORDER BY ua.earned_at DESC
        LIMIT 4
      `;
      
      lastEarnedAchievements = lastAchievementsResult.map((row: any) => ({
        code: row.code,
        name: row.name,
        icon: row.icon,
        earnedAt: row.earned_at
      }));
    } catch (achievementError) {
      // Log but don't fail dashboard load
      console.error('Error fetching last achievements:', achievementError);
    }

    const dashboardData = {
      user: auth.user,
      progress: {
        currentLevel: currentLevel || 'Not Assessed',
        levelProgress: currentLevel ? levelProgress : 0,
        levelCompleted,
        levelTotal,
        completionPercentage: currentLevel ? levelProgress : completionPercentage, // Use level-specific progress for current level
        overallCompletionPercentage: completionPercentage, // Keep overall for reference
        currentTitle: currentLevel ? currentTitle : 'Take Evaluation',
        nextTitle: currentLevel ? nextTitle : 'Complete Assessment',
        nextTitleLessonsNeeded: currentLevel ? nextTitleLessonsNeeded : null,
        totalStars,
        totalLessons,
        completedLessons
      },
      recentLessons,
      weeklyGoal,
      weeklyProgress,
      currentStreak,
      dailyGoal: 1,
      dailyProgress: completedLessons > 0 ? 1 : 0,
      evalTestResult,
      lastEarnedAchievements
    };

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        data: dashboardData
      })
    } as any;

  } catch (error) {
    console.error('Dashboard data error:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: false, error: 'Failed to load dashboard data' })
    } as any;
  }
};

export { handler };
