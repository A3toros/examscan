import { Handler } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'

export const handler: Handler = async (event) => {
  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  }

  // Handle preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: '',
    }
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({
        success: false,
        error: 'Method not allowed'
      }),
    }
  }

  try {
    const { text, voice = 'alloy' } = JSON.parse(event.body || '{}')

    if (!text) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'Text is required'
        }),
      }
    }

    const openaiApiKey = process.env.OPENAI_API_KEY
    if (!openaiApiKey) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'OpenAI API key not configured'
        }),
      }
    }

    // Call OpenAI TTS API
    const response = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'tts-1',
        input: text,
        voice: voice,
        response_format: 'mp3',
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      console.error('OpenAI TTS error:', error)
      return {
        statusCode: response.status,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'TTS generation failed'
        }),
      }
    }

    // Get the audio data
    const audioBuffer = await response.arrayBuffer()

    // Initialize Supabase client for file upload
    const supabaseUrl = process.env.SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY

    if (!supabaseUrl || !supabaseServiceKey) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'Supabase configuration missing'
        }),
      }
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Generate unique filename
    const timestamp = Date.now()
    const fileName = `tts-${timestamp}.mp3`

    // Upload to Supabase Storage
    const { data, error: uploadError } = await supabase.storage
      .from('audio-files')
      .upload(fileName, Buffer.from(audioBuffer), {
        contentType: 'audio/mpeg',
        cacheControl: '3600',
        upsert: false
      })

    if (uploadError) {
      console.error('Supabase upload error:', uploadError)
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'Failed to upload generated audio'
        }),
      }
    }

    console.log('TTS audio uploaded successfully:', data.path)

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('audio-files')
      .getPublicUrl(fileName)

    return {
      statusCode: 200,
      headers: {
        ...headers,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        success: true,
        message: 'TTS audio generated and uploaded successfully',
        file_path: data.path,
        public_url: urlData.publicUrl,
        file_name: fileName
      }),
    }
  } catch (error) {
    console.error('TTS function error:', error)
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: 'Internal server error'
      }),
    }
  }
}
