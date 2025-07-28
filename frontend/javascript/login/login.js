const Login = Vue.createApp({
  data() {
    return {
      username: '',
      password: '',
      error: '',
      lockedMessage: '',
      attemptsLeft: 5,
      countdownInterval: null
    };
  },
  methods: {
    async login() {
      this.error = '';
      this.lockedMessage = '';
      this.attemptsLeft = 5;
      if (this.countdownInterval) clearInterval(this.countdownInterval);

      try {
        const baseUrl = window.API_BASE_URL;
        const response = await fetch(`${baseUrl}/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: this.username,
            password: this.password
          })
        });

        const data = await response.json();

        if (!response.ok) {
          if (data.locked_until) {
            this.startCountdown(data.locked_until);
          }

          this.error = data.message || 'Login failed.';
          this.attemptsLeft = 5 - (data.failed_attempts || 0);

          return;
        }

        if (data.status !== 'Activated') {
          this.error = 'Account not activated.';
          return;
        }

        // Success: clear failed attempts (handled by backend), redirect
        // Store JWT in sessionStorage
        if (data.token) {
          sessionStorage.setItem('jwt', data.token);
        }
        // Helper to decode JWT (for use in other scripts)
        window.decodeJWT = function(token) {
          if (!token) return null;
          try {
            const payload = token.split('.')[1];
            return JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
          } catch (e) { return null; }
        };
        // Redirect based on role (no role_id in URL)
        const routeMap = {
          'Lawyer': data.attorney_category === 'Public' ? '/html/lawyer/search-public.html' : '/html/lawyer/search.html',
          'Client': '/html/client/search.html',
          'PAO-Admin': '/html/PAO-admin/lawyers.html',
          'OLBA-Admin': '/html/OLBA-admin/lawyers.html', // fixed: lowercase 'a'
          'Secretary': '/html/secretary/search.html'
        };
        const redirectUrl = routeMap[data.role];
        if (redirectUrl) {
          window.location.replace(redirectUrl);
        } else {
          this.error = 'Unknown role.';
        }
      } catch (err) {
        this.error = 'Server error. Please try again later.';
      }
    },
    startCountdown(lockedUntil) {
      const end = new Date(lockedUntil).getTime();

      this.countdownInterval = setInterval(() => {
        const now = Date.now();
        const diff = end - now;

        if (diff <= 0) {
          this.lockedMessage = '';
          clearInterval(this.countdownInterval);
          return;
        }

        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);

        this.lockedMessage = "Account locked. Try again in ${hours}h ${minutes}m ${seconds}s.";
      }, 1000);
    }
  },
  template:`
    <div class="login-container">
      <h2>Login</h2>
      <form @submit.prevent="login">
        <span>*Required</span>
        <input v-model="username" type="text" placeholder="Username" required />
        <span>*Required</span>
        <input v-model="password" type="password" placeholder="Password" required />
        <button type="submit">Login</button>
        <p v-if="error" class="error">{{ error }}</p>
        <p v-if="lockedMessage" class="locked">{{ lockedMessage }}</p>
        <p v-if="attemptsLeft > 0 && attemptsLeft < 5" class="warning">
          {{ attemptsLeft }} attempt{{ attemptsLeft === 1 ? '' : 's' }} left before lockout.
        </p>
      </form>
    </div>

    <a href="/index.html"><button class="homepage__back-button">Back</button></a>
  `
});

Login.mount('.login');