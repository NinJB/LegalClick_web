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
      selectedLawyer: null, // Holds clicked lawyer details
      lawyerAvailability: null,
      lawyerServices: null,
      specializations: [],
      reviews: [], // For lawyer reviews
      averageRating: null, // For average rating
      reviewsLoading: false // For loading state
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

        // Handle service and budget filtering
        if (this.selectedService !== 'Select' && this.selectedBudget !== 'Select') {
          // If Free budget is selected, only show public attorneys
          if (this.selectedBudget === 'Free') {
            matchesServiceAndBudget = lawyer.attorney_category === 'Public';
          } else {
            // For other budgets, apply normal filtering
            const budgetRanges = {
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
        }

        // Public attorneys always match specialization (they can handle all specializations)
        if (lawyer.attorney_category === 'Public') {
          return matchesSearch && matchesCategory && matchesServiceAndBudget;
        }
        return matchesSearch && matchesCategory && matchesServiceAndBudget;
      });
    }
  },
  methods: {
    fetchLawyers() {
        const baseUrl = window.API_BASE_URL;
        let url = `${baseUrl}/lawyers`;
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
      fetch(`${baseUrl}/specializations`, { headers: { 'Authorization': 'Bearer ' + sessionStorage.getItem('jwt') } })
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
      this.fetchLawyerReviews(lawyer.lawyer_id); // Fetch reviews when opening popup
    },
    closePopup() {
      this.selectedLawyer = null;
      this.lawyerAvailability = null;
      this.lawyerServices = null;
    },
    fetchLawyerDetails(lawyer_id) {
      const baseUrl = window.API_BASE_URL;
      fetch(`${baseUrl}/lawyer-details/${lawyer_id}`, { headers: { 'Authorization': 'Bearer ' + sessionStorage.getItem('jwt') } })
        .then(res => res.json())
        .then(data => {
          console.log(data);  // Debugging: Check the full data structure

          this.lawyerAvailability = data.availability;
          this.lawyerServices = data.services;

          // Update the selectedLawyer with additional details from the backend
          if (data.profile) {
            // Merge the details correctly from the 'profile' object
            this.selectedLawyer = {
              ...this.selectedLawyer, // Preserve existing data
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
    fetchLawyerReviews(lawyer_id) {
      this.reviewsLoading = true;
      const baseUrl = window.API_BASE_URL;
      fetch(`${baseUrl}/lawyer/${lawyer_id}/reviews`, { headers: { 'Authorization': 'Bearer ' + sessionStorage.getItem('jwt') } })
        .then(res => res.json())
        .then(data => {
          this.reviews = data.reviews || [];
          this.averageRating = data.average_rating;
        })
        .catch(err => {
          console.error('Error fetching reviews:', err);
          this.reviews = [];
          this.averageRating = null;
        })
        .finally(() => {
          this.reviewsLoading = false;
        });
    },
    formatTime(time) {
      if (!time) return 'N/A';
      const [hours, minutes] = time.split(':');
      const hour = parseInt(hours);
      const ampm = hour >= 12 ? 'PM' : 'AM';
      const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
      return `${displayHour}:${minutes} ${ampm}`;
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
      // If public attorney, go to free consultation form
      if (this.selectedLawyer.attorney_category === 'Public') {
        sessionStorage.setItem('selectedLawyerId', lawyerId);
        window.location.href = `/html/client/form.html?free=1`;
        return;
      }
      sessionStorage.setItem('selectedLawyerId', lawyerId);
      window.location.href = `/html/client/form.html`;
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
    this.fetchSpecializations();  // fetch specializations first
    this.fetchLawyers();
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
              <p>Graduated at <strong>{{ selectedLawyer.law_school }}</strong></p> <!-- Ensure law_school is populated -->
              <p>Passed the bar in <strong>{{ selectedLawyer.bar_admission_year }}</strong></p> <!-- Ensure bar_admission_year is populated -->
              <p><strong>Office Address:</strong> {{ selectedLawyer.office_address }}</p> <!-- Ensure office_address is populated -->
              <p><strong>Email:</strong> {{ selectedLawyer.email }}</p> <!-- Ensure email is populated -->
              <p><strong>Contact Number:</strong> {{ selectedLawyer.contact_number }}</p> <!-- Ensure contact_number is populated -->
            </div>

            <div class="popup-column">
              <h4 class="office-hours__part">Office Hours</h4>
              <p><strong>{{ lawyerAvailability?.workday_start || 'N/A' }} to {{ lawyerAvailability?.workday_end || 'N/A' }}</strong></p>
              <p><strong>Morning:</strong> {{ formatTime(lawyerAvailability?.morning_start) }} - {{ formatTime(lawyerAvailability?.morning_end) }}</p>
              <p><strong>Afternoon:</strong> {{ formatTime(lawyerAvailability?.evening_start) }} - {{ formatTime(lawyerAvailability?.evening_end) }}</p>

              <h4 class="services__part">Services</h4>
              <template v-if="selectedLawyer.attorney_category === 'Public'">
                <p><strong>Consultation:</strong> Free</p>
                <p><strong>Representation:</strong> Free</p>
              </template>
              <template v-else>
                <p><strong>Consultation:</strong> ₱{{ lawyerServices?.consultation ?? 'N/A' }} per hour</p>
                <p><strong>Representation:</strong> ₱{{ lawyerServices?.representation_min ?? 'N/A' }} - ₱{{ lawyerServices?.representation_max ?? 'N/A' }}</p>
              </template>

              <div class="buttons__book">
                <div class="tooltip-container">
                  <button 
                    :disabled="!selectedLawyer || !lawyerServices?.consultation"
                    @click="goToBookingForm"
                  >
                    Book Appointment
                  </button>
                  <span v-if="!selectedLawyer || !lawyerServices?.consultation" class="tooltip-text">
                    Cannot book appointment
                  </span>
                </div>

                <button>Message</button>
              </div>
            </div>

            <div class="popup-column">
              <div class="overall-rating-bar" v-if="averageRating !== null">
                <span v-for="n in 5" :key="n" class="star" :class="{ filled: n <= Math.round(averageRating) }">&#9733;</span>
                <span class="overall-rating-value">{{ Math.round(averageRating) }} / 5</span>
              </div>
              <h4 class="reviews">Reviews</h4>
              <div class="reviews-container">
                <div v-if="reviewsLoading" class="review-loading">Loading reviews...</div>
                <div v-else-if="reviews.length === 0" class="review-empty">No reviews yet</div>
                <template v-else>
                  <div v-for="review in reviews" :key="review.review_id" class="review-item">
                    <div class="review-header">
                      <img src="/images/profile-logo.png" class="review-profile-img" alt="Profile" />
                      <div>
                        <div class="review-username">{{ review.username }}</div>
                        <div class="review-stars">
                          <span v-for="n in 5" :key="n" class="review-star" :class="{ filled: n <= review.rating }">&#9733;</span>
                        </div>
                      </div>
                    </div>
                    <div class="review-description">{{ review.review_description }}</div>
                  </div>
                </template>
              </div>
            </div>
          </div>
    </div>
  `
});

search.mount('.search');
