const consultation = Vue.createApp({
  data() {
    return {
      selectedStatus: 'Pending',
      consultations: [],
      lawyersMap: {},
      selectedConsultation: null,
      clientId: null,
      loading: false,
      error: null,
      lawyerRecommendation: null,
      showRecommendationPopup: false,
      showReviewModal: false,
      reviewForm: {
        review_id: null,
        consultation_id: null,
        client_id: null,
        lawyer_id: null,
        rating: 5,
        review_description: ''
      },
      reviewLoading: false,
      reviewError: '',
      showPayModal: false,
      payProofFile: null,
      payError: '',
      payLoading: false,
    };
  },
  async mounted() {
    // Decode JWT from sessionStorage
    const token = sessionStorage.getItem('jwt');
    if (!token) {
      this.error = 'Not authenticated.';
      return;
    }
    const payload = window.decodeJWT ? window.decodeJWT(token) : JSON.parse(atob(token.split('.')[1]));
    this.clientId = payload && payload.role_id;
    if (!this.clientId) {
      this.error = 'Missing client ID in token.';
      return;
    }
    this.loading = true;
    try {
      const baseUrl = window.API_BASE_URL;
      const res = await fetch(`${baseUrl}/api/consultations?client_id=${this.clientId}`, {
        headers: { 'Authorization': 'Bearer ' + sessionStorage.getItem('jwt') }
      });
      if (!res.ok) throw new Error('Failed to load consultations');
      const consultationsData = await res.json();
      this.consultations = consultationsData;
      // Check for reviews for completed consultations
      await Promise.all(this.consultations.map(async (c) => {
        if (c.consultation_status === 'Completed') {
          try {
            const r = await fetch(`${baseUrl}/api/reviews/consultation/${c.consultation_id || c.id}/client/${this.clientId}`, {
              headers: { 'Authorization': 'Bearer ' + sessionStorage.getItem('jwt') }
            });
            c._hasReview = r.ok;
          } catch { c._hasReview = false; }
        }
      }));
      const lawyerIds = [...new Set(this.consultations.map(c => c.lawyer_id))];
      const lawyerPromises = lawyerIds.map(id => fetch(`${baseUrl}/api/lawyers/${id}`, { headers: { 'Authorization': 'Bearer ' + sessionStorage.getItem('jwt') } }));
      const lawyerResponses = await Promise.all(lawyerPromises);
      const lawyers = [];
      for (const lr of lawyerResponses) {
        if (lr.ok) lawyers.push(await lr.json());
        else lawyers.push(null);
      }
      this.lawyersMap = {};
      for (let i = 0; i < lawyerIds.length; i++) {
        const id = lawyerIds[i];
        const lawyer = lawyers[i];
        if (lawyer) this.lawyersMap[id] = lawyer;
      }
    } catch (err) {
      console.error(err);
      this.error = 'Failed to load consultation data.';
    } finally {
      this.loading = false;
    }
  },
  computed: {
    filteredConsultations() {
      // Sort by consultation_date ascending (soonest first)
      return this.consultations
        .filter(c => c.consultation_status === this.selectedStatus)
        .sort((a, b) => new Date(a.consultation_date) - new Date(b.consultation_date));
    }
  },
  methods: {
    setStatus(status) {
      this.selectedStatus = status;
      this.selectedConsultation = null;
    },
    openPopup(consult) {
      this.selectedConsultation = consult;
    },
    closePopup() {
      this.selectedConsultation = null;
    },
    async fetchLawyerRecommendation(consultationId) {
      try {
        const baseUrl = window.API_BASE_URL;
        const res = await fetch(`${baseUrl}/api/lawyer-notes-view/${consultationId}`, {
          headers: { 'Authorization': 'Bearer ' + sessionStorage.getItem('jwt') }
        });
        if (!res.ok) throw new Error('Failed to fetch recommendation');
        const data = await res.json();
        this.lawyerRecommendation = data.recommendation || 'No recommendation available.';
        this.showRecommendationPopup = true;
      } catch (error) {
        console.error('Error fetching lawyer recommendation:', error);
        this.lawyerRecommendation = 'Error fetching recommendation.';
        this.showRecommendationPopup = true;
      }
    },
    closeRecommendationPopup() {
      this.showRecommendationPopup = false;
      this.lawyerRecommendation = null;
    },
    statusColor(status) {
      switch (status) {
        case 'Pending': return 'color-blue';
        case 'Upcoming': return 'color-green';
        case 'Rejected': return 'color-red';
        case 'Unpaid': return 'color-yelloworange';
        case 'Completed': return 'color-purple';
        default: return '';
      }
    },
    formatDate(dateStr) {
      const d = new Date(dateStr);
      return d.toLocaleDateString();
    },
    async openReviewModal(consult) {
      this.reviewError = '';
      this.reviewLoading = true;
      this.reviewForm = {
        review_id: null,
        consultation_id: consult.consultation_id || consult.id,
        client_id: this.clientId,
        lawyer_id: consult.lawyer_id,
        rating: 5,
        review_description: ''
      };
      // Check if review exists
      try {
        const baseUrl = window.API_BASE_URL;
        const res = await fetch(`${baseUrl}/api/reviews/consultation/${this.reviewForm.consultation_id}/client/${this.clientId}`, {
          headers: { 'Authorization': 'Bearer ' + sessionStorage.getItem('jwt') }
        });
        if (res.ok) {
          const data = await res.json();
          this.reviewForm.review_id = data.review_id;
          this.reviewForm.rating = data.rating;
          this.reviewForm.review_description = data.review_description;
        }
      } catch (e) { /* No review yet, that's fine */ }
      this.reviewLoading = false;
      this.showReviewModal = true;
    },
    closeReviewModal() {
      this.showReviewModal = false;
    },
    async submitReview() {
      this.reviewError = '';
      if (!this.reviewForm.rating || this.reviewForm.rating < 1 || this.reviewForm.rating > 5) {
        this.reviewError = 'Rating must be between 1 and 5.';
        return;
      }
      if (!this.reviewForm.review_description.trim()) {
        this.reviewError = 'Review description is required.';
        return;
      }
      this.reviewLoading = true;
      try {
        let res;
        if (this.reviewForm.review_id) {
          // Edit existing review
          res = await fetch(`${window.API_BASE_URL}/api/reviews/${this.reviewForm.review_id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + sessionStorage.getItem('jwt') },
            body: JSON.stringify({
              rating: this.reviewForm.rating,
              review_description: this.reviewForm.review_description
            })
          });
        } else {
          // Add new review
          res = await fetch(`${window.API_BASE_URL}/api/reviews`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + sessionStorage.getItem('jwt') },
            body: JSON.stringify(this.reviewForm)
          });
        }
        if (!res.ok) {
          const err = await res.json();
          this.reviewError = err.error || 'Failed to save review.';
          return;
        }
        // Refresh review status for the consultation
        const consultId = this.reviewForm.consultation_id;
        const consult = this.consultations.find(c => (c.consultation_id || c.id) === consultId);
        if (consult) consult._hasReview = true;
        this.showReviewModal = false;
      } catch (e) {
        this.reviewError = 'Failed to save review.';
      } finally {
        this.reviewLoading = false;
      }
    },
    async hasReview(consult) {
      // Helper to check if a review exists for this consultation
      try {
        const baseUrl = window.API_BASE_URL;
        const res = await fetch(`${baseUrl}/api/reviews/consultation/${consult.consultation_id || consult.id}/client/${this.clientId}`, {
          headers: { 'Authorization': 'Bearer ' + sessionStorage.getItem('jwt') }
        });
        return res.ok;
      } catch {
        return false;
      }
    },
    openPayModal(consult) {
      this.selectedConsultation = consult;
      this.showPayModal = true;
      this.payProofFile = null;
      this.payError = '';
      this.payLoading = false;
    },
    closePayModal() {
      this.showPayModal = false;
      this.payProofFile = null;
      this.payError = '';
      this.payLoading = false;
    },
    async submitPaymentProof() {
      if (!this.payProofFile) {
        this.payError = 'Please attach a payment proof image.';
        return;
      }
      this.payLoading = true;
      this.payError = '';
      try {
        const formData = new FormData();
        formData.append('proof', this.payProofFile);
        formData.append('consultation_id', this.selectedConsultation.consultation_id);
        formData.append('client_id', this.clientId);
        formData.append('lawyer_id', this.selectedConsultation.lawyer_id);
        const baseUrl = window.API_BASE_URL;
        const res = await fetch(`${baseUrl}/api/payments/upload`, {
          method: 'POST',
          body: formData,
          headers: { 'Authorization': 'Bearer ' + sessionStorage.getItem('jwt') }
        });
        if (!res.ok) throw new Error('Failed to upload payment proof');
        // Update status locally
        this.selectedConsultation.consultation_status = 'Pending-Paid';
        const idx = this.consultations.findIndex(c => c.consultation_id === this.selectedConsultation.consultation_id);
        if (idx !== -1) this.consultations[idx].consultation_status = 'Pending-Paid';
        this.closePayModal();
        alert('Payment proof submitted!');
      } catch (err) {
        this.payError = 'Failed to upload payment proof.';
      } finally {
        this.payLoading = false;
      }
    },
    onPayProofChange(e) {
      this.payProofFile = e.target.files[0];
    },
    payFromDetails() {
      // Close details popup, then open pay modal
      const consult = this.selectedConsultation;
      this.closePopup();
      this.openPayModal(consult);
    },
  },
  template: `
    <div class="consultation__container">
      <div class="consultation__status">
        <button class="consultation__button" :class="{ active: selectedStatus === 'Pending' }" @click="setStatus('Pending')">Pending</button>
        <button class="consultation__button" :class="{ active: selectedStatus === 'Unpaid' }" @click="setStatus('Unpaid')">Unpaid</button>
        <button class="consultation__button" :class="{ active: selectedStatus === 'Upcoming' }" @click="setStatus('Upcoming')">Upcoming</button>
        <button class="consultation__button" :class="{ active: selectedStatus === 'Rejected' }" @click="setStatus('Rejected')">Rejected</button>
        <button class="consultation__button" :class="{ active: selectedStatus === 'Completed' }" @click="setStatus('Completed')">Completed</button>
      </div>

      <div v-if="loading">Loading consultations...</div>
      <div v-if="error" class="error">{{ error }}</div>
      <div v-if="!loading && filteredConsultations.length === 0" class="consultation-history">
        No consultation records yet.
      </div>

      <div v-for="consult in filteredConsultations" :key="consult.id" class="consultation-card" style="border:1px solid #ccc; margin-bottom:10px; padding:10px; border-radius:5px;">
        <div style="display: flex; align-items: center; justify-content: space-between;">
          <div @click="openPopup(consult)" style="flex: 1; cursor:pointer;">
            <strong>
              Atty. {{ lawyersMap[consult.lawyer_id]?.first_name || '' }} {{ lawyersMap[consult.lawyer_id]?.last_name || '' }}
            </strong><br>
            Date Issued: {{ formatDate(consult.created_at || consult.consultation_date) }}<br>
            <p>Status: <span :class="statusColor(consult.consultation_status)" style="font-weight:bold;">
               {{ consult.consultation_status }}
            </span></p>
          </div>
        </div>
        <div v-if="consult.consultation_status === 'Unpaid'" style="margin-top:0.5em; color:#888; font-style:italic; font-size:0.98em;">
          Click to Attach Payment Receipt
        </div>
        <template v-if="consult.consultation_status === 'Completed'">
          <button v-if="!consult._hasReview" @click="openReviewModal(consult)" class="review-btn">Add Review</button>
          <button v-else @click="openReviewModal(consult)" class="review-btn">Edit Review</button>
        </template>
      </div>

      <!-- Consultation Details Popup -->
      <div v-if="selectedConsultation" class="modal-overlay" @click.self="closePopup">
        <div class="modal-content">
          <button class="modal-close" @click="closePopup">&times;</button>
          <div class="modal-section">
            <div class="modal-section-title">Consultation Details</div>
            <div><span class="detail-label">Atty.:</span> <span class="detail-value">{{ lawyersMap[selectedConsultation.lawyer_id]?.first_name || '' }} {{ lawyersMap[selectedConsultation.lawyer_id]?.last_name || '' }}</span></div>
            <div><span class="detail-label">Category:</span> <span class="detail-value">{{ selectedConsultation.consultation_category }}</span></div>
            <div><span class="detail-label">Description:</span> <span class="detail-value">{{ selectedConsultation.consultation_description }}</span></div>
            <div><span class="detail-label">Date:</span> <span class="detail-value">{{ formatDate(selectedConsultation.consultation_date) }}</span></div>
            <div><span class="detail-label">Time:</span> <span class="detail-value">{{ selectedConsultation.consultation_time }}</span></div>
            <div><span class="detail-label">Duration:</span> <span class="detail-value">{{ selectedConsultation.consultation_duration }} hours</span></div>
            <div><span class="detail-label">Fee:</span> <span class="detail-value">₱{{ selectedConsultation.consultation_fee }}</span></div>
            <div><span class="detail-label">Mode:</span> <span class="detail-value">{{ selectedConsultation.consultation_mode }}</span></div>
            <div><span class="detail-label">Payment:</span> <span class="detail-value">{{ selectedConsultation.payment_mode }}</span></div>
            <div><span class="detail-label">Status:</span> <span class="detail-value">{{ selectedConsultation.consultation_status }}</span></div>
          </div>
          <button v-if="selectedConsultation.consultation_status === 'Unpaid'" @click="payFromDetails" class="review-modal-submit">Pay</button>
          <button v-if="selectedConsultation.consultation_status === 'Completed'" @click="fetchLawyerRecommendation(selectedConsultation.consultation_id)" class="view-recommendation-button review-modal-submit" style="margin-bottom:1em;">View Recommendation</button>
        </div>
      </div>

      <!-- Pay Modal -->
      <div v-if="showPayModal" class="modal-overlay" @click.self="closePayModal">
        <div class="modal-content">
          <button class="modal-close cancel-btn" @click="closePayModal">&times;</button>
          <h3>Upload Payment Proof</h3>
          <input type="file" accept="image/*" @change="onPayProofChange" />
          <div v-if="payError" style="color:red; margin-top:0.5em;">{{ payError }}</div>
          <button @click="submitPaymentProof" :disabled="payLoading" class="review-modal-submit">Submit</button>
        </div>
      </div>

      <!-- Recommendation Popup -->
      <div v-if="showRecommendationPopup" class="modal-overlay" @click.self="closeRecommendationPopup">
        <div class="modal-content recommendation-modal">
          <button class="modal-close" @click="closeRecommendationPopup">&times;</button>
          <div class="recommendation-title">Lawyer Recommendation</div>
          <div class="recommendation-text">{{ lawyerRecommendation }}</div>
        </div>
      </div>

      <!-- Review Modal -->
      <div v-if="showReviewModal" class="modal-overlay" @click.self="closeReviewModal">
        <div class="modal-content review-modal">
          <button class="modal-close" @click="closeReviewModal">&times;</button>
          <div class="review-modal-header">
            <img src="/images/profile-logo.png" class="review-modal-profile" alt="Profile" />
            <div>
              <div class="review-modal-username">You</div>
              <div class="review-modal-stars">
                <span v-for="n in 5" :key="n" class="review-modal-star" :class="{ filled: n <= reviewForm.rating }" @click="reviewForm.rating = n">&#9733;</span>
              </div>
            </div>
          </div>
          <label>Description:</label>
          <textarea v-model="reviewForm.review_description" rows="3"></textarea>
          <div v-if="reviewError" style="color:red; margin-bottom:0.5em;">{{ reviewError }}</div>
          <button @click="submitReview" :disabled="reviewLoading" class="review-modal-submit">{{ reviewForm.review_id ? 'Save Changes' : 'Submit Review' }}</button>
        </div>
      </div>
    </div>
  `
});

consultation.mount('.consultation');
