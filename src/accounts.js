export const ACCOUNTS = ['Moishy', 'Shaindy']

const COLORS = {
  Moishy: 'linear-gradient(135deg,#4f8cff,#7b5bff)',
  Shaindy: 'linear-gradient(135deg,#ff7b54,#ff4f8c)',
}

export const accountColor = (name) => COLORS[name] || '#666'
