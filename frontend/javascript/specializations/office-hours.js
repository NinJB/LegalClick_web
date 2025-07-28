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
          <h2>Office Hours</h2>
          <div>
            <div>
              <label>Morning Start: <input type="time" v-model="officeHours.morning_start" disabled /></label><br/>
              <label>Morning End: <input type="time" v-model="officeHours.morning_end" disabled /></label><br/>
              <label>Evening Start: <input type="time" v-model="officeHours.evening_start" disabled /></label><br/>
              <label>Evening End: <input type="time" v-model="officeHours.evening_end" disabled /></label><br/>
              <label>Workday Start:
                <select v-model="officeHours.workday_start" disabled>
                  <option v-for="day in days" :key="day">{{ day }}</option>
                </select>
              </label><br/>
              <label>Workday End:
                <select v-model="officeHours.workday_end" disabled>
                  <option v-for="day in days" :key="day">{{ day }}</option>
                </select>
              </label><br/>
            </div>
            <div v-if="isClient && officeHours.morning_start && officeHours.evening_end">
              <button class="btn btn-primary" @click="openBookPopup">Book Appointment</button>
            </div>
            <div v-if="pastOfficeHours.length && isClient">
              <h3>Past Office Hours</h3>
              <ul>
                <li v-for="(past, idx) in pastOfficeHours" :key="idx">
                  {{ past.morning_start }}-{{ past.morning_end }}, {{ past.evening_start }}-{{ past.evening_end }}, {{ past.workday_start }}-{{ past.workday_end }}
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>
      <!-- Book Consultation Popup -->
      <div v-if="showBookPopup" class="modern-popup-overlay">
        <div class="modern-popup">
          <h2>Book a Consultation with a Public Attorney</h2>
          <p>Please prepare the following before sending a request:</p>
          <ol>
            <li>Valid ID</li>
            <li>Recent Paycheck or Certificate of Indigency</li>
            <li>Prepare for a short interview at the Public Attorneys' Office.</li>
          </ol>
          <div class="disclaimer">
            <strong>Disclaimer:</strong> The Public Attorneys' Office's services are all free, but they do not offer online consultations.
          </div>
          <div class="popup-actions">
            <button class="btn btn-primary" @click="proceedBookConsultation">Book Consultation</button>
            <button class="btn btn-secondary" @click="closeBookPopup">Cancel</button>
          </div>
        </div>
      </div>
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
      pastOfficeHours: [], // Store past office hours
      isEditingAvailability: false,
      days: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
      activeSection: 'officeHours',
      isClient: false, // Track if current user is a client
      showBookPopup: false // Popup for booking
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
    this.isClient = payload && payload.role === 'Client';
    if (!this.roleId) {
      alert('No role_id found in token');
      return;
    }
    await this.fetchExistingSelections();
    if (this.isClient) {
      await this.fetchPastOfficeHours();
    }
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
    },
    async fetchPastOfficeHours() {
      // Fetch past office hours for this lawyer (if API exists)
      const baseUrl = window.API_BASE_URL;
      const res = await fetch(`${baseUrl}/lawyer/${this.roleId}/past-availability`, {
        headers: { 'Authorization': 'Bearer ' + sessionStorage.getItem('jwt') }
      });
      if (res.ok) {
        this.pastOfficeHours = await res.json();
      }
    },
    openBookPopup() {
      this.showBookPopup = true;
    },
    closeBookPopup() {
      this.showBookPopup = false;
    },
    proceedBookConsultation() {
      this.showBookPopup = false;
      // Redirect to free consultation form for this lawyer
      window.location.href = `/html/client/consultation-free.html?lawyer_id=${this.roleId}&free=1`;
    }
  }
}).mount('.setup');
