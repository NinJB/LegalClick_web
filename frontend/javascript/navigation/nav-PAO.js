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
    toggleProfileMenu(state) {
      this.showProfileMenu = state;
    }
  },
  template: `
    <div class="layout">
      <!-- Top Navigation -->
      <header class="top-nav">
        <div class="top-nav__right">
          <div class="notification-icon"><img src="/images/notif.png" class="nav-logo"></div>
          <div class="profile-wrapper" 
               @mouseenter="toggleProfileMenu(true)" 
               @mouseleave="toggleProfileMenu(false)">
            <div class="profile-icon"><img src="/images/profile-logo.png" class="nav-logo"></div>
            <div v-show="showProfileMenu" class="profile-menu">
              <a href="/html/admins/profile.html">Profile</a>
              <a href="/index.html">Logout</a>
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
