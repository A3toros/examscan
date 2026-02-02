import { Handler } from '@netlify/functions';
import { neon } from '@neondatabase/serverless';

// Admin authentication middleware
async function authenticateAdmin(event: any): Promise<boolean> {
  try {
    let token = null;

    // Try Authorization header first
    const authHeader = event.headers?.authorization || event.headers?.Authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    } else {
      // Fall back to cookie (check both lowercase and uppercase)
      const cookies = event.headers?.cookie || event.headers?.Cookie || '';
      const cookieArray = cookies.split(';');
      const tokenCookie = cookieArray.find((c: string) => c.trim().startsWith('admin_token='));

      if (tokenCookie) {
        token = tokenCookie.split('=')[1];
      }
    }

    if (!token) {
      return false;
    }

    const jwt = await import('jsonwebtoken');
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) return false;

    const decoded = jwt.verify(token, jwtSecret) as any;
    return decoded.role === 'admin';
  } catch (error) {
    return false;
  }
}

export const handler: Handler = async (event) => {
  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  }

  // Handle preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: '',
    }
  }

  try {
    // Check admin authentication
    const isAdmin = await authenticateAdmin(event);
    if (!isAdmin) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ success: false, error: 'Admin authentication required' })
      }
    }

    // Get database connection
    const databaseUrl = process.env.NEON_DATABASE_URL;
    if (!databaseUrl) {
      console.error('NEON_DATABASE_URL not configured');
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ success: false, error: 'Database configuration error' })
      }
    }

    const sql = neon(databaseUrl);

    if (event.httpMethod === 'GET') {
      const lessonId = event.queryStringParameters?.id;
      const checkStudentData = event.queryStringParameters?.checkStudentData === 'true';

      // Check for student data (for warning modal)
      if (lessonId && checkStudentData) {
        const studentDataCheck = await sql`
          SELECT 
            (SELECT COUNT(*) FROM lesson_activity_results WHERE lesson_id = ${lessonId})::int as activity_results_count,
            (SELECT COUNT(*) FROM user_progress WHERE lesson_id = ${lessonId})::int as progress_count
        `;

        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            success: true,
            studentData: {
              activityResults: parseInt(studentDataCheck[0].activity_results_count),
              progress: parseInt(studentDataCheck[0].progress_count)
            }
          })
        }
      }

      if (lessonId) {
        // Get single lesson with full details
        const lessonResult = await sql`
          SELECT
            l.id,
            l.level,
            l.topic,
            l.lesson_number,
            l.created_at,
            l.updated_at,
            json_agg(
              json_build_object(
                'id', la.id,
                'activity_type', la.activity_type,
                'activity_order', la.activity_order,
                'title', COALESCE(la.title, la.content->>'title'), -- Use column or fallback to content
                'description', COALESCE(la.description, la.content->>'description'), -- Use column or fallback to content
                'estimated_time_seconds', la.estimated_time_seconds,
                'content', la.content,
                'vocabulary_items', COALESCE(vocab_data.items, '[]'::json),
                'grammar_sentences', COALESCE(grammar_data.sentences, '[]'::json),
                'created_at', la.created_at,
                'updated_at', la.updated_at
              ) ORDER BY la.activity_order
            ) as activities
          FROM lessons l
          LEFT JOIN lesson_activities la ON l.id = la.lesson_id AND la.active = TRUE
          LEFT JOIN (
            SELECT
              activity_id,
              json_agg(
                json_build_object(
                  'id', id,
                  'english_word', english_word,
                  'thai_translation', thai_translation,
                  'audio_url', audio_url
                )
              ) as items
            FROM vocabulary_items
            GROUP BY activity_id
          ) vocab_data ON la.id = vocab_data.activity_id
          LEFT JOIN (
            SELECT
              activity_id,
              json_agg(
                json_build_object(
                  'id', id,
                  'original_sentence', original_sentence,
                  'correct_sentence', correct_sentence,
                  'words_array', words_array
                )
              ) as sentences
            FROM grammar_sentences
            GROUP BY activity_id
          ) grammar_data ON la.id = grammar_data.activity_id
          WHERE l.id = ${lessonId}
          GROUP BY l.id, l.level, l.topic, l.lesson_number, l.created_at, l.updated_at
        `;

        if (lessonResult.length === 0) {
          return {
            statusCode: 404,
            headers,
            body: JSON.stringify({ success: false, error: 'Lesson not found' })
          }
        }

        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            success: true,
            lesson: lessonResult[0]
          })
        }
      } else {
        // Get all lessons with statistics
        const lessonsResult = await sql`
          SELECT
            l.id,
            l.level,
            l.topic,
            l.lesson_number,
            l.created_at,
            l.updated_at,
            COUNT(DISTINCT la.id) FILTER (WHERE la.active = TRUE) as activity_count,
            COUNT(DISTINCT up.user_id) as completion_count,
            ROUND(AVG(up.score), 1) as average_score
          FROM lessons l
          LEFT JOIN lesson_activities la ON l.id = la.lesson_id AND la.active = TRUE
          LEFT JOIN user_progress up ON l.id = up.lesson_id AND up.completed = true
          GROUP BY l.id, l.level, l.topic, l.lesson_number, l.created_at, l.updated_at
          ORDER BY l.level, l.lesson_number
        `;

        // Debug logging
        console.log('Admin-lessons: Total lessons returned:', lessonsResult.length);
        const a1Lessons = lessonsResult.filter((l: any) => l.level === 'A1');
        console.log('Admin-lessons: A1 lessons count:', a1Lessons.length);
        console.log('Admin-lessons: A1 lesson numbers:', a1Lessons.map((l: any) => l.lesson_number).sort((a: number, b: number) => a - b));
        const levelCounts: any = {};
        lessonsResult.forEach((l: any) => {
          const level = l.level;
          levelCounts[level] = (levelCounts[level] || 0) + 1;
        });
        console.log('Admin-lessons: Level counts:', levelCounts);

        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            success: true,
            lessons: lessonsResult
          })
        }
      }

    } else if (event.httpMethod === 'POST') {
      // Create new lesson with activities
      let requestData;
      try {
        requestData = JSON.parse(event.body || '{}');
      } catch (error) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ success: false, error: 'Invalid JSON payload' })
        }
      }

      const { lesson, activities } = requestData;

      if (!lesson || !lesson.level || !lesson.lesson_number || !lesson.topic) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ success: false, error: 'Lesson level, lesson number, and topic are required' })
        }
      }

      if (!activities || !Array.isArray(activities) || activities.length === 0) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ success: false, error: 'At least one activity is required' })
        }
      }

      try {
        // Start transaction
        await sql`BEGIN`;

        // Insert lesson
        const lessonResult = await sql`
          INSERT INTO lessons (id, level, lesson_number, topic)
          VALUES (${lesson.id}, ${lesson.level}, ${lesson.lesson_number}, ${lesson.topic})
          RETURNING *
        `;

        const createdLesson = lessonResult[0];

        // Insert activities and their related data
        for (const activity of activities) {
          // Extract title/description from activity level or content (for backward compatibility)
          const activityTitle = activity.title || activity.content?.title || null
          const activityDescription = activity.description || activity.content?.description || null
          const activityEstimatedTime = activity.estimated_time_seconds || activity.content?.estimated_time_seconds || null
          
          // Insert activity with metadata
          const activityResult = await sql`
            INSERT INTO lesson_activities (
              lesson_id, 
              activity_type, 
              activity_order, 
              content,
              title,
              description,
              estimated_time_seconds
            )
            VALUES (
              ${createdLesson.id}, 
              ${activity.activity_type}, 
              ${activity.activity_order}, 
              ${JSON.stringify(activity.content)},
              ${activityTitle},
              ${activityDescription},
              ${activityEstimatedTime}
            )
            RETURNING id
          `;

          const activityId = activityResult[0].id;

          // Insert vocabulary items if they exist
          if (activity.vocabulary_items && Array.isArray(activity.vocabulary_items)) {
            for (const vocabItem of activity.vocabulary_items) {
              if (vocabItem.english_word && vocabItem.thai_translation) {
                await sql`
                  INSERT INTO vocabulary_items (activity_id, english_word, thai_translation, audio_url)
                  VALUES (${activityId}, ${vocabItem.english_word}, ${vocabItem.thai_translation}, ${vocabItem.audio_url || null})
                `;
              }
            }
          }

          // Insert grammar sentences if they exist
          if (activity.grammar_sentences && Array.isArray(activity.grammar_sentences)) {
            for (const grammarSentence of activity.grammar_sentences) {
              if (grammarSentence.original_sentence && grammarSentence.correct_sentence && grammarSentence.words_array) {
                await sql`
                  INSERT INTO grammar_sentences (activity_id, original_sentence, correct_sentence, words_array)
                  VALUES (${activityId}, ${grammarSentence.original_sentence}, ${grammarSentence.correct_sentence}, ${JSON.stringify(grammarSentence.words_array)})
                `;
              }
            }
          }
        }

        // Commit transaction
        await sql`COMMIT`;

        return {
          statusCode: 201,
          headers,
          body: JSON.stringify({
            success: true,
            lesson: createdLesson,
            message: 'Lesson created successfully with all activities'
          })
        }
      } catch (error) {
        // Rollback on error
        await sql`ROLLBACK`;
        console.error('Error creating lesson:', error);
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({ success: false, error: 'Failed to create lesson: ' + (error instanceof Error ? error.message : String(error)) })
        }
      }

    } else if (event.httpMethod === 'PUT') {
      // Update lesson with activities
      let updateData;
      try {
        updateData = JSON.parse(event.body || '{}');
      } catch (error) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ success: false, error: 'Invalid JSON payload' })
        }
      }

      const { lesson, activities } = updateData;

      if (!lesson || !lesson.id) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ success: false, error: 'Lesson ID is required' })
        }
      }

      try {
        // Start transaction
        await sql`BEGIN`;

        // Get current version for history
        const currentLesson = await sql`
          SELECT version, level, topic, lesson_number
          FROM lessons
          WHERE id = ${lesson.id}
          LIMIT 1
        `;

        const currentVersion = currentLesson.length > 0 ? parseInt(currentLesson[0].version) : 1;
        const newVersion = currentVersion + 1;

        // Update lesson with version increment
        const lessonResult = await sql`
          UPDATE lessons
          SET level = ${lesson.level}, lesson_number = ${lesson.lesson_number}, topic = ${lesson.topic},
              version = ${newVersion},
              last_modified_at = NOW(),
              updated_at = NOW()
          WHERE id = ${lesson.id}
          RETURNING *
        `;

        if (lessonResult.length === 0) {
          await sql`ROLLBACK`;
          return {
            statusCode: 404,
            headers,
            body: JSON.stringify({ success: false, error: 'Lesson not found' })
          }
        }

        const updatedLesson = lessonResult[0];

        // Check if lesson has student data
        const studentDataCheck = await sql`
          SELECT 
            (SELECT COUNT(*) FROM lesson_activity_results WHERE lesson_id = ${lesson.id})::int as activity_results_count,
            (SELECT COUNT(*) FROM user_progress WHERE lesson_id = ${lesson.id})::int as progress_count
        `;

        const hasStudentData = 
          parseInt(studentDataCheck[0].activity_results_count) > 0 ||
          parseInt(studentDataCheck[0].progress_count) > 0;

        // Get admin user ID for history tracking
        let adminUserId: string | null = null;
        try {
          let token = null;
          const authHeader = event.headers?.authorization || event.headers?.Authorization;
          if (authHeader && authHeader.startsWith('Bearer ')) {
            token = authHeader.substring(7);
          } else {
            const cookies = event.headers?.cookie || event.headers?.Cookie || '';
            const cookieArray = cookies.split(';');
            const tokenCookie = cookieArray.find((c: string) => c.trim().startsWith('admin_token='));
            if (tokenCookie) {
              token = tokenCookie.split('=')[1];
            }
          }
          
          if (token) {
            const jwt = await import('jsonwebtoken');
            const jwtSecret = process.env.JWT_SECRET;
            if (jwtSecret) {
              const decoded = jwt.verify(token, jwtSecret) as any;
              adminUserId = decoded.id || decoded.userId || null;
            }
          }
        } catch (error) {
          // If we can't get admin ID, continue without it
          console.warn('Could not extract admin user ID for history:', error);
        }

        // Create history record with changes snapshot
        const changesSnapshot = {
          before: currentLesson.length > 0 ? {
            level: currentLesson[0].level,
            topic: currentLesson[0].topic,
            lesson_number: currentLesson[0].lesson_number,
            version: currentVersion
          } : null,
          after: {
            level: lesson.level,
            topic: lesson.topic,
            lesson_number: lesson.lesson_number,
            version: newVersion
          },
          activities_changed: hasStudentData ? 'upsert' : 'replaced',
          student_data: {
            activity_results: parseInt(studentDataCheck[0].activity_results_count),
            progress_records: parseInt(studentDataCheck[0].progress_count)
          },
          timestamp: new Date().toISOString()
        };

        await sql`
          INSERT INTO lesson_history (lesson_id, version, changed_by, changes)
          VALUES (${lesson.id}, ${newVersion}, ${adminUserId || null}, ${JSON.stringify(changesSnapshot)}::jsonb)
          ON CONFLICT (lesson_id, version) DO NOTHING
        `;

        // Get existing activities with their IDs for mapping
        const existingActivities = await sql`
          SELECT id, activity_order, activity_type 
          FROM lesson_activities 
          WHERE lesson_id = ${lesson.id} AND active = TRUE
          ORDER BY activity_order
        `;

        // Create map of activity_order -> activity_id for existing activities
        const existingActivityMap = new Map<number, string>();
        for (const activity of existingActivities) {
          existingActivityMap.set(activity.activity_order, activity.id);
        }
        
        console.log('Admin-lessons: Existing activities map:', Array.from(existingActivityMap.entries()));

        // Get set of new activity orders from incoming activities
        const newActivityOrders = new Set<number>();
        if (activities && Array.isArray(activities)) {
          for (const activity of activities) {
            newActivityOrders.add(activity.activity_order);
          }
        }

        if (hasStudentData) {
          // UPSERT approach: Update existing activities, insert new ones, soft delete removed ones
          
          // Process each activity from the update
          if (activities && Array.isArray(activities)) {
            for (const activity of activities) {
              const activityTitle = activity.title || activity.content?.title || null;
              const activityDescription = activity.description || activity.content?.description || null;
              const activityEstimatedTime = activity.estimated_time_seconds || activity.content?.estimated_time_seconds || null;
              
              // Check if activity already exists (by order)
              const existingActivityId = existingActivityMap.get(activity.activity_order);
              
              let activityId: string;
              
              console.log(`Admin-lessons: Processing activity order ${activity.activity_order}, type ${activity.activity_type}, existing ID: ${existingActivityId}, vocab items count: ${activity.vocabulary_items?.length || 0}`);
              
              if (existingActivityId) {
                // Update existing activity (preserve ID and activity_id for vocabulary_items)
                await sql`
                  UPDATE lesson_activities
                  SET 
                    activity_type = ${activity.activity_type},
                    activity_order = ${activity.activity_order},
                    content = ${JSON.stringify(activity.content)}::jsonb,
                    title = ${activityTitle},
                    description = ${activityDescription},
                    estimated_time_seconds = ${activityEstimatedTime},
                    active = TRUE,
                    updated_at = NOW()
                  WHERE id = ${existingActivityId}::uuid
                `;
                activityId = existingActivityId;
                console.log(`Admin-lessons: Updated existing activity ${activityId} for order ${activity.activity_order}`);
              } else {
                // Insert new activity or get existing one if conflict
                // First, check if there's an existing activity with this order that we missed
                const checkExisting = await sql`
                  SELECT id FROM lesson_activities 
                  WHERE lesson_id = ${updatedLesson.id} AND activity_order = ${activity.activity_order} AND active = TRUE
                  LIMIT 1
                `;
                
                if (checkExisting.length > 0) {
                  // Activity exists but wasn't in our map - use it
                  activityId = checkExisting[0].id;
                  await sql`
                    UPDATE lesson_activities
                    SET 
                      activity_type = ${activity.activity_type},
                      content = ${JSON.stringify(activity.content)}::jsonb,
                      title = ${activityTitle},
                      description = ${activityDescription},
                      estimated_time_seconds = ${activityEstimatedTime},
                      active = TRUE,
                      updated_at = NOW()
                    WHERE id = ${activityId}::uuid
                  `;
                  console.log(`Admin-lessons: Found existing activity ${activityId} for order ${activity.activity_order} (wasn't in map)`);
                } else {
                  // Truly new activity
                  const activityResult = await sql`
                    INSERT INTO lesson_activities (
                      lesson_id, 
                      activity_type, 
                      activity_order, 
                      content,
                      title,
                      description,
                      estimated_time_seconds,
                      active
                    )
                    VALUES (
                      ${updatedLesson.id}, 
                      ${activity.activity_type}, 
                      ${activity.activity_order}, 
                      ${JSON.stringify(activity.content)}::jsonb,
                      ${activityTitle},
                      ${activityDescription},
                      ${activityEstimatedTime},
                      TRUE
                    )
                    RETURNING id
                  `;
                  activityId = activityResult[0].id;
                  console.log(`Admin-lessons: Created new activity ${activityId} for order ${activity.activity_order}`);
                }
              }

              // Check if activity has student results (needed for grammar sentences)
              const hasActivityResults = await sql`
                SELECT COUNT(*)::int as count
                FROM lesson_activity_results
                WHERE lesson_id = ${lesson.id} 
                  AND activity_order = ${activity.activity_order}
              `;

              // Handle vocabulary items - ALWAYS delete before inserting to prevent duplicates
              // Vocabulary items don't have foreign key constraints from student results, so it's safe to delete/recreate
              const deletedCount = await sql`
                DELETE FROM vocabulary_items WHERE activity_id = ${activityId}::uuid
                RETURNING id
              `;
              console.log(`Admin-lessons: Deleted ${deletedCount.length} vocabulary items for activity ${activityId} (order ${activity.activity_order})`);

              // Insert vocabulary items
              if (activity.vocabulary_items && Array.isArray(activity.vocabulary_items) && activity.vocabulary_items.length > 0) {
                for (const vocabItem of activity.vocabulary_items) {
                  if (vocabItem.english_word && vocabItem.thai_translation) {
                    await sql`
                      INSERT INTO vocabulary_items (activity_id, english_word, thai_translation, audio_url)
                      VALUES (${activityId}::uuid, ${vocabItem.english_word}, ${vocabItem.thai_translation}, ${vocabItem.audio_url || null})
                    `;
                  }
                }
                console.log(`Admin-lessons: Inserted ${activity.vocabulary_items.length} vocabulary items for activity ${activityId} (order ${activity.activity_order})`);
              }

              // Handle grammar sentences (only delete/recreate if no student results)
              if (parseInt(hasActivityResults[0].count) === 0) {
                await sql`DELETE FROM grammar_sentences WHERE activity_id = ${activityId}::uuid`;
              }

              // Insert grammar sentences
              if (activity.grammar_sentences && Array.isArray(activity.grammar_sentences)) {
                for (const grammarSentence of activity.grammar_sentences) {
                  if (grammarSentence.original_sentence && grammarSentence.correct_sentence && grammarSentence.words_array) {
                    await sql`
                      INSERT INTO grammar_sentences (activity_id, original_sentence, correct_sentence, words_array)
                      VALUES (${activityId}::uuid, ${grammarSentence.original_sentence}, ${grammarSentence.correct_sentence}, ${JSON.stringify(grammarSentence.words_array)}::jsonb)
                      ON CONFLICT DO NOTHING
                    `;
                  }
                }
              }
            }
          }

          // Soft delete activities that are no longer in the new list (only if no student results)
          for (const existingActivity of existingActivities) {
            if (!newActivityOrders.has(existingActivity.activity_order)) {
              // Check if this activity has student results
              const hasResults = await sql`
                SELECT COUNT(*)::int as count
                FROM lesson_activity_results
                WHERE lesson_id = ${lesson.id}
                  AND activity_order = ${existingActivity.activity_order}
              `;

              if (parseInt(hasResults[0].count) === 0) {
                // No student data - safe to soft delete
                await sql`
                  UPDATE lesson_activities
                  SET active = FALSE, updated_at = NOW()
                  WHERE id = ${existingActivity.id}::uuid
                `;
              }
              // If has results, keep it active (preserve for student data)
            }
          }
        } else {
          // No student data - safe to use DELETE approach (faster for new lessons)
          for (const activity of existingActivities) {
            // Delete vocabulary items
            await sql`DELETE FROM vocabulary_items WHERE activity_id = ${activity.id}::uuid`;
            // Delete grammar sentences
            await sql`DELETE FROM grammar_sentences WHERE activity_id = ${activity.id}::uuid`;
          }

          // Delete activities
          await sql`DELETE FROM lesson_activities WHERE lesson_id = ${lesson.id}`;

          // Insert new activities and their related data
          if (activities && Array.isArray(activities)) {
            for (const activity of activities) {
              // Extract title/description from activity level or content (for backward compatibility)
              const activityTitle = activity.title || activity.content?.title || null
              const activityDescription = activity.description || activity.content?.description || null
              const activityEstimatedTime = activity.estimated_time_seconds || activity.content?.estimated_time_seconds || null
              
              // Insert activity with metadata
              const activityResult = await sql`
                INSERT INTO lesson_activities (
                  lesson_id, 
                  activity_type, 
                  activity_order, 
                  content,
                  title,
                  description,
                  estimated_time_seconds,
                  active
                )
                VALUES (
                  ${updatedLesson.id}, 
                  ${activity.activity_type}, 
                  ${activity.activity_order}, 
                  ${JSON.stringify(activity.content)}::jsonb,
                  ${activityTitle},
                  ${activityDescription},
                  ${activityEstimatedTime},
                  TRUE
              )
              RETURNING id
            `;

              const activityId = activityResult[0].id;

              // Insert vocabulary items if they exist
              if (activity.vocabulary_items && Array.isArray(activity.vocabulary_items)) {
                for (const vocabItem of activity.vocabulary_items) {
                  if (vocabItem.english_word && vocabItem.thai_translation) {
                    await sql`
                      INSERT INTO vocabulary_items (activity_id, english_word, thai_translation, audio_url)
                      VALUES (${activityId}::uuid, ${vocabItem.english_word}, ${vocabItem.thai_translation}, ${vocabItem.audio_url || null})
                    `;
                  }
                }
              }

              // Insert grammar sentences if they exist
              if (activity.grammar_sentences && Array.isArray(activity.grammar_sentences)) {
                for (const grammarSentence of activity.grammar_sentences) {
                  if (grammarSentence.original_sentence && grammarSentence.correct_sentence && grammarSentence.words_array) {
                    await sql`
                      INSERT INTO grammar_sentences (activity_id, original_sentence, correct_sentence, words_array)
                      VALUES (${activityId}::uuid, ${grammarSentence.original_sentence}, ${grammarSentence.correct_sentence}, ${JSON.stringify(grammarSentence.words_array)}::jsonb)
                    `;
                  }
                }
              }
            }
          }
        }

        // Commit transaction
        await sql`COMMIT`;

        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            success: true,
            lesson: updatedLesson,
            message: 'Lesson updated successfully'
          })
        }
      } catch (error) {
        // Rollback on error
        await sql`ROLLBACK`;
        console.error('Error updating lesson:', error);
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({ success: false, error: 'Failed to update lesson: ' + (error instanceof Error ? error.message : String(error)) })
        }
      }

    } else if (event.httpMethod === 'DELETE') {
      // Delete lesson
      const url = new URL(event.rawUrl || `http://localhost${event.path}`);
      const lessonId = url.searchParams.get('id');

      if (!lessonId) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ success: false, error: 'Lesson ID is required' })
        }
      }

      // Check if lesson has activities or progress
      const activityCount = await sql`
        SELECT COUNT(*) as count FROM lesson_activities WHERE lesson_id = ${lessonId}
      `;

      const progressCount = await sql`
        SELECT COUNT(*) as count FROM user_progress WHERE lesson_id = ${lessonId}
      `;

      if (activityCount[0].count > 0 || progressCount[0].count > 0) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({
            success: false,
            error: 'Cannot delete lesson with existing activities or user progress'
          })
        }
      }

      await sql`
        DELETE FROM lessons WHERE id = ${lessonId}
      `;

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          message: 'Lesson deleted successfully'
        })
      }
    } else {
      return {
        statusCode: 405,
        headers,
        body: JSON.stringify({ success: false, error: 'Method not allowed' })
      }
    }

  } catch (error) {
    console.error('Admin lessons error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, error: 'Internal server error' })
    }
  }
};
