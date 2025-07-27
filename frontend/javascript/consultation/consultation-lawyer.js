const consultation = Vue.createApp({
  data() {
    return {
      selectedStatus: 'Pending',
      consultations: [],
      clientsMap: {},
      selectedConsultation: null,
      lawyerId: null,
      loading: false,
      error: null,
      showNotePopup: false,
      noteText: '',
      recommendationText: '',
      lawyerNote: null,
      showNotesPopup: false,
      showReviewModal: false,
      reviewToShow: null,
      editMode: false,
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
    this.lawyerId = payload && payload.role_id;
    if (!this.lawyerId) {
      this.error = 'Missing lawyer ID in token.';
      return;
    }
    this.loading = true;
    try {
      const baseUrl = window.API_BASE_URL;
      const res = await fetch(`${baseUrl}/consultations?lawyer_id=${this.lawyerId}`, {
        headers: { 'Authorization': 'Bearer ' + sessionStorage.getItem('jwt') }
      });
      if (!res.ok) throw new Error('Failed to load consultations');
      const consultationsData = await res.json();
      this.consultations = consultationsData.map(c => ({ ...c, id: c.id || c.consultation_id }));
      // Check for reviews for completed consultations
      await Promise.all(this.consultations.map(async (c) => {
        if (c.consultation_status === 'Completed') {
          try {
            const r = await fetch(`${baseUrl}/api/reviews/consultation/${c.consultation_id || c.id}/client/${c.client_id}`, {
              headers: { 'Authorization': 'Bearer ' + sessionStorage.getItem('jwt') }
            });
            const data = await r.json();
            c._hasReview = data.exists;
          } catch {
            c._hasReview = false; // Network or other error, treat as no review
          }
        }
      }));
      const clientIds = [...new Set(this.consultations.map(c => c.client_id))];
      const clientPromises = clientIds.map(id =>
        fetch(`${baseUrl}/api/clients/${id}`, { headers: { 'Authorization': 'Bearer ' + sessionStorage.getItem('jwt') } }).then(r => r.ok ? r.json() : null)
      );
      const clients = await Promise.all(clientPromises);
      this.clientsMap = {};
      clientIds.forEach((id, i) => {
        if (clients[i]) this.clientsMap[id] = clients[i];
      });
    } catch (err) {
      // Only log if the main consultations fetch fails
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
    closePopup() {
      this.selectedConsultation = null;
    },
    async updateStatus(consultationId, newStatus) {
      const consultation = this.consultations.find(c => c.id === consultationId);
      if (!consultation) return;

      try {
        const baseUrl = window.API_BASE_URL;
        const res = await fetch(`${baseUrl}/api/consultations-update/${consultationId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + sessionStorage.getItem('jwt') },
          body: JSON.stringify({ consultation_status: newStatus })
        });
        if (!res.ok) throw new Error('Failed to update status');

        consultation.consultation_status = newStatus;
        if (this.selectedConsultation && this.selectedConsultation.id === consultationId) {
          this.selectedConsultation.consultation_status = newStatus;
        }

        if (['Rejected', 'Upcoming', 'Unpaid'].includes(newStatus)) {
          this.closePopup();
        }
      } catch (error) {
        alert('Error updating status: ' + error.message);
      }
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
      if (!dateStr) return '';
      const d = new Date(dateStr);
      return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
    },
    acceptConsultation(consult) {
      const paymentMode = consult.payment_mode?.toLowerCase();
      const newStatus = paymentMode === 'gcash' ? 'Unpaid' : 'Upcoming';
      this.updateStatus(consult.id, newStatus);
    },
    rejectConsultation(consult) {
      this.updateStatus(consult.id, 'Rejected');
    },
    closeNotePopup() {
      this.showNotePopup = false;
    },
    async completeConsultation() {
      const consultationId = this.selectedConsultation.id;
      try {
        const baseUrl = window.API_BASE_URL;
        const updateRes = await fetch(`${baseUrl}/api/consultations-update/${consultationId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + sessionStorage.getItem('jwt') },
          body: JSON.stringify({ consultation_status: 'Completed' })
        });
        if (!updateRes.ok) throw new Error('Failed to update consultation');

        const noteRes = await fetch(`${baseUrl}/api/lawyer-notes`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + sessionStorage.getItem('jwt') },
          body: JSON.stringify({
            consultation_id: consultationId,
            note: this.noteText,
            recommendation: this.recommendationText
          })
        });
        if (!noteRes.ok) throw new Error('Failed to save lawyer note');

        const consultation = this.consultations.find(c => c.id === consultationId);
        if (consultation) consultation.consultation_status = 'Completed';

        this.closeNotePopup();
        this.closePopup();
        this.editMode = false;
      } catch (error) {
        alert('Error completing consultation: ' + error.message);
      }
    },
    async fetchLawyerNote(consultationId) {
      try {
        const baseUrl = window.API_BASE_URL;
        const res = await fetch(`${baseUrl}/api/lawyer-notes-view/${consultationId}`, {
          headers: { 'Authorization': 'Bearer ' + sessionStorage.getItem('jwt') }
        });
        if (!res.ok) throw new Error('Failed to fetch note');
        const data = await res.json();
        this.lawyerNote = data;
      } catch (error) {
        console.error('Error fetching lawyer note:', error);
        this.lawyerNote = null;
      }
    },
    async openPopup(consult) {
      this.selectedConsultation = consult;
      if (consult.consultation_status === 'Completed') {
        await this.fetchLawyerNote(consult.id);
      } else {
        this.lawyerNote = null;
      }
    },
    openNotePopup(consultation) {
      this.selectedConsultation = consultation;
      this.showNotePopup = true;
      if (
        consultation.consultation_status === 'Completed' &&
        this.lawyerNote && (this.lawyerNote.note || this.lawyerNote.recommendation)
      ) {
        this.noteText = this.lawyerNote.note || '';
        this.recommendationText = this.lawyerNote.recommendation || '';
        this.editMode = false;
      } else {
        this.noteText = '';
        this.recommendationText = '';
        this.editMode = true;
      }
    },
    async openNotesPopup(consultation) {
      this.selectedConsultation = consultation;
      try {
        const baseUrl = window.API_BASE_URL;
        const res = await fetch(`${baseUrl}/api/lawyer-notes-view/${consultation.id}`, {
          headers: { 'Authorization': 'Bearer ' + sessionStorage.getItem('jwt') }
        });
        if (!res.ok) throw new Error('Failed to fetch notes');
        this.lawyerNote = await res.json();
      } catch (err) {
        this.lawyerNote = null;
        console.error(err);
      }
      this.showNotesPopup = true;
    },
    closeNotesPopup() {
      this.showNotesPopup = false;
      this.selectedConsultation = null;
    },
    async fetchReviewForConsultation(consultationId, clientId) {
      try {
        const baseUrl = window.API_BASE_URL;
        const res = await fetch(`${baseUrl}/api/reviews/consultation/${consultationId}/client/${clientId}`, {
          headers: { 'Authorization': 'Bearer ' + sessionStorage.getItem('jwt') }
        });
        const data = await res.json();
        if (!data.exists) {
          this.reviewToShow = null;
          this.showReviewModal = false;
          alert('No review has been submitted for this consultation yet.');
        } else {
          this.reviewToShow = data.review;
          this.showReviewModal = true;
        }
      } catch {
        this.reviewToShow = null;
      }
    },
    closeReviewModal() {
      this.showReviewModal = false;
      this.reviewToShow = null;
    }
  },
  template: `
  <div class="consultation__container">
    <!-- Status Filter -->
    <nav class="consultation__status">
      <button
        v-for="status in ['Pending', 'Unpaid', 'Upcoming', 'Rejected', 'Completed']"
        :key="status"
        class="consultation__button"
        :class="{ active: selectedStatus === status }"
        @click="setStatus(status)"
      >
        {{ status }}
      </button>
    </nav>

    <!-- Loading / Error / Empty -->
    <div v-if="loading" class="loading">Loading consultations...</div>
    <div v-else-if="error" class="error">{{ error }}</div>
    <div
      v-else-if="filteredConsultations.length === 0"
      class="consultation__empty"
    >
      No consultation records yet.
    </div>

    <!-- Consultation Cards -->
    <section
      v-for="consult in filteredConsultations"
      :key="consult.id"
      class="consultation__card"
      @click="openPopup(consult)"
    >
      <div class="consultation-card">
        <strong>
          Client:
          {{ clientsMap[consult.client_id]?.first_name || '' }}
          {{ clientsMap[consult.client_id]?.last_name || '' }}
        </strong>
        <br />
        Date Issued:
        {{ formatDate(consult.created_at || consult.consultation_date) }}
        <br />
        <p>
          Status:
          <span
            :class="['consultation__status-label', statusColor(consult.consultation_status)]"
          >
            {{ consult.consultation_status }}
          </span>
        </p>
        <button v-if="consult.consultation_status === 'Completed' && consult._hasReview" @click.stop="fetchReviewForConsultation(consult.consultation_id || consult.id, consult.client_id)" class="review-btn">View Rating</button>
      </div>
    </section>

    <!-- Popup Modal -->
    <div v-if="selectedConsultation" class="modal-overlay" @click.self="closePopup">
      <div class="modal-content">
        <button class="modal-close" @click="closePopup">&times;</button>
        <div class="modal-section">
          <div class="modal-section-title">Consultation Details</div>
          <div><span class="detail-label">Client:</span> <span class="detail-value">{{ clientsMap[selectedConsultation.client_id]?.first_name || 'N/A' }} {{ clientsMap[selectedConsultation.client_id]?.last_name || '' }}</span></div>
          <div><span class="detail-label">Age:</span> <span class="detail-value">{{ clientsMap[selectedConsultation.client_id]?.age || 'N/A' }}</span></div>
          <div><span class="detail-label">Gender:</span> <span class="detail-value">{{ clientsMap[selectedConsultation.client_id]?.gender || 'N/A' }}</span></div>
          <div><span class="detail-label">Address:</span> <span class="detail-value">{{ clientsMap[selectedConsultation.client_id]?.address || 'N/A' }}</span></div>
          <div><span class="detail-label">Marital Status:</span> <span class="detail-value">{{ clientsMap[selectedConsultation.client_id]?.marital_status || 'N/A' }}</span></div>
        </div>
        <div class="modal-section">
          <div class="modal-section-title">Consultation Info</div>
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
        <div v-if="selectedConsultation.consultation_status === 'Pending'" style="margin-top:15px;">
          <button class="accept-btn" @click="acceptConsultation(selectedConsultation)">Accept</button>
          <button class="reject-btn" @click="rejectConsultation(selectedConsultation)">Reject</button>
        </div>
        <div v-if="selectedConsultation.consultation_status === 'Upcoming'" style="margin-top:15px;">
          <button class="add-note-btn review-modal-submit" @click="openNotePopup(selectedConsultation)">Add Notes & Recommendation</button>
        </div>
        <div v-else-if="selectedConsultation.consultation_status === 'Completed' && lawyerNote && (lawyerNote.note || lawyerNote.recommendation)" style="margin-top:15px;">
          <button class="add-note-btn review-modal-submit" @click="openNotePopup(selectedConsultation)">View Notes & Recommendation</button>
        </div>
      </div>
    </div>

    <!-- Add Notes & Recommendations Popup -->
    <div v-if="showNotePopup" class="modal-overlay">
      <div class="modal-content review-modal">
        <h3 style="color:#e67e22; margin-bottom:1em;">Notes and Recommendations</h3>
        <label>Notes:</label>
        <div v-if="!editMode" class="recommendation-text" style="background:#f9f9f9; border-radius:6px; padding:0.7em 1em; margin-bottom:1em;">{{ noteText || 'No notes available.' }}</div>
        <textarea v-else v-model="noteText" placeholder="Enter notes..."></textarea>
        <label>Recommendations:</label>
        <div v-if="!editMode" class="recommendation-text" style="background:#f9f9f9; border-radius:6px; padding:0.7em 1em; margin-bottom:1em;">{{ recommendationText || 'No recommendations available.' }}</div>
        <textarea v-else v-model="recommendationText" placeholder="Enter recommendations..."></textarea>
        <div class="popup-buttons">
          <button v-if="!editMode" @click="editMode = true" class="review-modal-submit">Edit</button>
          <button v-else @click="completeConsultation" class="review-modal-submit">Save</button>
          <button @click="closeNotePopup" class="cancel-btn">Cancel</button>
        </div>
      </div>
    </div>

    <!-- View Notes Popup -->
    <div v-if="showNotesPopup" class="modal-overlay" @click.self="closeNotesPopup">
      <div class="modal-content recommendation-modal">
        <button class="modal-close" @click="closeNotesPopup">&times;</button>
        <div class="recommendation-title">Consultation Notes & Recommendation</div>
        <div v-if="lawyerNote">
          <div class="recommendation-text"><b>Note:</b> {{ lawyerNote.note || 'No notes available.' }}</div>
          <div class="recommendation-text" style="margin-top:0.7em;"><b>Recommendation:</b> {{ lawyerNote.recommendation || 'No recommendations available.' }}</div>
        </div>
        <div v-else>
          <div class="recommendation-text">No notes found for this consultation.</div>
        </div>
      </div>
    </div>

    <!-- Review Modal -->
    <div v-if="showReviewModal && reviewToShow" class="modal-overlay" @click.self="closeReviewModal">
      <div class="modal-content review-modal">
        <button class="modal-close" @click="closeReviewModal">&times;</button>
        <div class="review-modal-header">
          <img src="/images/profile-logo.png" class="review-modal-profile" alt="Profile" />
          <div>
            <div class="review-modal-username">
              {{ clientsMap[reviewToShow.client_id]?.first_name || '' }} {{ clientsMap[reviewToShow.client_id]?.last_name || '' }}
            </div>
            <div class="review-modal-stars">
              <span v-for="n in 5" :key="n" class="review-modal-star" :class="{ filled: n <= reviewToShow.rating }">&#9733;</span>
            </div>
          </div>
        </div>
        <label>Description:</label>
        <div class="review-description">{{ reviewToShow.review_description }}</div>
      </div>
    </div>

  </div>
`
});

consultation.mount('.consultation');
