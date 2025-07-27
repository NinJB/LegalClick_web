const { createApp } = Vue;

createApp({
  template: `
    <div class="profile__container">
      <section class="profile__information">
        <div class="profile__title">
          <h2>Account Details</h2>
        </div>
        <div class="profile__options">
          <a :href="'/html/lawyer/profile.html'"><button>Profile Information</button></a>
          <a><button>Lawyer Setup</button></a>
          <a :href="'/html/lawyer/settings.html'"><button>Change Password</button></a>
        </div>
      </section>

      <section class="services__section">
        <div class="section__toggles">
          <button @click="toggleSection('specialization')">Specialization</button>
          <button @click="toggleSection('officeHours')">Office Hours</button>
          <button @click="toggleSection('services')">Services</button>
        </div>

        <!-- Specializations Section -->
        <div v-show="activeSection === 'specialization'">
          <h2>Choose Your Specializations</h2>
          <span class="specialization-span">*Required</span>
          <div v-if="specializations.length">
            <div class="specialization__grid">
              <div v-for="spec in specializations" :key="spec.specialization_id">
                <label>
                  <input 
                    type="checkbox" 
                    :value="spec.specialization_id"
                    :checked="selectedSpecializations.includes(spec.specialization_id)"
                    @change="toggleSpecialization(spec.specialization_id)"
                    :disabled="!isEditingSpecializations"
                  />
                  {{ spec.name }}
                </label>
              </div>
            </div>
            <button v-if="!isEditingSpecializations" @click="isEditingSpecializations = true">Edit</button>
            <button v-else @click="saveSpecializations">Save</button>
          </div>
          <div v-else>Loading specializations...</div>
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

        <!-- Services Section -->
        <div v-show="activeSection === 'services'">
          <h2>Set Your Services</h2>
          <div>
            <label><span>*</span>Consultation Rate (₱ per hour): <span>Required</span>
              <input type="number" v-model.number="services.consultation" :disabled="!isEditingServices" />
            </label><br/>
            <label><span>*</span>Representation Fee (Minimum ₱): <span>Required</span>
              <input type="number" v-model.number="services.representation_min" :disabled="!isEditingServices" />
            </label><br/>
            <label><span>*</span>Representation Fee (Maximum ₱): <span>Required</span>
              <input type="number" v-model.number="services.representation_max" :disabled="!isEditingServices" />
            </label><br/>
            <button v-if="!isEditingServices" @click="isEditingServices = true">Edit</button>
            <button v-else @click="saveServices">Save</button>
          </div>
        </div>
      </section>
    </div>
  `,
  data() {
    return {
      roleId: null,
      specializations: [],
      selectedSpecializations: [],
      originalSpecializations: [],
      officeHours: {
        morning_start: '',
        morning_end: '',
        evening_start: '',
        evening_end: '',
        workday_start: 'Monday',
        workday_end: 'Friday'
      },
      services: {
        consultation: 0,
        notary: 0,
        representation_min: 0,
        representation_max: 0
      },
      isEditingSpecializations: false,
      isEditingAvailability: false,
      isEditingServices: false,
      activeSection: 'specialization',
      days: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
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
    await this.fetchSpecializations();
    await this.fetchExistingSelections();
    await this.fetchServices();
  },
  methods: {
    toggleSection(section) {
      this.activeSection = this.activeSection === section ? '' : section;
    },
    async fetchSpecializations() {
      const baseUrl = window.API_BASE_URL;
      const res = await fetch(`${baseUrl}/api/specializations`, {
        headers: { 'Authorization': 'Bearer ' + sessionStorage.getItem('jwt') }
      });
      this.specializations = await res.json();
    },
    async fetchExistingSelections() {
      const baseUrl = window.API_BASE_URL;
      const [specsRes, availabilityRes] = await Promise.all([
        fetch(`${baseUrl}/api/lawyer/${this.roleId}/specializations`, { headers: { 'Authorization': 'Bearer ' + sessionStorage.getItem('jwt') } }),
        fetch(`${baseUrl}/api/lawyer/${this.roleId}/availability`, { headers: { 'Authorization': 'Bearer ' + sessionStorage.getItem('jwt') } })
      ]);
      const specs = await specsRes.json();
      this.selectedSpecializations = specs.map(Number);
      this.originalSpecializations = [...this.selectedSpecializations];
      const availability = await availabilityRes.json();
      if (availability) {
        this.officeHours = availability;
      }
    },
    async fetchServices() {
      const baseUrl = window.API_BASE_URL;
      const res = await fetch(`${baseUrl}/api/lawyer/${this.roleId}/services`, { headers: { 'Authorization': 'Bearer ' + sessionStorage.getItem('jwt') } });
      const data = await res.json();
      if (data) {
        this.services = data;
      }
    },
    toggleSpecialization(id) {
      if (!this.isEditingSpecializations) return;
      const index = this.selectedSpecializations.indexOf(id);
      if (index > -1) {
        this.selectedSpecializations.splice(index, 1);
      } else {
        this.selectedSpecializations.push(id);
      }
    },
    async saveSpecializations() {
      const baseUrl = window.API_BASE_URL;
      const res = await fetch(`${baseUrl}/api/lawyer/${this.roleId}/specializations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + sessionStorage.getItem('jwt') },
        body: JSON.stringify({
          specializations: this.selectedSpecializations.map(Number)
        })
      });
      if (res.ok) {
        alert('Specializations saved.');
        this.originalSpecializations = [...this.selectedSpecializations];
        this.isEditingSpecializations = false;
      } else {
        alert('Error saving specializations.');
      }
    },
    async saveAvailability() {
      const baseUrl = window.API_BASE_URL;
      const res = await fetch(`${baseUrl}/api/lawyer/${this.roleId}/availability`, {
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
    },
    async saveServices() {
      const baseUrl = window.API_BASE_URL;
      const res = await fetch(`${baseUrl}/api/lawyer/${this.roleId}/services`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + sessionStorage.getItem('jwt') },
        body: JSON.stringify(this.services)
      });
      if (res.ok) {
        alert('Services saved.');
        this.isEditingServices = false;
      } else {
        alert('Error saving services.');
      }
    }
  }
}).mount('.setup');
