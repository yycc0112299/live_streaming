// Azure neural voices a donor can pick for a points voice message (shared by server and page).
// Numbers 1–7 match the samples the team compared; 8–9 add a male Taiwanese and a sports voice.
export const VOICES = [
  { id: 'hsiaochen', name: '1 曉臻・台灣溫柔', voice: 'zh-TW-HsiaoChenNeural', style: '' },
  { id: 'hsiaoyu', name: '2 曉雨・台灣清亮', voice: 'zh-TW-HsiaoYuNeural', style: '' },
  { id: 'xiaoxiao', name: '3 曉曉・開心', voice: 'zh-CN-XiaoxiaoNeural', style: 'cheerful' },
  { id: 'xiaoxiao-ml', name: '4 曉曉・自然', voice: 'zh-CN-XiaoxiaoMultilingualNeural', style: '' },
  { id: 'xiaochen-live', name: '5 曉辰・直播帶貨', voice: 'zh-CN-XiaochenNeural', style: 'livecommercial' },
  { id: 'xiaoxiao-excited', name: '6 曉曉・興奮', voice: 'zh-CN-XiaoxiaoMultilingualNeural', style: 'excited' },
  { id: 'xiaoyou', name: '7 曉悠・可愛', voice: 'zh-CN-XiaoyouMultilingualNeural', style: 'cheerful' },
  { id: 'yunjhe', name: '8 雲哲・台灣男聲', voice: 'zh-TW-YunJheNeural', style: '' },
  { id: 'yunjian', name: '9 雲健・熱血解說', voice: 'zh-CN-YunjianNeural', style: 'sports-commentary-excited' },
];
export const DEFAULT_VOICE = 'xiaoxiao-excited';
export const PREVIEW_TEXT = '謝謝大家的支持！這是第九組的雲端直播，記得多多送禮物喔！';
export const findVoice = (id) => VOICES.find((v) => v.id === id) || VOICES.find((v) => v.id === DEFAULT_VOICE);
