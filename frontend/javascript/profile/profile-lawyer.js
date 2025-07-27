const profile = Vue.createApp({
  data() {
    return {
      isEditing: false,
      roleId: null,
      lawyer: {
        lawyer_id: 1,
        roll_number: '',
        username: '',
        first_name: '',
        last_name: '',
        bar_admission_year: '',
        gender: '',
        office_address: '',
        email: '',
        contact_number: '',
        gcash_number: '',
        attorney_category: '',
        law_school: '',
        profile_picture: null
      },
      form: {
        username: '',
        last_name: '',
        office_address: '',
        email: '',
        contact_number: '',
        gcash_number: ''
      },
      usernameError: false,
      profilePictureFile: null,
      showUploadPopup: false
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
    // Fetch the lawyer details using the role_id
    const res = await fetch(`${baseUrl}/api/lawyer/by-role/${this.roleId}`, {
      headers: { 'Authorization': 'Bearer ' + sessionStorage.getItem('jwt') }
    });
    const data = await res.json();
    // Log the data to check if profile_picture is correctly received
    console.log('Fetched lawyer data:', data);
    // Populate lawyer data
    this.lawyer = data;
    // Initialize form fields
    this.form.username = data.username;
    this.form.last_name = data.last_name;
    this.form.office_address = data.office_address;
    this.form.email = data.email;
    this.form.contact_number = data.contact_number;
    this.form.gcash_number = data.gcash_number;
  },
  methods: {
    async checkUsername() {
      if (this.form.username === this.lawyer.username) {
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
    },
    async submitForm() {
      if (this.usernameError) return;

      const updateData = {
        username: this.form.username,
        last_name: this.lawyer.gender === 'Female' ? this.form.last_name : this.lawyer.last_name,
        office_address: this.form.office_address,
        email: this.form.email,
        contact_number: this.form.contact_number,
        gcash_number: this.form.gcash_number
      };

      // If a new profile picture is selected, include it in the update
      if (this.profilePictureFile) {
        const baseUrl = window.API_BASE_URL;
        const formData = new FormData();
        formData.append('file', this.profilePictureFile);
        const uploadResponse = await fetch(`${baseUrl}/api/lawyer/upload-profile-picture/${this.lawyer.lawyer_id}`, {
          method: 'POST',
          body: formData
        });

        if (!uploadResponse.ok) {
          alert('Failed to upload profile picture.');
          return;
        }

        alert('Profile picture uploaded successfully!');
      }

      // Log the data being sent to the server
      console.log('Sending PUT request with data:', updateData);

      const baseUrl = window.API_BASE_URL;
      const response = await fetch(`${baseUrl}/api/lawyer/update/${this.lawyer.lawyer_id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData)
      });

      // Check for errors in response
      if (!response.ok) {
        console.error('Failed to update profile:', response.status, await response.text());
        alert('Profile update failed!');
        return;
      }

      alert('Profile updated successfully!');
      this.isEditing = false;
    },
    getProfileImage() {
      return this.lawyer.profile_picture 
        ? `data:image/jpeg;base64,${this.lawyer.profile_picture}` 
        : '/images/temporary-profile.jpg';
    },
    openUploadPopup() {
      this.showUploadPopup = true;
    },
    closeUploadPopup() {
      this.showUploadPopup = false;
    },
    handleFileUpload(event) {
      this.profilePictureFile = event.target.files[0];
    },
    async saveProfilePicture() {
      if (this.profilePictureFile) {
        const baseUrl = window.API_BASE_URL;
        const formData = new FormData();
        formData.append('file', this.profilePictureFile);

        const response = await fetch(`${baseUrl}/api/lawyer/upload-profile-picture/${this.lawyer.lawyer_id}`, {
          method: 'POST',
          body: formData
        });

        if (!response.ok) {
          alert('Failed to upload profile picture.');
        } else {
          alert('Profile picture uploaded successfully!');
          this.lawyer.profile_picture = await response.json();
        }

        this.showUploadPopup = false;
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
          <a><button>Profile Information</button></a>
          <a href="/html/lawyer/specialization.html"><button>Lawyer Setup</button></a>
          <a href="/html/lawyer/settings.html"><button>Change Password</button></a>
        </div>
      </section>
      
      <section class="profile-section">
        <div class="profile-background">
          <img :src="getProfileImage()" alt="Profile" class="profile-image" />
        </div>

        <div class="options">
          <h2 class="section-title">Attorney Profile</h2>

          <div class="button-group">
            <button v-if="!isEditing" @click="isEditing = true" class="edit-button">Edit</button>
            <button v-else type="submit" form="lawyerForm" class="save-button">Save</button>
            <button @click="openUploadPopup">Change Profile Picture</button>
          </div>
        </div>

        <form id="lawyerForm" @submit.prevent="submitForm" class="form-grid">
          <div>
            <label>Roll Number</label>
            <input type="text" :value="lawyer.roll_number" disabled class="form-input" />
          </div>
          <div>
            <label>Username</label>
            <input v-model="form.username" :disabled="!isEditing" @blur="checkUsername" required class="form-input" />
            <p v-if="usernameError" class="error-text">Username already taken.</p>
          </div>
          <div>
            <label>First Name</label>
            <input type="text" :value="lawyer.first_name" disabled class="form-input" />
          </div>
          <div>
            <label>Last Name</label>
            <input v-model="form.last_name" :disabled="lawyer.gender !== 'Female' || !isEditing" class="form-input" />
          </div>
          <div>
            <label>Bar Admission Year</label>
            <input type="text" :value="lawyer.bar_admission_year" disabled class="form-input" />
          </div>
          <div>
            <label>Gender</label>
            <input type="text" :value="lawyer.gender" disabled class="form-input" />
          </div>
          <div>
            <label>Office Address</label>
            <input v-model="form.office_address" :disabled="!isEditing" class="form-input" />
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
            <label>GCash Number</label>
            <input v-model="form.gcash_number" :disabled="!isEditing" class="form-input" />
          </div>
          <div>
            <label>Attorney Category</label>
            <input type="text" :value="lawyer.attorney_category" disabled class="form-input" />
          </div>
          <div>
            <label>Law School</label>
            <input type="text" :value="lawyer.law_school" disabled class="form-input" />
          </div>
        </form>
      </section>

      <!-- Profile Picture Upload Popup -->
      <div v-if="showUploadPopup" class="popup-overlay">
        <div class="popup-content">
          <h3>Upload New Profile Picture</h3>
          <input type="file" @change="handleFileUpload" />
          <button @click="saveProfilePicture">Save</button>
          <button @click="closeUploadPopup">Cancel</button>
        </div>
      </div>
    </div>
  `
});

profile.mount('.lawyer-profile-page');
