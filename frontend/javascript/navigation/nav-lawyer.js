/*******************************************************************************************************************/
/*Javascript for navigation bar*/
/*******************************************************************************************************************/

const app = Vue.createApp({
  data() {
    // Decode JWT from sessionStorage
    let roleId = null;
    const token = sessionStorage.getItem('jwt');
    if (token) {
      const payload = window.decodeJWT ? window.decodeJWT(token) : JSON.parse(atob(token.split('.')[1]));
      roleId = payload && payload.role_id;
    }
    return {
      showProfileMenu: false,
      showNotifications: false,
      notifications: [],
      unreadCount: 0,
      roleId: roleId
    };
  },
  methods: {
    toggleProfileMenu(state) {
      this.showProfileMenu = state;
    },
    async fetchNotifications() {
      const baseUrl = window.API_BASE_URL;
      const res = await fetch(`${baseUrl}/api/notifications/lawyer?user_id=${this.roleId}`, { headers: { 'Authorization': 'Bearer ' + sessionStorage.getItem('jwt') } });
      if (res.ok) {
        this.notifications = await res.json();
        this.unreadCount = this.notifications.filter(n => n.notification_status !== 'read').length;
      }
    },
    formatNotificationMessage(notif) {
      let clientName = 'Client';
      if (
        (notif.notification_purpose === 'request' || notif.notification_purpose === 'paid') &&
        notif.client_first_name && notif.client_last_name
      ){
        clientName = notif.client_first_name + ' ' + notif.client_last_name;
      }
      const attorneyLast = notif.attorney_last_name || notif.sender_last_name || 'Attorney';
      const secretaryLast = notif.secretary_last_name || notif.sender_last_name || 'Secretary';
      switch (notif.notification_purpose) {
        case 'request':
          return `${clientName} sent you a consultation request.`;
        case 'paid':
          return `${clientName} has paid their online consultation.`;
        default:
          return 'You have a new notification.';
      }
    },
    formatDate(dateStr) {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    },
    formatTime(timeStr) {
      const [h, m] = timeStr.split(':');
      const date = new Date();
      date.setHours(h, m);
      return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    },
    async markAsRead(notif, e) {
      e.stopPropagation();
      if (notif.notification_status === 'read') return;
      const baseUrl = window.API_BASE_URL;
      await fetch(`${baseUrl}/api/notifications/${notif.notification_id}/read`, {
        method: 'PATCH',
        headers: {
          'Authorization': 'Bearer ' + sessionStorage.getItem('jwt')
        }
      });
      notif.notification_status = 'read';
      this.unreadCount = this.notifications.filter(n => n.notification_status !== 'read').length;
    },
    handleNotificationClick(notif) {
      if (notif.notification_purpose === 'request' || notif.notification_purpose === 'rejected' || notif.notification_purpose === 'approved' || notif.notification_purpose === 'accepted') {
        window.location.href = '/html/lawyer/consultation.html';
      } else if (notif.notification_purpose === 'application') {
        window.location.href = '/html/lawyer/secretary.html';
      } else if (notif.notification_purpose === 'reschedule') {
        window.location.href = '/html/lawyer/calendar.html';
      } else if (notif.notification_purpose === 'paid') {
        window.location.href = '/html/lawyer/consultation.html';
      }
    },
    toggleNotifications() {
      this.showNotifications = !this.showNotifications;
      if (this.showNotifications) {
        this.fetchNotifications();
      }
    },
  },
  mounted() {
    this.fetchNotifications();
  },
  template: `
    <div class="layout">
      <!-- Top Navigation -->
      <header class="top-nav">
        <div class="top-nav__right">
          <div class="navbar-notification">
            <span class="notification-bell" @click="toggleNotifications">
              <img src="/images/notif.png" class="nav-logo">
              <span v-if="unreadCount > 0" class="notification-badge">{{ unreadCount }}</span>
            </span>
            <transition name="fade">
            <div v-if="showNotifications" class="notification-popup scrollable">
              <div v-if="notifications.length === 0" class="notification-empty">No notifications</div>
              <div v-for="notif in notifications" :key="notif.notification_id"
                class="notification-card"
                :class="{ 'read': notif.notification_status === 'read' }"
                @click="handleNotificationClick(notif)">
                <div class="notification-content">
                  <span class="notification-message">{{ formatNotificationMessage(notif) }}</span>
                  <span class="notification-eye" @click="markAsRead(notif, $event)">
                    <img :src="notif.notification_status === 'read' ? '/images/eye-open.png' : '/images/eye-close.png'" alt="Mark as read" style="width:18px;vertical-align:middle;cursor:pointer;" />
                  </span>
                </div>
                <div class="notification-date">
                  Date: {{ formatDate(notif.date) }}<br>Time: {{ formatTime(notif.time) }}
                </div>
              </div>
            </div>
            </transition>
          </div>
          <div class="profile-wrapper" 
               @mouseenter="toggleProfileMenu(true)" 
               @mouseleave="toggleProfileMenu(false)">
            <div class="profile-icon">
              <img src="/images/profile-logo.png" class="nav-logo">
            </div>
            <div v-show="showProfileMenu" class="profile-menu">
              <a href="/html/lawyer/profile.html">Profile</a>
              <a href="/index.html">Logout</a>
            </div>
          </div>
        </div>
      </header>

      <!-- Side Navigation -->
      <aside class="side-nav">
        <nav>
          <a href="/html/lawyer/search.html" class="chosen-dashboard" data-icon="search">
            <div class="icon-wrapper">
              <img src="/images/search-gray.png" class="icon-img" />
              <span class="icon-label">Search</span>
            </div>
          </a>
          <a href="/html/lawyer/messages.html" class="chosen-dashboard" data-icon="message">
            <div class="icon-wrapper">
              <img src="/images/message-gray.png" class="icon-img" />
              <span class="icon-label">Messages</span>
            </div>
          </a>
          <a href="/html/lawyer/consultation.html" class="chosen-dashboard" data-icon="consultation">
            <div class="icon-wrapper">
              <img src="/images/consultation-gray.png" class="icon-img" />
              <span class="icon-label">Consultations</span>
            </div>
          </a>
          <a href="/html/lawyer/calendar.html" class="chosen-dashboard" data-icon="calendar">
            <div class="icon-wrapper">
              <img src="/images/calendar-gray.png" class="icon-img" />
              <span class="icon-label">Calendar</span>
            </div>
          </a>
          <a href="/html/lawyer/secretary.html" class="chosen-dashboard" data-icon="secretary">
            <div class="icon-wrapper">
              <img src="/images/secretary-gray.png" class="icon-img" />
              <span class="icon-label">Secretaries</span>
            </div>
          </a>
        </nav>
      </aside>
    </div>
  `
});

app.mount('.navigation');
/*******************************************************************************************************************/
