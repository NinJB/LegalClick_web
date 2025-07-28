const { createApp } = Vue;

createApp({
  template: `
    <div class="profile__container">
      <section class="profile__information">
        <div class="profile__title">
          <h2>Account Details</h2>
        </div>
        <div class="profile__options">
          <a :href="'/html/lawyer/profile-public.html'"><button>Profile Information</button></a>
          <a><button>Lawyer Setup</button></a>
          <a :href="'/html/lawyer/settings.html'"><button>Change Password</button></a>
        </div>
      </section>

      <section class="services__section">
        <div class="section__toggles">
          <button @click="toggleSection('officeHours')">Office Hours</button>
        </div>
        <!-- Office Hours Section -->
        <div v-show="activeSection === 'officeHours'">
          <h2>Set Your Office Hours</h2>
          <div>
            <label><span>*</span>Morning Start: <span>Required</span><input type="time" v-model="officeHours.morning_start" :disabled="!isEditingAvailability" /></label><br/>
            <label><span>*</span>Morning End: <span>Required</span><input type="time" v-model="officeHours.morning_end" :disabled="!isEditingAvailability" /></label><br/>
            <label><span>*</span>Evening Start: <span>Required</span><input type="time" v-model="officeHours.evening_start" :disabled="!isEditingAvailability" /></label><br/>
            <label><span>*</span>Evening End: <span>Required</span><input type="time" v-model="officeHours.evening_end" :disabled="!isEditingAvailability" /></label><br/>
            <label><span>*</span>Workday Start: <span>Required</span>
              <select v-model="officeHours.workday_start" :disabled="!isEditingAvailability">
                <option v-for="day in days" :key="day">{{ day }}</option>
              </select>
            </label><br/>
            <label><span>*</span>Workday End: <span>Required</span>
              <select v-model="officeHours.workday_end" :disabled="!isEditingAvailability">
                <option v-for="day in days" :key="day">{{ day }}</option>
              </select>
            </label><br/>
            <button v-if="!isEditingAvailability" @click="isEditingAvailability = true">Edit</button>
            <button v-else @click="saveAvailability">Save</button>
          </div>
        </div>
      </section>
    </div>
  `,
  data() {
    return {
      roleId: null,
      officeHours: {
        morning_start: '',
        morning_end: '',
        evening_start: '',
        evening_end: '',
        workday_start: 'Monday',
        workday_end: 'Friday'
      },
      isEditingAvailability: false,
      days: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
      activeSection: 'officeHours'
    };
  },
  async mounted() {
    // Decode JWT from sessionStorage
    const token = sessionStorage.getItem('jwt');
    if (!token) {
      alert('Not authenticated.');
      return;
    }
    const payload = window.decodeJWT ? window.decodeJWT(token) : JSON.parse(atob(token.split('.')[1]));
    this.roleId = payload && payload.role_id;
    if (!this.roleId) {
      alert('No lawyer role_id found in token');
      return;
    }
    await this.fetchExistingSelections();
  },
  methods: {
    toggleSection(section) {
      this.activeSection = this.activeSection === section ? '' : section;
    },
    async fetchSpecializations() {
      const baseUrl = window.API_BASE_URL;
      const res = await fetch(`${baseUrl}/specializations`, {
        headers: { 'Authorization': 'Bearer ' + sessionStorage.getItem('jwt') }
      });
      this.specializations = await res.json();
    },
    async fetchExistingSelections() {
      const baseUrl = window.API_BASE_URL;
      const res = await fetch(`${baseUrl}/lawyer/${this.roleId}/availability`, {
        headers: { 'Authorization': 'Bearer ' + sessionStorage.getItem('jwt') }
      });
      if (res.ok) {
        const availability = await res.json();
        if (availability) {
          this.officeHours = availability;
        }
      }
    },
    async saveAvailability() {
      const baseUrl = window.API_BASE_URL;
      const res = await fetch(`${baseUrl}/lawyer/${this.roleId}/availability`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + sessionStorage.getItem('jwt') },
        body: JSON.stringify(this.officeHours)
      });
      if (res.ok) {
        alert('Availability saved.');
        this.isEditingAvailability = false;
      } else {
        alert('Error saving availability.');
      }
    }
  }
}).mount('.setup');
