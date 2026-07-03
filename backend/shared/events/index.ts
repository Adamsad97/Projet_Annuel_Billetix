// Noms des événements RabbitMQ échangés entre microservices

export const EVENTS = {
  // order-service → ticket-service + notification-service
  ORDER_CONFIRMED: 'order.confirmed',
  ORDER_CANCELLED: 'order.cancelled',

  // ticket-service → pdf-service
  TICKET_CREATED: 'ticket.created',

  // pdf-service → notification-service
  TICKET_PDF_READY: 'ticket.pdf.ready',

  // payment-service → order-service
  PAYMENT_CONFIRMED: 'payment.confirmed',
  PAYMENT_FAILED: 'payment.failed',

  // payment-service → notification-service
  PAYMENT_REFUNDED: 'payment.refunded',
  PAYOUT_COMPLETED: 'payout.completed',

  // event-service → notification-service
  EVENT_PUBLISHED: 'event.published',
  EVENT_REJECTED: 'event.rejected',
  EVENT_SUSPENDED: 'event.suspended',

  // scheduler (notification-service) → notification-service
  EVENT_REMINDER_J1: 'event.reminder_j1',

  // event-service → notification-service (seuils de remplissage)
  EVENT_THRESHOLD_25: 'event.threshold.25',
  EVENT_THRESHOLD_50: 'event.threshold.50',
  EVENT_THRESHOLD_75: 'event.threshold.75',
  EVENT_THRESHOLD_100: 'event.threshold.100',
} as const;

// Noms des patterns TCP entre api-gateway et services
export const PATTERNS = {
  // auth-service
  AUTH_REGISTER: 'auth.register',
  AUTH_LOGIN: 'auth.login',
  AUTH_REFRESH: 'auth.refresh',
  AUTH_LOGOUT: 'auth.logout',
  AUTH_VERIFY_EMAIL: 'auth.verify_email',
  AUTH_FORGOT_PASSWORD: 'auth.forgot_password',
  AUTH_RESET_PASSWORD: 'auth.reset_password',
  AUTH_VALIDATE_TOKEN: 'auth.validate_token',
  AUTH_2FA_ENABLE: 'auth.2fa.enable',
  AUTH_2FA_VERIFY: 'auth.2fa.verify',

  // user-service
  USER_GET_ME: 'user.get_me',
  USER_UPDATE_ME: 'user.update_me',
  USER_GET_ORGANIZER: 'user.get_organizer',
  USER_UPDATE_ORGANIZER: 'user.update_organizer',
  USER_KYC_SUBMIT: 'user.kyc.submit',
  USER_KYC_STATUS: 'user.kyc.status',
  USER_CREATE_AGENT: 'user.agent.create',
  USER_REVOKE_AGENT: 'user.agent.revoke',

  // event-service
  EVENT_CREATE: 'event.create',
  EVENT_UPDATE: 'event.update',
  EVENT_SUBMIT: 'event.submit',
  EVENT_GET: 'event.get',
  EVENT_LIST: 'event.list',
  EVENT_LIST_MINE: 'event.list_mine',
  EVENT_CATEGORY_CREATE: 'event.category.create',
  EVENT_CATEGORY_UPDATE: 'event.category.update',
  EVENT_ADMIN_PUBLISH: 'event.admin.publish',
  EVENT_ADMIN_REJECT: 'event.admin.reject',
  EVENT_ADMIN_SUSPEND: 'event.admin.suspend',

  // order-service
  ORDER_RESERVE: 'order.reserve',
  ORDER_CREATE: 'order.create',
  ORDER_GET: 'order.get',
  ORDER_LIST_MINE: 'order.list_mine',
  ORDER_CANCEL: 'order.cancel',
  ORDER_RESEND_TICKETS: 'order.resend_tickets',

  // ticket-service
  TICKET_LIST_MINE: 'ticket.list_mine',
  TICKET_GET: 'ticket.get',
  TICKET_SCAN: 'ticket.scan',
  TICKET_SCAN_MANUAL: 'ticket.scan.manual',
  TICKET_SYNC_OFFLINE: 'ticket.sync.offline',
  TICKET_STATS: 'ticket.stats',
  TICKET_INVALIDATE: 'ticket.invalidate',

  // payment-service
  PAYMENT_CREATE_INTENT: 'payment.create_intent',
  PAYMENT_GET_BALANCE: 'payment.get_balance',
  PAYMENT_GET_PAYOUTS: 'payment.get_payouts',

  // admin-service
  ADMIN_DASHBOARD: 'admin.dashboard',
  ADMIN_EVENTS_PENDING: 'admin.events.pending',
  ADMIN_USERS_LIST: 'admin.users.list',
  ADMIN_USERS_SUSPEND: 'admin.users.suspend',
  ADMIN_KYC_APPROVE: 'admin.kyc.approve',
  ADMIN_KYC_REJECT: 'admin.kyc.reject',
  ADMIN_PAYOUT_RELEASE: 'admin.payout.release',
  ADMIN_PAYOUT_BLOCK: 'admin.payout.block',
  ADMIN_AUDIT_LOG: 'admin.audit_log',
} as const;
