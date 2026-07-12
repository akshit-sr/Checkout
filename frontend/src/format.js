export function money(v) {
  const n = Number(v ?? 0)
  return n.toLocaleString(undefined, { style: 'currency', currency: 'USD' })
}

export function dateTime(v) {
  if (!v) return ''
  return new Date(v).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
}
