import { createClient } from '@supabase/supabase-js'

// Pembersihan URL Supabase agar tidak ada duplikasi /rest/v1/ atau trailing slash
function cleanSupabaseUrl(url) {
  if (!url) return ''
  return url.trim().replace(/\/rest\/v1\/?$/, '').replace(/\/+$/, '')
}

const savedUrl = localStorage.getItem('custom_supabase_url')
const savedKey = localStorage.getItem('custom_supabase_key')

const rawUrl = savedUrl || import.meta.env.VITE_SUPABASE_URL || ''
export const SUPABASE_URL = cleanSupabaseUrl(rawUrl)
export const SUPABASE_ANON_KEY = (savedKey || import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim()
export const ADMIN_PASSCODE = import.meta.env.VITE_ADMIN_PASSCODE || 'admin123'

export const isSupabaseConfigured = () => {
  return (
    SUPABASE_URL && 
    SUPABASE_ANON_KEY && 
    SUPABASE_URL.startsWith('http') && 
    !SUPABASE_URL.includes('your-project-id')
  )
}

export const supabase = isSupabaseConfigured()
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null

// Helper Tanggal Hari Ini (Format: YYYY-MM-DD)
export function getTodayDateString() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// Helper Format Tanggal Indonesia
export function formatIndonesianDate(dateStr) {
  if (!dateStr) return ''
  const parts = dateStr.split('-')
  if (parts.length !== 3) return dateStr
  const date = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]))
  return date.toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  })
}

// Helper Mapping Tanggal Soal & Peserta untuk Fallback jika kolom quiz_date belum ada di database
function getQuestionDateMap() {
  try {
    return JSON.parse(localStorage.getItem('quiz_question_date_map') || '{}')
  } catch (e) {
    return {}
  }
}

function setQuestionDate(questionId, dateStr) {
  const map = getQuestionDateMap()
  map[questionId] = dateStr
  localStorage.setItem('quiz_question_date_map', JSON.stringify(map))
}

function resolveQuestionDate(question, defaultDate) {
  if (question.quiz_date) return question.quiz_date
  const map = getQuestionDateMap()
  if (map[question.id]) return map[question.id]
  if (question.created_at) {
    // Ambil tanggal lokal dari created_at
    const d = new Date(question.created_at)
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }
  return defaultDate || getTodayDateString()
}

function resolveParticipantDate(participant) {
  if (participant.quiz_date) return participant.quiz_date
  if (participant.submitted_at) {
    const d = new Date(participant.submitted_at)
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }
  return getTodayDateString()
}

// 1. Ambil Pertanyaan Berdasarkan Tanggal Kuis
export async function getQuestions(targetDate = getTodayDateString()) {
  if (isSupabaseConfigured() && supabase) {
    try {
      // 1. Coba query langsung dengan filter quiz_date di database
      let { data, error } = await supabase
        .from('questions')
        .select('*')
        .eq('quiz_date', targetDate)
        .order('order_num', { ascending: true })

      // 2. Jika kolom quiz_date belum dibuat di tabel Supabase user,
      // ambil seluruh soal lalu filter secara cerdas berdasarkan tanggal
      if (error && error.message && error.message.includes('quiz_date')) {
        const fallbackRes = await supabase
          .from('questions')
          .select('*')
          .order('order_num', { ascending: true })

        if (!fallbackRes.error && fallbackRes.data) {
          // Filter hanya soal yang tanggalnya sesuai dengan targetDate
          data = fallbackRes.data.filter(q => resolveQuestionDate(q, getTodayDateString()) === targetDate)
          error = null
        }
      }

      if (!error && data) {
        // Format opsi pilihan ganda agar hanya menampilkan A, B, C
        return data.map(q => {
          if (q.type === 'multiple_choice' && Array.isArray(q.options)) {
            return {
              ...q,
              quiz_date: resolveQuestionDate(q, targetDate),
              options: q.options.filter(opt => ['A', 'B', 'C'].includes(opt.id))
            }
          }
          return {
            ...q,
            quiz_date: resolveQuestionDate(q, targetDate)
          }
        })
      }
    } catch (err) {
      console.warn('Gagal load dari Supabase:', err)
    }
  }

  // Fallback Local Storage Mode
  const stored = localStorage.getItem('quiz_mock_questions_v4')
  let allQuestions = stored ? JSON.parse(stored) : []

  return allQuestions
    .filter(q => (q.quiz_date || getTodayDateString()) === targetDate)
    .map(q => {
      if (q.type === 'multiple_choice' && Array.isArray(q.options)) {
        return {
          ...q,
          options: q.options.filter(opt => ['A', 'B', 'C'].includes(opt.id))
        }
      }
      return q
    })
}

// 2. Ambil Semua Tanggal yang Tersedia untuk Filter Admin
export async function getAvailableDates() {
  const today = getTodayDateString()
  const dates = new Set([today])

  if (isSupabaseConfigured() && supabase) {
    try {
      const { data } = await supabase.from('questions').select('*')
      if (data) {
        data.forEach(q => {
          const d = resolveQuestionDate(q, today)
          if (d) dates.add(d)
        })
      }
    } catch (err) {
      console.warn(err)
    }
  }

  return [...dates].sort().reverse()
}

// 3. Simpan atau Update Pertanyaan (Admin)
export async function saveQuestion(question) {
  const targetDate = question.quiz_date || getTodayDateString()

  // Opsi pilihan ganda hanya A, B, C
  if (question.type === 'multiple_choice' && Array.isArray(question.options)) {
    question.options = question.options.filter(opt => ['A', 'B', 'C'].includes(opt.id))
  }

  if (isSupabaseConfigured() && supabase) {
    const payload = {
      type: question.type,
      question_text: question.question_text,
      options: question.options,
      correct_answer: question.correct_answer,
      points: question.points,
      order_num: question.order_num
    }

    if (question.quiz_date) {
      payload.quiz_date = question.quiz_date
    }

    if (question.id && !question.id.toString().startsWith('q_')) {
      let { data, error } = await supabase
        .from('questions')
        .update(payload)
        .eq('id', question.id)
        .select()
        .single()

      if (error && error.message && error.message.includes('quiz_date')) {
        delete payload.quiz_date
        const retry = await supabase
          .from('questions')
          .update(payload)
          .eq('id', question.id)
          .select()
          .single()
        data = retry.data
        error = retry.error
      }

      if (error) throw error
      setQuestionDate(data.id, targetDate)
      return { ...data, quiz_date: targetDate }
    } else {
      let { data, error } = await supabase
        .from('questions')
        .insert([payload])
        .select()
        .single()

      if (error && error.message && error.message.includes('quiz_date')) {
        delete payload.quiz_date
        const retry = await supabase
          .from('questions')
          .insert([payload])
          .select()
          .single()
        data = retry.data
        error = retry.error
      }

      if (error) throw error
      setQuestionDate(data.id, targetDate)
      return { ...data, quiz_date: targetDate }
    }
  }

  // Local fallback
  const stored = localStorage.getItem('quiz_mock_questions_v4')
  const allQuestions = stored ? JSON.parse(stored) : []

  if (question.id) {
    const idx = allQuestions.findIndex(q => q.id === question.id)
    if (idx !== -1) {
      allQuestions[idx] = { ...question, quiz_date: targetDate }
    } else {
      allQuestions.push({ ...question, quiz_date: targetDate })
    }
  } else {
    question.id = 'q_' + Date.now()
    question.quiz_date = targetDate
    allQuestions.push(question)
  }

  localStorage.setItem('quiz_mock_questions_v4', JSON.stringify(allQuestions))
  setQuestionDate(question.id, targetDate)
  return question
}

// 4. Hapus Pertanyaan (Admin)
export async function deleteQuestion(id) {
  if (isSupabaseConfigured() && supabase && !id.toString().startsWith('q_')) {
    const { error } = await supabase.from('questions').delete().eq('id', id)
    if (error) throw error
    return true
  }

  const stored = localStorage.getItem('quiz_mock_questions_v4')
  const allQuestions = stored ? JSON.parse(stored) : []
  const filtered = allQuestions.filter(q => q.id !== id)
  localStorage.setItem('quiz_mock_questions_v4', JSON.stringify(filtered))
  return true
}

function clearParticipantSubmissionCache(participant) {
  const name = participant.name?.trim().toLowerCase()
  const school = participant.school?.trim().toLowerCase()
  if (name && school) {
    localStorage.removeItem(`submitted_${resolveParticipantDate(participant)}_${name}_${school}`)
  }
  if (localStorage.getItem('last_participant_id') === String(participant.id)) {
    localStorage.removeItem('last_participant_id')
  }
}

export async function deleteParticipant(participant) {
  if (isSupabaseConfigured() && supabase && !participant.id.toString().startsWith('p_')) {
    const { error } = await supabase
      .from('participants')
      .delete()
      .eq('id', participant.id)

    if (error) throw error
  } else {
    const participants = JSON.parse(localStorage.getItem('quiz_mock_participants_v4') || '[]')
    localStorage.setItem(
      'quiz_mock_participants_v4',
      JSON.stringify(participants.filter(item => item.id !== participant.id))
    )

    const allAnswers = JSON.parse(localStorage.getItem('quiz_mock_answers_v4') || '{}')
    delete allAnswers[participant.id]
    localStorage.setItem('quiz_mock_answers_v4', JSON.stringify(allAnswers))
  }

  clearParticipantSubmissionCache(participant)
  return true
}

async function getParticipantsForDateToDelete(dateStr) {
  const pageSize = 1000
  const participants = []
  let offset = 0

  while (true) {
    const { data, error } = await supabase
      .from('participants')
      .select('id, name, school, quiz_date, submitted_at')
      .eq('quiz_date', dateStr)
      .order('id', { ascending: true })
      .range(offset, offset + pageSize - 1)

    if (error) {
      if (!error.message?.includes('quiz_date')) throw error
      break
    }

    participants.push(...(data || []))
    if (!data || data.length < pageSize) return participants
    offset += pageSize
  }

  const legacyParticipants = []
  offset = 0
  while (true) {
    const { data, error } = await supabase
      .from('participants')
      .select('id, name, school, submitted_at')
      .order('id', { ascending: true })
      .range(offset, offset + pageSize - 1)

    if (error) throw error
    legacyParticipants.push(...(data || []))
    if (!data || data.length < pageSize) break
    offset += pageSize
  }

  return legacyParticipants.filter(item => resolveParticipantDate(item) === dateStr)
}

export async function deleteParticipantsForDate(dateStr) {
  if (isSupabaseConfigured() && supabase) {
    const participants = await getParticipantsForDateToDelete(dateStr)
    const batchSize = 100

    for (let offset = 0; offset < participants.length; offset += batchSize) {
      const batch = participants.slice(offset, offset + batchSize)
      const { error } = await supabase
        .from('participants')
        .delete()
        .in('id', batch.map(item => item.id))

      if (error) {
        participants.slice(0, offset).forEach(clearParticipantSubmissionCache)
        throw error
      }
    }

    participants.forEach(clearParticipantSubmissionCache)
  }

  const localParticipants = JSON.parse(localStorage.getItem('quiz_mock_participants_v4') || '[]')
  const localDeleted = localParticipants.filter(item => resolveParticipantDate(item) === dateStr)
  localStorage.setItem(
    'quiz_mock_participants_v4',
    JSON.stringify(localParticipants.filter(item => resolveParticipantDate(item) !== dateStr))
  )

  const allAnswers = JSON.parse(localStorage.getItem('quiz_mock_answers_v4') || '{}')
  localDeleted.forEach(item => {
    delete allAnswers[item.id]
    clearParticipantSubmissionCache(item)
  })
  localStorage.setItem('quiz_mock_answers_v4', JSON.stringify(allAnswers))

  const cachePrefix = `submitted_${dateStr}_`
  Object.keys(localStorage)
    .filter(key => key.startsWith(cachePrefix))
    .forEach(key => localStorage.removeItem(key))

  return true
}

// 5. Cek Apakah Peserta Sudah Submit Pada Tanggal Ini
export async function checkParticipantSubmission(name, school, dateStr = getTodayDateString()) {
  const normName = name.trim().toLowerCase()
  const normSchool = school.trim().toLowerCase()

  const localCache = localStorage.getItem(`submitted_${dateStr}_${normName}_${normSchool}`)
  if (localCache) {
    return JSON.parse(localCache)
  }

  if (isSupabaseConfigured() && supabase) {
    try {
      let query = supabase
        .from('participants')
        .select('*')
        .ilike('name', name.trim())
        .ilike('school', school.trim())

      let { data, error } = await query.eq('quiz_date', dateStr).maybeSingle()

      if (error && error.message && error.message.includes('quiz_date')) {
        // Fallback filter berdasarkan tanggal submit
        const fallbackRes = await supabase
          .from('participants')
          .select('*')
          .ilike('name', name.trim())
          .ilike('school', school.trim())

        if (fallbackRes.data && fallbackRes.data.length > 0) {
          const match = fallbackRes.data.find(p => resolveParticipantDate(p) === dateStr)
          if (match) {
            localStorage.setItem(`submitted_${dateStr}_${normName}_${normSchool}`, JSON.stringify(match))
            return match
          }
        }
        return null
      }

      if (!error && data) {
        localStorage.setItem(`submitted_${dateStr}_${normName}_${normSchool}`, JSON.stringify(data))
        return data
      }
    } catch (err) {
      console.warn('Cek submit error:', err)
    }
  }

  const mockParticipants = JSON.parse(localStorage.getItem('quiz_mock_participants_v4') || '[]')
  const found = mockParticipants.find(
    p => resolveParticipantDate(p) === dateStr &&
         p.name.trim().toLowerCase() === normName && 
         p.school.trim().toLowerCase() === normSchool
  )
  return found || null
}

// 6. Submit Jawaban Peserta
export async function submitQuizAnswers({ name, school, answers, questions, dateStr = getTodayDateString() }) {
  let calculatedMcScore = 0
  const processedAnswers = []

  questions.forEach(q => {
    const userAns = answers[q.id]
    if (q.type === 'multiple_choice') {
      const isCorrect = userAns && userAns.selected_option === q.correct_answer
      const awarded = isCorrect ? (q.points || 25) : 0
      if (isCorrect) calculatedMcScore += awarded

      processedAnswers.push({
        question_id: q.id,
        question_type: 'multiple_choice',
        selected_option: userAns ? userAns.selected_option : null,
        essay_answer: null,
        is_correct: isCorrect,
        score: awarded,
        admin_feedback: null
      })
    } else if (q.type === 'essay') {
      processedAnswers.push({
        question_id: q.id,
        question_type: 'essay',
        selected_option: null,
        essay_answer: userAns ? userAns.essay_answer : '',
        is_correct: null,
        score: 0,
        admin_feedback: null
      })
    }
  })

  if (isSupabaseConfigured() && supabase) {
    try {
      const participantPayload = {
        name: name.trim(),
        school: school.trim(),
        mc_score: calculatedMcScore,
        essay_score: null,
        total_score: calculatedMcScore,
        status: 'pending_review'
      }

      let { data: participantData, error: pError } = await supabase
        .from('participants')
        .insert([{ ...participantPayload, quiz_date: dateStr }])
        .select()
        .single()

      if (pError && pError.message && pError.message.includes('quiz_date')) {
        const retry = await supabase
          .from('participants')
          .insert([participantPayload])
          .select()
          .single()
        participantData = retry.data
        pError = retry.error
      }

      if (pError) throw pError

      const answersToInsert = processedAnswers.map(ans => ({
        ...ans,
        participant_id: participantData.id
      }))

      const { error: ansError } = await supabase
        .from('participant_answers')
        .insert(answersToInsert)

      if (ansError) console.error('Error insert answers:', ansError)

      const normName = name.trim().toLowerCase()
      const normSchool = school.trim().toLowerCase()
      localStorage.setItem(`submitted_${dateStr}_${normName}_${normSchool}`, JSON.stringify(participantData))
      localStorage.setItem('last_participant_id', participantData.id)

      return {
        participant: { ...participantData, quiz_date: dateStr },
        answers: processedAnswers
      }
    } catch (err) {
      console.error('Error simpan ke Supabase:', err)
      throw err
    }
  }

  // Fallback Local Storage
  const participantId = 'p_' + Date.now()
  const participantObj = {
    id: participantId,
    quiz_date: dateStr,
    name: name.trim(),
    school: school.trim(),
    mc_score: calculatedMcScore,
    essay_score: null,
    total_score: calculatedMcScore,
    status: 'pending_review',
    submitted_at: new Date().toISOString()
  }

  const allParticipants = JSON.parse(localStorage.getItem('quiz_mock_participants_v4') || '[]')
  allParticipants.unshift(participantObj)
  localStorage.setItem('quiz_mock_participants_v4', JSON.stringify(allParticipants))

  const allAnswers = JSON.parse(localStorage.getItem('quiz_mock_answers_v4') || '{}')
  allAnswers[participantId] = processedAnswers.map(ans => ({
    ...ans,
    id: 'ans_' + Math.random().toString(36).substring(2, 9),
    participant_id: participantId
  }))
  localStorage.setItem('quiz_mock_answers_v4', JSON.stringify(allAnswers))

  const normName = name.trim().toLowerCase()
  const normSchool = school.trim().toLowerCase()
  localStorage.setItem(`submitted_${dateStr}_${normName}_${normSchool}`, JSON.stringify(participantObj))
  localStorage.setItem('last_participant_id', participantId)

  return {
    participant: participantObj,
    answers: processedAnswers
  }
}

// 7. Ambil Hasil Peserta Berdasarkan ID
export async function getParticipantResult(participantId) {
  if (isSupabaseConfigured() && supabase && !participantId.toString().startsWith('p_')) {
    try {
      const { data: participant, error: pError } = await supabase
        .from('participants')
        .select('*')
        .eq('id', participantId)
        .single()

      if (pError) throw pError

      const { data: answers, error: aError } = await supabase
        .from('participant_answers')
        .select('*, question:questions(*)')
        .eq('participant_id', participantId)

      if (aError) throw aError

      return { 
        participant: {
          ...participant,
          quiz_date: resolveParticipantDate(participant)
        }, 
        answers 
      }
    } catch (err) {
      console.warn('Error getParticipantResult:', err)
    }
  }

  const allParticipants = JSON.parse(localStorage.getItem('quiz_mock_participants_v4') || '[]')
  const participant = allParticipants.find(p => p.id === participantId)

  const allAnswers = JSON.parse(localStorage.getItem('quiz_mock_answers_v4') || '{}')
  const allQuestions = JSON.parse(localStorage.getItem('quiz_mock_questions_v4') || '[]')
  const answers = (allAnswers[participantId] || []).map(answer => ({
    ...answer,
    question: answer.question || allQuestions.find(question => question.id === answer.question_id) || null
  }))

  return { participant, answers }
}

// 8. Ambil Semua Peserta untuk Admin Dashboard dengan Filter Tanggal
export async function getAllParticipants(targetDate = null) {
  if (isSupabaseConfigured() && supabase) {
    try {
      let query = supabase
        .from('participants')
        .select('*')
        .order('submitted_at', { ascending: false })

      if (targetDate) {
        // Coba query dengan quiz_date
        let { data, error } = await query.eq('quiz_date', targetDate)

        // Jika kolom quiz_date belum ada, ambil semua lalu filter tanggalnya berdasarkan submitted_at
        if (error && error.message && error.message.includes('quiz_date')) {
          const fallbackRes = await supabase
            .from('participants')
            .select('*')
            .order('submitted_at', { ascending: false })

          if (fallbackRes.data) {
            return fallbackRes.data
              .map(p => ({ ...p, quiz_date: resolveParticipantDate(p) }))
              .filter(p => p.quiz_date === targetDate)
          }
          return []
        }

        if (!error && data) {
          return data.map(p => ({ ...p, quiz_date: resolveParticipantDate(p) }))
        }
      } else {
        const { data, error } = await query
        if (!error && data) {
          return data.map(p => ({ ...p, quiz_date: resolveParticipantDate(p) }))
        }
      }
    } catch (err) {
      console.warn('Error getAllParticipants:', err)
    }
  }

  const list = JSON.parse(localStorage.getItem('quiz_mock_participants_v4') || '[]')
  if (targetDate) {
    return list.filter(p => resolveParticipantDate(p) === targetDate)
  }
  return list
}

// 9. Admin Menilai Jawaban Essay
export async function gradeEssaySubmissions(participantId, essayGradingList) {
  let totalEssayScore = 0
  essayGradingList.forEach(item => {
    totalEssayScore += Number(item.score || 0)
  })

  if (isSupabaseConfigured() && supabase && !participantId.toString().startsWith('p_')) {
    try {
      for (const item of essayGradingList) {
        await supabase
          .from('participant_answers')
          .update({
            score: Number(item.score || 0),
            admin_feedback: item.feedback || null
          })
          .eq('id', item.answerId)
      }

      const { data: participant } = await supabase
        .from('participants')
        .select('mc_score')
        .eq('id', participantId)
        .single()

      const mcScore = participant?.mc_score || 0
      const finalScore = mcScore + totalEssayScore

      const { data: updatedParticipant, error: updateError } = await supabase
        .from('participants')
        .update({
          essay_score: totalEssayScore,
          total_score: finalScore,
          status: 'graded'
        })
        .eq('id', participantId)
        .select()
        .single()

      if (updateError) throw updateError
      return updatedParticipant
    } catch (err) {
      console.error('Error grading essay in Supabase:', err)
      throw err
    }
  }

  // Local fallback
  const allParticipants = JSON.parse(localStorage.getItem('quiz_mock_participants_v4') || '[]')
  const pIdx = allParticipants.findIndex(p => p.id === participantId)
  if (pIdx !== -1) {
    const mc = allParticipants[pIdx].mc_score || 0
    allParticipants[pIdx].essay_score = totalEssayScore
    allParticipants[pIdx].total_score = mc + totalEssayScore
    allParticipants[pIdx].status = 'graded'
    localStorage.setItem('quiz_mock_participants_v4', JSON.stringify(allParticipants))

    const allAnswers = JSON.parse(localStorage.getItem('quiz_mock_answers_v4') || '{}')
    const userAnswers = allAnswers[participantId] || []
    essayGradingList.forEach(item => {
      const a = userAnswers.find(x => x.id === item.answerId || x.question_id === item.questionId)
      if (a) {
        a.score = Number(item.score || 0)
        a.admin_feedback = item.feedback || ''
      }
    })
    allAnswers[participantId] = userAnswers
    localStorage.setItem('quiz_mock_answers_v4', JSON.stringify(allAnswers))

    return allParticipants[pIdx]
  }

  throw new Error('Peserta tidak ditemukan')
}
