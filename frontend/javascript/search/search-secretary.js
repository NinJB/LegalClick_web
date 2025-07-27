const search = Vue.createApp({
  data() {
    return {
      lawyers: [],
      searchQuery: '',
      searchField: 'Select',
      selectedSpecialization: 'Select',
      selectedCategory: 'Select',
      selectedService: 'Select',
      selectedBudget: 'Select',
      loggedInRoleId: null,
      selectedLawyer: null,
      lawyerAvailability: null,
      lawyerServices: null,
      specializations: [],
      showMismatchPopup: false,
      lawyerServicesList: [],
      roleId: '',
      showConfirmationPopup: false,
      isRequestSuccessful: false,
      requestMessage: '',
      showSuccessPopup: false,
      existingRequests: [] // To track existing attorney requests
    };
  },
  computed: {
    filteredLawyers() {
      return this.lawyers.filter(lawyer => {
        let matchesSearch = true;
        let matchesCategory = true;
        let matchesServiceAndBudget = true;

        if (this.searchQuery.trim() !== '' && this.searchField !== 'Select') {
          if (this.searchField === 'First Name') {
            matchesSearch = lawyer.first_name?.toLowerCase().includes(this.searchQuery.toLowerCase());
          } else if (this.searchField === 'Last Name') {
            matchesSearch = lawyer.last_name?.toLowerCase().includes(this.searchQuery.toLowerCase());
          }
        }

        if (this.selectedCategory !== 'Select') {
          matchesCategory = lawyer.attorney_category === this.selectedCategory;
        }

        if (this.selectedService !== 'Select' && this.selectedBudget !== 'Select') {
          const budgetRanges = {
            'Free': [0, 0],
            'P500 below': [100, 499],
            'P500 - P999': [500, 999],
            'P1000 - P4999': [1000, 4999],
            'P5000 - P9999': [5000, 9999],
            'P10000 - P30000': [10000, 30000],
            'P30000 above': [30001, Infinity]
          };

          const [minBudget, maxBudget] = budgetRanges[this.selectedBudget];

          if (this.selectedService === 'Consultation') {
            matchesServiceAndBudget = lawyer.consultation != null &&
              lawyer.consultation >= minBudget &&
              lawyer.consultation <= maxBudget;
          } else if (this.selectedService === 'Representation') {
            matchesServiceAndBudget = lawyer.representation_min != null &&
              lawyer.representation_max != null &&
              lawyer.representation_min <= maxBudget &&
              lawyer.representation_max >= minBudget;
          }
        }

        return matchesSearch && matchesCategory && matchesServiceAndBudget;
      });
    },
    isAttorneyAlreadyAdded() {
      if (!this.selectedLawyer || !this.loggedInRoleId) return false;
      return this.existingRequests.some(request => 
        request.lawyer_id == this.selectedLawyer.lawyer_id && 
        request.secretary_id == this.loggedInRoleId
      );
    }
  },
  methods: {
    fetchLawyers() {
      const baseUrl = window.API_BASE_URL;
      let url = `${baseUrl}/api/lawyers`;
      const params = new URLSearchParams();

      if (this.selectedSpecialization !== 'Select') {
        const specialization_id = this.getSpecializationId(this.selectedSpecialization);
        if (specialization_id) {
          params.append('specialization_id', specialization_id);
        }
      }

      if (params.toString()) {
        url += `?${params.toString()}`;
      }

      fetch(url, { headers: { 'Authorization': 'Bearer ' + sessionStorage.getItem('jwt') } })
        .then(res => res.json())
        .then(data => {
          this.lawyers = data;
        })
        .catch(err => console.error('Error fetching lawyers:', err));
    },
    fetchSpecializations() {
      const baseUrl = window.API_BASE_URL;
      fetch(`${baseUrl}/api/specializations`, { headers: { 'Authorization': 'Bearer ' + sessionStorage.getItem('jwt') } })
        .then(res => res.json())
        .then(data => {
          this.specializations = data;
        })
        .catch(err => console.error('Error fetching specializations:', err));
    },
    getSpecializationId(name) {
      const specialization = this.specializations.find(s => s.name === name);
      return specialization ? specialization.specialization_id : null;
    },
    getProfileImage(lawyer) {
      return lawyer.profile_picture ? lawyer.profile_picture : '/images/profile.png';
    },
    openPopup(lawyer) {
      this.selectedLawyer = lawyer;
      this.fetchLawyerDetails(lawyer.lawyer_id);
      this.checkExistingRequests();
    },
    closePopup() {
      this.selectedLawyer = null;
      this.lawyerAvailability = null;
      this.lawyerServices = null;
    },
    fetchLawyerDetails(lawyer_id) {
      const baseUrl = window.API_BASE_URL;
      fetch(`${baseUrl}/api/lawyer-details/${lawyer_id}`, { headers: { 'Authorization': 'Bearer ' + sessionStorage.getItem('jwt') } })
        .then(res => res.json())
        .then(data => {
          this.lawyerAvailability = data.availability;
          this.lawyerServices = data.services;

          if (data.profile) {
            this.selectedLawyer = {
              ...this.selectedLawyer,
              law_school: data.profile.law_school,
              bar_admission_year: data.profile.bar_admission_year,
              office_address: data.profile.office_address,
              email: data.profile.email,
              contact_number: data.profile.contact_number
            };
          }
        })
        .catch(err => console.error('Error fetching lawyer details:', err));
    },
    checkExistingRequests() {
      if (!this.loggedInRoleId) return;
      
      const baseUrl = window.API_BASE_URL;
      fetch(`${baseUrl}/api/check-secretary-lawyers?role_id=${this.loggedInRoleId}`, { headers: { 'Authorization': 'Bearer ' + sessionStorage.getItem('jwt') } })
        .then(res => res.json())
        .then(data => {
          this.existingRequests = data;
        })
        .catch(err => console.error('Error fetching existing requests:', err));
    },
    goToBookingForm() {
      if (!this.selectedLawyer) {
        alert('No lawyer selected. Please click on a lawyer card first.');
        return;
      }

      if (!this.loggedInRoleId) {
        alert('Client not logged in. Please make sure you are logged in.');
        return;
      }

      const lawyerId = this.selectedLawyer.lawyer_id;
      // Use only lawyerId, not clientId in URL
      const bookingUrl = `/html/client/form.html?lawyer_id=${lawyerId}`;
      window.location.href = bookingUrl;
    },
    fetchLawyerServicesList() {
      const baseUrl = window.API_BASE_URL;
      fetch(`${baseUrl}/api/lawyer-services`, { headers: { 'Authorization': 'Bearer ' + sessionStorage.getItem('jwt') } })
      .then(res => res.json())
      .then(data => {
        this.lawyerServicesList = data;

        const isLawyer = this.lawyerServicesList.some(service => service.lawyer_id == this.loggedInRoleId);
        if (!isLawyer && this.loggedInRoleId !== null) {
          this.showMismatchPopup = true;
        }
      })
      .catch(err => console.error('Error fetching lawyer services:', err));
    },
    closeMismatchPopup() {
      this.showMismatchPopup = false;
    },
    showAddAttorneyConfirmation() {
      if (this.isAttorneyAlreadyAdded) return;
      this.showConfirmationPopup = true;
    },
    closeConfirmationPopup() {
      this.showConfirmationPopup = false;
      this.isRequestSuccessful = false;
      this.requestMessage = '';
    },
    closeSuccessPopup() {
      this.showSuccessPopup = false;
      this.closePopup();
    },
    confirmAddAttorney() {
      if (!this.selectedLawyer || !this.loggedInRoleId) {
        this.requestMessage = 'Error: Missing required information';
        return;
      }

      const requestData = {
        secretary_id: this.loggedInRoleId,
        lawyer_id: this.selectedLawyer.lawyer_id,
        work_status: 'Pending'
      };

      const baseUrl = window.API_BASE_URL;
      fetch(`${baseUrl}/api/secretary-lawyers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + sessionStorage.getItem('jwt')
        },
        body: JSON.stringify(requestData)
      })
      .then(response => {
        if (!response.ok) {
          throw new Error('Network response was not ok');
        }
        return response.json();
      })
      .then(data => {
        this.isRequestSuccessful = true;
        this.requestMessage = 'Request sent successfully!';
        this.showConfirmationPopup = false;
        this.showSuccessPopup = true;
        this.checkExistingRequests(); // Refresh the existing requests
      })
      .catch(error => {
        this.isRequestSuccessful = false;
        this.requestMessage = 'Error sending request: ' + error.message;
        console.error('Error:', error);
      });
    }
  },
  watch: {
    selectedSpecialization() {
      this.fetchLawyers();
    }
  },
  mounted() {
    // Decode JWT from sessionStorage
    const token = sessionStorage.getItem('jwt');
    if (!token) {
      this.loggedInRoleId = null;
    } else {
      const payload = window.decodeJWT ? window.decodeJWT(token) : JSON.parse(atob(token.split('.')[1]));
      this.loggedInRoleId = payload && payload.role_id;
    }
    this.fetchSpecializations();
    this.fetchLawyers();
    this.fetchLawyerServicesList();
    this.checkExistingRequests();
  },
  template: `
    <div class="search__container">
      <div class="search__bar">
        <label class="search__bar-label">Search:</label>
        <input v-model="searchQuery" class="search__bar-input" placeholder="Search here...">
        <select v-model="searchField" class="search__option">
          <option>Select</option>
          <option>First Name</option>
          <option>Last Name</option>
        </select>
      </div>

      <div class="search__filter">
        <div class="search__specializations">
          <label>Specialization</label>
          <select v-model="selectedSpecialization" class="search__option">
            <option>Select</option>
            <option v-for="spec in specializations" :key="spec.specialization_id">
              {{ spec.name }}
            </option>
          </select>
        </div>

        <div class="search__category">
          <label>Category</label>
          <select v-model="selectedCategory" class="search__option">
            <option>Select</option>
            <option>Private</option>
            <option>Public</option>
          </select>
        </div>

        <div class="search__service">
          <label>Service</label>
          <select v-model="selectedService" class="search__option">
            <option>Select</option>
            <option>Consultation</option>
            <option>Representation</option>
          </select>
        </div>

        <div class="search__budget">
          <label>Budget</label>
          <select v-model="selectedBudget" class="search__option">
            <option>Select</option>
            <option>Free</option>
            <option>P500 below</option>
            <option>P500 - P999</option>
            <option>P1000 - P4999</option>
            <option>P5000 - P9999</option>
            <option>P10000 - P30000</option>
            <option>P30000 above</option>
          </select>
        </div>
      </div>
    </div>

    <div class="lawyer-cards-wrapper">
      <div class="lawyer-cards">
        <div v-for="lawyer in filteredLawyers" :key="lawyer.lawyer_id" class="lawyer-card" @click="openPopup(lawyer)">
          <img :src="getProfileImage(lawyer)" class="lawyer-card-img" />
          <div class="lawyer-card-details">
            <p><strong>Roll No.</strong> {{ lawyer.roll_number }}</p>
            <p><strong>Atty.</strong> {{ lawyer.first_name }} {{ lawyer.last_name }}</p>
            <p><strong>Category:</strong> {{ lawyer.attorney_category }}</p>
          </div>
        </div>
      </div>
    </div>

    <div v-if="selectedLawyer" class="popup-overlay" @click.self="closePopup">
      <div class="popup-content">
        <div class="popup-column">
          <img :src="getProfileImage(selectedLawyer)" class="popup-profile-img" />
          <h3>Atty. {{ selectedLawyer.first_name }} {{ selectedLawyer.last_name }} <span><img src="/images/verified.png" class="verified"></span></h3>
          <p><strong>{{ selectedLawyer.attorney_category }} Lawyer</strong></p>
          <p>Graduated at <strong>{{ selectedLawyer.law_school }}</strong></p>
          <p>Passed the bar in <strong>{{ selectedLawyer.bar_admission_year }}</strong></p>
          <p><strong>Office Address:</strong> {{ selectedLawyer.office_address }}</p>
          <p><strong>Email:</strong> {{ selectedLawyer.email }}</p>
          <p><strong>Contact Number:</strong> {{ selectedLawyer.contact_number }}</p>
        </div>

        <div class="popup-column">
          <h4 class="office-hours__part">Office Hours</h4>
          <p><strong>{{ lawyerAvailability?.workday_start || 'N/A' }} to {{ lawyerAvailability?.workday_end || 'N/A' }}</strong></p>
          <p><strong>Morning (AM):</strong> {{ lawyerAvailability?.morning_start || 'N/A' }} - {{ lawyerAvailability?.morning_end || 'N/A' }}</p>
          <p><strong>Afternoon (PM):</strong> {{ lawyerAvailability?.evening_start || 'N/A' }} - {{ lawyerAvailability?.evening_end || 'N/A' }}</p>

          <h4 class="services__part">Services</h4>
          <p><strong>Consultation:</strong> ₱{{ lawyerServices?.consultation ?? 'N/A' }} per hour</p>
          <p><strong>Representation:</strong> ₱{{ lawyerServices?.representation_min ?? 'N/A' }} - ₱{{ lawyerServices?.representation_max ?? 'N/A' }}</p>
        
        <div class="tooltip-container secretary">
            <button class="secretary_add"
                @click="showAddAttorneyConfirmation"
                :disabled="isAttorneyAlreadyAdded"
                @mouseenter="checkExistingRequests">
                Add Attorney
            </button>

            <span v-if="isAttorneyAlreadyAdded" class="tooltip-text">Attorney already added</span>
        </div>  

        </div>

        <div class="popup-column">
          <img src="/images/stars-empty.png" class="stars">
          <h4 class="reviews">Reviews</h4>
          <p>No reviews yet</p>
        </div>
      </div>
    </div>

    <!-- Confirmation Popup -->
    <div v-if="showConfirmationPopup" class="popup-overlay">
      <div class="popup-confirm">
        <div class="confirmation-popup">
          <img src="/images/popup-reminder.gif" class="reminder-popup">
          <h3>Are you sure you want to send a request as secretary to Atty. {{ selectedLawyer?.first_name }} {{ selectedLawyer?.last_name }}?</h3>
          <div v-if="!isRequestSuccessful" class="buttons-list">
            <button @click="confirmAddAttorney" class="popup-button yes-button">Yes</button>
            <button @click="closeConfirmationPopup" class="popup-button no-button">No</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Success Popup -->
    <div v-if="showSuccessPopup" class="popup-overlay">
      <div class="success-popup">
        <div class="success-content">
          <img src="/images/check-mark.png" class="check">
          <h2>{{ requestMessage }}</h2>
          <p>Proceed to 'Lawyers' to view request status.</p>
          <div class="buttons-list">
            <button @click="closeSuccessPopup" class="popup-button no-button">Skip</button>
            <a :href="'/html/secretary/lawyers.html'"><button class="popup-button yes-button">Go to Lawyers</button></a>
          </div>
        </div>
      </div>
    </div>
  `
});

search.mount('.search');