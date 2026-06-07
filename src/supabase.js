import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY

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
    id:          member.id,
    name:        member.name,
    phone:       member.phone,
    email:       member.email       || '',
    join_date:   member.joinDate    || member.join_date || new Date().toISOString().slice(0,10),
    points:      member.points      ?? 0,
    checkins:    member.checkins    ?? 0,
    streak:      member.streak      ?? 0,
    status:      member.status      || 'active',
    pin:         member.pin         || null,
    last_checkin:member.lastCheckin || member.last_checkin || null,
  }
  const { data } = await supabase.from('members').upsert(row).select().single()
  return data
}
export async function updateMemberPoints(id, points, checkins, lastCheckin) {
  await supabase.from('members').update({ points, checkins, last_checkin: lastCheckin }).eq('id', id)
}
export async function resetMemberPin(id) {
  await supabase.from('members').update({ pin: null }).eq('id', id)
}
export async function updateMemberStatus(id, status) {
  await supabase.from('members').update({ status }).eq('id', id)
}
export async function updateMemberPin(id, pin) {
  await supabase.from('members').update({ pin }).eq('id', id)
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
  await supabase.from('tiers').upsert({ id: tier.id, name: tier.name, min_pts: tier.min, color: tier.color, icon: tier.icon })
}
