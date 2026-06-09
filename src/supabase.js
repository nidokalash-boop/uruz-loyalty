import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://ojbuosomzezrnsnmcypv.supabase.co'
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY || 'sb_publishable_EQb-ueNmUBxMTrq4okG4-g_BqT2oXa8'

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

// ── MEMBERS ──────────────────────────────────────────────
export async function getMembers() {
  const { data } = await supabase.from('members').select('*')
  return data || []
}
export async function getMemberByPhone(phone) {
  const clean = p => p.replace(/\s+/g, '')
  const { data } = await supabase.from('members').select('*')
  return (data || []).find(m => clean(m.phone) === clean(phone) && m.status === 'active') || null
}
export async function getMemberById(id) {
  const { data } = await supabase.from('members').select('*').eq('id', id).single()
  return data || null
}
export async function upsertMember(member) {
  const row = {
    id:           member.id,
    name:         member.name,
    phone:        member.phone,
    email:        member.email        || '',
    join_date:    member.joinDate     || member.join_date || new Date().toISOString().slice(0,10),
    points:       member.points       ?? 0,
    checkins:     member.checkins     ?? 0,
    streak:       member.streak       ?? 0,
    status:       member.status       || 'active',
    pin:          member.pin          || null,
    last_checkin: member.lastCheckin  || member.last_checkin || null,
    birthday:     member.birthday     || null,
  }
  const { data } = await supabase.from('members').upsert(row).select().single()
  return data
}
export async function updateMemberPin(id, pin) {
  await supabase.from('members').update({ pin }).eq('id', id)
}
export async function resetMemberPin(id) {
  await supabase.from('members').update({ pin: null }).eq('id', id)
}
export async function updateMemberStatus(id, status) {
  await supabase.from('members').update({ status }).eq('id', id)
}

// ── TRANSACTIONS ─────────────────────────────────────────
export async function getTransactions() {
  const { data } = await supabase.from('transactions').select('*').order('date', { ascending: false })
  return (data || []).map(t => ({ ...t, memberId: t.member_id, memberName: t.member_name }))
}
export async function addTransaction(txn) {
  await supabase.from('transactions').insert({
    id: txn.id, member_id: txn.memberId, member_name: txn.memberName,
    type: txn.type, pts: txn.pts, note: txn.note, date: txn.date
  })
}

// ── REDEMPTIONS ──────────────────────────────────────────
export async function getRedemptions() {
  const { data } = await supabase.from('redemptions').select('*').order('date', { ascending: false })
  return (data || []).map(r => ({ ...r, memberId: r.member_id, memberName: r.member_name }))
}
export async function addRedemption(rdm) {
  await supabase.from('redemptions').insert({
    id: rdm.id, member_id: rdm.memberId, member_name: rdm.memberName,
    reward: rdm.reward, pts: rdm.pts, status: rdm.status, date: rdm.date
  })
}
export async function updateRedemptionStatus(id, status) {
  await supabase.from('redemptions').update({ status }).eq('id', id)
}

// ── REWARDS ──────────────────────────────────────────────
export async function getRewards() {
  const { data } = await supabase.from('rewards').select('*')
  return data || []
}
export async function upsertReward(reward) {
  await supabase.from('rewards').upsert(reward)
}
export async function deleteReward(id) {
  await supabase.from('rewards').delete().eq('id', id)
}

// ── TIERS ────────────────────────────────────────────────
export async function getTiers() {
  const { data } = await supabase.from('tiers').select('*').order('min_pts', { ascending: true })
  return (data || []).map(t => ({ ...t, min: t.min_pts }))
}
export async function upsertTier(tier) {
  await supabase.from('tiers').upsert({
    id: tier.id, name: tier.name, min_pts: tier.min,
    color: tier.color, icon: tier.icon
  })
}

// ── STAFF ────────────────────────────────────────────────
export async function getStaff() {
  const { data } = await supabase.from('staff').select('*')
  return data || []
}
export async function upsertStaff(member) {
  const { data } = await supabase.from('staff').upsert(member).select().single()
  return data
}
export async function deleteStaff(id) {
  await supabase.from('staff').delete().eq('id', id)
}
export async function getStaffByName(name) {
  const { data } = await supabase.from('staff').select('*').ilike('name', name).single()
  return data || null
}

// ── DISPLAY SETTINGS ─────────────────────────────────────
export async function getDisplaySettings() {
  const { data } = await supabase.from('display_settings').select('*').eq('id', 'main').single()
  return data || null
}
export async function saveDisplaySettings(settings) {
  await supabase.from('display_settings').upsert({ id: 'main', ...settings })
}

// ── CHALLENGE ENROLLMENTS ────────────────────────────────
export async function getEnrollments() {
  const { data } = await supabase.from('challenge_enrollments').select('*')
  return (data || []).map(e => ({
    ...e,
    memberId: e.member_id,
    memberName: e.member_name,
    challengeId: e.challenge_id,
    challengeName: e.challenge_name,
    enrolledDate: e.enrolled_date,
    completedDate: e.completed_date,
  }))
}
export async function getMemberEnrollments(memberId) {
  const { data } = await supabase.from('challenge_enrollments')
    .select('*').eq('member_id', memberId)
  return (data || []).map(e => ({
    ...e,
    memberId: e.member_id,
    memberName: e.member_name,
    challengeId: e.challenge_id,
    challengeName: e.challenge_name,
    enrolledDate: e.enrolled_date,
    completedDate: e.completed_date,
  }))
}
export async function enrollInChallenge(enrollment) {
  await supabase.from('challenge_enrollments').insert({
    id: enrollment.id,
    challenge_id: enrollment.challengeId,
    challenge_name: enrollment.challengeName,
    member_id: enrollment.memberId,
    member_name: enrollment.memberName,
    progress: enrollment.progress || 0,
    goal: enrollment.goal || 1,
    completed: false,
    enrolled_date: enrollment.enrolledDate,
    completed_date: null,
  })
}
export async function updateEnrollmentProgress(id, progress, completed, completedDate) {
  await supabase.from('challenge_enrollments').update({
    progress,
    completed,
    completed_date: completedDate || null,
  }).eq('id', id)
}
export async function completeEnrollment(id, completedDate) {
  await supabase.from('challenge_enrollments').update({
    completed: true,
    completed_date: completedDate,
  }).eq('id', id)
}

// ── EARN RULES ───────────────────────────────────────────
export async function getEarnRules() {
  const { data } = await supabase.from('earn_rules').select('*').order('sort_order', { ascending: true })
  return data || []
}
export async function upsertEarnRule(rule) {
  await supabase.from('earn_rules').upsert(rule)
}
export async function deleteEarnRule(id) {
  await supabase.from('earn_rules').delete().eq('id', id)
}

// ── REFERRALS ────────────────────────────────────────────
export async function getReferrals() {
  const { data } = await supabase.from('referrals').select('*').order('date', { ascending: false })
  return (data || []).map(r => ({
    ...r,
    referrerId: r.referrer_id,
    referrerName: r.referrer_name,
    referrerCode: r.referrer_code,
    newMemberId: r.new_member_id,
    newMemberName: r.new_member_name,
  }))
}
export async function addReferral(ref) {
  await supabase.from('referrals').insert({
    id: ref.id,
    referrer_id: ref.referrerId,
    referrer_name: ref.referrerName,
    referrer_code: ref.referrerCode,
    new_member_id: ref.newMemberId,
    new_member_name: ref.newMemberName,
    pts: ref.pts || 500,
    date: ref.date,
  })
}
export async function getMemberByReferralCode(code) {
  const { data } = await supabase.from('members').select('*').ilike('referral_code', code).single()
  return data || null
}

// ── WORKOUTS ─────────────────────────────────────────────
export async function getWorkouts() {
  const { data } = await supabase.from('workouts').select('*').eq('active', true).order('created_at', { ascending: false })
  return data || []
}
export async function getAllWorkouts() {
  const { data } = await supabase.from('workouts').select('*').order('created_at', { ascending: false })
  return data || []
}
export async function upsertWorkout(workout) {
  const { data } = await supabase.from('workouts').upsert(workout).select().single()
  return data
}
export async function deleteWorkout(id) {
  await supabase.from('workouts').delete().eq('id', id)
}

// ── WORKOUT UNLOCKS ───────────────────────────────────────
export async function getMemberUnlocks(memberId) {
  const { data } = await supabase.from('workout_unlocks').select('*').eq('member_id', memberId)
  return (data || []).map(u => ({ ...u, workoutId: u.workout_id, memberId: u.member_id }))
}
export async function unlockWorkout(unlock) {
  await supabase.from('workout_unlocks').insert({
    id: unlock.id,
    workout_id: unlock.workoutId,
    member_id: unlock.memberId,
    unlocked_by: unlock.unlockedBy || 'staff',
    date: unlock.date,
  })
}
export async function getAllUnlocks() {
  const { data } = await supabase.from('workout_unlocks').select('*')
  return (data || []).map(u => ({ ...u, workoutId: u.workout_id, memberId: u.member_id }))
}
// ── WORKOUT LOGS ──────────────────────────────────────────
export async function getWorkoutLogs(memberId) {
  const { data } = await supabase.from('workout_logs')
    .select('*').eq('member_id', memberId)
    .order('date', { ascending: false })
  return data || []
}
export async function saveWorkoutLog(log) {
  const { data } = await supabase.from('workout_logs').upsert({
    id:          log.id,
    workout_id:  log.workoutId,
    member_id:   log.memberId,
    member_name: log.memberName,
    date:        log.date,
    exercises:   log.exercises,
    notes:       log.notes || '',
  }).select().single()
  return data
}
export async function getWorkoutLogsByWorkout(workoutId, memberId) {
  const { data } = await supabase.from('workout_logs')
    .select('*')
    .eq('workout_id', workoutId)
    .eq('member_id', memberId)
    .order('date', { ascending: false })
  return data || []
}

// ── WORKOUT PROGRAMS ──────────────────────────────────────
export async function getPrograms() {
  const { data } = await supabase.from('workout_programs')
    .select('*').order('created_at', { ascending: false })
  return data || []
}
export async function upsertProgram(program) {
  const { data } = await supabase.from('workout_programs').upsert({
    id:          program.id,
    name:        program.name,
    description: program.description || '',
    schedule:    program.schedule,
    active:      program.active !== false,
    created_at:  program.created_at || new Date().toISOString().slice(0,10),
  }).select().single()
  return data
}
export async function deleteProgram(id) {
  await supabase.from('workout_programs').delete().eq('id', id)
}
