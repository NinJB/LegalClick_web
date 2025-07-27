const consultation = Vue.createApp({
  data() {
    return {
      selectedStatus: 'Pending',
      consultations: [],
      clientsMap: {},
      selectedConsultation: null,
      secretaryId: null,
      approvedLawyers: [],
      selectedLawyerId: null,
      loading: false,
      error: null,
      selectedLawyerId: ''
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
    this.secretaryId = payload && payload.role_id;
    if (!this.secretaryId) {
      this.error = 'Missing secretary ID in token.';
      return;
    }
    await this.fetchApprovedLawyers();
  },
  methods: {
    async fetchApprovedLawyers() {
      this.loading = true;
      try {
        const baseUrl = window.API_BASE_URL;
        const res = await fetch(`${baseUrl}/secretary-lawyers-view/${this.secretaryId}`, {
          headers: { 'Authorization': 'Bearer ' + sessionStorage.getItem('jwt') }
        });
        if (!res.ok) throw new Error('Failed to fetch lawyers.');
        const data = await res.json();

        // Filter by work_status = "Approved"
        this.approvedLawyers = data.filter(l => l.work_status === 'Approved');

        // Auto-select first lawyer
        if (this.approvedLawyers.length > 0) {
          this.selectedLawyerId = this.approvedLawyers[0].lawyer_id;
          await this.fetchConsultations();
        } else {
          this.error = 'No approved lawyers found.';
        }
      } catch (err) {
        console.error(err);
        this.error = 'Error loading approved lawyers.';
      } finally {
        this.loading = false;
      }
    },
    async fetchConsultations() {
      if (!this.selectedLawyerId) return;

      this.loading = true;
      this.error = null;
      try {
        const baseUrl = window.API_BASE_URL;
        const res = await fetch(`${baseUrl}/consultations?lawyer_id=${this.selectedLawyerId}`, {
          headers: { 'Authorization': 'Bearer ' + sessionStorage.getItem('jwt') }
        });
        if (!res.ok) throw new Error('Failed to load consultations');
        const consultationsData = await res.json();

        this.consultations = consultationsData.map(c => ({
          ...c,
          id: c.id || c.consultation_id
        }));

        const clientIds = [...new Set(this.consultations.map(c => c.client_id))];
        const clientPromises = clientIds.map(id =>
          fetch(`${baseUrl}/clients/${id}`, { headers: { 'Authorization': 'Bearer ' + sessionStorage.getItem('jwt') } }).then(r => r.ok ? r.json() : null)
        );
        const clients = await Promise.all(clientPromises);

        this.clientsMap = {};
        clientIds.forEach((id, i) => {
          if (clients[i]) this.clientsMap[id] = clients[i];
        });
      } catch (err) {
        console.error(err);
        this.error = 'Failed to load consultation data.';
      } finally {
        this.loading = false;
      }
    },
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
    async updateStatus(consultationId, newStatus) {
      const consultation = this.consultations.find(c => c.id === consultationId);
      if (!consultation) return;

      try {
        const baseUrl = window.API_BASE_URL;
        const res = await fetch(`${baseUrl}/consultations-update/${consultationId}`, {
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
  template: `
    <div class="consultation__container">
      <div>
        <label for="lawyerDropdown"><strong>Select Lawyer:</strong></label>
        <select id="lawyerDropdown" v-model="selectedLawyerId" @change="fetchConsultations">
            <option disabled value="">-- Select A Lawyer --</option>
            <option v-for="lawyer in approvedLawyers" :value="lawyer.lawyer_id">
            Atty. {{ lawyer.last_name }}
            </option>
        </select>
      </div>

      <div class="consultation__status" style="margin-top:10px;">
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

      <div
        v-for="consult in filteredConsultations"
        :key="consult.id"
        class="consultation-card"
        @click="openPopup(consult)"
        style="cursor:pointer; border:1px solid #ccc; margin-bottom:10px; padding:10px; border-radius:5px;"
      >
        <div>
          <strong>
            Client: {{ clientsMap[consult.client_id]?.first_name || '' }} {{ clientsMap[consult.client_id]?.last_name || '' }}
          </strong><br>
          Date Issued: {{ formatDate(consult.created_at || consult.consultation_date) }}<br>
          <p>Status: <span :class="statusColor(consult.consultation_status)" style="font-weight:bold;">
            {{ consult.consultation_status }}
          </span></p>
        </div>
      </div>

      <!-- Popup Modal -->
      <div v-if="selectedConsultation" class="modal-overlay" @click.self="closePopup">
        <div class="modal-content">
          <button class="modal-close" @click="closePopup">&times;</button>
          <h3>Consultation Details</h3>
          <p><strong>Client:</strong> {{ clientsMap[selectedConsultation.client_id]?.first_name || '' }} {{ clientsMap[selectedConsultation.client_id]?.last_name || '' }}</p>
          <p><strong>Age:</strong> {{ clientsMap[selectedConsultation.client_id]?.age || 'N/A' }}</p>
          <p><strong>Gender:</strong> {{ clientsMap[selectedConsultation.client_id]?.gender || 'N/A' }}</p>
          <p><strong>Address:</strong> {{ clientsMap[selectedConsultation.client_id]?.address || 'N/A' }}</p>
          <p><strong>Marital Status:</strong> {{ clientsMap[selectedConsultation.client_id]?.marital_status || 'N/A' }}</p>
          <hr>
          <p><strong>Consultation Category:</strong> {{ selectedConsultation.consultation_category }}</p>
          <p><strong>Description:</strong> {{ selectedConsultation.consultation_description }}</p>
          <p><strong>Consultation Date:</strong> {{ formatDate(selectedConsultation.consultation_date) }}</p>
          <p><strong>Consultation Time:</strong> {{ selectedConsultation.consultation_time }}</p>
          <p><strong>Duration (hours):</strong> {{ selectedConsultation.consultation_duration }}</p>
          <p><strong>Fee (₱):</strong> {{ selectedConsultation.consultation_fee }}</p>
          <p><strong>Mode:</strong> {{ selectedConsultation.consultation_mode }}</p>
          <p><strong>Payment Mode:</strong> {{ selectedConsultation.payment_mode }}</p>
          <p><strong>Consultation Status:</strong> {{ selectedConsultation.consultation_status }}</p>

          <div v-if="selectedConsultation.consultation_status === 'Pending'" style="margin-top:15px;">
            <button class="accept-btn" @click="acceptConsultation(selectedConsultation)">Accept</button>
            <button class="reject-btn" @click="rejectConsultation(selectedConsultation)">Reject</button>
          </div>
        </div>
      </div>
    </div>
  `
});

consultation.mount('.consultation');