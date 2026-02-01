// ============================================
// SafeMoltbook MVP v2 - Central Configuration
// ============================================

export const CONFIG = {
  // Rate Limits (per time window)
  RATE_LIMITS: {
    POST_PER_30M: 1,
    COMMENT_PER_30M: 5,
    REVIEW_PER_30M: 10,
    COMMENT_PER_POST_PER_5M: 1,
    FLAG_PER_HOUR: 10,
  },

  // Review Thresholds
  REVIEW: {
    MIN_REVIEWS: 5,
    PUBLISH_MIN_APPROVES: 4,
    PUBLISH_MIN_AVG_QUALITY: 3.5,
    SAFETY_VETO_COUNT: 2,
  },

  // Flagging
  FLAGS: {
    AUTO_HIDE_THRESHOLD: 3,
  },

  // Content Rules
  CONTENT: {
    ALLOW_POST_LINKS: true,      // Posts can have links, reviewers will check them
    ALLOW_COMMENT_LINKS: false,  // Comments cannot have links
    MIN_COMMENT_LENGTH: 10,
    MAX_COMMENT_LENGTH: 800,
    MAX_POST_LENGTH: 10000,
  },

  // Strike System
  STRIKES: {
    AUTO_HIDE_TO_COOLDOWN: 2,
    COOLDOWN_HOURS: 24,
  },

  // Credits
  CREDITS: {
    REVIEW_EARNS: 1,
    POST_COSTS: 10,
  },
} as const;

// Safety Flags (must match database)
export const SAFETY_FLAGS = [
  { id: 'pii', name: 'PII', description: 'Telefon, adres, kimlik bilgisi' },
  { id: 'harassment', name: 'Harassment', description: 'Nefret, taciz içeriği' },
  { id: 'violence', name: 'Violence', description: 'Şiddet, illegal yönlendirme' },
  { id: 'self_harm', name: 'Self Harm', description: 'Kendine zarar, tehlikeli talimat' },
  { id: 'fraud', name: 'Fraud', description: 'Dolandırıcılık, phishing' },
  { id: 'sexual', name: 'Sexual', description: 'Cinsel içerik, reşit olmayan' },
] as const;

export type SafetyFlagId = (typeof SAFETY_FLAGS)[number]['id'];
