const secretaryProfile = Vue.createApp({
  data() {
    return {
      isEditing: false,
      roleId: null,
      secretary: {
        secretary_id: null,
        username: '',
        first_name: '',
        last_name: '',
        address: '',
        email: '',
        contact_number: '',
        profile_picture: null
      },
      form: {
        username: '',
        first_name: '',
        last_name: '',
        address: '',
        email: '',
        contact_number: ''
      },
      usernameError: false
    };
  },
  async created() {
    // Decode JWT from sessionStorage
    const token = sessionStorage.getItem('jwt');
    if (!token) {
      this.error = 'Not authenticated.';
      return;
    }
    const payload = window.decodeJWT ? window.decodeJWT(token) : JSON.parse(atob(token.split('.')[1]));
    this.roleId = payload && payload.role_id;
    const baseUrl = window.API_BASE_URL;
    const res = await fetch(`${baseUrl}/secretary/by-role/${this.roleId}`, {
      headers: { 'Authorization': 'Bearer ' + sessionStorage.getItem('jwt') }
    });
    const data = await res.json();
    this.secretary = data;
    this.form.username = data.username;
    this.form.first_name = data.first_name;
    this.form.last_name = data.last_name;
    this.form.address = data.address;
    this.form.email = data.email;
    this.form.contact_number = data.contact_number;
  },
  methods: {
    async checkUsername() {
      if (this.form.username === this.secretary.username) {
        this.usernameError = false;
        return;
      }
      const baseUrl = window.API_BASE_URL;
      const res = await fetch(`${baseUrl}/check-username`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            username: this.form.username,
            role_id: this.roleId
        })
      });

      const data = await res.json();
      this.usernameError = !data.available;
    },
    async submitForm() {
      if (this.usernameError) return;

      const updateData = {
        username: this.form.username,
        first_name: this.form.first_name,
        last_name: this.form.last_name,
        address: this.form.address,
        email: this.form.email,
        contact_number: this.form.contact_number
      };

      const baseUrl = window.API_BASE_URL;
      const response = await fetch(`${baseUrl}/secretary/update/${this.secretary.secretary_id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData)
      });

      if (!response.ok) {
        console.error('Failed to update profile:', response.status, await response.text());
        alert('Profile update failed!');
        return;
      }

      alert('Profile updated successfully!');
      Object.assign(this.secretary, updateData);
      this.isEditing = false;
    },
    getProfileImage() {
      return this.secretary.profile_picture || '/images/profile.png';
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
          <a href="/html/secretary/settings.html"><button>Change Password</button></a>
        </div>
      </section>

      <section class="profile-section"> 
        <div class="profile-background">
          <img :src="getProfileImage()" alt="Profile" class="profile-image" />
        </div>

        <div class="options">
          <h2 class="section-title">Secretary Profile</h2>
          <div class="button-group">
            <button v-if="!isEditing" @click="isEditing = true" class="edit-button">Edit</button>
            <button v-else type="submit" form="secretaryForm" class="save-button">Save</button>
          </div>
        </div>

        <form id="secretaryForm" @submit.prevent="submitForm" class="form-grid">
          <div>
            <label>Username</label>
            <input v-model="form.username" :disabled="!isEditing" @blur="checkUsername" required class="form-input" />
            <p v-if="usernameError" class="error-text">Username already taken.</p>
          </div>
          <div>
            <label>First Name</label>
            <input v-model="form.first_name" :disabled="!isEditing" class="form-input" />
          </div>
          <div>
            <label>Last Name</label>
            <input v-model="form.last_name" :disabled="!isEditing" class="form-input" />
          </div>
          <div>
            <label>Address</label>
            <input v-model="form.address" :disabled="!isEditing" class="form-input" />
          </div>
          <div>
            <label>Email</label>
            <input v-model="form.email" :disabled="!isEditing" class="form-input" />
          </div>
          <div>
            <label>Contact Number</label>
            <input v-model="form.contact_number" :disabled="!isEditing" class="form-input" />
          </div>
        </form>
      </section>
    </div>
  `
});

secretaryProfile.mount('.secretary-profile-page');
