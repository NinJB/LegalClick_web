/*******************************************************************************************************************/
/*Javascript for navigation bar*/
/*******************************************************************************************************************/

const app = Vue.createApp({
  data() {
    // Decode JWT from sessionStorage
    let roleId = null;
    let attorneyCategory = null;
    const token = sessionStorage.getItem('jwt');
    if (token) {
      const payload = window.decodeJWT ? window.decodeJWT(token) : JSON.parse(atob(token.split('.')[1]));
      roleId = payload && payload.role_id;
      attorneyCategory = payload && payload.attorney_category;
    }
    return {
      showProfileMenu: false,
      showNotifications: false,
      notifications: [],
      unreadCount: 0,
      consultationCount: 0,
      roleId: roleId,
      attorneyCategory: attorneyCategory
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
      const res = await fetch(`${baseUrl}/api/notifications/lawyer?user_id=${this.roleId}`, { headers: { 'Authorization': 'Bearer ' + sessionStorage.getItem('jwt') } });
      if (res.ok) {
        this.notifications = await res.json();
        this.unreadCount = this.notifications.filter(n => n.notification_status !== 'read').length;
      }
    },
    formatNotificationMessage(notif) {
      let clientName = 'Client';
      if (
        (notif.notification_purpose === 'request' || notif.notification_purpose === 'paid' || notif.notification_purpose === 'payment_receipt') &&
        notif.client_first_name && notif.client_last_name
      ){
        clientName = notif.client_first_name + ' ' + notif.client_last_name;
      }
      let secretaryName = 'Secretary';
      if (notif.notification_purpose === 'application' && notif.secretary_first_name && notif.secretary_last_name) {
        secretaryName = notif.secretary_first_name + ' ' + notif.secretary_last_name;
      }
      const attorneyLast = notif.attorney_last_name || notif.sender_last_name || 'Attorney';
      const secretaryLast = notif.secretary_last_name || notif.sender_last_name || 'Secretary';
      switch (notif.notification_purpose) {
        case 'request':
          return `${clientName} sent you a consultation request.`;
        case 'paid':
          return `${clientName} has paid their online consultation.`;
        case 'payment_receipt':
          return `${clientName} has paid their consultation. Please verify the payment by checking the receipt.`;
        case 'application':
          return `${secretaryName} has sent you an application to be your secretary.`;
        case 'application_accepted':
          return `Secretary ${notif.secretary_first_name || ''} ${notif.secretary_last_name || ''} has accepted your application.`.replace(/  +/g, ' ');
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
    async fetchConsultationCount() {
      try {
        const baseUrl = window.API_BASE_URL;
        const res = await fetch(`${baseUrl}/consultations-lawyer?lawyer_id=${this.roleId}`, {
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
            <div v-show="showProfileMenu" class="profile-menu">
              <a :href="attorneyCategory === 'Public' ? '/html/lawyer/profile-public.html' : '/html/lawyer/profile.html'">Profile</a>
              <a href="#" @click="logout">Logout</a>
            </div>
          </div>
        </div>
      </header>

      <!-- Side Navigation -->
      <aside class="side-nav">
        <nav>
          <a :href="attorneyCategory === 'Public' ? '/html/lawyer/search-public.html' : '/html/lawyer/search.html'" class="chosen-dashboard" data-icon="search">
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
              <span v-if="consultationCount > 0" class="consultation-badge">{{ consultationCount }}</span>
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
