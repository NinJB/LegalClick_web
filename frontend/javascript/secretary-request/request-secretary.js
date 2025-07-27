const secretary_request = Vue.createApp({
  data() {
    return {
      requests: [],
      filteredStatus: null,
      secretaryId: null,
      showModal: false,
      selectedRequest: null
    };
  },
  computed: {
    filteredRequests() {
      if (!this.filteredStatus) return this.requests;
      return this.requests.filter(r => r.work_status === this.filteredStatus);
    }
  },
  mounted() {
    // Decode JWT from sessionStorage
    const token = sessionStorage.getItem('jwt');
    if (!token) {
      this.secretaryId = null;
    } else {
      const payload = window.decodeJWT ? window.decodeJWT(token) : JSON.parse(atob(token.split('.')[1]));
      this.secretaryId = payload && payload.role_id;
    }
    this.fetchRequests();
    document.addEventListener('keydown', this.handleEscape);
  },
  beforeUnmount() {
    document.removeEventListener('keydown', this.handleEscape);
  },
  methods: {
    async fetchRequests() {
      try {
        const baseUrl = window.API_BASE_URL;
        const response = await fetch(`${baseUrl}/api/secretary/${this.secretaryId}/requests`, {
          headers: { 'Authorization': 'Bearer ' + sessionStorage.getItem('jwt') }
        });
        const data = await response.json();
        console.log('Fetched requests:', data);
        this.requests = data;
        console.log('First request:', this.requests[0]);
      } catch (error) {
        console.error('Error fetching requests:', error);
      }
    },
    getProfilePicture(picture) {
      return picture || '/images/temporary-profile.jpg';
    },
    setFilter(status) {
      this.filteredStatus = status;
    },
    confirmRemove(request) {
      this.selectedRequest = request;
      this.showModal = true;
    },
    async removeConfirmed() {
      try {
        console.log("Selected request in removeConfirmed:", this.selectedRequest);
        const baseUrl = window.API_BASE_URL;
        const response = await fetch(`${baseUrl}/api/secretary/requests/${this.selectedRequest.work_id}`, {
          method: 'DELETE',
          headers: { 'Authorization': 'Bearer ' + sessionStorage.getItem('jwt') }
        });
        if (response.ok) {
          this.requests = this.requests.filter(req => req.work_id !== this.selectedRequest.work_id);
        } else {
          console.error('Failed to delete request');
        }
      } catch (error) {
        console.error('Error deleting request:', error);
      } finally {
        this.showModal = false;
        this.selectedRequest = null;
      }
    },
    cancelRemove() {
      this.showModal = false;
      this.selectedRequest = null;
    },
    handleEscape(event) {
      if (event.key === 'Escape' && this.showModal) {
        this.cancelRemove();
      }
    }
  },
  template: `
    <div class="requests-list">
      <h2 class="title">Lawyer List</h2>
      <div class="filters">
        <button @click="setFilter(null)">All</button>
        <button @click="setFilter('Pending')">Pending</button>
        <button @click="setFilter('Approved')">Approved</button>
        <button @click="setFilter('Rejected')">Rejected</button>
      </div>
      <div class="scroll-container">
        <ul v-if="filteredRequests.length" class="request-items">
          <li v-for="request in filteredRequests" :key="request.work_id" class="request-card">
            <img :src="getProfilePicture(request.profile_picture)" alt="Profile" class="profile-pic" />
            <div class="info">
              <h3>Atty. {{ request.first_name }} {{ request.last_name }}</h3>
              <p>Status: <strong>{{ request.work_status }}</strong></p>
            </div>
            <button @click="confirmRemove(request)" class="button remove">Remove</button>
          </li>
        </ul>

        <div v-else class="empty-state" style="text-align:center; padding: 20px;">
          <img src="/images/hammer.png" alt="Nothing to see here" class="nothing-image"/>
          <p class="nothing">Nothing to see here yet.</p>
        </div>
      </div>

      <!-- Modal -->
      <!-- Modal -->
      <div v-if="showModal" class="modal-overlay">
        <div class="modal">
          <img src="/images/delete-mark.png" class="remove-attorney">
          <h2>Are you sure you want to remove Atty. {{ selectedRequest.first_name }} {{ selectedRequest.last_name }}?</h2>
          <div class="modal-buttons">
            <button @click="removeConfirmed" class="button approve">Yes, Remove</button>
            <button @click="cancelRemove" class="button reject">Cancel</button>
          </div>
        </div>
      </div>
    </div>
  `
});

secretary_request.mount('.lawyers');
