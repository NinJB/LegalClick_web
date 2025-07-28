const adminProfile = Vue.createApp({
    data() {
      return {
        isEditing: false,
        roleId: null,
        admin: {
          admin_id: null,
          user_id: null,
          username: '',
          first_name: '',
          last_name: '',
          email: '',
          contact_number: '',
          // Optional: profile_picture: null
        },
        form: {
          username: '',
          first_name: '',
          last_name: '',
          email: '',
          contact_number: ''
        },
        usernameError: false,
        adminsList: [] // Add this for the list of admins with the same role
      };
    },
    async created() {
      // Decode JWT from sessionStorage
      const token = sessionStorage.getItem('jwt');
      if (!token) {
        this.roleId = null;
        return;
      }
      const payload = window.decodeJWT ? window.decodeJWT(token) : JSON.parse(atob(token.split('.')[1]));
      this.roleId = payload && payload.role_id;
      const res = await fetch(`${window.API_BASE_URL}/admin/by-role/${this.roleId}`, {
        headers: { 'Authorization': 'Bearer ' + sessionStorage.getItem('jwt') }
      });
      const data = await res.json();
      this.admin = data;
      Object.assign(this.form, {
        username: data.username,
        first_name: data.first_name,
        last_name: data.last_name,
        email: data.email,
        contact_number: data.contact_number
      });
      // Fetch the list of admins with the same role
      const listRes = await fetch(`${window.API_BASE_URL}/admins/by-role/${this.roleId}`, {
        headers: { 'Authorization': 'Bearer ' + sessionStorage.getItem('jwt') }
      });
      if (listRes.ok) {
        this.adminsList = await listRes.json();
      }
    },
    methods: {
      async checkUsername() {
        if (this.form.username === this.admin.username) return this.usernameError = false;
        const res = await fetch(`${window.API_BASE_URL}/check-username`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + sessionStorage.getItem('jwt') },
          body: JSON.stringify({ 
            username: this.form.username,
            role_id: this.roleId
          })
        });
        const { available } = await res.json();
        this.usernameError = !available;
      },
      async submitForm() {
        if (this.usernameError) return;
        const upd = { ...this.form };
        const res = await fetch(`${window.API_BASE_URL}/admin/update/${this.admin.admin_id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + sessionStorage.getItem('jwt') },
          body: JSON.stringify(upd)
        });
        if (!res.ok) return alert('Update failed');
        alert('Updated');
        Object.assign(this.admin, upd);
        this.isEditing = false;
      },
      getProfileImage() {
        // Optional: if admin.profile_picture is supported, use that
        return this.admin.profile_picture || '/images/profile.png';
      }
    },
    template: `
      <div class="profile__container">
        <section class="profile__information">
          <div class="profile__title">
            <h2>Account Details</h2>
          </div>

          <div class="profile__options">
            <a><button>Profile Information</button></a>
            <a href="/html/admins/settings.html"><button>Change Password</button></a>
          </div>
        </section>
        
        <section class="profile-section">
          <div class="profile-background">
            <img :src="getProfileImage()" alt="Profile" class="profile-image" />
          </div>
    
          <div class="options">
            <h2 class="section-title">Admin Profile</h2>
            <div class="button-group">
              <button v-if="!isEditing" @click="isEditing = true" class="edit-button">Edit</button>
              <button v-else @click="submitForm" class="save-button">Save</button>
            </div>
          </div>
    
          <form @submit.prevent="submitForm" class="form-grid">
            <div>
              <label>Username</label>
              <input v-model="form.username" :disabled="!isEditing" @blur="checkUsername" required class="form-input" />
              <p v-if="usernameError" class="error-text">Username already taken.</p>
            </div>
            <div><label>First Name</label><input v-model="form.first_name" :disabled="!isEditing" class="form-input" /></div>
            <div><label>Last Name</label><input v-model="form.last_name" :disabled="!isEditing" class="form-input" /></div>
            <div><label>Email</label><input v-model="form.email" type="email" :disabled="!isEditing" class="form-input" /></div>
            <div><label>Contact Number</label><input v-model="form.contact_number" :disabled="!isEditing" class="form-input" /></div>
          </form>
        </section>
        <section class="profile-section">
          <h2 class="section-title">Admins with Same Role</h2>
          <ul v-if="adminsList.length">
            <li v-for="a in adminsList" :key="a.admin_id">
              <strong>{{ a.first_name }} {{ a.last_name }}</strong> ({{ a.username }})<br>
              Email: {{ a.email }}<br>
              Contact: {{ a.contact_number }}
            </li>
          </ul>
          <div v-else>No other admins found for your role.</div>
        </section>
      </div>
    `
  });
  
  adminProfile.mount('.admin-profile-page');  