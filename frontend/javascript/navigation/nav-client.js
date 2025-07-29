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
      consultationCount: 0,
      roleId: roleId
    };
  },
  methods: {
    toggleProfileMenu() {
      this.showProfileMenu = !this.showProfileMenu;
    },
    closeProfileMenu() {
      this.showProfileMenu = false;
    },
    handleProfileClick(event) {
      event.stopPropagation();
      this.toggleProfileMenu();
    },
    handleDocumentClick(event) {
      const profileWrapper = event.target.closest('.profile-wrapper');
      if (!profileWrapper) {
        this.closeProfileMenu();
      }
    },
    logout() {
      // Clear all session data
      sessionStorage.clear();
      localStorage.clear();
      // Clear browser history and redirect to login page
      window.location.replace('/index.html');
      // Clear all history entries
      window.history.pushState(null, '', '/index.html');
      window.history.pushState(null, '', '/index.html');
      window.history.pushState(null, '', '/index.html');
    },
    async fetchNotifications() {
      const baseUrl = window.API_BASE_URL;
      const res = await fetch(`${baseUrl}/notifications/client?user_id=${this.roleId}`, { headers: { 'Authorization': 'Bearer ' + sessionStorage.getItem('jwt') } });
      if (res.ok) {
        this.notifications = await res.json();
        this.unreadCount = this.notifications.filter(n => n.notification_status !== 'read').length;
      }
    },
    formatNotificationMessage(notif) {
      // You may need to adjust these fields based on your backend notification object
      const clientName = notif.client_name || notif.sender_name || 'Client';
      const attorneyLast = notif.attorney_last_name || notif.sender_last_name || 'Attorney';
      const secretaryLast = notif.secretary_last_name || notif.sender_last_name || 'Secretary';
      switch (notif.notification_purpose) {
        case 'request':
          return `${clientName} sent you a consultation request.`;
        case 'reschedule':
          return `Atty. ${attorneyLast} has rescheduled your consultation.`;
        case 'rejected':
          return `Atty. ${attorneyLast} has rejected your consultation.`;
        case 'approved_online':
          return `Atty. ${attorneyLast} has approved your consultation. Please proceed to pay your consultation via GCASH.`;
        case 'approved':
          return `Atty. ${attorneyLast} has approved your consultation.`;
        case 'payment_confirmed':
          return `Atty. ${attorneyLast} has confirmed your payment.`;
        case 'payment_denied':
          return `Atty. ${attorneyLast} has denied the legitimacy of your receipt. Please proceed to attach another one.`;
        default:
          return 'You have a new notification.';
      }
    },
    formatDate(dateStr) {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    },
    formatTime(timeStr) {
      // timeStr expected as 'HH:MM:SS' or similar
      const [h, m] = timeStr.split(':');
      const date = new Date();
      date.setHours(h, m);
      return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    },
    async markAsRead(notif, e) {
      e.stopPropagation();
      if (notif.notification_status === 'read') return;
      const baseUrl = window.API_BASE_URL;
      await fetch(`${baseUrl}/notifications/${notif.notification_id}/read`, {
        method: 'PATCH',
        headers: {
          'Authorization': 'Bearer ' + sessionStorage.getItem('jwt')
        }
      });
      notif.notification_status = 'read';
      this.unreadCount = this.notifications.filter(n => n.notification_status !== 'read').length;
    },
    handleNotificationClick(notif) {
      // Navigation by purpose
      if (notif.notification_purpose === 'request' || notif.notification_purpose === 'rejected' || notif.notification_purpose === 'approved' || notif.notification_purpose === 'approved_online' || notif.notification_purpose === 'accepted' || notif.notification_purpose === 'payment_denied' || notif.notification_purpose === 'payment_confirmed') {
        window.location.href = '/html/client/consultation.html';
      } else if (notif.notification_purpose === 'application') {
        window.location.href = '/html/client/search.html';
      } else if (notif.notification_purpose === 'reschedule') {
        window.location.href = '/html/client/calendar.html';
      }
    },
    toggleNotifications() {
      this.showNotifications = !this.showNotifications;
      if (this.showNotifications) {
        this.fetchNotifications();
      }
    },
    async fetchConsultationCount() {
      try {
        const baseUrl = window.API_BASE_URL;
        const res = await fetch(`${baseUrl}/consultations-client?client_id=${this.roleId}`, {
          headers: { 'Authorization': 'Bearer ' + sessionStorage.getItem('jwt') }
        });
        if (res.ok) {
          const consultations = await res.json();
          // Count only pending, unpaid, and upcoming consultations
          this.consultationCount = consultations.filter(c => 
            ['Pending', 'Unpaid', 'Upcoming'].includes(c.consultation_status)
          ).length;
        }
      } catch (error) {
        console.error('Error fetching consultation count:', error);
      }
    },
  },
  mounted() {
    // Check if user is authenticated
    const token = sessionStorage.getItem('jwt');
    if (!token) {
      window.location.href = '/index.html';
      return;
    }
    this.fetchNotifications();
    this.fetchConsultationCount();
    
    // Add document click listener to close profile menu when clicking outside
    document.addEventListener('click', this.handleDocumentClick);
  },
  beforeUnmount() {
    // Clean up event listener
    document.removeEventListener('click', this.handleDocumentClick);
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
          <div class="profile-wrapper" @click="handleProfileClick">
            <div class="profile-icon">
              <img src="/images/profile-logo.png" class="nav-logo">
            </div>
            <div :class="['profile-menu', { 'show': showProfileMenu }]">
              <a href="/html/client/profile.html">Profile</a>
              <a href="#" @click="logout">Logout</a>
            </div>
          </div>
        </div>
      </header>

      <!-- Side Navigation -->
      <aside class="side-nav">
        <nav>
          <a href="/html/client/search.html" class="chosen-dashboard" data-icon="search">
            <div class="icon-wrapper">
              <img src="/images/search-gray.png" class="icon-img" />
              <span class="icon-label">Search</span>
            </div>
          </a>
          <a href="/html/client/messages.html" class="chosen-dashboard" data-icon="message">
            <div class="icon-wrapper">
              <img src="/images/message-gray.png" class="icon-img" />
              <span class="icon-label">Messages</span>
            </div>
          </a>
          <a href="/html/client/consultation.html" class="chosen-dashboard" data-icon="consultation">
            <div class="icon-wrapper">
              <img src="/images/consultation-gray.png" class="icon-img" />
              <span v-if="consultationCount > 0" class="consultation-badge">{{ consultationCount }}</span>
              <span class="icon-label">Consultations</span>
            </div>
          </a>
          <a href="/html/client/calendar.html" class="chosen-dashboard" data-icon="calendar">
            <div class="icon-wrapper">
              <img src="/images/calendar-gray.png" class="icon-img" />
              <span class="icon-label">Calendar</span>
            </div>
          </a>
        </nav>
      </aside>
    </div>
  `
});

app.mount('.navigation');
/*******************************************************************************************************************/
