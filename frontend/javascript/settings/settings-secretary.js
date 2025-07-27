const Password = Vue.createApp({
    data() {
      return {
        oldPassword: '',
        newPassword: '',
        confirmPassword: '',
        message: '',
        error: '',
        roleId: ''
      };
    },
    mounted() {
      // Decode JWT from sessionStorage
      const token = sessionStorage.getItem('jwt');
      if (!token) {
        this.error = 'Not authenticated.';
        return;
      }
      const payload = window.decodeJWT ? window.decodeJWT(token) : JSON.parse(atob(token.split('.')[1]));
      this.roleId = payload && payload.role_id;
      if (!this.roleId) {
        this.error = 'Missing role ID in token.';
      }
    },
    methods: {
      async changePassword() {
        this.message = '';
        this.error = '';
        if (!this.roleId) {
          this.error = 'Missing role ID.';
          return;
        }
        try {
          const response = await fetch(`${window.API_BASE_URL}/change-password-secretary/${this.roleId}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': 'Bearer ' + sessionStorage.getItem('jwt')
            },
            body: JSON.stringify({
              oldPassword: this.oldPassword,
              newPassword: this.newPassword,
              confirmPassword: this.confirmPassword
            })
          });
          const data = await response.json();
          if (!response.ok) {
            this.error = data.message || 'Failed to change password.';
            return;
          }
          this.message = data.message;
          this.oldPassword = '';
          this.newPassword = '';
          this.confirmPassword = '';
        } catch (err) {
          this.error = 'Server error. Please try again.';
        }
      }
    },
    template: `
      <div class="profile__container">
        <section class="profile__information">
          <div class="profile__title">
            <h2>Account Details</h2>
          </div>
          <div class="profile__options">
            <a href="/html/secretary/profile.html"><button>Profile Information</button></a>
            <a><button>Change Password</button></a>
          </div>
        </section>
        <section class="password-container">
          <h2>Change Password</h2>
          <form @submit.prevent="changePassword">
            <p><span>*</span>Old Password <span>Required</span></p>
            <input type="password" v-model="oldPassword" placeholder="Old Password" required />
            <p><span>*</span>New Password <span>Required</span></p>
            <input type="password" v-model="newPassword" placeholder="New Password" required />
            <p><span>*</span>Confirm Password <span>Required</span></p>
            <input type="password" v-model="confirmPassword" placeholder="Confirm New Password" required />
            <button type="submit">Change Password</button>
            <p v-if="message" class="success">{{ message }}</p>
            <p v-if="error" class="error">{{ error }}</p>
          </form>
        </section>
      </div>
    `
  });
  
  Password.mount('.password');  