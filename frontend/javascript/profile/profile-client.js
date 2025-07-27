const clientProfile = Vue.createApp({
  data() {
    return {
      isEditing: false,
      roleId: null,
      client: {
        client_id: null,
        username: '',
        first_name: '',
        last_name: '',
        birth_date: '',
        age: '',
        gender: '',
        address: '',
        email: '',
        contact_number: '',
        marital_status: '',
        profile_picture: null
      },
      form: {
        username: '',
        marital_status: '',
        last_name: '',
        age: '',
        address: '',
        email: '',
        contact_number: ''
      },
      usernameError: false
    };
  },
  computed: {
    formattedBirthDate() {
      if (!this.client.birth_date) return '';
      const date = new Date(this.client.birth_date);
      const offsetDate = new Date(date.getTime() + Math.abs(date.getTimezoneOffset() * 60000));
      return offsetDate.toISOString().split('T')[0];
    },
    isFemale() {
      return this.client.gender === 'Female';
    }
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
    const res = await fetch(`${baseUrl}/api/client/by-role/${this.roleId}`, {
      headers: { 'Authorization': 'Bearer ' + sessionStorage.getItem('jwt') }
    });
    const data = await res.json();
    this.client = data;
    // Populate form fields with the client's data
    this.form.username = data.username;
    this.form.marital_status = data.marital_status;
    this.form.last_name = data.last_name;
    this.form.age = data.age;
    this.form.address = data.address;
    this.form.email = data.email;
    this.form.contact_number = data.contact_number;
  },
  methods: {
    async checkUsername() {
      console.log('Checking username...');
      console.log('form.username:', this.form.username);
      console.log('client.username:', this.client.username);

      // Normalize before comparing to avoid case or whitespace mismatches
      if (
        this.form.username.trim().toLowerCase() ===
        this.client.username.trim().toLowerCase()
      ) {
        console.log('Username unchanged, skipping API check');
        this.usernameError = false;
        return;
      }

      const baseUrl = window.API_BASE_URL;
      const res = await fetch(`${baseUrl}/api/check-username`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: this.form.username,
          role_id: this.roleId
        })
      });
      const data = await res.json();
      this.usernameError = !data.available;

      console.log('Username availability:', data.available);
    },
    async submitForm() {
      if (this.usernameError) return;

      const updateData = {
        username: this.form.username,
        marital_status: this.form.marital_status,
        last_name: this.form.last_name,
        age: this.form.age,
        address: this.form.address,
        email: this.form.email,
        contact_number: this.form.contact_number
      };

      const baseUrl = window.API_BASE_URL;
      const response = await fetch(`${baseUrl}/api/client/update/${this.client.client_id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + sessionStorage.getItem('jwt')
        },
        body: JSON.stringify(updateData)
      });

      if (!response.ok) {
        console.error('Failed to update profile:', response.status, await response.text());
        alert('Profile update failed!');
        return;
      }

      alert('Profile updated successfully!');
      this.client.username = this.form.username;
      this.client.marital_status = this.form.marital_status;
      this.client.last_name = this.form.last_name;
      this.client.age = this.form.age;
      this.client.address = this.form.address;
      this.client.email = this.form.email;
      this.client.contact_number = this.form.contact_number;
      this.isEditing = false;
    },
    getProfileImage() {
      return this.client.profile_picture || '/images/profile.png';
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
          <a href="/html/client/settings.html"><button>Change Password</button></a>
        </div>
      </section>

      <section class="profile-section"> 
        <div class="profile-background">
          <img :src="getProfileImage()" alt="Profile" class="profile-image" />
        </div>

        <div class="options">
          <h2 class="section-title">Client Profile</h2>
          <div class="button-group">
            <button v-if="!isEditing" @click="isEditing = true" class="edit-button">Edit</button>
            <button v-else type="submit" form="clientForm" class="save-button">Save</button>
          </div>
        </div>

        <form id="clientForm" @submit.prevent="submitForm" class="form-grid">
          <div>
            <label>Username</label>
            <input v-model="form.username" :disabled="!isEditing" @blur="checkUsername" required class="form-input" />
            <p v-if="usernameError" class="error-text">Username already taken.</p>
          </div>
          <div><label>First Name</label><input type="text" :value="client.first_name" disabled class="form-input" /></div>
          <div>
            <label>Last Name</label>
            <input v-model="form.last_name" :disabled="!isEditing || !isFemale" class="form-input" />
          </div>
          <div>
            <label>Birth Date</label>
            <input type="date" :value="formattedBirthDate" disabled class="form-input" />
          </div>
          <div>
            <label>Age</label>
            <input v-model="form.age" :disabled="!isEditing" class="form-input" />
          </div>
          <div>
            <label>Gender</label>
            <input type="text" :value="client.gender" disabled class="form-input" />
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
          <div>
            <label>Marital Status</label>
            <select v-model="form.marital_status" :disabled="!isEditing" class="form-input">
              <option disabled value="">Select status</option>
              <option>Single</option>
              <option>Married</option>
              <option>Widowed</option>
              <option>Separated</option>
              <option>Divorced</option>
            </select>
          </div>
        </form>
      </section>
    </div>
  `
});

clientProfile.mount('.client-profile-page');
