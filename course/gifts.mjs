export const GIFTS = [
  { amount: 1, name: '小愛心', icon: '♥', kind: 'heart', duration: 2200 },
  { amount: 5, name: '玫瑰花', icon: '🌹', kind: 'rose', duration: 2800 },
  { amount: 10, name: '小火箭', icon: '🚀', kind: 'rocket', duration: 3400 },
  { amount: 25, name: '小跑車', icon: '🏎️', kind: 'car', duration: 4000 },
  { amount: 50, name: '星光派對', icon: '🎆', kind: 'party', duration: 4800 },
  { amount: 100, name: '夢幻嘉年華', icon: '🎠', kind: 'carnival', duration: 6000 },
];

export const VOICE_MESSAGE_POINTS = 10;
export const FORMAL_VOICE_MESSAGE_POINTS = 50;

export const enqueueGift = (items, gift) => [...items, gift].sort((a, b) => b.amount - a.amount);
