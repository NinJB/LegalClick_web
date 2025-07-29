/*******************************************************************************************************************/
/*Javascript for navigation bar with role_id support for client dashboard*/
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
    }
  },
  mounted() {
    // Check if user is authenticated
    const token = sessionStorage.getItem('jwt');
    if (!token) {
      window.location.href = '/index.html';
      return;
    }
    
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
          <div class="notification-icon"><img src="/images/notif.png" class="nav-logo"></div>
          <div class="profile-wrapper" @click="handleProfileClick">
            <div class="profile-icon"><img src="/images/profile-logo.png" class="nav-logo"></div>
            <div :class="['profile-menu', { 'show': showProfileMenu }]">
              <a href="/html/admins/profile.html">Profile</a>
              <a href="#" @click="logout">Logout</a>
            </div>
          </div>
        </div>
      </header>

      <!-- Side Navigation -->
      <aside class="side-nav">
        <nav>
          <a href="/html/PAO-admin/lawyers.html" class="chosen-dashboard" data-icon="search">
            <div class="icon-wrapper">
              <img src="/images/search-gray.png" class="icon-img" />
              <span class="icon-label">Search</span>
            </div>
          </a>

          <a href="/html/PAO-admin/maintenance.html" class="chosen-dashboard" data-icon="maintenance">
            <div class="icon-wrapper">
              <img src="/images/maintenance-gray.png" class="icon-img" />
              <span class="icon-label">Maintenance</span>
            </div>
          </a>
        </nav>
      </aside>
    </div>
  `
});

/*Insert to client dashboard navigation*/
app.mount('.navigation');

/*******************************************************************************************************************/
